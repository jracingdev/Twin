<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Jobs\ProcessChannelMessageJob;

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

        if ($platformMessageId && $this->isDuplicatePlatformMessage($twinId, $platformMessageId)) {
            return;
        }

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
