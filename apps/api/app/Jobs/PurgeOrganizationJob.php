<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;

class PurgeOrganizationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public string $organizationId) {}

    public function handle(AiEngineClient $ai): void
    {
        $org = Organization::find($this->organizationId);
        if (! $org) {
            return;
        }

        $tenantId = $org->id;

        tenancy()->initialize($org);

        try {
            foreach (Twin::pluck('id') as $twinId) {
                try {
                    $ai->purgeTenant([
                        'tenant_id' => $tenantId,
                        'twin_id' => $twinId,
                    ]);
                } catch (\Throwable $e) {
                    Log::warning('PurgeOrganizationJob: falha ao purgar twin no AI engine', [
                        'organization_id' => $tenantId,
                        'twin_id' => $twinId,
                        'error' => $e->getMessage(),
                    ]);
                }
            }

            $tenantStorage = storage_path('tenant'.$tenantId);
            if (is_dir($tenantStorage)) {
                File::deleteDirectory($tenantStorage);
            }
        } finally {
            tenancy()->end();
        }

        $org->delete();
    }
}
