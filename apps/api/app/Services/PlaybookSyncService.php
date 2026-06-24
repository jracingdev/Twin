<?php

namespace App\Services;

use App\Models\SellerPlaybook;
use App\Models\Twin;
use Illuminate\Support\Facades\Log;

class PlaybookSyncService
{
    public function __construct(private AiEngineClient $ai) {}

    public function syncForTwin(Twin $twin): void
    {
        $playbooks = SellerPlaybook::where('twin_id', $twin->id)->get();

        try {
            $this->ai->syncPlaybooks([
                'tenant_id' => tenant('id'),
                'twin_id' => $twin->id,
                'playbooks' => $playbooks->map(fn ($p) => [
                    'id' => (string) $p->id,
                    'intent' => $p->intent,
                    'template' => $p->template,
                    'vertical' => $p->vertical,
                ])->values()->all(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('playbook.sync_failed', [
                'twin_id' => $twin->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
