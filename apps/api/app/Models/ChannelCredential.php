<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class ChannelCredential extends Model
{
    use HasUuids;

    public function getConnectionName(): string
    {
        return config('tenancy.database.central_connection');
    }

    protected $fillable = [
        'organization_id', 'twin_id', 'channel', 'credentials', 'webhook_token', 'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    protected static function boot(): void
    {
        parent::boot();

        static::creating(function (self $model) {
            if (empty($model->webhook_token)) {
                $model->webhook_token = Str::random(48);
            }
        });
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function getCredentialsDecoded(): array
    {
        return json_decode(decrypt($this->credentials), true) ?? [];
    }

    public static function findByToken(string $token): ?self
    {
        return self::where('webhook_token', $token)->where('is_active', true)->first();
    }
}
