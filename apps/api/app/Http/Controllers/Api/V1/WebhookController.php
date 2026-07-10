<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use App\Models\Subscription;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    public function stripe(Request $request): Response
    {
        $secret = config('services.stripe.webhook_secret');
        $payload = $request->getContent();
        $sig = $request->header('Stripe-Signature');
        $requireSignature = app()->environment('production') || filled($secret);

        if (app()->environment('production') && blank($secret)) {
            Log::error('Stripe webhook rejected: STRIPE_WEBHOOK_SECRET not configured in production');

            return response('Webhook secret not configured', 503);
        }

        if ($requireSignature) {
            if (blank($sig)) {
                return response('Missing signature', 400);
            }

            if (blank($secret)) {
                return response('Webhook secret not configured', 503);
            }

            try {
                $event = \Stripe\Webhook::constructEvent($payload, $sig, $secret);
            } catch (\Throwable $e) {
                Log::warning('Stripe webhook signature failed', ['error' => $e->getMessage()]);

                return response('Invalid signature', 400);
            }
        } else {
            // Local/dev only when no secret is configured
            $event = json_decode($payload, false);
            if (! $event) {
                return response('Invalid payload', 400);
            }
        }

        $type = is_object($event) ? ($event->type ?? null) : ($event['type'] ?? null);
        $object = is_object($event) ? ($event->data->object ?? null) : ($event['data']['object'] ?? null);

        if ($type === 'checkout.session.completed' && $object) {
            $this->handleCheckoutCompleted($object);
        }

        if (in_array($type, ['customer.subscription.updated', 'customer.subscription.deleted'], true) && $object) {
            $this->syncSubscription($object);
        }

        return response('ok');
    }

    private function handleCheckoutCompleted(object $session): void
    {
        $orgId = $session->metadata->organization_id ?? null;
        $planId = $session->metadata->plan_id ?? null;

        if (! $orgId || ! $planId) {
            return;
        }

        Subscription::updateOrCreate(
            ['organization_id' => $orgId],
            [
                'plan_id' => (int) $planId,
                'stripe_id' => $session->subscription ?? $session->id,
                'stripe_status' => 'active',
            ]
        );
    }

    private function syncSubscription(object $subscription): void
    {
        $customerId = $subscription->customer ?? null;
        if (! $customerId) {
            return;
        }

        $org = Organization::where('stripe_id', $customerId)->first();
        if (! $org) {
            return;
        }

        $sub = Subscription::where('organization_id', $org->id)->first();
        if ($sub) {
            $sub->update([
                'stripe_status' => $subscription->status ?? 'unknown',
                'ends_at' => isset($subscription->cancel_at)
                    ? now()->setTimestamp($subscription->cancel_at)
                    : null,
            ]);
        }
    }
}
