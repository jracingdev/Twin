<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\SendChannelMessageJob;
use App\Models\Message;
use App\Models\ResponseSuggestion;
use App\Models\Twin;
use App\Services\AiEngineClient;
use App\Services\SuggestionAcceptanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuggestionController extends Controller
{
    public function __construct(
        private AiEngineClient $ai,
        private SuggestionAcceptanceService $acceptance,
    ) {}
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'nullable|uuid',
            'status' => 'nullable|in:pending,accepted,rejected,sent',
            'per_page' => 'integer|min:1|max:100',
        ]);

        $query = ResponseSuggestion::with('contact')
            ->orderByDesc('created_at');

        if (! empty($data['twin_id'])) {
            $query->where('twin_id', $data['twin_id']);
        }

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }

        $perPage = min(max((int) ($data['per_page'] ?? 20), 1), 100);

        return response()->json($query->paginate($perPage));
    }

    public function send(Request $request, ResponseSuggestion $suggestion): JsonResponse
    {
        if ($suggestion->status === 'sent') {
            return response()->json(['message' => 'Sugestão já enviada.'], 422);
        }

        $data = $request->validate([
            'text' => 'nullable|string|max:10000',
        ]);

        $text = $data['text'] ?? $suggestion->suggested_text;
        $meta = $suggestion->metadata ?? [];

        $suggestion->update([
            'suggested_text' => $text,
            'status' => 'sent',
            'metadata' => array_merge($meta, ['sent_at' => now()->toIso8601String()]),
        ]);

        if (! empty($meta['channel']) && ! empty($meta['conversation_id'])) {
            $replyMessage = Message::create([
                'twin_id' => $suggestion->twin_id,
                'conversation_id' => $meta['conversation_id'],
                'contact_id' => $suggestion->contact_id,
                'body' => $text,
                'role' => 'assistant',
                'sent_at' => now(),
                'content_hash' => hash('sha256', $text),
                'metadata' => ['channel_reply' => true, 'suggestion_id' => $suggestion->id],
            ]);

            SendChannelMessageJob::dispatch(
                $replyMessage->id,
                $meta['channel'],
                tenant('id'),
                $suggestion->twin_id,
                $meta['platform_meta'] ?? []
            )->onQueue('channel');
        }

        $this->acceptance->handleAccepted(
            $suggestion->fresh(),
            tenant('id'),
            'sent',
            ['sent_via_channel' => ! empty($meta['channel'])],
        );

        return response()->json($suggestion->fresh());
    }

    public function explain(ResponseSuggestion $suggestion): JsonResponse
    {
        $meta = $suggestion->metadata ?? [];
        $scoreBreakdown = $meta['score_breakdown'] ?? $meta['similarity_breakdown'] ?? null;

        $twin = Twin::with('activeDna')->find($suggestion->twin_id);

        try {
            $aiResult = $this->ai->explain([
                'input_text' => $suggestion->input_text,
                'suggestion_text' => $suggestion->suggested_text,
                'dna' => $twin?->activeDna?->payload,
                'similarity_breakdown' => is_array($scoreBreakdown) ? $scoreBreakdown : null,
            ]);

            return response()->json([
                'id' => $suggestion->id,
                'input_text' => $aiResult['input_text'] ?? $suggestion->input_text,
                'suggested_text' => $aiResult['suggestion_text'] ?? $suggestion->suggested_text,
                'score' => $aiResult['confidence'] ?? $suggestion->score,
                'confidence' => $aiResult['confidence'] ?? $suggestion->score,
                'intensity' => $suggestion->intensity,
                'seller_mode' => $meta['seller_mode'] ?? false,
                'metadata' => $meta,
                'score_breakdown' => $aiResult['similarity_breakdown'] ?? $scoreBreakdown,
                'factors' => $aiResult['factors'] ?? [],
                'summary' => $aiResult['summary'] ?? null,
                'dna_influence' => $aiResult['dna_influence'] ?? [],
                'context_used' => $aiResult['context_used'] ?? [],
            ]);
        } catch (\Throwable) {
            return $this->explainFromMetadata($suggestion, $meta, $scoreBreakdown);
        }
    }

    private function explainFromMetadata(
        ResponseSuggestion $suggestion,
        array $meta,
        mixed $scoreBreakdown
    ): JsonResponse {
        $labels = [
            'formalidade' => 'Formalidade',
            'tom_emocional' => 'Tom emocional',
            'vocabulario' => 'Vocabulário',
            'persuasao' => 'Persuasão',
            'geral' => 'Geral',
        ];

        $factors = [];
        if (is_array($scoreBreakdown)) {
            foreach ($scoreBreakdown as $key => $value) {
                if (! is_numeric($value)) {
                    continue;
                }
                $factors[] = [
                    'key' => $key,
                    'label' => $labels[$key] ?? $key,
                    'value' => (float) $value,
                    'explanation' => '',
                ];
            }
        }

        return response()->json([
            'id' => $suggestion->id,
            'input_text' => $suggestion->input_text,
            'suggested_text' => $suggestion->suggested_text,
            'score' => $suggestion->score,
            'intensity' => $suggestion->intensity,
            'seller_mode' => $meta['seller_mode'] ?? false,
            'metadata' => $meta,
            'score_breakdown' => $scoreBreakdown,
            'factors' => $factors,
            'summary' => $suggestion->score !== null
                ? 'Sugestão gerada com score de similaridade '.round((float) $suggestion->score * ($suggestion->score <= 1 ? 100 : 1)).'%.'
                : 'Sugestão gerada pelo motor RAG.',
        ]);
    }

    public function metrics(Request $request): JsonResponse
    {
        $twinId = $request->query('twin_id');

        $base = ResponseSuggestion::query();
        if ($twinId) {
            $base->where('twin_id', $twinId);
        }

        $total = (clone $base)->count();
        $accepted = (clone $base)->where('status', 'accepted')->count();
        $sent = (clone $base)->where('status', 'sent')->count();
        $rejected = (clone $base)->where('status', 'rejected')->count();
        $pending = (clone $base)->where('status', 'pending')->count();

        $resolved = $accepted + $sent + $rejected;

        return response()->json([
            'total' => $total,
            'pending' => $pending,
            'accepted' => $accepted,
            'sent' => $sent,
            'rejected' => $rejected,
            'accept_rate' => $resolved > 0
                ? round((($accepted + $sent) / $resolved) * 100, 1)
                : null,
        ]);
    }
}
