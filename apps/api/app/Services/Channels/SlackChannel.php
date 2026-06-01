<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class SlackChannel implements ChannelInterface
{
    public function handleVerification(Request $request, array $credentials): ?Response
    {
        $payload = $request->json()->all();

        if (($payload['type'] ?? '') === 'url_verification') {
            return response()->json(['challenge' => $payload['challenge']]);
        }

        return null;
    }

    public function verifySignature(Request $request, array $credentials): bool
    {
        $secret = $credentials['signing_secret'] ?? '';
        if (! $secret) {
            return true;
        }

        $timestamp = $request->header('X-Slack-Request-Timestamp', '');
        $sig = $request->header('X-Slack-Signature', '');

        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $baseString = "v0:{$timestamp}:" . $request->getContent();
        $computed = 'v0=' . hash_hmac('sha256', $baseString, $secret);

        return hash_equals($computed, $sig);
    }

    public function normalize(array $payload, array $credentials): ?array
    {
        $event = $payload['event'] ?? null;

        if (! $event || ($event['type'] ?? '') !== 'message') {
            return null;
        }

        if (isset($event['bot_id']) || isset($event['subtype'])) {
            return null;
        }

        $text = $event['text'] ?? '';
        if ($text === '') {
            return null;
        }

        return [
            'external_id' => $event['user'],
            'display_name' => $event['user'],
            'text' => $text,
            'platform_meta' => [
                'channel' => $event['channel'],
                'thread_ts' => $event['thread_ts'] ?? $event['ts'],
                'ts' => $event['ts'],
            ],
        ];
    }

    public function send(string $text, array $credentials, array $platformMeta): void
    {
        $token = $credentials['bot_token'];

        Http::withToken($token)
            ->post('https://slack.com/api/chat.postMessage', [
                'channel' => $platformMeta['channel'],
                'text' => $text,
                'thread_ts' => $platformMeta['thread_ts'] ?? null,
            ])
            ->throw();
    }
}
