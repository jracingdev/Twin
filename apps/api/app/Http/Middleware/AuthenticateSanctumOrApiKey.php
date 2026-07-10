<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Tenant routes: Sanctum Bearer token OR organization API key (X-Api-Key).
 */
class AuthenticateSanctumOrApiKey
{
    public function __construct(private AuthenticateApiKey $apiKeys) {}

    public function handle(Request $request, Closure $next, string ...$scopes): Response
    {
        $rawKey = $this->apiKeys->extractKey($request);

        if ($rawKey !== null) {
            $apiKey = $this->apiKeys->resolveApiKey($rawKey);

            if (! $apiKey) {
                return response()->json(['message' => 'API key inválida.'], 401);
            }

            if ($denied = $this->apiKeys->assertScopes($apiKey, $scopes)) {
                return $denied;
            }

            $apiKey->update(['last_used_at' => now()]);
            $request->attributes->set('api_key', $apiKey);
            $request->attributes->set('organization_id', $apiKey->organization_id);

            return $next($request);
        }

        $user = Auth::guard('sanctum')->user();
        if (! $user) {
            return response()->json(['message' => 'Não autenticado.'], 401);
        }

        Auth::setUser($user);

        return $next($request);
    }
}
