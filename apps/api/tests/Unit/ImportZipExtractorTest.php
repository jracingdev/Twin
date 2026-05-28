<?php

namespace Tests\Unit;

use App\Services\ImportZipExtractor;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;
use ZipArchive;

class ImportZipExtractorTest extends TestCase
{
    public function test_extracts_json_from_zip_safely(): void
    {
        Storage::fake('local');
        config(['twin.import_disk' => 'local']);

        $zipPath = storage_path('framework/testing/sample_import.zip');
        if (! is_dir(dirname($zipPath))) {
            mkdir(dirname($zipPath), 0755, true);
        }

        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString(
            'your_instagram_activity/messages/inbox/x/message_1.json',
            '{"participants":[{"name":"A"}],"messages":[{"sender_name":"A","timestamp_ms":1700000000000,"content":"hi","type":"Generic"}]}'
        );
        $zip->close();

        $extractor = new ImportZipExtractor;
        $meta = $extractor->extract($zipPath, 'twin-test-uuid', 'instagram');

        $this->assertSame('instagram', $meta['channel']);
        $this->assertSame(1, $meta['file_count']);
        $this->assertCount(1, $meta['files']);
        Storage::disk('local')->assertExists($meta['extracted_path'].'/message_1.json');

        @unlink($zipPath);
    }

    public function test_rejects_unsafe_paths(): void
    {
        Storage::fake('local');
        config(['twin.import_disk' => 'local']);

        $zipPath = storage_path('framework/testing/unsafe.zip');
        $zip = new ZipArchive;
        $zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString('../../etc/passwd', 'evil');
        $zip->close();

        $extractor = new ImportZipExtractor;
        $this->expectException(\RuntimeException::class);
        $extractor->extract($zipPath, 'twin-test', 'instagram');

        @unlink($zipPath);
    }
}
