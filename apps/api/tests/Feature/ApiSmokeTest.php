<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ApiSmokeTest extends TestCase
{
    public function test_root_returns_ok(): void
    {
        $response = $this->get('/');

        $response->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_health_endpoint(): void
    {
        $response = $this->get('/up');

        $response->assertOk();
    }

    public function test_api_docs_route_registered(): void
    {
        $uris = collect(Route::getRoutes())->map(fn ($route) => $route->uri());

        $this->assertTrue($uris->contains('api/v1/docs'));
        $this->assertTrue($uris->contains('api/v1/login'));
        $this->assertTrue($uris->contains('api/v1/twins'));
        $this->assertTrue($uris->contains('api/webhooks/stripe'));
    }

    public function test_register_disabled_by_default(): void
    {
        config(['twin.registration_enabled' => false]);

        $response = $this->postJson('/api/v1/register', [
            'name' => 'Test',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'organization_name' => 'Org Test',
        ]);

        $response->assertStatus(403);
    }
}
