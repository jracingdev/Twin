<?php

namespace App\Jobs;

use App\Models\BehavioralDna;
use App\Models\DnaVersion;
use App\Models\Message;
use App\Services\AiEngineClient;
use App\Services\WebhookDispatcher;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ExtractDnaJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public string $twinId) {}

    public function handle(AiEngineClient $ai, WebhookDispatcher $webhooks): void
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

        $result = $ai->extractDna($payload);

        BehavioralDna::where('twin_id', $this->twinId)->update(['is_active' => false]);

        $dna = BehavioralDna::create([
            'twin_id' => $this->twinId,
            'version' => $result['version'] ?? '1.0.0',
            'payload' => $result['payload'],
            'is_active' => true,
        ]);

        DnaVersion::create([
            'twin_id' => $this->twinId,
            'version' => $dna->version,
            'payload' => $dna->payload,
            'change_summary' => 'auto_extract',
        ]);

        $webhooks->dispatchForTenant('dna.updated', [
            'twin_id' => $this->twinId,
            'version' => $dna->version,
            'source' => 'auto_extract',
        ]);
    }
}
