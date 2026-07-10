<?php

namespace App\Console\Commands;

use App\Models\Message;
use App\Models\Organization;
use App\Models\ResponseSuggestion;
use App\Models\RetentionPolicy;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class ApplyRetentionCommand extends Command
{
    protected $signature = 'lgpd:apply-retention
                            {--org= : Aplicar apenas nesta organização (UUID)}
                            {--dry-run : Contar registros sem apagar}';

    protected $description = 'Aplica retenção LGPD: purge de mensagens/sugestões antigas quando auto_purge está ativo';

    public function handle(): int
    {
        $query = Organization::query();
        if ($orgId = $this->option('org')) {
            $query->where('id', $orgId);
        }

        $dryRun = (bool) $this->option('dry-run');
        $orgsProcessed = 0;
        $messagesDeleted = 0;
        $suggestionsDeleted = 0;
        $skipped = 0;

        foreach ($query->cursor() as $org) {
            try {
                tenancy()->initialize($org);

                $policy = RetentionPolicy::query()->where('auto_purge', true)->first();
                if (! $policy) {
                    $skipped++;
                    continue;
                }

                $cutoff = now()->subDays((int) $policy->days);

                if ($dryRun) {
                    $orgMessages = Message::query()->where('sent_at', '<', $cutoff)->count();
                    $orgSuggestions = ResponseSuggestion::query()->where('created_at', '<', $cutoff)->count();
                } else {
                    $orgMessages = 0;
                    $orgSuggestions = 0;

                    while (true) {
                        $ids = Message::query()
                            ->where('sent_at', '<', $cutoff)
                            ->orderBy('id')
                            ->limit(500)
                            ->pluck('id');
                        if ($ids->isEmpty()) {
                            break;
                        }
                        $orgMessages += $ids->count();
                        Message::whereIn('id', $ids)->delete();
                    }

                    while (true) {
                        $ids = ResponseSuggestion::query()
                            ->where('created_at', '<', $cutoff)
                            ->orderBy('id')
                            ->limit(500)
                            ->pluck('id');
                        if ($ids->isEmpty()) {
                            break;
                        }
                        $orgSuggestions += $ids->count();
                        ResponseSuggestion::whereIn('id', $ids)->delete();
                    }
                }

                $messagesDeleted += $orgMessages;
                $suggestionsDeleted += $orgSuggestions;
                $orgsProcessed++;

                $this->line(sprintf(
                    '%s %s (%s): messages=%d suggestions=%d (retenção %d dias)',
                    $dryRun ? '[dry-run]' : '✓',
                    $org->name,
                    $org->id,
                    $orgMessages,
                    $orgSuggestions,
                    $policy->days
                ));
            } catch (\Throwable $e) {
                $this->error("Falha em {$org->id}: {$e->getMessage()}");
                Log::warning('lgpd:apply-retention falhou para organização', [
                    'organization_id' => $org->id,
                    'error' => $e->getMessage(),
                ]);
            } finally {
                if (tenancy()->initialized) {
                    tenancy()->end();
                }
            }
        }

        $this->info(sprintf(
            'Concluído%s: orgs=%d skipped=%d messages=%d suggestions=%d',
            $dryRun ? ' (dry-run)' : '',
            $orgsProcessed,
            $skipped,
            $messagesDeleted,
            $suggestionsDeleted
        ));

        return self::SUCCESS;
    }
}
