<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Services\AiEngineClient;
use App\Services\ImportMessagePersister;
use App\Services\WebhookDispatcher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ProcessImportBatchJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 3600;

    public function __construct(public string $batchId) {}

    public function handle(
        AiEngineClient $ai,
        WebhookDispatcher $webhooks,
        ImportMessagePersister $persister
    ): void {
        $batch = ImportBatch::findOrFail($this->batchId);
        $batch->update(['status' => 'processing', 'started_at' => now()]);

        try {
            $disk = config('twin.import_disk', 'local');
            $content = Storage::disk($disk)->get($batch->file_path);

            $metadata = $batch->metadata ?? [];
            $channel = $metadata['channel'] ?? $batch->source;

            $result = $ai->ingestBatch([
                'tenant_id' => tenant('id'),
                'twin_id' => $batch->twin_id,
                'batch_id' => $batch->id,
                'source' => $batch->source,
                'channel' => is_string($channel) ? $channel : null,
                'content' => base64_encode($content),
            ]);

            $persistChannel = is_string($channel) ? $channel : $batch->source;

            if (! empty($result['messages']) && is_array($result['messages'])) {
                $persister->persist($batch->twin_id, $persistChannel, $result['messages']);
            }

            if ($batch->fresh()->status !== 'completed') {
                $batch->update([
                    'status' => 'completed',
                    'total_messages' => $result['total_messages'] ?? 0,
                    'processed_messages' => $result['processed_messages'] ?? 0,
                    'metadata' => array_merge($metadata, [
                        'channels' => $result['channels'] ?? [$persistChannel],
                    ]),
                    'completed_at' => now(),
                ]);

                ExtractDnaJob::dispatch($batch->twin_id);

                $webhooks->dispatch('import.completed', [
                    'batch_id' => $batch->id,
                    'twin_id' => $batch->twin_id,
                    'total_messages' => $batch->total_messages,
                ]);
            }
        } catch (\Throwable $e) {
            Log::error('Import batch failed', [
                'batch_id' => $batch->id,
                'error' => $e->getMessage(),
            ]);

            $batch->update([
                'status' => 'failed',
                'completed_at' => now(),
                'metadata' => array_merge($batch->metadata ?? [], [
                    'error' => $e->getMessage(),
                ]),
            ]);

            throw $e;
        }
    }
}
