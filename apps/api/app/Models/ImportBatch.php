<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class ImportBatch extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = [
        'twin_id', 'consent_id', 'source', 'status', 'file_path',
        'file_hash', 'total_messages', 'processed_messages', 'metadata',
        'started_at', 'completed_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }
}
