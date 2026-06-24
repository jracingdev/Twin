<?php

namespace App\Services;

use App\Models\BehavioralDna;
use App\Models\DnaVersion;

class BehavioralDnaPersister
{
    public function __construct(private WebhookDispatcher $webhooks) {}

    /**
     * Persiste o resultado de extração de DNA e dispara webhook dna.updated.
     *
     * @param  array{version?: string, payload: array}  $result
     */
    public function persist(string $twinId, array $result, string $changeSummary, string $webhookSource): BehavioralDna
    {
        BehavioralDna::where('twin_id', $twinId)->update(['is_active' => false]);

        $dna = BehavioralDna::create([
            'twin_id' => $twinId,
            'version' => $result['version'] ?? '1.0.0',
            'payload' => $result['payload'],
            'is_active' => true,
        ]);

        DnaVersion::create([
            'twin_id' => $twinId,
            'version' => $dna->version,
            'payload' => $dna->payload,
            'change_summary' => $changeSummary,
        ]);

        $this->webhooks->dispatchForTenant('dna.updated', [
            'twin_id' => $twinId,
            'version' => $dna->version,
            'source' => $webhookSource,
        ]);

        return $dna;
    }
}
