<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('twins', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedTinyInteger('intensity')->default(2);
            $table->boolean('seller_mode')->default(false);
            $table->string('vertical', 64)->nullable();
            $table->string('status', 32)->default('draft');
            $table->timestamps();
        });

        Schema::create('contacts', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('display_name');
            $table->string('channel', 32)->default('whatsapp');
            $table->string('external_id')->nullable();
            $table->json('tags')->nullable();
            $table->string('preferred_tone', 32)->nullable();
            $table->timestamps();
            $table->index(['channel', 'external_id']);
        });

        Schema::create('import_batches', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->unsignedBigInteger('consent_id');
            $table->string('source', 32);
            $table->string('status', 32)->default('pending');
            $table->string('file_path')->nullable();
            $table->string('file_hash', 64)->nullable();
            $table->unsignedInteger('total_messages')->default(0);
            $table->unsignedInteger('processed_messages')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('conversations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->constrained('contacts')->cascadeOnDelete();
            $table->string('channel', 32);
            $table->timestamp('last_message_at')->nullable();
            $table->timestamps();
            $table->index(['twin_id', 'contact_id']);
        });

        Schema::create('messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->foreignUuid('conversation_id')->constrained('conversations')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->text('body');
            $table->string('role', 16);
            $table->timestamp('sent_at');
            $table->unsignedSmallInteger('emoji_count')->default(0);
            $table->unsignedInteger('reply_latency_seconds')->nullable();
            $table->string('content_hash', 64)->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['twin_id', 'conversation_id', 'sent_at']);
        });

        Schema::create('behavioral_dna', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->string('version', 16)->default('1.0.0');
            $table->json('payload');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->index(['twin_id', 'is_active']);
        });

        Schema::create('dna_versions', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->string('version', 16);
            $table->json('payload');
            $table->string('change_summary')->nullable();
            $table->timestamps();
        });

        Schema::create('memory_entities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('label');
            $table->text('content')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['twin_id', 'type']);
        });

        Schema::create('memory_edges', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('subject_id')->constrained('memory_entities')->cascadeOnDelete();
            $table->foreignUuid('object_id')->constrained('memory_entities')->cascadeOnDelete();
            $table->string('relation', 64);
            $table->text('context')->nullable();
            $table->timestamps();
        });

        Schema::create('training_jobs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->string('type', 32);
            $table->string('status', 32)->default('queued');
            $table->json('result')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('response_suggestions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->foreignUuid('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->text('input_text');
            $table->text('suggested_text');
            $table->unsignedTinyInteger('intensity')->default(2);
            $table->decimal('score', 5, 4)->nullable();
            $table->string('status', 32)->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('seller_playbooks', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('twin_id')->constrained('twins')->cascadeOnDelete();
            $table->string('intent', 32);
            $table->string('vertical', 64)->default('autopecas');
            $table->text('template');
            $table->json('variables')->nullable();
            $table->unsignedInteger('usage_count')->default(0);
            $table->timestamps();
            $table->index(['twin_id', 'intent']);
        });

        Schema::create('retention_policies', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('days')->default(365);
            $table->boolean('auto_purge')->default(false);
            $table->timestamps();
        });

        Schema::create('export_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id');
            $table->string('status', 32)->default('pending');
            $table->string('file_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('export_requests');
        Schema::dropIfExists('retention_policies');
        Schema::dropIfExists('seller_playbooks');
        Schema::dropIfExists('response_suggestions');
        Schema::dropIfExists('training_jobs');
        Schema::dropIfExists('memory_edges');
        Schema::dropIfExists('memory_entities');
        Schema::dropIfExists('dna_versions');
        Schema::dropIfExists('behavioral_dna');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversations');
        Schema::dropIfExists('import_batches');
        Schema::dropIfExists('contacts');
        Schema::dropIfExists('twins');
    }
};
