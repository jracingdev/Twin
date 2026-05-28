<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\TrainingJob;
use App\Models\Twin;
use App\Services\AiEngineClient;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TrainController extends Controller
{
    public function __construct(private AiEngineClient $ai) {}

    public function trigger(Request $request): JsonResponse
    {
        $data = $request->validate([
            'twin_id' => 'required|uuid|exists:twins,id',
            'type' => 'required|in:dna_extract,reindex,incremental',
        ]);

        $job = TrainingJob::create([
            'id' => (string) Str::uuid(),
            'twin_id' => $data['twin_id'],
            'type' => $data['type'],
            'status' => 'queued',
        ]);

        try {
            $this->ai->triggerTraining([
                'job_id' => $job->id,
                'tenant_id' => tenant('id'),
                'twin_id' => $data['twin_id'],
                'type' => $data['type'],
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
                'result' => ['error' => $message],
                'completed_at' => now(),
            ]);
        }

        return response()->json($job->fresh(), 202);
    }

    public function show(TrainingJob $job): JsonResponse
    {
        return response()->json($job);
    }
}
