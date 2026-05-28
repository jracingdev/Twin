<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class ResetDemoUserCommand extends Command
{
    protected $signature = 'twin:reset-demo-user {--password=password}';

    protected $description = 'Ensure admin@twin.local demo user exists with a known password';

    public function handle(): int
    {
        $email = 'admin@twin.local';
        $password = (string) $this->option('password');

        $user = User::firstOrNew(['email' => $email]);
        $user->fill([
            'name' => 'Admin TWIN',
            'password' => $password,
        ]);
        $user->save();

        $org = Organization::where('slug', 'demo')->first();
        if (! $org) {
            $org = Organization::create([
                'id' => (string) Str::uuid(),
                'name' => 'Demo Organization',
                'slug' => 'demo',
            ]);
        }

        if (! $org->users()->where('users.id', $user->id)->exists()) {
            $org->users()->attach($user->id, ['role' => 'owner']);
        }

        $this->info("Demo user ready: {$email} / {$password}");
        $this->line("Organization: {$org->name} ({$org->id})");

        return self::SUCCESS;
    }
}