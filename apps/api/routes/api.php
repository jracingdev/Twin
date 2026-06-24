<?php



use App\Http\Controllers\Api\V1\ApiKeyController;

use App\Http\Controllers\Api\V1\AuthController;

use App\Http\Controllers\Api\V1\BillingController;

use App\Http\Controllers\Api\V1\ConsentController;

use App\Http\Controllers\Api\V1\ContactController;

use App\Http\Controllers\Api\V1\ConversationController;

use App\Http\Controllers\Api\V1\DocsController;

use App\Http\Controllers\Api\V1\ImportController;

use App\Http\Controllers\Api\V1\LgpdController;

use App\Http\Controllers\Api\V1\PlaybookController;

use App\Http\Controllers\Api\V1\SuggestionController;

use App\Http\Controllers\Api\V1\SuggestController;

use App\Http\Controllers\Api\V1\TimelineController;

use App\Http\Controllers\Api\V1\TrainController;

use App\Http\Controllers\Api\V1\TwinController;

use App\Http\Controllers\Api\V1\TwoFactorController;

use App\Http\Controllers\Api\V1\WebhookController;

use App\Http\Controllers\Api\V1\WebhookSettingsController;

use App\Http\Controllers\Internal\InternalJobCallbackController;

use App\Http\Controllers\Api\V1\ChannelCredentialController;

use App\Http\Controllers\Api\V1\ChannelMetricsController;

use App\Http\Controllers\Api\V1\MemoryEntityController;

use App\Http\Controllers\Api\V1\TwinReplayController;

use App\Http\Controllers\Api\V1\TwinTrainController;

use App\Http\Controllers\Webhooks\ChannelWebhookController;

use Illuminate\Support\Facades\Route;



Route::get('v1/docs', [DocsController::class, 'index']);

Route::get('v1/docs/openapi.yaml', [DocsController::class, 'openapi']);

Route::get('v1/docs/ui', [DocsController::class, 'swaggerUi']);



