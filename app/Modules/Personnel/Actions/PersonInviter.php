<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Actions;

use App\Modules\Notifications\Contracts\EmailMessage;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Throwable;

/** Emails a person made by an admin a link to choose their own password. */
class PersonInviter
{
    public function __construct(private readonly MailSender $mail) {}

    /** True when the email went out. A mail failure is logged, the admin can send it again. */
    public function send(User $user): bool
    {
        $minutes = (int) config('auth.passwords.users.expire');
        $token = Password::broker()->createToken($user);

        $message = EmailMessage::make('Set your DRRMO EAMS password', 'Welcome to DRRMO EAMS')
            ->preheader("Choose your password. The link works for {$minutes} minutes.")
            ->greeting($user->name)
            ->line('The DRRMO office made an account for you. Use the button to choose your password, then sign in.')
            ->button('Choose my password', $user->passwordResetUrl($token))
            ->line("The link works for {$minutes} minutes and only once. If it expired, ask the DRRMO office to send a new one.");

        try {
            $this->mail->send($user->email, $user->name, $message->subject, $message->text(), $message->html());

            return true;
        } catch (Throwable $e) {
            Log::error('Set password email failed: '.$e->getMessage(), ['user_id' => $user->getKey()]);

            return false;
        }
    }
}
