<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\PurgeTwinDataJob;
use App\Models\AuditLog;
use App\Models\DnaVersion;
use App\Models\ImportBatch;
use App\Models\Message;
use App\Models\ResponseSuggestion;
use App\Models\SellerPlaybook;
use App\Models\Twin;
use App\Services\PlanFeaturesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TwinController extends Controller
{
    public function __construct(private PlanFeaturesService $plans) {}

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
        if (! $this->plans->canCreateTwin(tenant('id'))) {
            return response()->json([
                'message' => 'Limite de twins do plano atingido. Faça upgrade para criar mais.',
                'code' => 'plan_twins_limit',
            ], 403);
        }

        $data = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'vertical' => 'nullable|string|max:64',
        ]);

        if (! empty($data['seller_mode']) && ! $this->plans->canUseSellerMode(tenant('id'))) {
            return response()->json([
                'message' => 'Modo vendedor disponível apenas nos planos Pro e Business.',
                'code' => 'plan_seller_mode',
            ], 403);
        }

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

        $similarityBaseline = $payload['similarity_baseline'] ?? null;
        $similarityScore = $payload['similarity_score'] ?? null;
        if ($similarityScore === null && is_array($similarityBaseline) && isset($similarityBaseline['geral'])) {
            $geral = (float) $similarityBaseline['geral'];
            $similarityScore = $geral <= 1 ? (int) round($geral * 100) : (int) round($geral);
        }

        return response()->json([
            'twin_id' => $twin->id,
            'name' => $twin->name,
            'dna_version' => $dna?->version ?? '0.0.0',
            'similarity_score' => $similarityScore,
            'similarity_baseline' => $similarityBaseline,
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

    public function dnaEvolution(Twin $twin): JsonResponse
    {
        $versions = DnaVersion::where('twin_id', $twin->id)
            ->orderBy('created_at')
            ->get(['id', 'version', 'payload', 'change_summary', 'created_at']);

        $evolution = [];
        $previous = null;

        foreach ($versions as $version) {
            $entry = [
                'id' => $version->id,
                'version' => $version->version,
                'created_at' => $version->created_at,
                'change_summary' => $version->change_summary,
            ];

            if ($previous !== null) {
                $entry['diff'] = $this->diffDnaPayloads(
                    $previous->payload ?? [],
                    $version->payload ?? []
                );
            }

            $evolution[] = $entry;
            $previous = $version;
        }

        return response()->json([
            'twin_id' => $twin->id,
            'versions_count' => $versions->count(),
            'evolution' => $evolution,
        ]);
    }

    /**
     * @param  array<string, mixed>  $from
     * @param  array<string, mixed>  $to
     * @return array<string, mixed>
     */
    private function diffDnaPayloads(array $from, array $to): array
    {
        $diff = [
            'radar' => $this->diffRadar($from['radar'] ?? [], $to['radar'] ?? []),
            'key_fields' => $this->diffKeyFields($from, $to),
        ];

        return array_filter($diff, fn ($section) => $section !== [] && $section !== null);
    }

    /**
     * @param  array<int, array<string, mixed>>  $from
     * @param  array<int, array<string, mixed>>  $to
     * @return array<int, array<string, mixed>>
     */
    private function diffRadar(array $from, array $to): array
    {
        $fromMap = [];
        foreach ($from as $item) {
            $trait = $item['trait'] ?? null;
            if ($trait) {
                $fromMap[$trait] = $item['value'] ?? null;
            }
        }

        $changes = [];
        foreach ($to as $item) {
            $trait = $item['trait'] ?? null;
            if (! $trait) {
                continue;
            }

            $newValue = $item['value'] ?? null;
            $oldValue = $fromMap[$trait] ?? null;

            if ($oldValue !== $newValue) {
                $changes[] = [
                    'trait' => $trait,
                    'from' => $oldValue,
                    'to' => $newValue,
                    'delta' => is_numeric($newValue) && is_numeric($oldValue)
                        ? round((float) $newValue - (float) $oldValue, 2)
                        : null,
                ];
            }
        }

        return $changes;
    }

    /**
     * @param  array<string, mixed>  $from
     * @param  array<string, mixed>  $to
     * @return array<int, array<string, mixed>>
     */
    private function diffKeyFields(array $from, array $to): array
    {
        $paths = [
            'identity.nome_referencia',
            'identity.vertical',
            'identity.role',
            'communication.estilo_comunicacao',
            'communication.nivel_formalidade',
            'communication.comprimento_medio_mensagem',
            'communication.taxa_emojis',
            'behavior.tempo_medio_resposta_minutos',
            'behavior.resposta_duvidas',
            'behavior.resposta_reclamacoes',
            'commercial.perfil_vendas',
            'commercial.perfil_emocional',
            'commercial.estrategia_negociacao',
            'similarity_score',
            'similarity_baseline.geral',
        ];

        $changes = [];
        foreach ($paths as $path) {
            $oldValue = data_get($from, $path);
            $newValue = data_get($to, $path);

            if ($oldValue !== $newValue) {
                $changes[] = [
                    'field' => $path,
                    'from' => $oldValue,
                    'to' => $newValue,
                ];
            }
        }

        return $changes;
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
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'intensity' => 'integer|min:1|max:4',
            'seller_mode' => 'boolean',
            'vertical' => 'nullable|string|max:64',
            'status' => 'string|max:32',
        ]);

        if (array_key_exists('seller_mode', $data) && $data['seller_mode']
            && ! $this->plans->canUseSellerMode(tenant('id'))) {
            return response()->json([
                'message' => 'Modo vendedor disponível apenas nos planos Pro e Business.',
                'code' => 'plan_seller_mode',
            ], 403);
        }

        $twin->update($data);

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
