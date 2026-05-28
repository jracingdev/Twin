<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\PurgeTwinDataJob;
use App\Models\AuditLog;
use App\Models\ImportBatch;
use App\Models\Message;
use App\Models\ResponseSuggestion;
use App\Models\SellerPlaybook;
use App\Models\Twin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwinController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Twin::query()->orderByDesc('created_at');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $perPage = min(max((int) $request->query('per_page', 20), 1), 50);

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'vertical' => 'nullable|string|max:64',
        ]);

        $twin = Twin::create(array_merge($data, ['status' => 'active']));

        AuditLog::record('twin.created', [
            'user_id' => $request->user()?->id,
            'resource_type' => 'twin',
            'resource_id' => $twin->id,
        ]);

        return response()->json($twin, 201);
    }

    public function show(Twin $twin): JsonResponse
    {
        return response()->json($twin->load('activeDna'));
    }

    public function stats(Twin $twin): JsonResponse
    {
        $dna = $twin->activeDna;
        $payload = $dna?->payload ?? [];

        $radar = $payload['radar'] ?? [
            ['trait' => 'Formalidade', 'value' => 50],
            ['trait' => 'Emojis', 'value' => 50],
            ['trait' => 'Empatia', 'value' => 50],
            ['trait' => 'Comercial', 'value' => 50],
            ['trait' => 'Objetividade', 'value' => 50],
            ['trait' => 'Naturalidade', 'value' => 50],
        ];

        $totalSuggestions = ResponseSuggestion::where('twin_id', $twin->id)->count();
        $accepted = ResponseSuggestion::where('twin_id', $twin->id)->where('status', 'accepted')->count();

        return response()->json([
            'twin_id' => $twin->id,
            'name' => $twin->name,
            'dna_version' => $dna?->version ?? '0.0.0',
            'similarity_score' => $payload['similarity_score'] ?? null,
            'messages_indexed' => Message::where('twin_id', $twin->id)->count(),
            'radar' => $radar,
            'intents' => $payload['intents'] ?? [],
            'suggestions' => [
                'total' => $totalSuggestions,
                'accepted' => $accepted,
                'accept_rate' => $totalSuggestions > 0
                    ? round(($accepted / $totalSuggestions) * 100, 1)
                    : null,
            ],
        ]);
    }

    public function imports(Twin $twin): JsonResponse
    {
        $batches = ImportBatch::where('twin_id', $twin->id)
            ->orderByDesc('created_at')
            ->limit(20)
            ->get(['id', 'twin_id', 'source', 'status', 'total_messages', 'processed_messages', 'created_at', 'completed_at']);

        return response()->json(['data' => $batches]);
    }

    public function playbooks(Twin $twin): JsonResponse
    {
        $playbooks = SellerPlaybook::where('twin_id', $twin->id)
            ->orderByDesc('usage_count')
            ->get();

        return response()->json(['data' => $playbooks]);
    }

    public function update(Request $request, Twin $twin): JsonResponse
    {
        $twin->update($request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'vertical' => 'nullable|string|max:64',
            'status' => 'string|max:32',
        ]));

        return response()->json($twin);
    }

    public function destroy(Twin $twin): JsonResponse
    {
        $twin->delete();

        return response()->json(null, 204);
    }

    public function purge(Request $request, Twin $twin): JsonResponse
    {
        PurgeTwinDataJob::dispatch($twin->id, tenant('id'));

        AuditLog::record('twin.purge_requested', [
            'user_id' => $request->user()?->id,
            'resource_type' => 'twin',
            'resource_id' => $twin->id,
        ]);

        return response()->json(['message' => 'Exclusão LGPD enfileirada.']);
    }
}
