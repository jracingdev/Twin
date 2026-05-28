<?php

namespace App\Models;

use Laravel\Sanctum\PersonalAccessToken as SanctumPersonalAccessToken;
use Stancl\Tenancy\Database\Concerns\CentralConnection;

class PersonalAccessToken extends SanctumPersonalAccessToken
{
    use CentralConnection;
}
