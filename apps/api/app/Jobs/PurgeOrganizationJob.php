<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Services\AiEngineClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

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

        tenancy()->initialize($org);

        // Purge all twins via AI engine + drop tenant database
        $org->delete();
    }
}
