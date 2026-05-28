<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class BehavioralDna extends Model
{
    use TenantConnection;
    protected $table = 'behavioral_dna';

    protected $fillable = ['twin_id', 'version', 'payload', 'is_active'];

    protected $casts = [
        'payload' => 'array',
        'is_active' => 'boolean',
    ];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }
}
