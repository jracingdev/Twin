<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class MemoryEdge extends Model
{
    use TenantConnection;

    protected $fillable = [
        'subject_id', 'object_id', 'relation', 'context',
    ];

    public function subject(): BelongsTo
    {
        return $this->belongsTo(MemoryEntity::class, 'subject_id');
    }

    public function object(): BelongsTo
    {
        return $this->belongsTo(MemoryEntity::class, 'object_id');
    }
}
