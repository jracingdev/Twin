<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class TelegramChannel implements ChannelInterface
{
    public function handleVerification(Request $request, array $credentials): ?Response
    {
        return null;
    }

    /**
     * Fail-closed when secret_token is configured: require matching
     * X-Telegram-Bot-Api-Secret-Token. Without secret_token: reject in
     * production; allow in local/dev with a warning (URL token still required).
     */
    public function verifySignature(Request $request, array $credentials): bool
    {
        $expected = $credentials['secret_token'] ?? '';

        if ($expected === '') {
            if (app()->environment('production')) {
                return false;
            }

            Log::warning('Telegram webhook accepted without secret_token (non-production). Configure secret_token for defense in depth.');

            return true;
        }

        $provided = $request->header('X-Telegram-Bot-Api-Secret-Token', '');

        return $provided !== '' && hash_equals($expected, $provided);
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
