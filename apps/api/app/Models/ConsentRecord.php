<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class ConsentRecord extends Model
{
    use CentralConnection;

    protected $fillable = ['organization_id', 'user_id', 'type', 'text_version', 'ip_address', 'accepted_at'];

    protected $casts = ['accepted_at' => 'datetime'];
}
