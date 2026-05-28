<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpFoundation\Response;

class EnsureTenantDatabaseProvisioned
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! tenancy()->initialized) {
            return response()->json([
                'message' => 'Contexto de tenant não inicializado.',
                'code' => 'tenant_not_initialized',
            ], 503);
        }

        try {
            $provisioned = Schema::hasTable('twins');
        } catch (\Throwable) {
            $provisioned = false;
        }

        if (! $provisioned) {
            return response()->json([
                'message' => 'Banco do tenant não provisionado. Execute: php artisan tenants:provision --seed',
                'code' => 'tenant_not_provisioned',
            ], 503);
        }

        return $next($request);
    }
}
