<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessImportBatchJob;
use App\Models\ConsentRecord;
use App\Models\ImportBatch;
use App\Services\ImportZipExtractor;
use App\Services\PlanFeaturesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ImportController extends Controller
{
    private const SOURCES = 'whatsapp,telegram,instagram,facebook,messenger,email,json,csv,zip';

    private const CHANNELS = 'whatsapp,telegram,instagram,facebook,messenger';

    public function store(Request $request, ImportZipExtractor $zipExtractor, PlanFeaturesService $plans): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid|exists:twins,id',
            'source' => 'required|in:'.self::SOURCES,
            'channel' => 'nullable|in:'.self::CHANNELS,
            'consent_id' => 'required|integer',
            'file' => 'required|file|max:512000',
        ]);

        $consent = ConsentRecord::findOrFail($data['consent_id']);
        if ($consent->organization_id !== tenant('id')) {
            return response()->json([
                'message' => 'Consentimento não pertence a esta organização.',
            ], 403);
        }

        if (! $plans->canImport(tenant('id'))) {
            return response()->json([
                'message' => 'Limite mensal de mensagens atingido para o seu plano.',
                'code' => 'plan_messages_limit',
            ], 403);
        }

        $file = $request->file('file');
        $hash = hash_file('sha256', $file->getRealPath());
        $disk = config('twin.import_disk', 'local');
        $path = $file->store("imports/{$data['twin_id']}", $disk);

        $metadata = $this->buildChannelMetadata($data);

        if ($data['source'] === 'zip') {
            $channel = $data['channel'] ?? $metadata['channel'] ?? null;
            if (! $channel) {
                return response()->json([
                    'message' => 'Para arquivos ZIP, informe o canal (channel) da exportação.',
                ], 422);
            }
            try {
                $extracted = $zipExtractor->extract(
                    $file->getRealPath(),
                    $data['twin_id'],
                    $channel
                );
                $metadata = array_merge($metadata, $extracted, ['channel' => $channel]);
            } catch (\Throwable $e) {
                Storage::disk($disk)->delete($path);

                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $batch = ImportBatch::create([
            'twin_id' => $data['twin_id'],
            'consent_id' => $data['consent_id'],
            'source' => $data['source'],
            'status' => 'queued',
            'file_path' => $path,
            'file_hash' => $hash,
            'metadata' => $metadata ?: null,
        ]);

        ProcessImportBatchJob::dispatch($batch->id);

        return response()->json($batch, 202);
    }

    public function show(ImportBatch $import): JsonResponse
    {
        return response()->json($import);
    }

    /**
     * @param  array{source: string, channel?: string|null}  $data
     * @return array<string, mixed>
     */
    private function buildChannelMetadata(array $data): array
    {
        $channel = $data['channel'] ?? null;
        $source = $data['source'];

        if (in_array($source, ['whatsapp', 'telegram', 'instagram', 'facebook', 'messenger'], true)) {
            $channel = $channel ?? $source;
        }

        if (! $channel) {
            return [];
        }

        return [
            'channel' => $channel,
            'import_type' => 'official_export',
        ];
    }
}
