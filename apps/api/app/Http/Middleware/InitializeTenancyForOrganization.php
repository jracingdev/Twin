<?php

namespace App\Http\Middleware;

use App\Models\Organization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class InitializeTenancyForOrganization
{
    public function handle(Request $request, Closure $next): Response
    {
        $tenantId = $request->header('X-Tenant')
            ?? $request->attributes->get('organization_id');

        if (! $tenantId) {
            return response()->json(['message' => 'Header X-Tenant obrigatório.'], 400);
        }

        $tenant = Organization::find($tenantId);
        if (! $tenant) {
            return response()->json(['message' => 'Organização não encontrada.'], 404);
        }

        $user = $request->user();
        if ($user && ! $user->organizations()->where('organizations.id', $tenantId)->exists()) {
            return response()->json(['message' => 'Organização não autorizada.'], 403);
        }

        tenancy()->initialize($tenant);

        return $next($request);
    }
}
