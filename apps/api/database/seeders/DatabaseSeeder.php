<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->plans() as $plan) {
            Plan::updateOrCreate(
                ['slug' => $plan['slug']],
                $plan,
            );
        }

        $user = User::firstOrCreate(
            ['email' => 'admin@twin.local'],
            [
                'name' => 'Admin TWIN',
                'password' => 'password',
            ],
        );

        $org = Organization::firstOrCreate(
            ['slug' => 'demo'],
            ['name' => 'Demo Organization'],
        );

        if (! $org->users()->where('users.id', $user->id)->exists()) {
            $org->users()->attach($user->id, ['role' => 'owner']);
        }

        $freePlan = Plan::where('slug', 'free')->first();
        if ($freePlan) {
            Subscription::firstOrCreate(
                [
                    'organization_id' => $org->id,
                    'plan_id' => $freePlan->id,
                ],
                ['stripe_status' => 'active'],
            );
        }
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function plans(): array
    {
        return [
            [
                'slug' => 'free',
                'name' => 'Free',
                'messages_per_month' => 50000,
                'twins_limit' => 1,
                'seller_mode' => false,
                'api_requests' => 0,
                'price_monthly' => 0,
            ],
            [
                'slug' => 'pro',
                'name' => 'Pro',
                'messages_per_month' => 500000,
                'twins_limit' => 3,
                'seller_mode' => true,
                'api_requests' => 10000,
                'price_monthly' => 99,
            ],
            [
                'slug' => 'business',
                'name' => 'Business',
                'messages_per_month' => 5000000,
                'twins_limit' => 10,
                'seller_mode' => true,
                'api_requests' => 100000,
                'price_monthly' => 299,
            ],
        ];
    }
}
