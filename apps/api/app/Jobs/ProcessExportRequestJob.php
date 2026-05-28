<?php

namespace App\Jobs;

use App\Models\ExportRequest;
use App\Models\Message;
use App\Models\Twin;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class ProcessExportRequestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $exportRequestId,
        public string $tenantId
    ) {}

    public function handle(): void
    {
        $export = ExportRequest::find($this->exportRequestId);
        if (! $export) {
            return;
        }

        $export->update(['status' => ExportRequest::STATUS_PROCESSING]);

        try {
            $payload = [
                'exported_at' => now()->toIso8601String(),
                'twins' => Twin::all(['id', 'name', 'status', 'created_at']),
                'messages_sample' => Message::orderByDesc('sent_at')->limit(500)->get([
                    'id', 'twin_id', 'conversation_id', 'body', 'role', 'sent_at',
                ]),
            ];

            $path = 'exports/'.tenant('id').'/'.$export->id.'.json';
            Storage::disk(config('twin.import_disk', 'local'))->put(
                $path,
                json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            );

            $export->update([
                'status' => ExportRequest::STATUS_READY,
                'file_path' => $path,
            ]);
        } catch (\Throwable $e) {
            $export->update(['status' => ExportRequest::STATUS_FAILED]);
            throw $e;
        }
    }
}
