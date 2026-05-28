<?php

namespace Database\Seeders;

use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Plan::insert([
            ['slug' => 'free', 'name' => 'Free', 'messages_per_month' => 50000, 'twins_limit' => 1, 'seller_mode' => false, 'api_requests' => 0, 'price_monthly' => 0, 'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'pro', 'name' => 'Pro', 'messages_per_month' => 500000, 'twins_limit' => 3, 'seller_mode' => true, 'api_requests' => 10000, 'price_monthly' => 99, 'created_at' => now(), 'updated_at' => now()],
            ['slug' => 'business', 'name' => 'Business', 'messages_per_month' => 5000000, 'twins_limit' => 10, 'seller_mode' => true, 'api_requests' => 100000, 'price_monthly' => 299, 'created_at' => now(), 'updated_at' => now()],
        ]);

        $user = User::create([
            'name' => 'Admin TWIN',
            'email' => 'admin@twin.local',
            'password' => 'password',
        ]);

        $org = Organization::create([
            'id' => (string) Str::uuid(),
            'name' => 'Demo Organization',
            'slug' => 'demo',
        ]);

        $org->users()->attach($user->id, ['role' => 'owner']);

        $freePlan = Plan::where('slug', 'free')->first();
        if ($freePlan) {
            Subscription::create([
                'organization_id' => $org->id,
                'plan_id' => $freePlan->id,
                'stripe_status' => 'active',
            ]);
        }

    }
}
