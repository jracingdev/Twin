<?php

namespace App\Services;

use App\Jobs\ProcessChannelMessageJob;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Facades\Cache;

class ChannelGatewayService
{
    /**
     * Persists the incoming message and queues the AI response pipeline.
     *
     * @param  array{external_id: string, display_name: string, text: string, platform_meta: array}  $normalized
     */
    public function handle(
        string $twinId,
        string $channel,
        array $normalized,
        string $organizationId
    ): void {
        $platformMessageId = $normalized['platform_meta']['message_id'] ?? null;
        $lock = null;

        if ($platformMessageId) {
            if ($this->isDuplicatePlatformMessage($twinId, $platformMessageId)) {
                return;
            }

            $lock = Cache::lock("channel_msg:{$twinId}:{$platformMessageId}", 30);
            if (! $lock->get()) {
                return;
            }

            if ($this->isDuplicatePlatformMessage($twinId, $platformMessageId)) {
                $lock->release();

                return;
            }
        }

        try {
            $this->persistAndQueue(
                $twinId,
                $channel,
                $normalized,
                $organizationId
            );
        } finally {
            $lock?->release();
        }
    }

    /**
     * @param  array{external_id: string, display_name: string, text: string, platform_meta: array}  $normalized
     */
    private function persistAndQueue(
        string $twinId,
        string $channel,
        array $normalized,
        string $organizationId
    ): void {
        $contact = Contact::firstOrCreate(
            ['channel' => $channel, 'external_id' => $normalized['external_id']],
            ['display_name' => $normalized['display_name']]
        );

        $conversation = Conversation::firstOrCreate(
            ['twin_id' => $twinId, 'contact_id' => $contact->id, 'channel' => $channel]
        );

        $conversation->update(['last_message_at' => now()]);

        $message = Message::create([
            'twin_id' => $twinId,
            'conversation_id' => $conversation->id,
            'contact_id' => $contact->id,
            'body' => $normalized['text'],
            'role' => 'user',
            'sent_at' => now(),
            'content_hash' => hash('sha256', $normalized['text']),
            'metadata' => ['platform_meta' => $normalized['platform_meta']],
        ]);

        ProcessChannelMessageJob::dispatch(
            $message->id,
            $conversation->id,
            $twinId,
            $channel,
            $organizationId,
            $normalized['platform_meta']
        )->onQueue('channel');
    }

    private function isDuplicatePlatformMessage(string $twinId, string $platformMessageId): bool
    {
        return Message::where('twin_id', $twinId)
            ->where('metadata->platform_meta->message_id', $platformMessageId)
            ->exists();
    }
}
