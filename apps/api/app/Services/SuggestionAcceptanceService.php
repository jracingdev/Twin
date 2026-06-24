<?php

namespace App\Services;

use App\Jobs\SyncAcceptedSuggestionJob;
use App\Models\ResponseSuggestion;
use App\Models\Twin;

class SuggestionAcceptanceService
{
    public function __construct(
        private AiEngineClient $ai,
        private WebhookDispatcher $webhooks,
    ) {}

    public function handleAccepted(
        ResponseSuggestion $suggestion,
        string $tenantId,
        string $webhookStatus = 'accepted',
        array $webhookExtra = [],
    ): void {
        if ($suggestion->score === null) {
            $this->fillMissingScore($suggestion, $tenantId);
        }

        $this->webhooks->dispatchForTenant('suggestion.accepted', array_merge([
            'suggestion_id' => $suggestion->id,
            'twin_id' => $suggestion->twin_id,
            'status' => $webhookStatus,
        ], $webhookExtra));

        SyncAcceptedSuggestionJob::dispatch($suggestion->id, $tenantId);
    }

    private function fillMissingScore(ResponseSuggestion $suggestion, string $tenantId): void
    {
        try {
            $twin = Twin::with('activeDna')->find($suggestion->twin_id);
            $result = $this->ai->scoreStyle([
                'tenant_id' => $tenantId,
                'twin_id' => $suggestion->twin_id,
                'text' => $suggestion->suggested_text,
                'dna' => $twin?->activeDna?->payload,
            ]);

            $score = $result['confidence'] ?? $result['score'] ?? null;
            if ($score === null) {
                return;
            }

            $breakdown = $result['similarity'] ?? $result['similarity_breakdown'] ?? null;
            $meta = $suggestion->metadata ?? [];

            $suggestion->update([
                'score' => $score,
                'metadata' => array_merge($meta, array_filter([
                    'score_breakdown' => $breakdown,
                ], fn ($v) => $v !== null)),
            ]);
        } catch (\Throwable) {
            // Score opcional — não bloqueia aceite nem sync com Pinecone
        }
    }
}
