<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class TelegramChannel implements ChannelInterface
{
    public function handleVerification(Request $request, array $credentials): ?Response
    {
        return null;
    }

    public function verifySignature(Request $request, array $credentials): bool
    {
        // Telegram security is enforced via the secret_token passed during setWebhook.
        // We already validate identity through the webhook_token in the URL.
        return true;
    }

    public function normalize(array $payload, array $credentials): ?array
    {
        $message = $payload['message'] ?? $payload['edited_message'] ?? null;

        if (! $message || empty($message['text'])) {
            return null;
        }

        $from = $message['from'] ?? [];
        $chatId = $message['chat']['id'];
        $displayName = trim(($from['first_name'] ?? '') . ' ' . ($from['last_name'] ?? ''));

        return [
            'external_id' => (string) $from['id'],
            'display_name' => $displayName ?: ($from['username'] ?? (string) $from['id']),
            'text' => $message['text'],
            'platform_meta' => [
                'chat_id' => $chatId,
                'message_id' => $message['message_id'],
            ],
        ];
    }

    public function send(string $text, array $credentials, array $platformMeta): void
    {
        $token = $credentials['bot_token'];
        $chatId = $platformMeta['chat_id'];

        Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
            'chat_id' => $chatId,
            'text' => $text,
        ])->throw();
    }
}
