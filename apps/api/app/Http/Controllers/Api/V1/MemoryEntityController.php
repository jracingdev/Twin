<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\MemoryEdge;
use App\Models\MemoryEntity;
use App\Models\Twin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MemoryEntityController extends Controller
{
    public function index(Request $request, Twin $twin): JsonResponse
    {
        $query = MemoryEntity::where('twin_id', $twin->id)->orderByDesc('updated_at');

        if ($type = $request->query('type')) {
            $query->where('type', $type);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('label', 'like', "%{$search}%")
                    ->orWhere('content', 'like', "%{$search}%");
            });
        }

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request, Twin $twin): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|string|max:32',
            'label' => 'required|string|max:255',
            'content' => 'nullable|string',
            'metadata' => 'nullable|array',
        ]);

        $entity = MemoryEntity::create(array_merge($data, ['twin_id' => $twin->id]));

        return response()->json($entity, 201);
    }

    public function indexEdges(Request $request, Twin $twin): JsonResponse
    {
        $entityIds = MemoryEntity::where('twin_id', $twin->id)->pluck('id');

        $query = MemoryEdge::query()
            ->whereIn('subject_id', $entityIds)
            ->with(['subject', 'object'])
            ->orderByDesc('updated_at');

        if ($relation = $request->query('relation')) {
            $query->where('relation', $relation);
        }

        $perPage = min(max((int) $request->query('per_page', 20), 1), 100);

        return response()->json($query->paginate($perPage));
    }

    public function storeEdge(Request $request, Twin $twin): JsonResponse
    {
        $data = $request->validate([
            'subject_id' => 'required|uuid|exists:memory_entities,id',
            'object_id' => 'required|uuid|exists:memory_entities,id|different:subject_id',
            'relation' => 'required|string|max:64',
            'context' => 'nullable|string',
        ]);

        $subject = MemoryEntity::findOrFail($data['subject_id']);
        $object = MemoryEntity::findOrFail($data['object_id']);

        abort_unless($subject->twin_id === $twin->id && $object->twin_id === $twin->id, 404);

        $edge = MemoryEdge::create($data);

        return response()->json($edge->load(['subject', 'object']), 201);
    }
}
