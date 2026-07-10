<?php

namespace App\Jobs;

use App\Models\BehavioralDna;
use App\Models\MemoryEdge;
use App\Models\MemoryEntity;
use App\Models\ResponseSuggestion;
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
        if (! $twin) {
            return;
        }

        Storage::disk(config('twin.import_disk', 'local'))->deleteDirectory("imports/{$this->twinId}");

        ResponseSuggestion::where('twin_id', $twin->id)->delete();
        BehavioralDna::where('twin_id', $twin->id)->delete();

        $entityIds = MemoryEntity::where('twin_id', $twin->id)->pluck('id');
        if ($entityIds->isNotEmpty()) {
            MemoryEdge::where(function ($q) use ($entityIds) {
                $q->whereIn('subject_id', $entityIds)->orWhereIn('object_id', $entityIds);
            })->delete();
            MemoryEntity::where('twin_id', $twin->id)->delete();
        }

        $twin->messages()->delete();
        $twin->conversations()->delete();
        $twin->imports()->delete();
        $twin->sellerPlaybooks()->delete();
        $twin->trainingJobs()->delete();
        $twin->delete();
    }
}
