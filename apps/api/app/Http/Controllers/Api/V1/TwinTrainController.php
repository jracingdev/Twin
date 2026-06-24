<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ResponseSuggestion;
use App\Models\TrainingJob;
use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TwinTrainController extends Controller
{
    public function __construct(private AiEngineClient $ai) {}

    public function train(Request $request, Twin $twin): JsonResponse
    {
        $data = $request->validate([
            'limit' => 'integer|min:1|max:500',
            'type' => 'in:incremental,reindex',
        ]);

        $limit = $data['limit'] ?? 100;
        $type = $data['type'] ?? 'incremental';

        $suggestions = ResponseSuggestion::where('twin_id', $twin->id)
            ->where('status', 'accepted')
            ->orderByDesc('updated_at')
            ->limit($limit)
            ->get();

        if ($suggestions->isEmpty()) {
            return response()->json([
                'message' => 'Nenhuma sugestão aceita encontrada para treinar.',
                'code' => 'no_feedback',
            ], 422);
        }

        $synced = 0;
        foreach ($suggestions as $suggestion) {
            try {
                $this->ai->syncFeedback([
                    'tenant_id' => tenant('id'),
                    'twin_id' => $twin->id,
                    'suggestion_id' => $suggestion->id,
                    'input_text' => $suggestion->input_text,
                    'accepted_text' => $suggestion->suggested_text,
                ]);
                $synced++;
            } catch (\Throwable) {
                // Continua com as demais sugestões
            }
        }

        $messages = $suggestions->map(fn (ResponseSuggestion $s) => [
            'role' => 'user',
            'body' => $s->input_text,
            'message_id' => 'train_'.$s->id,
            'source' => 'feedback',
        ])->values()->all();

        $job = TrainingJob::create([
            'id' => (string) Str::uuid(),
            'twin_id' => $twin->id,
            'type' => $type,
            'status' => 'queued',
            'result' => ['feedback_synced' => $synced, 'batch_size' => $suggestions->count()],
        ]);

        try {
            $this->ai->triggerTraining([
                'job_id' => $job->id,
                'tenant_id' => tenant('id'),
                'twin_id' => $twin->id,
                'type' => $type,
                'messages' => $messages,
            ]);
            $job->update(['status' => 'processing', 'started_at' => now()]);
        } catch (\Throwable $e) {
            $message = $e->getMessage();
            if ($e instanceof RequestException && $e->response) {
                $detail = $e->response->json('detail');
                if (is_string($detail) && $detail !== '') {
                    $message = $detail;
                }
            }
            $job->update([
                'status' => 'failed',
                'result' => array_merge($job->result ?? [], ['error' => $message]),
                'completed_at' => now(),
            ]);
        }

        return response()->json([
            'message' => 'Treinamento enfileirado com base no feedback aceito.',
            'job' => $job->fresh(),
            'feedback_synced' => $synced,
        ], 202);
    }

    public function status(Twin $twin): JsonResponse
    {
        $job = TrainingJob::where('twin_id', $twin->id)
            ->orderByDesc('created_at')
            ->first();

        if (! $job) {
            return response()->json([
                'twin_id' => $twin->id,
                'status' => 'none',
                'message' => 'Nenhum treinamento registrado para este twin.',
            ]);
        }

        return response()->json([
            'twin_id' => $twin->id,
            'job' => $job,
        ]);
    }
}
