<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $key = $this->extractKey($request);

        if (! $key) {
            return response()->json(['message' => 'API key inválida.'], 401);
        }

        $apiKey = $this->resolveApiKey($key);

        if (! $apiKey) {
            return response()->json(['message' => 'API key inválida.'], 401);
        }

        if ($denied = $this->assertScopes($apiKey, $scopes)) {
            return $denied;
        }

        $apiKey->update(['last_used_at' => now()]);
        $request->attributes->set('api_key', $apiKey);
        $request->attributes->set('organization_id', $apiKey->organization_id);

        return $next($request);
    }

    /**
     * Prefer X-Api-Key; also accept Bearer tokens in twin_*.* format.
     */
    public function extractKey(Request $request): ?string
    {
        $header = $request->header('X-Api-Key');
        if (is_string($header) && $header !== '') {
            return $header;
        }

        $bearer = $request->bearerToken();
        if (is_string($bearer) && str_starts_with($bearer, 'twin_') && str_contains($bearer, '.')) {
            return $bearer;
        }

        return null;
    }

    public function resolveApiKey(string $key): ?ApiKey
    {
        if (! str_contains($key, '.')) {
            return null;
        }

        [$prefix] = explode('.', $key, 2);
        $hash = hash('sha256', $key);

        return ApiKey::where('key_prefix', $prefix)
            ->where('key_hash', $hash)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();
    }

    /**
     * If the key has scopes configured, require an intersection with $required
     * (or allow when $required is empty — auth-only). Empty/null key scopes = full access.
     */
    public function assertScopes(ApiKey $apiKey, array $required): ?Response
    {
        $keyScopes = $apiKey->scopes ?? [];

        if ($keyScopes === [] || in_array('*', $keyScopes, true)) {
            return null;
        }

        if ($required === []) {
            return null;
        }

        foreach ($required as $scope) {
            if (in_array($scope, $keyScopes, true)) {
                return null;
            }
        }

        return response()->json(['message' => 'API key sem permissão para este escopo.'], 403);
    }
}
