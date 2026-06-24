<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class AiEngineClient
{
  public function suggest(array $payload): array
    {
        if (isset($payload['confidence_threshold'])) {
            $payload['confidence_threshold'] = (float) $payload['confidence_threshold'];
        }

        $response = Http::withHeaders($this->headers())
            ->timeout(120)
            ->post($this->baseUrl().'/ai/respond/suggest', $payload);

        $response->throw();

        return $response->json();
    }

    public function explain(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(60)
            ->post($this->baseUrl().'/ai/respond/explain', $payload);

        $response->throw();

        return $response->json();
    }

    public function compareDna(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(60)
            ->post($this->baseUrl().'/ai/dna/compare', $payload);

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

    public function syncPlaybooks(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(60)
            ->post($this->baseUrl().'/ai/playbooks/sync', $payload);

        $response->throw();

        return $response->json();
    }

    public function syncFeedback(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(60)
            ->post($this->baseUrl().'/ai/feedback/sync', $payload);

        $response->throw();

        return $response->json();
    }

    public function computeSimilarity(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(30)
            ->post($this->baseUrl().'/ai/respond/similarity', $payload);

        $response->throw();

        return $response->json();
    }

    public function batchTrain(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(300)
            ->post($this->baseUrl().'/ai/train/batch', $payload);

        $response->throw();

        return $response->json();
    }

    public function replaySimulate(array $payload): array
    {
        $response = Http::withHeaders($this->headers())
            ->timeout(120)
            ->post($this->baseUrl().'/ai/replay/simulate', $payload);

        $response->throw();

        return $response->json();
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
