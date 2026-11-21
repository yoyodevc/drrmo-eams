<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Jobs;

use App\Modules\Notifications\Contracts\PushTransport;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushSubscription;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use RuntimeException;
use Throwable;

/** Sends one push alert to every device of one person. Retries 3 times. Never blocks the in app alert or the email. */
class SendPush implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    /** @var list<int> */
    public array $backoff = [10, 60];

    /** @param array{title: string, body: string, url: string, urgent: bool, tag: string} $payload */
    public function __construct(public Notification $notification, public array $payload) {}

    public function handle(PushTransport $transport): void
    {
        if ($this->notification->status === 'sent') {
            return;
        }

        $subscriptions = PushSubscription::query()->where('user_id', $this->notification->user_id)->get();
        $this->notification->increment('attempts');
        $sent = 0;
        $failed = 0;

        foreach ($subscriptions as $subscription) {
            $result = $transport->deliver($subscription, $this->payload, $this->payload['urgent']);
            if ($result === 'sent') {
                $sent++;
                $subscription->forceFill(['last_used_at' => now()])->save();
            } elseif ($result === 'gone') {
                $subscription->delete();
            } else {
                $failed++;
            }
        }

        if ($sent === 0 && $failed > 0) {
            throw new RuntimeException('Push service refused the message.');
        }

        $this->notification->update(['status' => $sent > 0 ? 'sent' : 'failed', 'sent_at' => now(), 'last_error' => $sent > 0 ? null : 'No device was reachable.']);
    }

    public function failed(Throwable $e): void
    {
        $this->notification->update(['status' => 'failed', 'last_error' => mb_substr($e->getMessage(), 0, 500)]);
    }
}
