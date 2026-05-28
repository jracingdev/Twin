<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class ResponseSuggestion extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = [
        'twin_id', 'contact_id', 'input_text', 'suggested_text',
        'intensity', 'score', 'status', 'metadata',
    ];

    protected $casts = ['metadata' => 'array'];
}
