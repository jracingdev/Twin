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

    public const REPLY_MODES = ['assistant', 'copilot', 'auto'];

    protected $fillable = [
        'organization_id', 'twin_id', 'channel', 'credentials', 'webhook_token',
        'is_active', 'reply_mode', 'confidence_threshold',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'confidence_threshold' => 'float',
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

    public static function normalizeReplyMode(?string $mode): string
    {
        $mode = $mode ?? 'copilot';

        return match ($mode) {
            'approval' => 'copilot',
            default => $mode,
        };
    }

    public function resolveConfidenceThreshold(): float
    {
        if ($this->confidence_threshold !== null) {
            return (float) $this->confidence_threshold;
        }

        $org = $this->organization;
        $orgThreshold = $org?->data['confidence_threshold'] ?? null;

        return $orgThreshold !== null ? (float) $orgThreshold : 0.75;
    }
}
