<?php

return [
    'import_disk' => env('TWIN_IMPORT_DISK', 'local'),
    'registration_enabled' => (bool) env('TWIN_REGISTRATION_ENABLED', false),
    'default_retention_days' => (int) env('TWIN_DEFAULT_RETENTION_DAYS', 365),
    'frontend_url' => env('FRONTEND_URL', 'http://127.0.0.1:3000'),
];
