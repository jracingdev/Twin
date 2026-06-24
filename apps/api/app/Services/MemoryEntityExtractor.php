<?php

namespace App\Services;

use App\Models\MemoryEdge;
use App\Models\MemoryEntity;
use App\Models\ResponseSuggestion;

class MemoryEntityExtractor
{
    /** @var list<string> */
    private const OBJECTION_KEYWORDS = [
        'caro', 'caríssimo', 'carissimo', 'preço', 'preco', 'desconto', 'muito caro',
        'não tenho', 'nao tenho', 'não posso', 'nao posso', 'orçamento', 'orcamento',
        'concorrente', 'mais barato', 'não compensa', 'nao compensa',
    ];

    public function extractFromSuggestion(ResponseSuggestion $suggestion): void
    {
        $input = trim($suggestion->input_text);
        $accepted = trim($suggestion->suggested_text);
        if ($input === '' && $accepted === '') {
            return;
        }

        $objection = $this->detectObjection($input);
        $products = $this->extractProducts($input.' '.$accepted);

        $objectionEntity = null;
        if ($objection !== null) {
            $objectionEntity = $this->upsertEntity(
                $suggestion->twin_id,
                'objection',
                $objection,
                $input,
                ['suggestion_id' => $suggestion->id, 'source' => 'feedback']
            );
        }

        $productEntities = [];
        foreach ($products as $label) {
            $productEntities[] = $this->upsertEntity(
                $suggestion->twin_id,
                'product',
                $label,
                null,
                ['suggestion_id' => $suggestion->id, 'source' => 'feedback']
            );
        }

        if ($objectionEntity !== null) {
            foreach ($productEntities as $productEntity) {
                MemoryEdge::firstOrCreate(
                    [
                        'subject_id' => $objectionEntity->id,
                        'object_id' => $productEntity->id,
                        'relation' => 'mentions',
                    ],
                    [
                        'context' => mb_substr($input, 0, 500),
                    ]
                );
            }
        }
    }

    private function detectObjection(string $text): ?string
    {
        $lower = mb_strtolower($text);
        foreach (self::OBJECTION_KEYWORDS as $keyword) {
            if (str_contains($lower, $keyword)) {
                return 'Objeção: '.$keyword;
            }
        }

        if (preg_match('/\b(não|nao)\s+(quero|preciso|vou|compro|aceito)\b/ui', $text)) {
            return 'Objeção: recusa';
        }

        return null;
    }

    /**
     * @return list<string>
     */
    private function extractProducts(string $text): array
    {
        $products = [];

        if (preg_match_all('/["\']([^"\']{2,80})["\']/u', $text, $quoted)) {
            foreach ($quoted[1] as $match) {
                $products[] = trim($match);
            }
        }

        if (preg_match_all('/\b(?:produto|modelo|item|peça|peca|serviço|servico)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][\wÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç\-]{1,60})/u', $text, $labeled)) {
            foreach ($labeled[1] as $match) {
                $products[] = trim($match);
            }
        }

        if (preg_match_all('/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9\-]{2,40})\b/u', $text, $caps)) {
            foreach ($caps[1] as $match) {
                if (mb_strlen($match) >= 3) {
                    $products[] = trim($match);
                }
            }
        }

        $unique = [];
        foreach ($products as $label) {
            $normalized = mb_strtolower(trim($label));
            if ($normalized === '' || isset($unique[$normalized])) {
                continue;
            }
            $unique[$normalized] = $label;
        }

        return array_slice(array_values($unique), 0, 5);
    }

    private function upsertEntity(
        string $twinId,
        string $type,
        string $label,
        ?string $content,
        array $metadata
    ): MemoryEntity {
        $entity = MemoryEntity::where('twin_id', $twinId)
            ->where('type', $type)
            ->where('label', $label)
            ->first();

        if ($entity) {
            $entity->update([
                'content' => $content ?? $entity->content,
                'metadata' => array_merge($entity->metadata ?? [], $metadata),
            ]);

            return $entity->fresh();
        }

        return MemoryEntity::create([
            'twin_id' => $twinId,
            'type' => $type,
            'label' => $label,
            'content' => $content,
            'metadata' => $metadata,
        ]);
    }
}
