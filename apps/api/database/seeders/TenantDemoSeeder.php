<?php

namespace Database\Seeders;

use App\Models\BehavioralDna;
use App\Models\SellerPlaybook;
use App\Models\Twin;
use Illuminate\Database\Seeder;

class TenantDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (Twin::exists()) {
            return;
        }

        $twin = Twin::create([
            'name' => 'Meu TWIN Demo',
            'description' => 'Gêmeo digital de demonstração',
            'intensity' => 2,
            'seller_mode' => true,
            'vertical' => 'autopecas',
            'status' => 'active',
        ]);

        BehavioralDna::create([
            'twin_id' => $twin->id,
            'version' => '1.0.0',
            'is_active' => true,
            'payload' => [
                'similarity_score' => 87,
                'radar' => [
                    ['trait' => 'Formalidade', 'value' => 35],
                    ['trait' => 'Emojis', 'value' => 60],
                    ['trait' => 'Empatia', 'value' => 78],
                    ['trait' => 'Comercial', 'value' => 72],
                    ['trait' => 'Objetividade', 'value' => 85],
                    ['trait' => 'Naturalidade', 'value' => 88],
                ],
                'intents' => ['Saudação', 'Negociação', 'Suporte', 'Objeção', 'Fechamento', 'Upsell'],
            ],
        ]);

        foreach (
            [
                ['intent' => 'objection_price', 'label' => 'Objeção de preço', 'vertical' => 'autopecas'],
                ['intent' => 'closing', 'label' => 'Fechamento', 'vertical' => 'motopeças'],
                ['intent' => 'upsell', 'label' => 'Upsell kit', 'vertical' => 'ERP'],
                ['intent' => 'reactivation', 'label' => 'Reativação cliente', 'vertical' => 'autopecas'],
            ] as $pb
        ) {
            SellerPlaybook::create([
                'twin_id' => $twin->id,
                'intent' => $pb['intent'],
                'vertical' => $pb['vertical'],
                'template' => $pb['label'],
            ]);
        }
    }
}
