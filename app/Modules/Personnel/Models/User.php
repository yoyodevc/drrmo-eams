<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Models;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Contracts\PermissionChecker;
use App\Modules\Access\Models\PermissionGrant;
use App\Modules\Access\Models\Role;
use App\Modules\Notifications\Contracts\EmailMessage;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property string|null $team
 * @property AvailabilityStatus $status
 * @property string $first_name
 * @property string $last_name
 * @property-read string $name Full name for display, see name().
 * @property AccountStatus $account_status
 * @property Carbon|null $email_verified_at
 * @property Carbon|null $created_at
 * @property Carbon|null $verification_expires_at
 * @property Carbon|null $verification_sent_at
 * @property Carbon|null $reviewed_at
 */
#[Fillable(['first_name', 'last_name', 'email', 'contact_number', 'role_id', 'department_id', 'team', 'status', 'password'])]
#[Hidden(['password', 'remember_token'])]
#[UseFactory(UserFactory::class)]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'disabled_at' => 'datetime',
            'verification_expires_at' => 'datetime',
            'verification_sent_at' => 'datetime',
            'reviewed_at' => 'datetime',
            'password' => 'hashed',
            'status' => AvailabilityStatus::class,
            'account_status' => AccountStatus::class,
        ];
    }

    /**
     * Full name for emails, audit text and lists: "First Last".
     * A last name of "-" (a one word name moved over from the old name column) is left out.
     *
     * @return Attribute<string, never>
     */
    protected function name(): Attribute
    {
        return Attribute::get(fn (): string => trim($this->first_name.' '.($this->last_name === '-' ? '' : $this->last_name)));
    }

    /** The screen the emailed link opens. It posts the token to /api/reset-password. */
    public function passwordResetUrl(string $token): string
    {
        return url('/reset-password').'?'.http_build_query(['token' => $token, 'email' => $this->email]);
    }

    /**
     * Called by the password broker. Sends the reset link through the same MailSender as the
     * sign up code, so there is one mail path. It throws when the mail cannot be sent.
     *
     * @param  string  $token
     */
    public function sendPasswordResetNotification($token): void
    {
        $minutes = (int) config('auth.passwords.users.expire');
        $message = EmailMessage::make('Reset your DRRMO EAMS password', 'Reset your password')
            ->preheader("Choose a new password. The link works for {$minutes} minutes.")
            ->greeting($this->name)
            ->line('Someone asked to reset the password of this account. Use the button to choose a new password.')
            ->button('Choose a new password', $this->passwordResetUrl((string) $token))
            ->line("The link works for {$minutes} minutes and only once. If you did not ask for this, ignore this email. Your password stays the same.");

        app(MailSender::class)->send($this->email, $this->name, $message->subject, $message->text(), $message->html());
    }

    /** @return BelongsTo<Role, $this> */
    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    /** @return BelongsTo<Department, $this> */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /** The display name of this person's team, or null when they have none. */
    public function teamName(): ?string
    {
        return $this->team === null ? null : Team::query()->where('code', $this->team)->value('name');
    }

    /** @return HasMany<EmergencyContact, $this> */
    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(EmergencyContact::class);
    }

    /** @return HasMany<VolunteerStatusLog, $this> */
    public function statusLogs(): HasMany
    {
        return $this->hasMany(VolunteerStatusLog::class);
    }

    /** The role as an enum, or null when the role row is unknown. */
    public function roleCode(): ?RoleCode
    {
        return RoleCode::tryFrom((string) $this->role?->code);
    }

    public function isDisabled(): bool
    {
        return $this->disabled_at !== null;
    }

    /** True when the account may sign in: approved and not disabled. */
    public function canSignIn(): bool
    {
        return ! $this->isDisabled() && $this->account_status === AccountStatus::Active;
    }

    /**
     * Role permission or an active grant, answered by the Access module's PermissionChecker.
     * Pass the event id when the question is about one event, so event grants can match.
     */
    public function hasPermission(string $code, ?int $eventId = null): bool
    {
        return app(PermissionChecker::class)->allows($this, $code, $eventId);
    }

    /**
     * Grants that are in force right now, with their permission. Cached on this object once loaded.
     *
     * @return HasMany<PermissionGrant, $this>
     */
    public function activeGrants(): HasMany
    {
        return $this->hasMany(PermissionGrant::class)->active()->with('permission');
    }

    /** @return HasMany<PermissionGrant, $this> */
    public function grants(): HasMany
    {
        return $this->hasMany(PermissionGrant::class);
    }
}
