<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'product' => 'TWIN',
    'version' => '1.0.0',
    'status' => 'ok',
]));
