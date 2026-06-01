<?php

namespace App\Services\Channels;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

interface ChannelInterface
{
    /**
     * Returns a Response if the request is a platform verification challenge, null otherwise.
     */
    public function handleVerification(Request $request, array $credentials): ?Response;

    /**
     * Normalizes the incoming webhook payload into a unified message array.
     * Returns null if the event is not an inbound user message.
     *
     * Returned shape:
     *   external_id    string  — sender identifier on the platform
     *   display_name   string  — human-readable name (best-effort)
     *   text           string  — message body
     *   platform_meta  array   — raw platform IDs needed to reply
     */
    public function normalize(array $payload, array $credentials): ?array;

    /**
     * Sends a text reply back to the originating platform.
     */
    public function send(string $text, array $credentials, array $platformMeta): void;

    /**
     * Verifies the authenticity of an incoming webhook request.
     */
    public function verifySignature(Request $request, array $credentials): bool;
}
