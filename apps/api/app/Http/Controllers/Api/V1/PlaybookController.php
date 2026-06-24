<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\SellerPlaybook;
use App\Models\Twin;
use App\Services\PlaybookSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlaybookController extends Controller
{
    public function __construct(private PlaybookSyncService $sync) {}

    public function store(Request $request, Twin $twin): JsonResponse
    {
        $data = $request->validate([
            'intent' => 'required|string|max:32',
            'vertical' => 'string|max:64',
            'template' => 'required|string',
            'variables' => 'nullable|array',
        ]);

        $playbook = SellerPlaybook::create(array_merge($data, [
            'twin_id' => $twin->id,
            'vertical' => $data['vertical'] ?? 'autopecas',
        ]));

        $this->sync->syncForTwin($twin);

        return response()->json($playbook, 201);
    }

    public function update(Request $request, Twin $twin, SellerPlaybook $playbook): JsonResponse
    {
        abort_unless($playbook->twin_id === $twin->id, 404);

        $playbook->update($request->validate([
            'intent' => 'sometimes|string|max:32',
            'vertical' => 'string|max:64',
            'template' => 'sometimes|string',
            'variables' => 'nullable|array',
        ]));

        $this->sync->syncForTwin($twin);

        return response()->json($playbook);
    }

    public function destroy(Twin $twin, SellerPlaybook $playbook): JsonResponse
    {
        abort_unless($playbook->twin_id === $twin->id, 404);
        $playbook->delete();

        $this->sync->syncForTwin($twin);

        return response()->json(null, 204);
    }

    public function resync(Twin $twin): JsonResponse
    {
        $this->sync->syncForTwin($twin);

        return response()->json(['message' => 'Playbooks sincronizados com o motor de IA.']);
    }
}
