<?php

namespace App\Jobs;

use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class PurgeTwinDataJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $twinId,
        public string $tenantId,
    ) {}

    public function handle(AiEngineClient $ai): void
    {
        $ai->purgeTenant([
            'tenant_id' => $this->tenantId,
            'twin_id' => $this->twinId,
        ]);

        $twin = Twin::find($this->twinId);
        if ($twin) {
            Storage::disk(config('twin.import_disk', 'local'))->deleteDirectory("imports/{$this->twinId}");
            $twin->messages()->delete();
            $twin->imports()->delete();
            $twin->delete();
        }
    }
}
