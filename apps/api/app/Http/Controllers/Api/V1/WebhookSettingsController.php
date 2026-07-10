<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Services\WebhookDispatcher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WebhookSettingsController extends Controller
{
    public function __construct(private WebhookDispatcher $webhooks) {}

    public function show(): JsonResponse
    {
        $org = Organization::findOrFail(tenant('id'));
        $data = $org->data ?? [];

        return response()->json([
            'webhook_url' => $data['webhook_url'] ?? config('services.webhook.url'),
            'webhook_events' => $data['webhook_events'] ?? ['import.completed', 'dna.updated', 'suggestion.accepted'],
            'enabled' => ! empty($data['webhook_url'] ?? config('services.webhook.url')),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'webhook_url' => 'nullable|url|max:500',
            'webhook_events' => 'nullable|array',
            'webhook_events.*' => 'string|max:64',
        ]);

        if (! empty($data['webhook_url'])) {
            try {
                $this->webhooks->assertSafeUrl($data['webhook_url']);
            } catch (\InvalidArgumentException $e) {
                return response()->json(['message' => $e->getMessage()], 422);
            }
        }

        $org = Organization::findOrFail(tenant('id'));
        $merged = array_merge($org->data ?? [], array_filter([
            'webhook_url' => $data['webhook_url'] ?? null,
            'webhook_events' => $data['webhook_events'] ?? null,
        ], fn ($v) => $v !== null));

        $org->update(['data' => $merged]);

        return response()->json([
            'webhook_url' => $merged['webhook_url'] ?? null,
            'webhook_events' => $merged['webhook_events'] ?? [],
            'message' => 'Configuração de webhook atualizada.',
        ]);
    }

    public function test(Request $request): JsonResponse
    {
        $org = Organization::findOrFail(tenant('id'));
        $url = $org->data['webhook_url'] ?? config('services.webhook.url');

        if (! $url) {
            return response()->json(['message' => 'Nenhuma URL de webhook configurada.'], 422);
        }

        try {
            $this->webhooks->assertSafeUrl($url);

            $response = \Illuminate\Support\Facades\Http::timeout(10)->post($url, [
                'event' => 'webhook.test',
                'organization_id' => $org->id,
                'timestamp' => now()->toIso8601String(),
            ]);

            return response()->json([
                'ok' => $response->successful(),
                'status' => $response->status(),
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\Throwable $e) {
            return response()->json([
                'ok' => false,
                'message' => $e->getMessage(),
            ], 502);
        }
    }
}
