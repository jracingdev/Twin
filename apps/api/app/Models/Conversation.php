<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class Conversation extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = ['twin_id', 'contact_id', 'channel', 'last_message_at'];

    protected $casts = ['last_message_at' => 'datetime'];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }

    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }
}
