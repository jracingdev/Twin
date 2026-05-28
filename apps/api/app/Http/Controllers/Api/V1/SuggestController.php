<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ResponseSuggestion;
use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SuggestController extends Controller
{
    public function __construct(private AiEngineClient $ai) {}

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid|exists:twins,id',
            'text' => 'required|string|max:10000',
            'contact_id' => 'nullable|uuid',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
        ]);

        $twin = Twin::with('activeDna')->findOrFail($data['twin_id']);
        $intensity = $data['intensity'] ?? $twin->intensity;

        $result = $this->ai->suggest([
            'tenant_id' => tenant('id'),
            'twin_id' => $twin->id,
            'text' => $data['text'],
            'contact_id' => $data['contact_id'] ?? null,
            'intensity' => $intensity,
            'seller_mode' => $data['seller_mode'] ?? $twin->seller_mode,
            'dna' => $twin->activeDna?->payload,
        ]);

        $suggestion = ResponseSuggestion::create([
            'twin_id' => $twin->id,
            'contact_id' => $data['contact_id'] ?? null,
            'input_text' => $data['text'],
            'suggested_text' => $result['suggestion'],
            'intensity' => $intensity,
            'score' => $result['score'] ?? null,
            'metadata' => $result['metadata'] ?? [],
        ]);

        return response()->json([
            'id' => $suggestion->id,
            'suggested_text' => $suggestion->suggested_text,
            'suggestion' => $suggestion->suggested_text,
            'score' => $suggestion->score,
            'status' => $suggestion->status,
        ]);
    }

    public function feedback(Request $request, ResponseSuggestion $suggestion): JsonResponse
    {
        $data = $request->validate([
            'status' => 'required|in:accepted,rejected',
        ]);

        $suggestion->update(['status' => $data['status']]);

        return response()->json($suggestion);
    }
}
