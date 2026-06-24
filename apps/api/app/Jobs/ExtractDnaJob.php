<?php

namespace App\Jobs;

use App\Models\Message;
use App\Services\AiEngineClient;
use App\Services\BehavioralDnaPersister;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExtractDnaJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public string $twinId) {}

    public function handle(AiEngineClient $ai, BehavioralDnaPersister $dnaPersister): void
    {
        $messages = Message::where('twin_id', $this->twinId)
            ->where('role', 'user')
            ->orderByDesc('sent_at')
            ->limit(500)
            ->get(['body', 'role'])
            ->map(fn ($m) => ['role' => $m->role, 'body' => $m->body])
            ->values()
            ->all();

        $payload = [
            'tenant_id' => tenant('id'),
            'twin_id' => $this->twinId,
        ];

        if ($messages !== []) {
            $payload['messages'] = $messages;
        }

        // Fluxo síncrono pós-importação — não depende de Celery/Redis.
        $result = $ai->extractDna($payload);

        $dnaPersister->persist($this->twinId, $result, 'auto_extract', 'auto_extract');
    }
}
