<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('channel_credentials', function (Blueprint $table) {
            $table->string('reply_mode', 16)->default('approval')->after('is_active');
        });
    }

    public function down(): void
    {
        Schema::table('channel_credentials', function (Blueprint $table) {
            $table->dropColumn('reply_mode');
        });
    }
};
