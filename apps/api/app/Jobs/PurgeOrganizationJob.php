<?php

namespace App\Jobs;

use App\Models\ApiKey;
use App\Models\AuditLog;
use App\Models\ChannelCredential;
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
use Illuminate\Support\Facades\Storage;

class PurgeOrganizationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    public function __construct(public string $organizationId) {}

    public function handle(AiEngineClient $ai): void
    {
        $org = Organization::find($this->organizationId);
        if (! $org) {
            return;
        }

        $tenantId = $org->id;
        $twinIds = [];

        tenancy()->initialize($org);

        try {
            $twinIds = Twin::pluck('id')->all();

            foreach ($twinIds as $twinId) {
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

            $disk = Storage::disk(config('twin.import_disk', 'local'));
            if ($disk->exists('exports/'.$tenantId)) {
                $disk->deleteDirectory('exports/'.$tenantId);
            }
            foreach ($twinIds as $twinId) {
                if ($disk->exists('imports/'.$twinId)) {
                    $disk->deleteDirectory('imports/'.$twinId);
                }
            }
        } finally {
            tenancy()->end();
        }

        // Após end(): storage_path() volta ao landlord — apaga pasta tenant sem path duplicado.
        $tenantStorage = storage_path('tenant'.$tenantId);
        if (is_dir($tenantStorage)) {
            File::deleteDirectory($tenantStorage);
        }

        // Landlord scoped (não apaga users globais — só vínculos e dados da org).
        ChannelCredential::where('organization_id', $tenantId)->delete();
        ApiKey::where('organization_id', $tenantId)->delete();
        AuditLog::where('organization_id', $tenantId)->delete();
        $org->users()->detach();

        // TenantDeleted → DeleteDatabase. Cascades landlord restantes (subscriptions, consents, etc.).
        $org->delete();

        Log::info('PurgeOrganizationJob concluído', [
            'organization_id' => $tenantId,
            'twins_purged' => count($twinIds),
        ]);
    }
}
