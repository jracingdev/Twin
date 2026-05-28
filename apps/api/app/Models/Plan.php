<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class Plan extends Model
{
    use CentralConnection;
    protected $fillable = [
        'slug', 'name', 'messages_per_month', 'twins_limit',
        'seller_mode', 'api_requests', 'price_monthly',
    ];

    protected $casts = ['seller_mode' => 'boolean'];
}
