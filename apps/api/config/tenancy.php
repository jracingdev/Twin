<?php

declare(strict_types=1);

return [
    'tenant_model' => \App\Models\Organization::class,
    'id_generator' => Stancl\Tenancy\UUIDGenerator::class,
    'database' => [
        'central_connection' => env('DB_CONNECTION', 'sqlite'),
        'based_on' => null,
        'prefix' => 'twin_tenant_',
        'suffix' => '',
        'managers' => [
            'sqlite' => Stancl\Tenancy\TenantDatabaseManagers\SQLiteDatabaseManager::class,
            'mysql' => Stancl\Tenancy\TenantDatabaseManagers\MySQLDatabaseManager::class,
        ],
    ],
    'migration_parameters' => [
        '--force' => true,
        '--path' => [database_path('migrations/tenant')],
        '--realpath' => true,
    ],
    'redis' => [
        'prefix_base' => 'tenant',
    ],
    'features' => [
        Stancl\Tenancy\Features\TenantConfig::class,
    ],
    'bootstrappers' => [
        Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\CacheTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper::class,
    ],
];
