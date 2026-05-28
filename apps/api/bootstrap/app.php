<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withProviders([
        App\Providers\TenancyServiceProvider::class,
    ])
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'tenant' => \App\Http\Middleware\InitializeTenancyForOrganization::class,
            'tenant.provisioned' => \App\Http\Middleware\EnsureTenantDatabaseProvisioned::class,
            'role' => \App\Http\Middleware\EnsureUserRole::class,
            'api.key' => \App\Http\Middleware\AuthenticateApiKey::class,
            'internal.secret' => \App\Http\Middleware\VerifyInternalSecret::class,
        ]);

        // Tenant DB must be active before ImplicitRouteBinding resolves Twin, etc.
        $middleware->prependToPriorityList(
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
            \App\Http\Middleware\InitializeTenancyForOrganization::class,
        );
        $middleware->prependToPriorityList(
            \Illuminate\Routing\Middleware\SubstituteBindings::class,
            \App\Http\Middleware\EnsureTenantDatabaseProvisioned::class,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
