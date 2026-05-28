<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DnaVersion;
use App\Models\ImportBatch;
use App\Models\TrainingJob;
use App\Models\Twin;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TimelineController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $twinId = $request->query('twin_id');
        $events = collect();

        $importQuery = ImportBatch::query()->orderByDesc('created_at');
        $dnaQuery = DnaVersion::query()->orderByDesc('created_at');
        $trainQuery = TrainingJob::query()->orderByDesc('created_at');

        if ($twinId) {
            $importQuery->where('twin_id', $twinId);
            $dnaQuery->where('twin_id', $twinId);
            $trainQuery->where('twin_id', $twinId);
        }

        foreach ($importQuery->limit(50)->get() as $batch) {
            $events->push([
                'date' => $batch->created_at?->toDateString(),
                'title' => "Importação {$batch->source} — {$batch->status}",
                'type' => 'import',
                'meta' => [
                    'id' => $batch->id,
                    'total_messages' => $batch->total_messages,
                ],
            ]);
        }

        foreach ($dnaQuery->limit(50)->get() as $dna) {
            $events->push([
                'date' => $dna->created_at?->toDateString(),
                'title' => "DNA {$dna->version} extraído",
                'type' => 'dna',
                'meta' => ['version' => $dna->version],
            ]);
        }

        foreach ($trainQuery->limit(50)->get() as $job) {
            $events->push([
                'date' => $job->created_at?->toDateString(),
                'title' => "Treino {$job->type} — {$job->status}",
                'type' => 'training',
                'meta' => ['id' => $job->id],
            ]);
        }

        foreach (Twin::orderByDesc('created_at')->limit(20)->get() as $twin) {
            $events->push([
                'date' => $twin->created_at?->toDateString(),
                'title' => "Twin criado: {$twin->name}",
                'type' => 'twin',
                'meta' => ['id' => $twin->id],
            ]);
        }

        $sorted = $events->sortByDesc('date')->values()->take(100);

        return response()->json(['data' => $sorted]);
    }
}
