<?php

namespace App\Jobs;

use App\Models\ImportBatch;
use App\Models\SellerPlaybook;
use App\Models\Twin;
use App\Services\AiEngineClient;
use App\Services\ImportMessagePersister;
use App\Services\PlaybookSyncService;
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
        ImportMessagePersister $persister,
        PlaybookSyncService $playbookSync
    ): void {
        $batch = ImportBatch::findOrFail($this->batchId);
        $batch->update(['status' => 'processing', 'started_at' => now()]);

        try {
            $disk = config('twin.import_disk', 'local');
            $content = Storage::disk($disk)->get($batch->file_path);

            $metadata = $batch->metadata ?? [];
            $channel = $metadata['channel'] ?? $batch->source;
            $ownerName = $metadata['owner_name'] ?? null;

            $ingestPayload = [
                'tenant_id' => tenant('id'),
                'twin_id' => $batch->twin_id,
                'batch_id' => $batch->id,
                'source' => $batch->source,
                'channel' => is_string($channel) ? $channel : null,
                'content' => base64_encode($content),
            ];
            if (is_string($ownerName) && trim($ownerName) !== '') {
                $ingestPayload['owner_name'] = trim($ownerName);
            }

            $result = $ai->ingestBatch($ingestPayload);

            $persistChannel = is_string($channel) ? $channel : $batch->source;

            if (! empty($result['messages']) && is_array($result['messages'])) {
                $persister->persist($batch->twin_id, $persistChannel, $result['messages']);
            }

            $this->persistPlaybooks($batch->twin_id, $result['playbooks'] ?? [], $playbookSync);

            if ($batch->status !== 'completed') {
                $batch->update([
                    'status' => 'completed',
                    'total_messages' => $result['total_messages'] ?? 0,
                    'processed_messages' => $result['processed_messages'] ?? 0,
                    'metadata' => array_merge($metadata, array_filter([
                        'channels' => $result['channels'] ?? [$persistChannel],
                        'seller_messages' => $result['seller_messages'] ?? null,
                        'contact_messages' => $result['contact_messages'] ?? null,
                        'warning' => $result['warning'] ?? null,
                    ], fn ($v) => $v !== null)),
                    'completed_at' => now(),
                ]);

                ExtractDnaJob::dispatch($batch->twin_id);

                $webhooks->dispatchForTenant('import.completed', [
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
        }
    }

    /**
     * @param  list<array{intent?: string, template?: string, vertical?: string, variables?: array}>  $playbooks
     */
    private function persistPlaybooks(string $twinId, array $playbooks, PlaybookSyncService $playbookSync): void
    {
        if ($playbooks === []) {
            return;
        }

        $created = 0;
        foreach ($playbooks as $pb) {
            $template = trim((string) ($pb['template'] ?? ''));
            $intent = trim((string) ($pb['intent'] ?? 'general'));
            if ($template === '') {
                continue;
            }

            $exists = SellerPlaybook::where('twin_id', $twinId)
                ->where('intent', $intent)
                ->where('template', $template)
                ->exists();

            if ($exists) {
                continue;
            }

            SellerPlaybook::create([
                'twin_id' => $twinId,
                'intent' => $intent,
                'vertical' => (string) ($pb['vertical'] ?? 'general'),
                'template' => $template,
                'variables' => $pb['variables'] ?? [],
            ]);
            $created++;
        }

        if ($created > 0) {
            $twin = Twin::find($twinId);
            if ($twin) {
                $playbookSync->syncForTwin($twin);
            }
        }
    }
}