Route::prefix('v1')->group(function () {

    Route::post('login', [AuthController::class, 'login']);

    Route::post('register', [AuthController::class, 'register']);

    Route::post('forgot-password', [AuthController::class, 'forgotPassword']);

    Route::post('reset-password', [AuthController::class, 'resetPassword']);

    // Sessão do usuário — landlord only; /me descobre a org (não exige X-Tenant ainda)
    Route::middleware(['auth:sanctum'])->group(function () {

        Route::post('logout', [AuthController::class, 'logout']);

        Route::get('me', [AuthController::class, 'me']);

        Route::get('organizations', [AuthController::class, 'organizations']);

        Route::post('organizations/switch', [AuthController::class, 'switchOrganization']);

        Route::get('two-factor/status', [TwoFactorController::class, 'status']);

        Route::post('two-factor/enable', [TwoFactorController::class, 'enable']);

        Route::post('two-factor/confirm', [TwoFactorController::class, 'confirm']);

        Route::delete('two-factor', [TwoFactorController::class, 'disable']);

    });

    Route::middleware(['auth:sanctum', 'tenant', 'tenant.provisioned'])->group(function () {

        Route::get('billing/subscription', [BillingController::class, 'subscription']);

        Route::get('billing/plans', [BillingController::class, 'plans']);

        Route::post('billing/checkout', [BillingController::class, 'checkout']);

        Route::post('billing/portal', [BillingController::class, 'portal']);



        Route::get('lgpd/retention', [LgpdController::class, 'retention']);

        Route::post('lgpd/export', [LgpdController::class, 'requestExport']);

        Route::get('lgpd/exports/{export}', [LgpdController::class, 'exportStatus']);

        Route::get('lgpd/exports/{export}/download', [LgpdController::class, 'downloadExport']);

        Route::post('lgpd/account-deletion', [LgpdController::class, 'requestAccountDeletion']);



        Route::get('webhooks/settings', [WebhookSettingsController::class, 'show']);

        Route::put('webhooks/settings', [WebhookSettingsController::class, 'update']);

        Route::post('webhooks/test', [WebhookSettingsController::class, 'test']);



        Route::apiResource('contacts', ContactController::class);

        Route::get('conversations', [ConversationController::class, 'index']);

        Route::get('conversations/{conversation}', [ConversationController::class, 'show']);



        Route::get('twins/{twin}/stats', [TwinController::class, 'stats']);

        Route::get('twins/{twin}/dna/evolution', [TwinController::class, 'dnaEvolution']);

        Route::get('twins/{twin}/imports', [TwinController::class, 'imports']);

        Route::get('twins/{twin}/playbooks', [TwinController::class, 'playbooks']);

        Route::post('twins/{twin}/playbooks/resync', [PlaybookController::class, 'resync']);

        Route::post('twins/{twin}/playbooks', [PlaybookController::class, 'store']);

        Route::put('twins/{twin}/playbooks/{playbook}', [PlaybookController::class, 'update']);

        Route::delete('twins/{twin}/playbooks/{playbook}', [PlaybookController::class, 'destroy']);

        Route::post('twins/{twin}/purge', [TwinController::class, 'purge'])->name('twins.purge');

        Route::get('twins/{twin}/memory-entities', [MemoryEntityController::class, 'index']);
        Route::post('twins/{twin}/memory-entities', [MemoryEntityController::class, 'store']);
        Route::get('twins/{twin}/memory-edges', [MemoryEntityController::class, 'indexEdges']);
        Route::post('twins/{twin}/memory-edges', [MemoryEntityController::class, 'storeEdge']);

        Route::post('twins/{twin}/train', [TwinTrainController::class, 'train']);
        Route::get('twins/{twin}/training-status', [TwinTrainController::class, 'status']);

        Route::post('twins/{twin}/replay', [TwinReplayController::class, 'replay']);

        Route::apiResource('twins', TwinController::class);



        Route::post('imports', [ImportController::class, 'store']);

        Route::get('imports/{import}', [ImportController::class, 'show']);



        Route::get('consent/latest', [ConsentController::class, 'latest']);
        Route::post('consent', [ConsentController::class, 'store']);



        Route::post('suggest', [SuggestController::class, 'store']);

        Route::get('suggestions', [SuggestionController::class, 'index']);

        Route::get('suggestions/metrics', [SuggestionController::class, 'metrics']);

        Route::get('channel-metrics', [ChannelMetricsController::class, 'index']);

        Route::get('suggestions/{suggestion}/explain', [SuggestionController::class, 'explain']);

        Route::post('suggestions/{suggestion}/send', [SuggestionController::class, 'send']);

        Route::patch('suggestions/{suggestion}', [SuggestController::class, 'feedback']);



        Route::post('train/trigger', [TrainController::class, 'trigger']);

        Route::get('train/jobs/{job}', [TrainController::class, 'show']);



        Route::get('timeline', [TimelineController::class, 'index']);

        Route::get('api-keys', [ApiKeyController::class, 'index']);

        Route::post('api-keys', [ApiKeyController::class, 'store']);

        Route::delete('api-keys/{apiKey}', [ApiKeyController::class, 'destroy']);



        Route::get('plan', fn (\App\Services\PlanFeaturesService $plans) => response()->json(
            $plans->planSummary(tenant('id'))
        ));

        Route::get('channel-credentials', [ChannelCredentialController::class, 'index']);

        Route::post('channel-credentials', [ChannelCredentialController::class, 'store']);

        Route::put('channel-credentials/{channelCredential}', [ChannelCredentialController::class, 'update']);

        Route::delete('channel-credentials/{channelCredential}', [ChannelCredentialController::class, 'destroy']);

    });

});



Route::post('webhooks/stripe', [WebhookController::class, 'stripe']);

Route::match(['get', 'post'], 'webhooks/channel/{platform}/{webhookToken}', [ChannelWebhookController::class, 'handle']);



Route::prefix('internal')->middleware(['internal.secret', 'tenant', 'tenant.provisioned'])->group(function () {

    Route::post('jobs/{id}/complete', [InternalJobCallbackController::class, 'complete']);

});

