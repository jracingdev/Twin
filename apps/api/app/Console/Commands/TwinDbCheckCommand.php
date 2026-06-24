<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class TwinDbCheckCommand extends Command
{
    protected $signature = 'twin:db-check';

    protected $description = 'Verifica conexão MySQL, extensão PDO e permissões para tenants';

    public function handle(): int
    {
        $driver = config('database.default');

        if ($driver !== 'mysql') {
            $this->warn("DB_CONNECTION={$driver} — este comando valida MySQL.");
            $this->line('Para servidor, defina DB_CONNECTION=mysql em apps/api/.env');

            return self::FAILURE;
        }

        if (! extension_loaded('pdo_mysql')) {
            $this->error('Extensão pdo_mysql não habilitada no PHP.');

            return self::FAILURE;
        }

        try {
            DB::connection()->getPdo();
            $version = DB::selectOne('SELECT VERSION() AS v')->v ?? '?';
            $this->info("Conexão OK — MySQL {$version}");
        } catch (\Throwable $e) {
            $this->error('Falha na conexão: '.$e->getMessage());
            $this->line('Verifique DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD');

            return self::FAILURE;
        }

        $db = config('database.connections.mysql.database');
        if (! Schema::hasTable('organizations') && ! Schema::hasTable('migrations')) {
            $this->line("Banco `{$db}` acessível (ainda sem migrations).");
        } else {
            $orgs = DB::table('organizations')->count();
            $this->line("Landlord OK — {$orgs} organização(ões).");
        }

        try {
            $canCreate = DB::selectOne("SHOW GRANTS FOR CURRENT_USER()");
            $grants = json_encode($canCreate);
            if (is_string($grants) && (str_contains($grants, 'CREATE') || str_contains($grants, 'ALL PRIVILEGES ON *.*'))) {
                $this->info('Permissão CREATE detectada — tenants:provision deve funcionar.');
            } else {
                $this->warn('Permissão CREATE não detectada. tenants:provision pode falhar.');
                $this->line('Execute scripts/mysql/01-create-landlord.sql no servidor.');
            }
        } catch (\Throwable) {
            $this->warn('Não foi possível ler GRANTS (normal em alguns hosts).');
        }

        return self::SUCCESS;
    }
}
