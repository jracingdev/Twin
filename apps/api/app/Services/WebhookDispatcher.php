<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class WebhookDispatcher
{
    public function dispatch(string $event, array $payload, ?string $url = null): void
    {
        $url = $url ?? config('services.webhook.url');
        if (! $url) {
            return;
        }

        try {
            Http::timeout(10)->post($url, [
                'event' => $event,
                'payload' => $payload,
                'timestamp' => now()->toIso8601String(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('webhook.failed', ['event' => $event, 'error' => $e->getMessage()]);
        }
    }

    public function dispatchForTenant(string $event, array $payload): void
    {
        $orgId = tenant('id');
        if (! $orgId) {
            $this->dispatch($event, $payload);

            return;
        }

        $org = Organization::find($orgId);
        $data = $org?->data ?? [];
        $url = $data['webhook_url'] ?? config('services.webhook.url');
        $events = $data['webhook_events'] ?? ['import.completed', 'dna.updated', 'suggestion.accepted'];

        if (! $url || ! in_array($event, $events, true)) {
            return;
        }

        $this->dispatch($event, array_merge($payload, ['organization_id' => $orgId]), $url);
    }
}
