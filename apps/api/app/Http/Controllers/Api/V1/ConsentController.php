<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ConsentRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConsentController extends Controller
{
    public function latest(Request $request): JsonResponse
    {
        $type = $request->query('type', 'import');

        $consent = ConsentRecord::query()
            ->where('organization_id', tenant('id'))
            ->where('user_id', $request->user()->id)
            ->where('type', $type)
            ->orderByDesc('accepted_at')
            ->first();

        if (! $consent) {
            return response()->noContent();
        }

        return response()->json($consent);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => 'required|in:import,training,fine_tune',
            'text_version' => 'required|string|max:64',
        ]);

        $consent = ConsentRecord::create([
            'organization_id' => tenant('id'),
            'user_id' => $request->user()->id,
            'type' => $data['type'],
            'text_version' => $data['text_version'],
            'ip_address' => $request->ip(),
            'accepted_at' => now(),
        ]);

        AuditLog::record('consent.accepted', [
            'organization_id' => tenant('id'),
            'user_id' => $request->user()->id,
            'resource_type' => 'consent',
            'resource_id' => (string) $consent->id,
            'metadata' => ['type' => $data['type']],
        ]);

        return response()->json($consent, 201);
    }
}
