<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class RetentionPolicy extends Model
{
    use TenantConnection;
    protected $fillable = ['days', 'auto_purge'];

    protected $casts = ['auto_purge' => 'boolean'];
}
