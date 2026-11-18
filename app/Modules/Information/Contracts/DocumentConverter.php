<?php

declare(strict_types=1);

namespace App\Modules\Information\Contracts;

use RuntimeException;

/** Turns an office file (Word) into a PDF, so the memo page can show it exactly as Word lays it out. */
interface DocumentConverter
{
    /** False when no converter is set up on this server. Word memos then use the quick browser preview. */
    public function available(): bool;

    /**
     * Converts the file and returns the PDF's bytes.
     *
     * @throws RuntimeException when the conversion fails or takes too long
     */
    public function toPdf(string $sourcePath): string;
}
