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

        $user = $request->user();
        if (! $tenantId && $user) {
            $tenantId = $user->organizations()->value('organizations.id');
        }

        if (! $tenantId) {
            $message = $user
                ? 'Nenhuma organização vinculada a este usuário. No servidor: php artisan db:seed && php artisan twin:reset-demo-user && php artisan tenants:provision --seed'
                : 'Header X-Tenant obrigatório.';

            return response()->json(['message' => $message], 400);
        }

        $tenant = Organization::find($tenantId);
        if (! $tenant) {
            return response()->json(['message' => 'Organização não encontrada.'], 404);
        }

        if ($user && ! $user->organizations()->where('organizations.id', $tenantId)->exists()) {
            return response()->json(['message' => 'Organização não autorizada.'], 403);
        }

        tenancy()->initialize($tenant);

        return $next($request);
    }
}
