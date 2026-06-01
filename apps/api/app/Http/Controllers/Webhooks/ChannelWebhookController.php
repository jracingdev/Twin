<?php

namespace App\Http\Controllers\Webhooks;

use App\Http\Controllers\Controller;
use App\Models\ChannelCredential;
use App\Services\ChannelGatewayService;
use App\Services\Channels\DiscordChannel;
use App\Services\Channels\SlackChannel;
use App\Services\Channels\TelegramChannel;
use App\Services\Channels\WhatsAppChannel;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class ChannelWebhookController extends Controller
{
    private static array $channelMap = [
        'whatsapp' => WhatsAppChannel::class,
        'telegram' => TelegramChannel::class,
        'slack' => SlackChannel::class,
        'discord' => DiscordChannel::class,
    ];

    public function handle(Request $request, string $platform, string $webhookToken): Response|\Illuminate\Http\JsonResponse
    {
        if (! isset(self::$channelMap[$platform])) {
            return response('Not found', 404);
        }

        $credential = ChannelCredential::findByToken($webhookToken);
        if (! $credential) {
            return response('Not found', 404);
        }

        $channelHandler = new (self::$channelMap[$platform])();
        $credentials = $credential->getCredentialsDecoded();

        $verification = $channelHandler->handleVerification($request, $credentials);
        if ($verification !== null) {
            return $verification;
        }

        if (! $channelHandler->verifySignature($request, $credentials)) {
            Log::warning('Channel webhook signature failed', [
                'platform' => $platform,
                'org' => $credential->organization_id,
            ]);

            return response('Unauthorized', 401);
        }

        $payload = $request->json()->all();
        $normalized = $channelHandler->normalize($payload, $credentials);

        if (! $normalized) {
            return response('ok');
        }

        $org = $credential->organization;

        if (! $org) {
            Log::error('Channel webhook: organization not found', ['org_id' => $credential->organization_id]);
            return response('ok');
        }

        tenancy()->initialize($org);

        try {
            app(ChannelGatewayService::class)->handle(
                $credential->twin_id,
                $platform,
                $normalized,
                $credential->organization_id
            );
            Log::info('Channel webhook handled', ['platform' => $platform, 'twin' => $credential->twin_id]);
        } catch (\Throwable $e) {
            Log::error('Channel webhook gateway error', [
                'platform' => $platform,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        } finally {
            tenancy()->end();
        }

        return response('ok');
    }
}
