<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Contracts;

use App\Modules\Notifications\Models\PushSubscription;

interface PushTransport
{
    /**
     * Send one encrypted push to one device. "gone" means the device unsubscribed (404 or 410), so the row should go.
     *
     * @param  array<string, mixed>  $payload
     * @return 'sent'|'gone'|'failed'
     */
    public function deliver(PushSubscription $subscription, array $payload, bool $urgent): string;
}
