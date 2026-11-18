<?php

declare(strict_types=1);

namespace App\Modules\Information\Services;

use App\Modules\Information\Contracts\DocumentConverter;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Converts with LibreOffice in headless mode. Set LIBREOFFICE_BINARY to the soffice program to turn it on.
 * Each run gets its own work and profile folder, so two conversions at once do not block each other.
 */
class LibreOfficeConverter implements DocumentConverter
{
    public function __construct(private ?string $binary, private int $timeout = 120) {}

    public function available(): bool
    {
        if ($this->binary === null || $this->binary === '') {
            return false;
        }
        // A bare name such as "soffice" is trusted to be on the PATH. A full path must exist.
        if (! str_contains($this->binary, '/') && ! str_contains($this->binary, '\\')) {
            return true;
        }

        return is_file($this->binary);
    }

    public function toPdf(string $sourcePath): string
    {
        if (! $this->available()) {
            throw new RuntimeException('LibreOffice is not set up (LIBREOFFICE_BINARY).');
        }

        $work = storage_path('app/convert/'.Str::random(16));
        File::ensureDirectoryExists($work);
        try {
            $input = $work.DIRECTORY_SEPARATOR.'source.'.(pathinfo($sourcePath, PATHINFO_EXTENSION) ?: 'docx');
            File::copy($sourcePath, $input);
            $profile = 'file:///'.ltrim(str_replace('\\', '/', $work.'/profile'), '/');

            $result = Process::timeout($this->timeout)->run([
                (string) $this->binary,
                '-env:UserInstallation='.$profile,
                '--headless', '--norestore', '--nolockcheck',
                '--convert-to', 'pdf',
                '--outdir', $work,
                $input,
            ]);

            $pdf = $work.DIRECTORY_SEPARATOR.'source.pdf';
            if (! $result->successful() || ! is_file($pdf)) {
                $why = trim($result->errorOutput() !== '' ? $result->errorOutput() : $result->output());

                throw new RuntimeException('LibreOffice could not convert the file. '.Str::limit($why, 300));
            }

            return (string) file_get_contents($pdf);
        } finally {
            File::deleteDirectory($work);
        }
    }
}
