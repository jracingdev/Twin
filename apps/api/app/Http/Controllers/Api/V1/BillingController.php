<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Plan;
use App\Models\Subscription;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BillingController extends Controller
{
    public function subscription(): JsonResponse
    {
        $orgId = tenant('id');
        $sub = Subscription::where('organization_id', $orgId)
            ->with('plan')
            ->latest()
            ->first();

        return response()->json([
            'subscription' => $sub ? [
                'plan' => $sub->plan?->only(['id', 'slug', 'name', 'price_monthly', 'twins_limit', 'seller_mode']),
                'stripe_status' => $sub->stripe_status,
                'trial_ends_at' => $sub->trial_ends_at,
                'ends_at' => $sub->ends_at,
            ] : null,
            'stripe_configured' => (bool) config('services.stripe.secret'),
        ]);
    }

    public function plans(): JsonResponse
    {
        return response()->json(['data' => Plan::orderBy('price_monthly')->get()]);
    }

    public function checkout(Request $request): JsonResponse
    {
        $central = config('tenancy.database.central_connection');

        $data = $request->validate([
            'plan_slug' => [
                'required',
                'string',
                Rule::exists('plans', 'slug')->connection($central),
            ],
        ]);

        $secret = config('services.stripe.secret');
        if (! $secret) {
            return response()->json([
                'message' => 'Stripe não configurado. Defina STRIPE_SECRET no .env.',
            ], 503);
        }

        $org = Organization::findOrFail(tenant('id'));
        $plan = Plan::where('slug', $data['plan_slug'])->firstOrFail();

        $stripe = new \Stripe\StripeClient($secret);

        if (! $org->stripe_id) {
            $customer = $stripe->customers->create([
                'name' => $org->name,
                'metadata' => ['organization_id' => $org->id],
            ]);
            $org->update(['stripe_id' => $customer->id]);
        }

        $priceId = env('STRIPE_PRICE_'.strtoupper($plan->slug));
        if (! $priceId) {
            return response()->json([
                'message' => 'Defina STRIPE_PRICE_'.strtoupper($plan->slug).' no .env com o Price ID do Stripe.',
                'plan' => $plan->only(['slug', 'name', 'price_monthly']),
            ], 422);
        }

        $session = $stripe->checkout->sessions->create([
            'customer' => $org->stripe_id,
            'mode' => 'subscription',
            'line_items' => [['price' => $priceId, 'quantity' => 1]],
            'success_url' => config('twin.frontend_url').'/settings/billing?success=1',
            'cancel_url' => config('twin.frontend_url').'/settings/billing?canceled=1',
            'metadata' => [
                'organization_id' => $org->id,
                'plan_id' => (string) $plan->id,
            ],
        ]);

        return response()->json(['checkout_url' => $session->url]);
    }

    public function portal(): JsonResponse
    {
        $secret = config('services.stripe.secret');
        if (! $secret) {
            return response()->json(['message' => 'Stripe não configurado.'], 503);
        }

        $org = Organization::findOrFail(tenant('id'));
        if (! $org->stripe_id) {
            return response()->json(['message' => 'Nenhum cliente Stripe vinculado.'], 422);
        }

        $stripe = new \Stripe\StripeClient($secret);
        $session = $stripe->billingPortal->sessions->create([
            'customer' => $org->stripe_id,
            'return_url' => config('twin.frontend_url').'/settings/billing',
        ]);

        return response()->json(['portal_url' => $session->url]);
    }
}
