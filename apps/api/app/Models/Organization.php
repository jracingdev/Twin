<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Stancl\Tenancy\Contracts\Tenant;
use Stancl\Tenancy\Contracts\TenantWithDatabase;
use Stancl\Tenancy\Database\Concerns\HasDatabase;
use Stancl\Tenancy\Database\Models\Tenant as BaseTenant;

class Organization extends BaseTenant implements Tenant, TenantWithDatabase
{
    use HasDatabase, HasUuids;

    protected $table = 'organizations';

    protected $fillable = [
        'name', 'slug', 'data', 'stripe_id', 'pm_type', 'pm_last_four', 'trial_ends_at',
    ];

    protected $casts = [
        'trial_ends_at' => 'datetime',
        'data' => 'array',
    ];

    public static function getCustomColumns(): array
    {
        return ['id', 'name', 'slug', 'data', 'created_at', 'updated_at'];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_users')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function apiKeys(): HasMany
    {
        return $this->hasMany(ApiKey::class);
    }
}