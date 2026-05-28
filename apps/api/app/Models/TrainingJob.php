<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class TrainingJob extends Model
{
    use HasUuids, TenantConnection;

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = ['id', 'twin_id', 'type', 'status', 'result', 'started_at', 'completed_at'];

    protected $casts = [
        'result' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];
}
