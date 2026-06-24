<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ChannelCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChannelCredentialController extends Controller
{
    private const CHANNELS = ['whatsapp', 'telegram', 'slack', 'discord'];

    private const REPLY_MODE_INPUT = 'assistant,copilot,approval,auto';

    public function index(): JsonResponse
    {
        $credentials = ChannelCredential::where('organization_id', tenant('id'))
            ->get()
            ->map(fn ($c) => $this->format($c));

        return response()->json($credentials);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid',
            'channel' => ['required', Rule::in(self::CHANNELS)],
            'credentials' => 'required|array',
            'reply_mode' => 'nullable|in:'.self::REPLY_MODE_INPUT,
            'confidence_threshold' => 'nullable|numeric|min:0|max:1',
        ]);

        $this->validateChannelCredentials($data['channel'], $data['credentials']);

        $credential = ChannelCredential::create([
            'organization_id' => tenant('id'),
            'twin_id' => $data['twin_id'],
            'channel' => $data['channel'],
            'credentials' => encrypt(json_encode($data['credentials'])),
            'reply_mode' => ChannelCredential::normalizeReplyMode($data['reply_mode'] ?? null),
            'confidence_threshold' => $data['confidence_threshold'] ?? null,
        ]);

        return response()->json($this->format($credential), 201);
    }

    public function update(Request $request, ChannelCredential $channelCredential): JsonResponse
    {
        $this->authorizeCredential($channelCredential);

        $data = $request->validate([
            'credentials' => 'sometimes|array',
            'is_active' => 'sometimes|boolean',
            'reply_mode' => 'sometimes|in:'.self::REPLY_MODE_INPUT,
            'confidence_threshold' => 'nullable|numeric|min:0|max:1',
        ]);

        if (isset($data['credentials'])) {
            $this->validateChannelCredentials($channelCredential->channel, $data['credentials']);
            $data['credentials'] = encrypt(json_encode($data['credentials']));
        }

        if (array_key_exists('reply_mode', $data)) {
            $data['reply_mode'] = ChannelCredential::normalizeReplyMode($data['reply_mode']);
        }

        $channelCredential->update($data);

        return response()->json($this->format($channelCredential->fresh()));
    }

    public function destroy(ChannelCredential $channelCredential): JsonResponse
    {
        $this->authorizeCredential($channelCredential);
        $channelCredential->delete();

        return response()->json(null, 204);
    }

    private function format(ChannelCredential $c): array
    {
        return [
            'id' => $c->id,
            'twin_id' => $c->twin_id,
            'channel' => $c->channel,
            'is_active' => $c->is_active,
            'reply_mode' => $c->reply_mode ?? 'copilot',
            'confidence_threshold' => $c->confidence_threshold ?? 0.75,
            'webhook_token' => $this->maskToken($c->webhook_token),
            'webhook_url' => url("/api/webhooks/channel/{$c->channel}/{$c->webhook_token}"),
            'created_at' => $c->created_at,
        ];
    }

    private function authorizeCredential(ChannelCredential $credential): void
    {
        if ($credential->organization_id !== tenant('id')) {
            abort(403);
        }
    }

    private function maskToken(?string $token): ?string
    {
        if (! $token || strlen($token) < 8) {
            return $token ? '****' : null;
        }

        return substr($token, 0, 4).'…'.substr($token, -4);
    }

    private function validateChannelCredentials(string $channel, array $creds): void
    {
        $required = match ($channel) {
            'whatsapp' => ['phone_number_id', 'access_token', 'verify_token', 'app_secret'],
            'telegram' => ['bot_token'],
            'slack' => ['bot_token', 'signing_secret'],
            'discord' => ['bot_token', 'public_key'],
        };

        $missing = array_diff($required, array_keys($creds));

        if (! empty($missing)) {
            abort(422, 'Missing credentials fields: '.implode(', ', $missing));
        }
    }
}
