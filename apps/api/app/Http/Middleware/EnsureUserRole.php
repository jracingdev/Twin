<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserRole
{
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Não autenticado.'], 401);
        }

        $orgId = tenant('id');
        $hasRole = $user->organizations()
            ->where('organizations.id', $orgId)
            ->whereIn('organization_users.role', $roles)
            ->exists();

        if (! $hasRole) {
            return response()->json(['message' => 'Permissão negada.'], 403);
        }

        return $next($request);
    }
}
