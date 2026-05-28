<?php

namespace App\Http\Middleware;

use App\Models\ApiKey;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiKey
{
    public function handle(Request $request, Closure $next): Response
    {
        $key = $request->bearerToken() ?? $request->header('X-Api-Key');

        if (! $key || ! str_contains($key, '.')) {
            return response()->json(['message' => 'API key inválida.'], 401);
        }

        [$prefix] = explode('.', $key, 2);
        $hash = hash('sha256', $key);

        $apiKey = ApiKey::where('key_prefix', $prefix)
            ->where('key_hash', $hash)
            ->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))
            ->first();

        if (! $apiKey) {
            return response()->json(['message' => 'API key inválida.'], 401);
        }

        $apiKey->update(['last_used_at' => now()]);
        $request->attributes->set('api_key', $apiKey);
        $request->attributes->set('organization_id', $apiKey->organization_id);

        return $next($request);
    }
}
