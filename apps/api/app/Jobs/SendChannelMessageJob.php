<?php

namespace App\Jobs;

use App\Models\ChannelCredential;
use App\Models\Message;
use App\Services\Channels\DiscordChannel;
use App\Services\Channels\SlackChannel;
use App\Services\Channels\TelegramChannel;
use App\Services\Channels\WhatsAppChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendChannelMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 30;
    public int $tries = 3;

    public function __construct(
        public string $messageId,
        public string $channel,
        public string $organizationId,
        public string $twinId,
        public array $platformMeta
    ) {}

    public function handle(): void
    {
        $credential = ChannelCredential::where('organization_id', $this->organizationId)
            ->where('twin_id', $this->twinId)
            ->where('channel', $this->channel)
            ->where('is_active', true)
            ->first();

        if (! $credential) {
            Log::warning('No active channel credential for send', [
                'org' => $this->organizationId,
                'twin' => $this->twinId,
                'channel' => $this->channel,
            ]);

            return;
        }

        $message = Message::findOrFail($this->messageId);
        $channelSender = $this->makeChannel();
        $channelSender->send($message->body, $credential->getCredentialsDecoded(), $this->platformMeta);
    }

    private function makeChannel(): \App\Services\Channels\ChannelInterface
    {
        return match ($this->channel) {
            'whatsapp' => new WhatsAppChannel(),
            'telegram' => new TelegramChannel(),
            'slack' => new SlackChannel(),
            'discord' => new DiscordChannel(),
            default => throw new \InvalidArgumentException("Unsupported channel: {$this->channel}"),
        };
    }

    public function failed(\Throwable $e): void
    {
        Log::error('SendChannelMessageJob failed', [
            'message_id' => $this->messageId,
            'channel' => $this->channel,
            'error' => $e->getMessage(),
        ]);
    }
}
