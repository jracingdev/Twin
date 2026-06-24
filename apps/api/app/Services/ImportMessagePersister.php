<?php

namespace App\Services;

use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Str;

class ImportMessagePersister
{
    /**
     * @param  list<array{role: string, body: string, contact?: string|null, channel?: string|null}>  $messages
     */
    public function persist(string $twinId, string $source, array $messages): int
    {
        $allowed = ['whatsapp', 'telegram', 'instagram', 'facebook', 'messenger', 'email'];
        $channel = in_array($source, $allowed, true) ? $source : 'whatsapp';
        $count = 0;

        foreach ($messages as $row) {
            $body = trim((string) ($row['body'] ?? ''));
            if ($body === '') {
                continue;
            }

            $role = in_array($row['role'] ?? '', ['user', 'contact', 'assistant'], true)
                ? $row['role']
                : 'contact';

            $contactKey = (string) ($row['contact'] ?? 'imported');
            $msgChannel = (string) ($row['channel'] ?? $channel);
            if (! in_array($msgChannel, $allowed, true)) {
                $msgChannel = $channel;
            }

            $contact = Contact::firstOrCreate(
                ['channel' => $msgChannel, 'external_id' => $contactKey],
                ['display_name' => $contactKey]
            );

            $conversation = Conversation::firstOrCreate(
                ['twin_id' => $twinId, 'contact_id' => $contact->id, 'channel' => $msgChannel],
                ['last_message_at' => now()]
            );

            $hash = hash('sha256', $role.$body.$contactKey);

            if (Message::where('content_hash', $hash)->where('twin_id', $twinId)->exists()) {
                continue;
            }

            Message::create([
                'twin_id' => $twinId,
                'conversation_id' => $conversation->id,
                'contact_id' => $contact->id,
                'body' => Str::limit($body, 8000, ''),
                'role' => $role,
                'sent_at' => now(),
                'content_hash' => $hash,
            ]);

            $conversation->update(['last_message_at' => now()]);
            $count++;
        }

        return $count;
    }
}
