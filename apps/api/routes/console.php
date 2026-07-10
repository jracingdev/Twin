<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('queue:prune-failed --hours=168')->weekly();
Schedule::command('lgpd:apply-retention')->dailyAt('03:15');
