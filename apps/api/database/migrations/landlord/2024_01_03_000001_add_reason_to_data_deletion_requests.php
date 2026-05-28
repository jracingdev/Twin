<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('data_deletion_requests', function (Blueprint $table) {
            $table->text('reason')->nullable()->after('status');
            $table->timestamp('processed_at')->nullable()->after('reason');
        });
    }

    public function down(): void
    {
        Schema::table('data_deletion_requests', function (Blueprint $table) {
            $table->dropColumn(['reason', 'processed_at']);
        });
    }
};
