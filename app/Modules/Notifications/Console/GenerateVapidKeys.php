<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Console;

use Illuminate\Console\Command;
use Minishlink\WebPush\VAPID;

/** Prints a new VAPID key pair for .env. Changing keys later makes every device turn alerts on again. */
class GenerateVapidKeys extends Command
{
    protected $signature = 'push:vapid {--write : Add the keys to .env if they are not there yet}';

    protected $description = 'Generate VAPID keys for Web Push';

    public function handle(): int
    {
        $keys = VAPID::createVapidKeys();
        $lines = "VAPID_PUBLIC_KEY={$keys['publicKey']}\nVAPID_PRIVATE_KEY={$keys['privateKey']}\n";

        if ($this->option('write')) {
            $path = base_path('.env');
            $env = is_file($path) ? (string) file_get_contents($path) : '';
            if (str_contains($env, 'VAPID_PUBLIC_KEY=')) {
                $this->error('.env already has VAPID keys. Remove them first to make new ones.');

                return self::FAILURE;
            }
            file_put_contents($path, rtrim($env)."\n".$lines);
            $this->info('Keys written to .env.');

            return self::SUCCESS;
        }

        $this->line($lines);

        return self::SUCCESS;
    }
}
