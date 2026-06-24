<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Plan;
use App\Services\PlanFeaturesService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PlanFeaturesDemoTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        if (! Schema::hasTable('users')) {
            Artisan::call('migrate', [
                '--path' => database_path('migrations/landlord'),
                '--realpath' => true,
                '--force' => true,
            ]);
        }
    }

    public function test_demo_organization_gets_business_plan(): void
    {
        Plan::updateOrCreate(
            ['slug' => 'business'],
            [
                'name' => 'Business',
                'messages_per_month' => 5000000,
                'twins_limit' => 10,
                'seller_mode' => true,
                'api_requests' => 100000,
                'price_monthly' => 299,
            ],
        );

        $org = Organization::create([
            'name' => 'Demo Organization',
            'slug' => 'demo',
        ]);

        $summary = app(PlanFeaturesService::class)->planSummary($org->id);

        $this->assertSame('business', $summary['slug']);
        $this->assertTrue($summary['seller_mode']);
    }
}
