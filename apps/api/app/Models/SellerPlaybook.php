<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class SellerPlaybook extends Model
{
    use TenantConnection;
    protected $fillable = ['twin_id', 'intent', 'vertical', 'template', 'variables', 'usage_count'];

    protected $casts = ['variables' => 'array'];

    public function twin(): BelongsTo
    {
        return $this->belongsTo(Twin::class);
    }
}
