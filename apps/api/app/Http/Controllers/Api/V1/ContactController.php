<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Contact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ContactController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Contact::query()->orderBy('display_name');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('display_name', 'like', "%{$search}%")
                    ->orWhere('external_id', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $contact = Contact::create($request->validate([
            'display_name' => 'required|string|max:255',
            'channel' => 'string|max:32',
            'external_id' => 'nullable|string|max:255',
            'tags' => 'nullable|array',
            'preferred_tone' => 'nullable|string|max:32',
        ]));

        return response()->json($contact, 201);
    }

    public function show(Contact $contact): JsonResponse
    {
        return response()->json($contact);
    }

    public function update(Request $request, Contact $contact): JsonResponse
    {
        $contact->update($request->validate([
            'display_name' => 'sometimes|string|max:255',
            'channel' => 'string|max:32',
            'external_id' => 'nullable|string|max:255',
            'tags' => 'nullable|array',
            'preferred_tone' => 'nullable|string|max:32',
        ]));

        return response()->json($contact);
    }

    public function destroy(Contact $contact): JsonResponse
    {
        $contact->delete();

        return response()->json(null, 204);
    }
}
