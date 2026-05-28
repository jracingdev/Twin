<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyInternalSecret
{
    public function handle(Request $request, Closure $next): Response
    {
        $secret = config('services.ai_engine.secret');
        $provided = $request->header('X-Internal-Secret');

        if (! $secret || ! hash_equals($secret, (string) $provided)) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        return $next($request);
    }
}
