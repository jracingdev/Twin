<?php

namespace App\Jobs;

use App\Models\ConsentRecord;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\ExportRequest;
use App\Models\Message;
use App\Models\Organization;
use App\Models\ResponseSuggestion;
use App\Models\Twin;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;
use ZipArchive;

class ProcessExportRequestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    private const CHUNK_SIZE = 500;

    /** @var list<string> */
    private const SECRET_META_KEYS = [
        'api_key', 'apikey', 'token', 'secret', 'password', 'authorization',
        'access_token', 'refresh_token', 'bot_token', 'app_secret', 'webhook_secret',
    ];

    public function __construct(
        public int $exportRequestId,
        public string $tenantId
    ) {}

    public function handle(): void
    {
        $org = Organization::find($this->tenantId);
        if (! $org) {
            return;
        }

        tenancy()->initialize($org);

        try {
            $export = ExportRequest::find($this->exportRequestId);
            if (! $export) {
                return;
            }

            $export->update(['status' => ExportRequest::STATUS_PROCESSING]);

            try {
                $path = $this->buildExportArchive($export->id);
                $export->update([
                    'status' => ExportRequest::STATUS_READY,
                    'file_path' => $path,
                ]);
            } catch (\Throwable $e) {
                $export->update(['status' => ExportRequest::STATUS_FAILED]);
                throw $e;
            }
        } finally {
            tenancy()->end();
        }
    }

    private function buildExportArchive(int $exportId): string
    {
        $workDir = storage_path('app/tmp/exports/'.$this->tenantId.'/'.$exportId);
        File::ensureDirectoryExists($workDir);

        try {
            $counts = [
                'twins' => $this->writeJsonArray($workDir.'/twins.json', Twin::query()->orderBy('id'), [
                    'id', 'name', 'description', 'intensity', 'seller_mode', 'vertical', 'status', 'created_at', 'updated_at',
                ]),
                'contacts' => $this->writeJsonl($workDir.'/contacts.jsonl', Contact::query()->orderBy('id'), function (Contact $c) {
                    return [
                        'id' => $c->id,
                        'display_name' => $c->display_name,
                        'channel' => $c->channel,
                        'external_id' => $c->external_id,
                        'tags' => $c->tags,
                        'preferred_tone' => $c->preferred_tone,
                        'created_at' => optional($c->created_at)?->toIso8601String(),
                        'updated_at' => optional($c->updated_at)?->toIso8601String(),
                    ];
                }),
                'conversations' => $this->writeJsonl($workDir.'/conversations.jsonl', Conversation::query()->orderBy('id'), function (Conversation $c) {
                    return [
                        'id' => $c->id,
                        'twin_id' => $c->twin_id,
                        'contact_id' => $c->contact_id,
                        'channel' => $c->channel,
                        'last_message_at' => optional($c->last_message_at)?->toIso8601String(),
                        'created_at' => optional($c->created_at)?->toIso8601String(),
                        'updated_at' => optional($c->updated_at)?->toIso8601String(),
                    ];
                }),
                'messages' => $this->writeJsonl($workDir.'/messages.jsonl', Message::query()->orderBy('id'), function (Message $m) {
                    return [
                        'id' => $m->id,
                        'twin_id' => $m->twin_id,
                        'conversation_id' => $m->conversation_id,
                        'contact_id' => $m->contact_id,
                        'body' => $m->body,
                        'role' => $m->role,
                        'sent_at' => optional($m->sent_at)?->toIso8601String(),
                        'emoji_count' => $m->emoji_count,
                        'reply_latency_seconds' => $m->reply_latency_seconds,
                        'metadata' => $this->sanitizeMetadata($m->metadata),
                        'created_at' => optional($m->created_at)?->toIso8601String(),
                    ];
                }),
                'suggestions' => $this->writeJsonl($workDir.'/suggestions.jsonl', ResponseSuggestion::query()->orderBy('id'), function (ResponseSuggestion $s) {
                    return [
                        'id' => $s->id,
                        'twin_id' => $s->twin_id,
                        'contact_id' => $s->contact_id,
                        'input_text' => $s->input_text,
                        'suggested_text' => $s->suggested_text,
                        'intensity' => $s->intensity,
                        'score' => $s->score,
                        'status' => $s->status,
                        'metadata' => $this->sanitizeMetadata($s->metadata),
                        'created_at' => optional($s->created_at)?->toIso8601String(),
                        'updated_at' => optional($s->updated_at)?->toIso8601String(),
                    ];
                }),
            ];

            $consents = ConsentRecord::where('organization_id', $this->tenantId)
                ->orderBy('id')
                ->get(['id', 'organization_id', 'user_id', 'type', 'text_version', 'ip_address', 'accepted_at', 'created_at']);

            File::put($workDir.'/consents.json', json_encode(
                $consents->map(fn (ConsentRecord $c) => [
                    'id' => $c->id,
                    'organization_id' => $c->organization_id,
                    'user_id' => $c->user_id,
                    'type' => $c->type,
                    'text_version' => $c->text_version,
                    'ip_address' => $c->ip_address,
                    'accepted_at' => optional($c->accepted_at)?->toIso8601String(),
                    'created_at' => optional($c->created_at)?->toIso8601String(),
                ])->all(),
                JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE
            ));
            $counts['consents'] = $consents->count();

            File::put($workDir.'/manifest.json', json_encode([
                'exported_at' => now()->toIso8601String(),
                'organization_id' => $this->tenantId,
                'export_request_id' => $exportId,
                'format' => 'jsonl-zip',
                'counts' => $counts,
                'files' => [
                    'manifest.json',
                    'twins.json',
                    'contacts.jsonl',
                    'conversations.jsonl',
                    'messages.jsonl',
                    'suggestions.jsonl',
                    'consents.json',
                ],
            ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

            $zipLocal = $workDir.'.zip';
            $this->zipDirectory($workDir, $zipLocal);

            $disk = Storage::disk(config('twin.import_disk', 'local'));
            $remotePath = 'exports/'.$this->tenantId.'/'.$exportId.'.zip';
            $disk->put($remotePath, File::get($zipLocal));

            return $remotePath;
        } finally {
            File::deleteDirectory($workDir);
            if (is_file($workDir.'.zip')) {
                File::delete($workDir.'.zip');
            }
        }
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  list<string>  $columns
     */
    private function writeJsonArray(string $path, $query, array $columns): int
    {
        $rows = [];
        $query->select($columns)->chunkById(self::CHUNK_SIZE, function ($chunk) use (&$rows) {
            foreach ($chunk as $row) {
                $rows[] = $row->toArray();
            }
        });

        File::put($path, json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

        return count($rows);
    }

    /**
     * @param  \Illuminate\Database\Eloquent\Builder<\Illuminate\Database\Eloquent\Model>  $query
     * @param  callable(object): array<string, mixed>  $mapper
     */
    private function writeJsonl(string $path, $query, callable $mapper): int
    {
        $handle = fopen($path, 'wb');
        if ($handle === false) {
            throw new \RuntimeException("Não foi possível criar {$path}");
        }

        $count = 0;
        try {
            $query->chunkById(self::CHUNK_SIZE, function ($chunk) use ($handle, $mapper, &$count) {
                foreach ($chunk as $row) {
                    fwrite($handle, json_encode($mapper($row), JSON_UNESCAPED_UNICODE)."\n");
                    $count++;
                }
            });
        } finally {
            fclose($handle);
        }

        return $count;
    }

    private function zipDirectory(string $dir, string $zipPath): void
    {
        if (! class_exists(ZipArchive::class)) {
            throw new \RuntimeException('Extensão PHP zip é necessária para exportação LGPD.');
        }

        $zip = new ZipArchive;
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new \RuntimeException('Não foi possível criar o arquivo ZIP de exportação.');
        }

        foreach (File::files($dir) as $file) {
            $zip->addFile($file->getPathname(), $file->getFilename());
        }

        $zip->close();
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     * @return array<string, mixed>|null
     */
    private function sanitizeMetadata(?array $metadata): ?array
    {
        if ($metadata === null) {
            return null;
        }

        $clean = [];
        foreach ($metadata as $key => $value) {
            $normalized = strtolower((string) $key);
            $isSecret = false;
            foreach (self::SECRET_META_KEYS as $secretKey) {
                if ($normalized === $secretKey || str_contains($normalized, $secretKey)) {
                    $isSecret = true;
                    break;
                }
            }
            if ($isSecret) {
                continue;
            }
            $clean[$key] = is_array($value) ? $this->sanitizeMetadata($value) : $value;
        }

        return $clean;
    }
}
