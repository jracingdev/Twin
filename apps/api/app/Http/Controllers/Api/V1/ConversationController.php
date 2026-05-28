<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Conversation::with('contact:id,display_name,channel')
            ->orderByDesc('last_message_at');

        if ($twinId = $request->query('twin_id')) {
            $query->where('twin_id', $twinId);
        }

        return response()->json($query->paginate(min((int) $request->query('per_page', 20), 50)));
    }

    public function show(Conversation $conversation): JsonResponse
    {
        $messages = Message::where('conversation_id', $conversation->id)
            ->orderBy('sent_at')
            ->limit(500)
            ->get(['id', 'body', 'role', 'sent_at', 'contact_id']);

        return response()->json([
            'conversation' => $conversation->load('contact:id,display_name,channel'),
            'messages' => $messages,
        ]);
    }
}
