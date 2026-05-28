<?php

namespace App\Services;

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
}
