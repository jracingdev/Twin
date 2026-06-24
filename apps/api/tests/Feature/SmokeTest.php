<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use App\Models\Organization;
use App\Models\User;
use Stancl\Tenancy\Jobs\CreateDatabase;
use Stancl\Tenancy\Jobs\MigrateDatabase;
use Tests\TestCase;

class SmokeTest extends TestCase
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

    public function test_login_rejects_invalid_credentials(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'inexistente@example.com',
            'password' => 'senha-invalida',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_twins_list_requires_authentication(): void
    {
        $response = $this->getJson('/api/v1/twins');

        $response->assertUnauthorized();
    }

    public function test_authenticated_user_can_list_twins_with_tenant_header(): void
    {
        $user = User::create([
            'name' => 'Usuário Teste',
            'email' => 'smoke-'.uniqid().'@example.com',
            'password' => Hash::make('password123'),
        ]);

        $organization = Organization::create([
            'name' => 'Org Smoke',
            'slug' => 'org-smoke-'.uniqid(),
        ]);
        $organization->users()->attach($user->id, ['role' => 'owner']);

        try {
            if (! $organization->database()->manager()->databaseExists($organization)) {
                CreateDatabase::dispatchSync($organization);
            }
        } catch (\Throwable $e) {
            if (! str_contains(strtolower($e->getMessage()), 'already exists')) {
                throw $e;
            }
        }

        try {
            MigrateDatabase::dispatchSync($organization);
        } catch (\Throwable $e) {
            $msg = strtolower($e->getMessage());
            if (! str_contains($msg, 'already exists') && ! str_contains($msg, 'nothing to migrate')) {
                throw $e;
            }
        }

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->withToken($token)
            ->withHeader('X-Tenant', $organization->id)
            ->getJson('/api/v1/twins');

        $response->assertOk()
            ->assertJsonStructure(['data', 'current_page', 'per_page']);
    }

    public function test_sprint3_routes_registered(): void
    {
        $uris = collect(Route::getRoutes())->map(fn ($route) => $route->uri());

        $this->assertTrue($uris->contains('api/v1/twins/{twin}/memory-entities'));
        $this->assertTrue($uris->contains('api/v1/twins/{twin}/memory-edges'));
        $this->assertTrue($uris->contains('api/v1/twins/{twin}/train'));
        $this->assertTrue($uris->contains('api/v1/twins/{twin}/training-status'));
        $this->assertTrue($uris->contains('api/v1/twins/{twin}/replay'));
    }
}
