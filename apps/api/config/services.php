<?php

return [
    'ai_engine' => [
        'url' => env('AI_ENGINE_URL', 'http://localhost:8000'),
        'secret' => env('AI_ENGINE_SECRET'),
        'train_timeout' => (int) env('AI_ENGINE_TRAIN_TIMEOUT', 30),
    ],
    'pinecone' => [
        'api_key' => env('PINECONE_API_KEY'),
        'index' => env('PINECONE_INDEX', 'twin-integrated'),
    ],
    'webhook' => [
        'url' => env('WEBHOOK_URL'),
    ],
    'stripe' => [
        'key' => env('STRIPE_KEY'),
        'secret' => env('STRIPE_SECRET'),
        'webhook_secret' => env('STRIPE_WEBHOOK_SECRET'),
    ],
];
