<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class MemoryEntity extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = [
        'twin_id', 'type', 'label', 'content', 'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }

    public function outgoingEdges(): HasMany
    {
        return $this->hasMany(MemoryEdge::class, 'subject_id');
    }

    public function incomingEdges(): HasMany
    {
        return $this->hasMany(MemoryEdge::class, 'object_id');
    }
}
