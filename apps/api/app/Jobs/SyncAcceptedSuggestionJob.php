<?php

namespace App\Jobs;

use App\Models\ResponseSuggestion;
use App\Services\AiEngineClient;
use App\Services\MemoryEntityExtractor;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SyncAcceptedSuggestionJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $suggestionId,
        public string $tenantId,
    ) {}

    public function handle(AiEngineClient $ai, MemoryEntityExtractor $extractor): void
    {
        $suggestion = ResponseSuggestion::find($this->suggestionId);
        if (! $suggestion || $suggestion->status !== 'accepted') {
            return;
        }

        $ai->syncFeedback([
            'tenant_id' => $this->tenantId,
            'twin_id' => $suggestion->twin_id,
            'suggestion_id' => $suggestion->id,
            'input_text' => $suggestion->input_text,
            'accepted_text' => $suggestion->suggested_text,
        ]);

        $extractor->extractFromSuggestion($suggestion);
    }
}
