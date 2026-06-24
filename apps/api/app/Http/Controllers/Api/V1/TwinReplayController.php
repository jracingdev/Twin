<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Twin;
use App\Services\AiEngineClient;
use App\Services\PlanFeaturesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwinReplayController extends Controller
{
    public function __construct(
        private AiEngineClient $ai,
        private PlanFeaturesService $plans,
    ) {}

    public function replay(Request $request, Twin $twin): JsonResponse
    {
        $data = $request->validate([
            'input_text' => 'required|string|max:10000',
            'contact_id' => 'nullable|uuid',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'confidence_threshold' => 'nullable|numeric|min:0|max:1',
        ]);

        $twin->load('activeDna');
        $intensity = $data['intensity'] ?? $twin->intensity;
        $sellerMode = $data['seller_mode'] ?? $twin->seller_mode;

        if ($sellerMode && ! $this->plans->canUseSellerMode(tenant('id'))) {
            return response()->json([
                'message' => 'Modo vendedor disponível apenas nos planos Pro e Business.',
                'code' => 'plan_seller_mode',
            ], 403);
        }

        $payload = [
            'tenant_id' => tenant('id'),
            'twin_id' => $twin->id,
            'input' => $data['input_text'],
            'contact_id' => $data['contact_id'] ?? null,
            'intensity' => $intensity,
            'seller_mode' => $sellerMode,
            'dna' => $twin->activeDna?->payload,
        ];

        if (isset($data['confidence_threshold'])) {
            $payload['confidence_threshold'] = (float) $data['confidence_threshold'];
        }

        $result = $this->ai->replaySimulate($payload);

        $scoreBreakdown = $result['score_breakdown']
            ?? $result['similarity']
            ?? ($result['metadata']['score_breakdown'] ?? null)
            ?? ($result['metadata']['similarity_breakdown'] ?? null);

        $similarity = $result['confidence'] ?? $result['score'] ?? null;

        return response()->json([
            'twin_id' => $twin->id,
            'input_text' => $data['input_text'],
            'suggestion' => $result['suggestion'] ?? null,
            'similarity' => $similarity,
            'score_breakdown' => $scoreBreakdown,
            'replay' => true,
            'metadata' => $result['metadata'] ?? [],
        ]);
    }
}
