<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('channel_credentials')
            ->where('reply_mode', 'approval')
            ->update(['reply_mode' => 'copilot']);

        Schema::table('channel_credentials', function (Blueprint $table) {
            $table->decimal('confidence_threshold', 3, 2)->nullable()->default(0.75)->after('reply_mode');
            $table->string('reply_mode', 16)->default('copilot')->change();
        });
    }

    public function down(): void
    {
        Schema::table('channel_credentials', function (Blueprint $table) {
            $table->dropColumn('confidence_threshold');
            $table->string('reply_mode', 16)->default('approval')->change();
        });

        DB::table('channel_credentials')
            ->where('reply_mode', 'copilot')
            ->update(['reply_mode' => 'approval']);
    }
};
