<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\TenantConnection;

class DnaVersion extends Model
{
    use TenantConnection;
    protected $fillable = ['twin_id', 'version', 'payload', 'change_summary'];

    protected $casts = ['payload' => 'array'];
}
