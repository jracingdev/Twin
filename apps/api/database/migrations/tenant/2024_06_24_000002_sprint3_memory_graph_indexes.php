<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('memory_entities')) {
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
        }

        if (! Schema::hasTable('memory_edges')) {
            Schema::create('memory_edges', function (Blueprint $table) {
                $table->id();
                $table->foreignUuid('subject_id')->constrained('memory_entities')->cascadeOnDelete();
                $table->foreignUuid('object_id')->constrained('memory_entities')->cascadeOnDelete();
                $table->string('relation', 64);
                $table->text('context')->nullable();
                $table->timestamps();
            });
        }

        Schema::table('memory_entities', function (Blueprint $table) {
            $table->index(['twin_id', 'type', 'label'], 'memory_entities_twin_type_label_idx');
        });

        Schema::table('memory_edges', function (Blueprint $table) {
            $table->index(['subject_id', 'relation'], 'memory_edges_subject_relation_idx');
        });
    }

    public function down(): void
    {
        Schema::table('memory_entities', function (Blueprint $table) {
            $table->dropIndex('memory_entities_twin_type_label_idx');
        });

        Schema::table('memory_edges', function (Blueprint $table) {
            $table->dropIndex('memory_edges_subject_relation_idx');
        });
    }
};
