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

        // Acknowledge only — admin reviews and purges within ~30 days (API contract).
        // Do NOT dispatch PurgeOrganizationJob here.
        $request->update([
            'status' => 'acknowledged',
            'processed_at' => now(),
        ]);

        Log::info('DataDeletionRequest acknowledged for admin review', [
            'request_id' => $request->id,
            'organization_id' => $request->organization_id,
            'user_id' => $request->user_id,
        ]);
    }
}
