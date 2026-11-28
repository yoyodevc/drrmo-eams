<?php

declare(strict_types=1);

use App\Modules\Personnel\Models\User;
use App\Support\PublicCode;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

it('shows first and last name together as the display name', function () {
    $user = User::factory()->make(['first_name' => 'Maria', 'last_name' => 'Dela Cruz']);

    expect($user->name)->toBe('Maria Dela Cruz');
});

it('leaves out the dash that a one word name gets as last name', function () {
    $user = User::factory()->make(['first_name' => 'Cher', 'last_name' => '-']);

    expect($user->name)->toBe('Cher');
});

it('splits old names at the last space and puts one word names in first_name', function () {
    $migration = require base_path('database/migrations/2026_01_01_200006_split_user_name_into_first_and_last_name.php');
    $roleId = User::factory()->create()->role_id;

    // Go back to the old shape, fill it with old style names, then run the split again.
    $migration->down();
    expect(Schema::hasColumn('users', 'name'))->toBeTrue()
        ->and(Schema::hasColumn('users', 'first_name'))->toBeFalse();

    $now = now();
    foreach ([
        ['two@example.test', 'Ana Reyes'],
        ['three@example.test', 'Maria  Dela Cruz'],
        ['one@example.test', 'Cher'],
    ] as [$email, $name]) {
        DB::table('users')->insert([
            'public_code' => PublicCode::make(), 'name' => $name, 'email' => $email, 'role_id' => $roleId, 'password' => 'x',
            'created_at' => $now, 'updated_at' => $now,
        ]);
    }

    $migration->up();

    expect(Schema::hasColumn('users', 'name'))->toBeFalse();
    $rows = DB::table('users')->whereIn('email', ['two@example.test', 'three@example.test', 'one@example.test'])
        ->orderBy('email')->get(['email', 'first_name', 'last_name'])->map(fn ($r) => (array) $r)->all();
    expect($rows)->toBe([
        ['email' => 'one@example.test', 'first_name' => 'Cher', 'last_name' => '-'],
        ['email' => 'three@example.test', 'first_name' => 'Maria Dela', 'last_name' => 'Cruz'],
        ['email' => 'two@example.test', 'first_name' => 'Ana', 'last_name' => 'Reyes'],
    ]);
});
