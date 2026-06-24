<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Twin extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = [
        'name', 'description', 'intensity', 'seller_mode', 'vertical', 'status',
    ];

    protected $casts = [
        'seller_mode' => 'boolean',
        'intensity' => 'integer',
    ];

    public function imports(): HasMany
    {
        return $this->hasMany(ImportBatch::class);
    }

    public function conversations(): HasMany
    {
        return $this->hasMany(Conversation::class);
    }

    public function activeDna(): HasOne
    {
        return $this->hasOne(BehavioralDna::class)->where('is_active', true);
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class);
    }

    public function sellerPlaybooks(): HasMany
    {
        return $this->hasMany(SellerPlaybook::class);
    }

    public function memoryEntities(): HasMany
    {
        return $this->hasMany(MemoryEntity::class);
    }

    public function trainingJobs(): HasMany
    {
        return $this->hasMany(TrainingJob::class);
    }
}
