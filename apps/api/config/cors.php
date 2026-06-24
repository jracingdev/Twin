<?php

$localOrigins = [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
];

$envOrigins = array_filter(array_map('trim', explode(',', (string) env('CORS_ALLOWED_ORIGINS', ''))));

$frontendUrl = env('FRONTEND_URL');
if ($frontendUrl) {
    $envOrigins[] = rtrim($frontendUrl, '/');
}

$allowedOrigins = array_values(array_unique(array_filter(array_merge($envOrigins, $localOrigins))));

$allowedPatterns = [];
if (env('APP_ENV') === 'production') {
    $allowedPatterns[] = '#^https://([\w-]+\.)?twin\.app\.br$#';
}

return [
    'paths' => ['api/*', 'sanctum/csrf-cookie'],
    'allowed_methods' => ['*'],
    'allowed_origins' => $allowedOrigins,
    'allowed_origins_patterns' => $allowedPatterns,
    'allowed_headers' => ['*'],
    'exposed_headers' => [],
    'max_age' => 3600,
    'supports_credentials' => false,
];
