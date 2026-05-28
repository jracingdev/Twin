<?php



namespace App\Console\Commands;



use App\Models\Organization;

use Illuminate\Console\Command;

use Illuminate\Support\Facades\Artisan;

use Stancl\Tenancy\Jobs\CreateDatabase;

use Stancl\Tenancy\Jobs\MigrateDatabase;



class ProvisionTenantsCommand extends Command

{

    protected $signature = 'tenants:provision

                            {--seed : Seed demo twin data}

                            {--org= : Provision only this organization UUID}';



    protected $description = 'Create and migrate tenant databases for organizations';



    public function handle(): int

    {

        $query = Organization::query();

        if ($orgId = $this->option('org')) {

            $query->where('id', $orgId);

        }



        $orgs = $query->get();



        if ($orgs->isEmpty()) {

            $this->warn('Nenhuma organização encontrada. Execute: php artisan db:seed');



            return self::FAILURE;

        }



        $failed = 0;



        foreach ($orgs as $org) {

            $this->info("Provisionando {$org->name} ({$org->id})…");



            try {

                if (! $org->database()->manager()->databaseExists($org)) {

                    CreateDatabase::dispatchSync($org);

                    $this->line('  ✓ Banco criado.');

                } else {

                    $this->line('  · Banco já existia.');

                }

            } catch (\Throwable $e) {

                if (str_contains(strtolower($e->getMessage()), 'already exists')) {

                    $this->line('  · Banco já existia (exceção ignorada).');

                } else {

                    $this->error('  ✗ Falha ao criar banco: '.$e->getMessage());

                    $failed++;

                    continue;

                }

            }



            try {

                MigrateDatabase::dispatchSync($org);

                $this->line('  ✓ Migrations aplicadas.');

            } catch (\Throwable $e) {

                $msg = strtolower($e->getMessage());

                if (str_contains($msg, 'already exists') || str_contains($msg, 'nothing to migrate')) {

                    $this->line('  · Migrations já aplicadas.');

                } else {

                    $this->error('  ✗ Falha nas migrations: '.$e->getMessage());

                    $failed++;

                    continue;

                }

            }



            if ($this->option('seed')) {

                try {

                    $org->run(function () {

                        Artisan::call('db:seed', [

                            '--class' => 'Database\\Seeders\\TenantDemoSeeder',

                            '--force' => true,

                        ]);

                    });

                    $this->line('  ✓ Seed aplicado.');

                } catch (\Throwable $e) {

                    $this->warn('  ! Seed falhou: '.$e->getMessage());

                }

            }

        }



        if ($failed > 0) {

            $this->error("Concluído com {$failed} falha(s).");



            return self::FAILURE;

        }



        $this->info('Provisionamento concluído com sucesso.');



        return self::SUCCESS;

    }

}

