<?php

declare(strict_types=1);

namespace App\Modules\Notifications;

use App\Modules\Notifications\Console\SendShiftReminders;
use App\Modules\Notifications\Contracts\AssignmentNotifier;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Notifications\Listeners\NotifyAdminsOfWithdrawal;
use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Policies\NotificationPolicy;
use App\Modules\Notifications\Services\LogMailSender;
use App\Modules\Notifications\Services\PhpMailerSender;
use App\Modules\Notifications\Services\QueuedAssignmentNotifier;
use App\Modules\Records\Events\LocationConsentWithdrawn;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class NotificationsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AssignmentNotifier::class, QueuedAssignmentNotifier::class);
        $this->app->bind(MailSender::class, function (): MailSender {
            $host = (string) config('mail.phpmailer.host');
            // Tests and the log or array mailers never reach a real mail server, even when MAIL_HOST is set.
            $logOnly = in_array(config('mail.default'), ['log', 'array'], true) || $this->app->environment('testing') || $host === '';

            return $logOnly ? new LogMailSender : new PhpMailerSender;
        });
    }

    public function boot(): void
    {
        Event::listen(LocationConsentWithdrawn::class, NotifyAdminsOfWithdrawal::class);
        $this->loadViewsFrom(__DIR__.'/Views', 'eams-notifications');
        Gate::policy(Notification::class, NotificationPolicy::class);
        if ($this->app->runningInConsole()) {
            $this->commands([SendShiftReminders::class]);
            $this->callAfterResolving(Schedule::class, fn (Schedule $schedule) => $schedule->command('notifications:send-reminders')->everyFiveMinutes());
        }
        Route::middleware(['api', 'auth:api'])->prefix('api')->group(__DIR__.'/routes.php');
    }
}
