<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Enums\AvailabilityStatus;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\ConsentRecorder;
use App\Modules\Records\Enums\ConsentPurpose;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Fake people only. Emails always end in @example.test.
 *
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    protected static ?string $password;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'first_name' => fake()->firstName(),
            'last_name' => fake()->lastName(),
            'email' => fake()->unique()->userName().'@example.test',
            'contact_number' => '09'.fake()->numerify('#########'),
            'role_id' => fn () => Role::query()->firstOrCreate(
                ['code' => RoleCode::Volunteer->value],
                ['name' => RoleCode::Volunteer->label(), 'is_system' => true],
            )->id,
            'status' => AvailabilityStatus::Active,
            'account_status' => AccountStatus::Active,
            'email_verified_at' => now(),
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
        ];
    }

    /** Test people have already agreed to the privacy notice, so API tests reach the endpoint they test. */
    public function configure(): static
    {
        return $this->afterCreating(function (User $user) {
            if (! $user->relationLoaded('skipConsent')) {
                app(ConsentRecorder::class)->give($user, ConsentPurpose::PrivacyNotice, '127.0.0.1');
            }
        });
    }

    public function withoutConsent(): static
    {
        return $this->afterMaking(fn (User $user) => $user->setRelation('skipConsent', true));
    }

    public function role(RoleCode $role): static
    {
        return $this->state(fn () => [
            'role_id' => Role::query()->firstOrCreate(
                ['code' => $role->value],
                ['name' => $role->label(), 'is_system' => true],
            )->id,
        ]);
    }

    public function inactive(): static
    {
        return $this->state(fn () => ['status' => AvailabilityStatus::Inactive]);
    }

    public function disabled(): static
    {
        return $this->state(fn () => ['disabled_at' => now()]);
    }

    public function accountStatus(AccountStatus $status): static
    {
        return $this->state(fn () => ['account_status' => $status]);
    }

    public function unverified(): static
    {
        return $this->state(fn () => ['email_verified_at' => null]);
    }
}
