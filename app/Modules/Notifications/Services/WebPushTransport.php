<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Services;

use App\Modules\Notifications\Contracts\PushTransport;
use App\Modules\Notifications\Models\PushSubscription;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Throwable;

/** Real delivery through the push services of Google, Apple and Mozilla. The payload is encrypted. */
class WebPushTransport implements PushTransport
{
    public function deliver(PushSubscription $subscription, array $payload, bool $urgent): string
    {
        if (! config('webpush.public_key') || ! config('webpush.private_key')) {
            return 'failed';
        }

        try {
            $client = new WebPush(['VAPID' => [
                'subject' => (string) config('webpush.subject'),
                'publicKey' => (string) config('webpush.public_key'),
                'privateKey' => (string) config('webpush.private_key'),
            ]], ['TTL' => $urgent ? 600 : 3600, 'urgency' => $urgent ? 'high' : 'normal']);

            $report = $client->sendOneNotification(
                Subscription::create(['endpoint' => $subscription->endpoint, 'publicKey' => $subscription->public_key, 'authToken' => $subscription->auth_token]),
                json_encode($payload, JSON_THROW_ON_ERROR),
            );
        } catch (Throwable $e) {
            report($e);

            return 'failed';
        }

        if ($report->isSuccess()) {
            return 'sent';
        }

        return $report->isSubscriptionExpired() ? 'gone' : 'failed';
    }
}
