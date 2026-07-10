<?php

namespace App\Jobs;

use App\Models\ChannelCredential;
use App\Models\Message;
use App\Models\ResponseSuggestion;
use App\Models\Twin;
use App\Services\AiEngineClient;
use App\Services\PlanFeaturesService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessChannelMessageJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 120;
    public int $tries = 3;

    public function __construct(
        public string $messageId,
        public string $conversationId,
        public string $twinId,
        public string $channel,
        public string $organizationId,
        public array $platformMeta
    ) {}

    public function handle(AiEngineClient $ai, PlanFeaturesService $plans): void
    {
        if (! $plans->canSuggest($this->organizationId)) {
            Log::warning('ProcessChannelMessageJob skipped: plan messages limit reached', [
                'message_id' => $this->messageId,
                'twin_id' => $this->twinId,
                'organization_id' => $this->organizationId,
            ]);

            return;
        }

        $message = Message::findOrFail($this->messageId);
        $twin = Twin::with('activeDna')->findOrFail($this->twinId);

        $credential = ChannelCredential::where('organization_id', $this->organizationId)
            ->where('twin_id', $this->twinId)
            ->where('channel', $this->channel)
            ->where('is_active', true)
            ->first();

        $replyMode = ChannelCredential::normalizeReplyMode($credential?->reply_mode);
        $agentMode = $replyMode === 'auto';

        $suggestPayload = [
            'tenant_id' => $this->organizationId,
            'twin_id' => $twin->id,
            'text' => $message->body,
            'contact_id' => $message->contact_id,
            'session_id' => $this->conversationId,
            'intensity' => $twin->intensity,
            'seller_mode' => $twin->seller_mode,
            'dna' => $twin->activeDna?->payload,
            'channel' => $this->channel,
            'agent_mode' => $agentMode,
            'conversation_history' => $this->conversationHistory(),
        ];

        if ($agentMode && $credential !== null) {
            $suggestPayload['confidence_threshold'] = $credential->resolveConfidenceThreshold();
        }

        $result = $ai->suggest($suggestPayload);

        $reply = $result['suggestion'] ?? '';

        if ($reply === '') {
            return;
        }

        if ($replyMode === 'assistant') {
            // Internal suggestion only — no channel send path (no platform_meta).
            $this->createPendingSuggestion($twin, $message, $reply, $result, [
                'reply_mode' => 'assistant',
                'requires_approval' => false,
            ], includePlatformMeta: false);

            return;
        }

        if ($replyMode === 'copilot') {
            $this->createPendingSuggestion($twin, $message, $reply, $result, [
                'reply_mode' => 'copilot',
                'requires_approval' => true,
            ]);

            return;
        }

        if ($replyMode === 'auto') {
            $score = $this->resolveResultScore($result);
            $threshold = $credential?->resolveConfidenceThreshold() ?? 0.75;

            if ($score === null || $score < $threshold) {
                $this->createPendingSuggestion($twin, $message, $reply, $result, [
                    'reply_mode' => 'auto',
                    'requires_approval' => true,
                    'auto_fallback' => true,
                    'score' => $score,
                    'threshold' => $threshold,
                ]);

                return;
            }

            $this->dispatchAutoReply($twin, $message, $reply, $result);

            return;
        }

        $this->createPendingSuggestion($twin, $message, $reply, $result, [
            'reply_mode' => $replyMode,
            'requires_approval' => true,
        ]);
    }

    private function createPendingSuggestion(
        Twin $twin,
        Message $message,
        string $reply,
        array $result,
        array $extraMeta = [],
        bool $includePlatformMeta = true
    ): void {
        $scoreBreakdown = $result['score_breakdown']
            ?? $result['similarity']
            ?? ($result['metadata']['score_breakdown'] ?? null)
            ?? ($result['metadata']['similarity_breakdown'] ?? null);

        $meta = array_filter([
            'channel' => $this->channel,
            'conversation_id' => $this->conversationId,
            'inbound_message_id' => $this->messageId,
            'platform_meta' => $includePlatformMeta ? $this->platformMeta : null,
            'source' => 'channel_webhook',
            'score_breakdown' => $scoreBreakdown,
            'seller_mode' => $twin->seller_mode,
        ], fn ($v) => $v !== null);

        ResponseSuggestion::create([
            'twin_id' => $this->twinId,
            'contact_id' => $message->contact_id,
            'input_text' => $message->body,
            'suggested_text' => $reply,
            'intensity' => $twin->intensity,
            'score' => $this->resolveResultScore($result),
            'status' => 'pending',
            'metadata' => array_merge($result['metadata'] ?? [], $meta, $extraMeta),
        ]);
    }

    private function dispatchAutoReply(Twin $twin, Message $message, string $reply, array $result): void
    {
        $score = $this->resolveResultScore($result);
        $scoreBreakdown = $result['score_breakdown']
            ?? $result['similarity']
            ?? ($result['metadata']['score_breakdown'] ?? null)
            ?? ($result['metadata']['similarity_breakdown'] ?? null);

        $replyMessage = Message::create([
            'twin_id' => $this->twinId,
            'conversation_id' => $this->conversationId,
            'contact_id' => $message->contact_id,
            'body' => $reply,
            'role' => 'assistant',
            'sent_at' => now(),
            'content_hash' => hash('sha256', $reply),
            'metadata' => [
                'channel_reply' => true,
                'agent_auto' => true,
                'score' => $score,
            ],
        ]);

        ResponseSuggestion::create([
            'twin_id' => $this->twinId,
            'contact_id' => $message->contact_id,
            'input_text' => $message->body,
            'suggested_text' => $reply,
            'intensity' => $twin->intensity,
            'score' => $score,
            'status' => 'sent',
            'metadata' => array_merge($result['metadata'] ?? [], array_filter([
                'channel' => $this->channel,
                'conversation_id' => $this->conversationId,
                'inbound_message_id' => $this->messageId,
                'outbound_message_id' => $replyMessage->id,
                'platform_meta' => $this->platformMeta,
                'source' => 'channel_agent',
                'agent_auto' => true,
                'score_breakdown' => $scoreBreakdown,
                'seller_mode' => $twin->seller_mode,
            ], fn ($v) => $v !== null)),
        ]);

        SendChannelMessageJob::dispatch(
            $replyMessage->id,
            $this->channel,
            $this->organizationId,
            $this->twinId,
            $this->platformMeta
        )->onQueue('channel');
    }

    /**
     * @return list<array{role: string, text: string}>
     */
    private function conversationHistory(): array
    {
        return Message::query()
            ->where('conversation_id', $this->conversationId)
            ->where('id', '!=', $this->messageId)
            ->orderByDesc('sent_at')
            ->limit(12)
            ->get(['role', 'body', 'sent_at'])
            ->sortBy('sent_at')
            ->values()
            ->map(fn (Message $m) => [
                'role' => $m->role === 'assistant' ? 'assistant' : 'user',
                'text' => (string) $m->body,
            ])
            ->all();
    }

    private function resolveResultScore(array $result): ?float
    {
        return $this->normalizeScore($result['confidence'] ?? $result['score'] ?? null);
    }

    private function normalizeScore(mixed $score): ?float
    {
        if ($score === null || ! is_numeric($score)) {
            return null;
        }

        $value = (float) $score;

        return $value <= 1 ? $value : $value / 100;
    }

    public function failed(\Throwable $e): void
    {
        Log::error('ProcessChannelMessageJob failed', [
            'message_id' => $this->messageId,
            'twin_id' => $this->twinId,
            'channel' => $this->channel,
            'error' => $e->getMessage(),
        ]);
    }
}
