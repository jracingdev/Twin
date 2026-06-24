<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Jobs\ExtractDnaJob;
use App\Models\ImportBatch;
use App\Models\TrainingJob;
use App\Services\BehavioralDnaPersister;
use App\Services\ImportMessagePersister;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InternalJobCallbackController extends Controller
{
    public function complete(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'job_type' => 'required|in:import_batch,training',
            'status' => 'required|in:completed,failed',
            'tenant_id' => 'required|string',
            'twin_id' => 'required|uuid',
            'total_messages' => 'nullable|integer|min:0',
            'processed_messages' => 'nullable|integer|min:0',
            'messages' => 'nullable|array',
            'messages.*.role' => 'required_with:messages|string',
            'messages.*.body' => 'required_with:messages|string',
            'messages.*.contact' => 'nullable|string',
            'result' => 'nullable|array',
            'error' => 'nullable|string',
        ]);

        if (tenant('id') && tenant('id') !== $data['tenant_id']) {
            return response()->json(['message' => 'Tenant mismatch'], 403);
        }

        if ($data['job_type'] === 'import_batch') {
            return $this->completeImport($id, $data);
        }

        return $this->completeTraining($id, $data);
    }

    private function completeImport(string $id, array $data): JsonResponse
    {
        $batch = ImportBatch::find($id);
        if (! $batch) {
            return response()->json(['message' => 'Import batch not found'], 404);
        }

        if ($data['status'] === 'failed') {
            if ($batch->status !== 'failed') {
                $batch->update([
                    'status' => 'failed',
                    'completed_at' => now(),
                    'metadata' => array_merge($batch->metadata ?? [], [
                        'error' => $data['error'] ?? 'AI engine reported failure',
                    ]),
                ]);
            }

            return response()->json(['message' => 'Import marked failed']);
        }

        $wasCompleted = $batch->status === 'completed';

        if (! $wasCompleted && ! empty($data['messages'])) {
            $metadata = $batch->metadata ?? [];
            $channel = is_string($metadata['channel'] ?? null)
                ? $metadata['channel']
                : $batch->source;

            app(ImportMessagePersister::class)->persist(
                $batch->twin_id,
                $channel,
                $data['messages']
            );
        }

        if (! $wasCompleted) {
            $batch->update([
                'status' => 'completed',
                'total_messages' => $data['total_messages'] ?? $batch->total_messages,
                'processed_messages' => $data['processed_messages'] ?? $batch->processed_messages,
                'completed_at' => now(),
            ]);

            ExtractDnaJob::dispatch($batch->twin_id);
        }

        return response()->json(['message' => 'Import completed']);
    }

    private function completeTraining(string $id, array $data): JsonResponse
    {
        $job = TrainingJob::find($id);
        if (! $job) {
            return response()->json(['message' => 'Training job not found'], 404);
        }

        if ($data['status'] === 'failed') {
            $job->update([
                'status' => 'failed',
                'result' => ['error' => $data['error'] ?? 'Training failed'],
                'completed_at' => now(),
            ]);

            return response()->json(['message' => 'Training marked failed']);
        }

        $result = $data['result'] ?? [];

        if ($job->type === 'dna_extract' && ! empty($result['payload'])) {
            app(BehavioralDnaPersister::class)->persist(
                $job->twin_id,
                $result,
                'ai_engine_callback',
                'training_job',
            );
        }

        $job->update([
            'status' => 'completed',
            'result' => $result ?: ['status' => 'completed'],
            'completed_at' => now(),
        ]);

        return response()->json(['message' => 'Training completed']);
    }
}
