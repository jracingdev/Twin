<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class Message extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = [
        'twin_id', 'conversation_id', 'contact_id', 'body', 'role',
        'sent_at', 'emoji_count', 'reply_latency_seconds', 'content_hash', 'metadata',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }
}
