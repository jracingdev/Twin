<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class DiscordChannel implements ChannelInterface
{
    public function handleVerification(Request $request, array $credentials): ?Response
    {
        $payload = $request->json()->all();

        if (($payload['type'] ?? 0) === 1) {
            if (! $this->verifySignature($request, $credentials)) {
                return response('Invalid signature', 401);
            }

            return response()->json(['type' => 1]);
        }

        return null;
    }

    public function verifySignature(Request $request, array $credentials): bool
    {
        $publicKey = $credentials['public_key'] ?? '';
        if (! $publicKey) {
            return true;
        }

        $signature = $request->header('X-Signature-Ed25519', '');
        $timestamp = $request->header('X-Signature-Timestamp', '');

        if (! $signature || ! $timestamp) {
            return false;
        }

        try {
            return sodium_crypto_sign_verify_detached(
                hex2bin($signature),
                $timestamp . $request->getContent(),
                hex2bin($publicKey)
            );
        } catch (\Throwable) {
            return false;
        }
    }

    public function normalize(array $payload, array $credentials): ?array
    {
        // type 2 = APPLICATION_COMMAND, type 3 = MESSAGE_COMPONENT; we handle type 0 (MESSAGE_CREATE)
        if (($payload['type'] ?? 0) !== 0) {
            return null;
        }

        $data = $payload['d'] ?? $payload;
        $content = $data['content'] ?? '';
        $author = $data['author'] ?? [];

        if ($content === '' || ($author['bot'] ?? false)) {
            return null;
        }

        return [
            'external_id' => $author['id'] ?? '',
            'display_name' => $author['global_name'] ?? $author['username'] ?? $author['id'],
            'text' => $content,
            'platform_meta' => [
                'channel_id' => $data['channel_id'] ?? '',
                'message_id' => $data['id'] ?? '',
                'guild_id' => $data['guild_id'] ?? null,
            ],
        ];
    }

    public function send(string $text, array $credentials, array $platformMeta): void
    {
        $token = $credentials['bot_token'];
        $channelId = $platformMeta['channel_id'];

        Http::withHeaders(['Authorization' => "Bot {$token}"])
            ->post("https://discord.com/api/v10/channels/{$channelId}/messages", [
                'content' => $text,
            ])
            ->throw();
    }
}
