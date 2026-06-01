<?php

namespace App\Jobs;

use App\Models\Message;
use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessChannelMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;
    public int $tries = 3;

    public function __construct(
        public string $messageId,
        public string $conversationId,
        public string $twinId,
        public string $channel,
        public string $organizationId,
        public array $platformMeta
    ) {}

    public function handle(AiEngineClient $ai): void
    {
        $message = Message::findOrFail($this->messageId);
        $twin = Twin::with('activeDna')->findOrFail($this->twinId);

        $result = $ai->suggest([
            'tenant_id' => $this->organizationId,
            'twin_id' => $twin->id,
            'text' => $message->body,
            'contact_id' => $message->contact_id,
            'intensity' => $twin->intensity,
            'seller_mode' => $twin->seller_mode,
            'dna' => $twin->activeDna?->payload,
        ]);

        $reply = $result['suggestion'] ?? '';

        if ($reply === '') {
            return;
        }

        $replyMessage = Message::create([
            'twin_id' => $this->twinId,
            'conversation_id' => $this->conversationId,
            'contact_id' => $message->contact_id,
            'body' => $reply,
            'role' => 'assistant',
            'sent_at' => now(),
            'content_hash' => hash('sha256', $reply),
            'metadata' => ['channel_reply' => true, 'score' => $result['score'] ?? null],
        ]);

        SendChannelMessageJob::dispatch(
            $replyMessage->id,
            $this->channel,
            $this->organizationId,
            $this->twinId,
            $this->platformMeta
        )->onQueue('channel');
    }

    public function failed(\Throwable $e): void
    {
        Log::error('ProcessChannelMessageJob failed', [
            'message_id' => $this->messageId,
            'twin_id' => $this->twinId,
            'channel' => $this->channel,
            'error' => $e->getMessage(),
        ]);
    }
}
