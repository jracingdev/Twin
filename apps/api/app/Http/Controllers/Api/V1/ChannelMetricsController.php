<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ResponseSuggestion;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChannelMetricsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid',
        ]);

        $twinId = $data['twin_id'];
        $channelQuery = fn () => ResponseSuggestion::query()
            ->where('twin_id', $twinId)
            ->whereNotNull('metadata->channel');

        $pending = $channelQuery()
            ->where('status', 'pending')
            ->count();

        $sentToday = $channelQuery()
            ->where('status', 'sent')
            ->whereDate('updated_at', today())
            ->count();

        $sentSuggestions = $channelQuery()
            ->where('status', 'sent')
            ->whereNotNull('metadata->sent_at')
            ->get(['created_at', 'metadata']);

        $responseTimes = [];
        foreach ($sentSuggestions as $suggestion) {
            $sentAt = $suggestion->metadata['sent_at'] ?? null;
            if (! $sentAt) {
                continue;
            }
            $responseTimes[] = Carbon::parse($sentAt)->diffInSeconds($suggestion->created_at);
        }

        $since = now()->subDays(7);
        $last7 = $channelQuery()->where('created_at', '>=', $since);
        $resolved7d = (clone $last7)->whereIn('status', ['accepted', 'sent', 'rejected'])->count();
        $accepted7d = (clone $last7)->whereIn('status', ['accepted', 'sent'])->count();

        return response()->json([
            'twin_id' => $twinId,
            'pending' => $pending,
            'sent_today' => $sentToday,
            'avg_response_time_seconds' => count($responseTimes) > 0
                ? (int) round(array_sum($responseTimes) / count($responseTimes))
                : null,
            'accept_rate_7d' => $resolved7d > 0
                ? round(($accepted7d / $resolved7d) * 100, 1)
                : null,
        ]);
    }
}
