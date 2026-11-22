<?php

declare(strict_types=1);

// Web Push keys. Generate with `php artisan push:vapid`. Never commit them.
return [
    'subject' => env('VAPID_SUBJECT', env('APP_URL')),
    'public_key' => env('VAPID_PUBLIC_KEY'),
    'private_key' => env('VAPID_PRIVATE_KEY'),
];
