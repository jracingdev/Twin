<?php

namespace App\Services;

use App\Models\Message;
use App\Models\Plan;
use App\Models\ResponseSuggestion;
use App\Models\Subscription;
use App\Models\Twin;

class PlanFeaturesService
{
    public function currentPlan(string $organizationId): Plan
    {
        $subscription = Subscription::where('organization_id', $organizationId)
            ->whereIn('stripe_status', ['active', 'trialing'])
            ->with('plan')
            ->latest()
            ->first();

        if ($subscription?->plan) {
            return $subscription->plan;
        }

        return Plan::where('slug', 'free')->first()
            ?? new Plan(['slug' => 'free', 'seller_mode' => false, 'twins_limit' => 1]);
    }

    public function canUseSellerMode(string $organizationId): bool
    {
        return (bool) $this->currentPlan($organizationId)->seller_mode;
    }

    public function canCreateTwin(string $organizationId): bool
    {
        $plan = $this->currentPlan($organizationId);
        $count = Twin::count();

        return $count < ($plan->twins_limit ?? 1);
    }

    public function canSuggest(string $organizationId): bool
    {
        $limit = $this->currentPlan($organizationId)->messages_per_month;
        if (! $limit || $limit <= 0) {
            return true;
        }

        $used = ResponseSuggestion::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        return $used < $limit;
    }

    public function canImport(string $organizationId): bool
    {
        $limit = $this->currentPlan($organizationId)->messages_per_month;
        if (! $limit || $limit <= 0) {
            return true;
        }

        $used = Message::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        return $used < $limit;
    }

    public function planSummary(string $organizationId): array
    {
        $plan = $this->currentPlan($organizationId);

        return [
            'slug' => $plan->slug,
            'name' => $plan->name,
            'seller_mode' => (bool) $plan->seller_mode,
            'twins_limit' => $plan->twins_limit,
            'messages_per_month' => $plan->messages_per_month,
        ];
    }
}
