<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class DataDeletionRequest extends Model
{
    use CentralConnection;

    protected $fillable = [
        'user_id',
        'organization_id',
        'status',
        'reason',
        'processed_at',
    ];

    protected $casts = ['processed_at' => 'datetime'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function organization()
    {
        return $this->belongsTo(Organization::class);
    }
}
