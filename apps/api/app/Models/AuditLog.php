<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class AuditLog extends Model
{
    use CentralConnection;
    public $timestamps = false;

    protected $fillable = [
        'organization_id', 'user_id', 'action', 'resource_type',
        'resource_id', 'metadata', 'ip_address', 'created_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'created_at' => 'datetime',
    ];

    public static function record(string $action, array $context = []): void
    {
        static::create(array_merge([
            'action' => $action,
            'created_at' => now(),
        ], $context));
    }
}
