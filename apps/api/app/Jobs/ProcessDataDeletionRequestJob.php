<?php

namespace App\Jobs;

use App\Models\DataDeletionRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessDataDeletionRequestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $requestId) {}

    public function handle(): void
    {
        $request = DataDeletionRequest::find($this->requestId);
        if (! $request || $request->status !== 'pending') {
            return;
        }

        $request->update(['status' => 'processing']);

        Log::info('DataDeletionRequest enfileirado para revisão administrativa', [
            'request_id' => $request->id,
            'organization_id' => $request->organization_id,
            'user_id' => $request->user_id,
        ]);

        $request->update([
            'status' => 'acknowledged',
            'processed_at' => now(),
        ]);

        PurgeOrganizationJob::dispatch($request->organization_id);
    }
}
