<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use ZipArchive;

class ImportZipExtractor
{
    private const MAX_FILES = 500;

    private const MAX_UNCOMPRESSED_BYTES = 104857600; // 100 MB

    private const ALLOWED_EXTENSIONS = ['txt', 'json', 'csv', 'eml', 'html'];

    /**
     * Extrai ZIP de forma segura e devolve metadados para o lote.
     *
     * @return array{extracted_path: string, file_count: int, files: list<string>, channel: string|null}
     */
    public function extract(string $zipPath, string $twinId, ?string $channel = null): array
    {
        $zip = new ZipArchive;
        if ($zip->open($zipPath) !== true) {
            throw new \RuntimeException('Não foi possível abrir o arquivo ZIP.');
        }

        $disk = config('twin.import_disk', 'local');
        $extractDir = "imports/{$twinId}/extracted/".uniqid('zip_', true);
        $totalBytes = 0;
        $files = [];
        $count = 0;

        for ($i = 0; $i < $zip->numFiles && $count < self::MAX_FILES; $i++) {
            $stat = $zip->statIndex($i);
            if (! $stat || str_ends_with($stat['name'], '/')) {
                continue;
            }

            $name = str_replace('\\', '/', $stat['name']);
            if ($this->isUnsafePath($name)) {
                continue;
            }

            $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
            if (! in_array($ext, self::ALLOWED_EXTENSIONS, true)) {
                continue;
            }

            $totalBytes += $stat['size'];
            if ($totalBytes > self::MAX_UNCOMPRESSED_BYTES) {
                break;
            }

            $content = $zip->getFromIndex($i);
            if ($content === false) {
                continue;
            }

            $dest = $extractDir.'/'.basename($name);
            Storage::disk($disk)->put($dest, $content);
            $files[] = $name;
            $count++;
        }

        $zip->close();

        if ($count === 0) {
            throw new \RuntimeException('ZIP não contém ficheiros de conversa suportados (.txt, .json).');
        }

        return [
            'extracted_path' => $extractDir,
            'file_count' => $count,
            'files' => $files,
            'channel' => $channel,
        ];
    }

    private function isUnsafePath(string $path): bool
    {
        if (str_starts_with($path, '/') || preg_match('/\.\./', $path)) {
            return true;
        }

        return false;
    }
}
