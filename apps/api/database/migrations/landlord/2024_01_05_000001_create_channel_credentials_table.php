<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('channel_credentials', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations')->cascadeOnDelete();
            $table->uuid('twin_id');
            $table->string('channel', 32);
            $table->text('credentials');
            $table->string('webhook_token', 64)->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['channel', 'webhook_token']);
            $table->index(['organization_id', 'channel']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('channel_credentials');
    }
};
