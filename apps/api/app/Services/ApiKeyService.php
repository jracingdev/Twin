<?php

namespace App\Services;

use App\Models\ApiKey;
use App\Models\Organization;
use Illuminate\Support\Str;

class ApiKeyService
{
    public function create(Organization $org, string $name, array $scopes = []): array
    {
        $plain = 'twin_'.Str::random(8).'.'.Str::random(32);
        $prefix = substr($plain, 0, 12);

        ApiKey::create([
            'organization_id' => $org->id,
            'name' => $name,
            'key_hash' => hash('sha256', $plain),
            'key_prefix' => $prefix,
            'scopes' => $scopes,
        ]);

        return ['key' => $plain, 'prefix' => $prefix];
    }
}
