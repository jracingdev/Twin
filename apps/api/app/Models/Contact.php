<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class Contact extends Model
{
    use HasUuids, TenantConnection;

    protected $fillable = ['display_name', 'channel', 'external_id', 'tags', 'preferred_tone'];

    protected $casts = ['tags' => 'array'];
}
