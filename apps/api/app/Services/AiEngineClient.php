<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiEngineClient
{
    public function suggest(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(120)
            ->post($this->baseUrl().'/ai/respond/suggest', $payload);

        $response->throw();

        return $response->json();
    }

    public function ingestBatch(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(300)
            ->post($this->baseUrl().'/ai/ingest/batch', $payload);

        $response->throw();

        return $response->json();
    }

    public function extractDna(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(300)
            ->post($this->baseUrl().'/ai/dna/extract', $payload);

        $response->throw();

        return $response->json();
    }

    public function triggerTraining(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout((int) config('services.ai_engine.train_timeout', 30))
            ->connectTimeout(5)
            ->post($this->baseUrl().'/ai/train/trigger', $payload);

        $response->throw();

        return $response->json();
    }

    public function purgeTenant(array $payload): void
    {
        Http::withHeaders($this->headers())
            ->delete($this->baseUrl().'/ai/tenant/purge', $payload)
            ->throw();
    }

    private function baseUrl(): string
    {
        return rtrim(config('services.ai_engine.url'), '/');
    }

    private function headers(): array
    {
        return [
            'X-Internal-Secret' => config('services.ai_engine.secret'),
            'Accept' => 'application/json',
        ];
    }
}
