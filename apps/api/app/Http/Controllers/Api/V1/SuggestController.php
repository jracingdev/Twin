<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\SyncAcceptedSuggestionJob;
use App\Models\ResponseSuggestion;
use App\Models\Twin;
use App\Services\AiEngineClient;
use App\Services\PlanFeaturesService;
use App\Services\WebhookDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuggestController extends Controller
{
    public function __construct(
        private AiEngineClient $ai,
        private PlanFeaturesService $plans,
        private WebhookDispatcher $webhooks
    ) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid|exists:twins,id',
            'text' => 'required|string|max:10000',
            'contact_id' => 'nullable|uuid',
            'conversation_id' => 'nullable|uuid',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'confidence_threshold' => 'nullable|numeric|min:0|max:1',
        ]);

        $twin = Twin::with('activeDna')->findOrFail($data['twin_id']);
        $intensity = $data['intensity'] ?? $twin->intensity;
        $sellerMode = $data['seller_mode'] ?? $twin->seller_mode;

        if (! $this->plans->canSuggest(tenant('id'))) {
            return response()->json([
                'message' => 'Limite mensal de sugestões atingido para o seu plano.',
                'code' => 'plan_messages_limit',
            ], 403);
        }

        if ($sellerMode && ! $this->plans->canUseSellerMode(tenant('id'))) {
            return response()->json([
                'message' => 'Modo vendedor disponível apenas nos planos Pro e Business.',
                'code' => 'plan_seller_mode',
            ], 403);
        }

        $suggestPayload = [
            'tenant_id' => tenant('id'),
            'twin_id' => $twin->id,
            'text' => $data['text'],
            'contact_id' => $data['contact_id'] ?? null,
            'intensity' => $intensity,
            'seller_mode' => $sellerMode,
            'dna' => $twin->activeDna?->payload,
        ];

        if (isset($data['confidence_threshold'])) {
            $suggestPayload['confidence_threshold'] = (float) $data['confidence_threshold'];
        }

        $result = $this->ai->suggest($suggestPayload);

        $metadata = $result['metadata'] ?? [];
        if (! empty($data['conversation_id'])) {
            $metadata['conversation_id'] = $data['conversation_id'];
        }

        $scoreBreakdown = $result['score_breakdown']
            ?? $result['similarity']
            ?? $metadata['score_breakdown']
            ?? $metadata['similarity_breakdown']
            ?? null;

        $resolvedScore = $result['confidence'] ?? $result['score'] ?? null;

        $suggestion = ResponseSuggestion::create([
            'twin_id' => $twin->id,
            'contact_id' => $data['contact_id'] ?? null,
            'input_text' => $data['text'],
            'suggested_text' => $result['suggestion'],
            'intensity' => $intensity,
            'score' => $resolvedScore,
            'status' => 'pending',
            'metadata' => array_merge($metadata, array_filter([
                'score_breakdown' => $scoreBreakdown,
                'seller_mode' => $sellerMode,
            ], fn ($v) => $v !== null)),
        ]);

        return response()->json([
            'id' => $suggestion->id,
            'suggested_text' => $suggestion->suggested_text,
            'suggestion' => $suggestion->suggested_text,
            'score' => $suggestion->score,
            'confidence' => $result['confidence'] ?? $suggestion->score,
            'auto_send_recommended' => $result['auto_send_recommended'] ?? null,
            'score_breakdown' => $scoreBreakdown,
            'intensity' => $intensity,
            'seller_mode' => $sellerMode,
            'status' => $suggestion->status,
            'metadata' => $suggestion->metadata,
        ]);
    }

    public function feedback(Request $request, ResponseSuggestion $suggestion): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:accepted,rejected',
            'edited_text' => 'nullable|string|max:10000',
        ]);

        $updates = ['status' => $data['status']];
        if (! empty($data['edited_text'])) {
            $updates['suggested_text'] = $data['edited_text'];
        }

        $suggestion->update($updates);

        if ($data['status'] === 'accepted') {
            $this->webhooks->dispatchForTenant('suggestion.accepted', [
                'suggestion_id' => $suggestion->id,
                'twin_id' => $suggestion->twin_id,
                'status' => $data['status'],
            ]);

            SyncAcceptedSuggestionJob::dispatch($suggestion->id, tenant('id'));
        }

        return response()->json($suggestion);
    }
}
