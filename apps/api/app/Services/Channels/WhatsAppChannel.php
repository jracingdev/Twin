<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

class WhatsAppChannel implements ChannelInterface
{
    public function handleVerification(Request $request, array $credentials): ?Response
    {
        if ($request->query('hub_mode') === 'subscribe') {
            $token = $credentials['verify_token'] ?? '';

            if ($request->query('hub_verify_token') !== $token) {
                return response('Forbidden', 403);
            }

            return response($request->query('hub_challenge'), 200);
        }

        return null;
    }

    public function verifySignature(Request $request, array $credentials): bool
    {
        $secret = $credentials['app_secret'] ?? '';
        if (! $secret) {
            return false;
        }

        $sig = $request->header('X-Hub-Signature-256', '');
        $expected = 'sha256=' . hash_hmac('sha256', $request->getContent(), $secret);

        return hash_equals($expected, $sig);
    }

    public function normalize(array $payload, array $credentials): ?array
    {
        $entry = $payload['entry'][0] ?? null;
        $change = $entry['changes'][0]['value'] ?? null;

        if (! $change || empty($change['messages'])) {
            return null;
        }

        $msg = $change['messages'][0];
        if (($msg['type'] ?? '') !== 'text') {
            return null;
        }

        $contact = $change['contacts'][0] ?? [];

        return [
            'external_id' => $msg['from'],
            'display_name' => $contact['profile']['name'] ?? $msg['from'],
            'text' => $msg['text']['body'] ?? '',
            'platform_meta' => [
                'phone_number_id' => $change['metadata']['phone_number_id'],
                'message_id' => $msg['id'],
                'from' => $msg['from'],
            ],
        ];
    }

    public function send(string $text, array $credentials, array $platformMeta): void
    {
        $phoneNumberId = $credentials['phone_number_id'];
        $accessToken = $credentials['access_token'];
        $to = $platformMeta['from'];

        Http::withToken($accessToken)
            ->post("https://graph.facebook.com/v19.0/{$phoneNumberId}/messages", [
                'messaging_product' => 'whatsapp',
                'to' => $to,
                'type' => 'text',
                'text' => ['body' => $text],
            ])
            ->throw();
    }
}
