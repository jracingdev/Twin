<?php

namespace App\Services;

use App\Models\Organization;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use InvalidArgumentException;

class WebhookDispatcher
{
    public function dispatch(string $event, array $payload, ?string $url = null): void
    {
        $url = $url ?? config('services.webhook.url');
        if (! $url) {
            return;
        }

        try {
            $this->assertSafeUrl($url);

            Http::timeout(10)->post($url, [
                'event' => $event,
                'payload' => $payload,
                'timestamp' => now()->toIso8601String(),
            ]);
        } catch (InvalidArgumentException $e) {
            Log::warning('webhook.ssrf_blocked', ['event' => $event, 'url' => $url, 'error' => $e->getMessage()]);
        } catch (\Throwable $e) {
            Log::warning('webhook.failed', ['event' => $event, 'error' => $e->getMessage()]);
        }
    }

    public function dispatchForTenant(string $event, array $payload): void
    {
        $orgId = tenant('id');
        if (! $orgId) {
            $this->dispatch($event, $payload);

            return;
        }

        $org = Organization::find($orgId);
        $data = $org?->data ?? [];
        $url = $data['webhook_url'] ?? config('services.webhook.url');
        $events = $data['webhook_events'] ?? ['import.completed', 'dna.updated', 'suggestion.accepted'];

        if (! $url || ! in_array($event, $events, true)) {
            return;
        }

        $this->dispatch($event, array_merge($payload, ['organization_id' => $orgId]), $url);
    }

    /**
     * Block private, loopback, link-local and cloud metadata targets (SSRF).
     *
     * @throws InvalidArgumentException
     */
    public function assertSafeUrl(string $url): void
    {
        $parts = parse_url($url);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            throw new InvalidArgumentException('URL de webhook inválida.');
        }

        $scheme = strtolower($parts['scheme']);
        if (! in_array($scheme, ['http', 'https'], true)) {
            throw new InvalidArgumentException('Esquema de webhook não permitido.');
        }

        $host = strtolower($parts['host']);
        if ($host === 'localhost' || str_ends_with($host, '.localhost') || str_ends_with($host, '.local')) {
            throw new InvalidArgumentException('Host de webhook bloqueado.');
        }

        $ips = [];
        if (filter_var($host, FILTER_VALIDATE_IP)) {
            $ips[] = $host;
        } else {
            $resolved = @gethostbynamel($host) ?: [];
            $ips = array_merge($ips, $resolved);
            // IPv6 AAAA if available
            $records = @dns_get_record($host, DNS_AAAA) ?: [];
            foreach ($records as $record) {
                if (! empty($record['ipv6'])) {
                    $ips[] = $record['ipv6'];
                }
            }
        }

        if ($ips === []) {
            throw new InvalidArgumentException('Não foi possível resolver o host do webhook.');
        }

        foreach (array_unique($ips) as $ip) {
            if ($this->isBlockedIp($ip)) {
                throw new InvalidArgumentException('Destino de webhook bloqueado (rede privada/metadata).');
            }
        }
    }

    private function isBlockedIp(string $ip): bool
    {
        if ($ip === '169.254.169.254') {
            return true;
        }

        // FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE covers RFC1918,
        // loopback, link-local, and some reserved ranges.
        $flags = FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE;
        if (filter_var($ip, FILTER_VALIDATE_IP, $flags) === false) {
            return true;
        }

        // Extra: IPv6 unique-local / link-local / loopback
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            $lower = strtolower($ip);
            if ($lower === '::1'
                || str_starts_with($lower, 'fc')
                || str_starts_with($lower, 'fd')
                || str_starts_with($lower, 'fe80:')
            ) {
                return true;
            }
        }

        return false;
    }
}
