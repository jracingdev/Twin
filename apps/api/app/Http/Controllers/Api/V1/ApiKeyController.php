<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApiKey;
use App\Models\Organization;
use App\Services\ApiKeyService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApiKeyController extends Controller
{
    public function __construct(private ApiKeyService $apiKeys) {}

    public function index(Request $request): JsonResponse
    {
        $orgId = tenant('id');

        $keys = ApiKey::where('organization_id', $orgId)
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'key_prefix', 'scopes', 'last_used_at', 'expires_at', 'created_at']);

        return response()->json(['data' => $keys]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'scopes' => 'array',
        ]);

        $org = Organization::findOrFail(tenant('id'));
        $created = $this->apiKeys->create($org, $data['name'], $data['scopes'] ?? []);

        return response()->json([
            'message' => 'Chave criada. Copie agora — não será exibida novamente.',
            'key' => $created['key'],
            'prefix' => $created['prefix'],
        ], 201);
    }

    public function destroy(Request $request, ApiKey $apiKey): JsonResponse
    {
        abort_unless($apiKey->organization_id === tenant('id'), 404);
        $apiKey->delete();

        return response()->json(null, 204);
    }
}
