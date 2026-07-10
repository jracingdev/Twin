<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessDataDeletionRequestJob;
use App\Jobs\ProcessExportRequestJob;
use App\Models\DataDeletionRequest;
use App\Models\ExportRequest;
use App\Models\RetentionPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class LgpdController extends Controller
{
    public function retention(): JsonResponse
    {
        $policy = RetentionPolicy::first();

        if (! $policy) {
            $policy = RetentionPolicy::create([
                'days' => config('twin.default_retention_days', 365),
                'auto_purge' => false,
            ]);
        }

        return response()->json([
            'days' => $policy->days,
            'auto_purge' => $policy->auto_purge,
            'description' => "Mensagens e metadados são mantidos por {$policy->days} dias. "
                .($policy->auto_purge
                    ? 'Exclusão automática ativa após o prazo.'
                    : 'Exclusão automática desativada — use purge manual.'),
        ]);
    }

    public function requestExport(Request $request): JsonResponse
    {
        $export = ExportRequest::create([
            'user_id' => $request->user()->id,
            'status' => ExportRequest::STATUS_PENDING,
        ]);

        ProcessExportRequestJob::dispatch($export->id, tenant('id'));

        return response()->json([
            'id' => $export->id,
            'status' => $export->status,
            'message' => 'Exportação LGPD enfileirada. Atualize em alguns instantes.',
        ], 202);
    }

    public function exportStatus(Request $request, int $export): JsonResponse
    {
        $row = ExportRequest::where('user_id', $request->user()->id)->findOrFail($export);

        $downloadUrl = null;
        if ($row->status === ExportRequest::STATUS_READY && $row->file_path) {
            $downloadUrl = url('/api/v1/lgpd/exports/'.$row->id.'/download');
        }

        return response()->json([
            'id' => $row->id,
            'status' => $row->status,
            'file_path' => $row->file_path,
            'download_url' => $downloadUrl,
            'created_at' => $row->created_at,
        ]);
    }

    public function downloadExport(Request $request, int $export)
    {
        $row = ExportRequest::where('user_id', $request->user()->id)->findOrFail($export);

        if ($row->status !== ExportRequest::STATUS_READY || ! $row->file_path) {
            return response()->json(['message' => 'Exportação ainda não disponível.'], 404);
        }

        $disk = Storage::disk(config('twin.import_disk', 'local'));
        if (! $disk->exists($row->file_path)) {
            return response()->json(['message' => 'Arquivo não encontrado.'], 404);
        }

        $isZip = str_ends_with(strtolower($row->file_path), '.zip');
        $filename = 'twin-export-'.$row->id.($isZip ? '.zip' : '.json');
        $contentType = $isZip ? 'application/zip' : 'application/json';

        return response()->streamDownload(
            fn () => print ($disk->get($row->file_path)),
            $filename,
            ['Content-Type' => $contentType]
        );
    }

    public function requestAccountDeletion(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reason' => 'nullable|string|max:1000',
        ]);

        $deletion = DataDeletionRequest::create([
            'user_id' => $request->user()->id,
            'organization_id' => tenant('id'),
            'status' => 'pending',
            'reason' => $data['reason'] ?? null,
        ]);

        ProcessDataDeletionRequestJob::dispatch($deletion->id);

        return response()->json([
            'id' => $deletion->id,
            'status' => $deletion->status,
            'message' => 'Pedido de exclusão registrado. Um administrador processará em até 30 dias.',
        ], 202);
    }
}
