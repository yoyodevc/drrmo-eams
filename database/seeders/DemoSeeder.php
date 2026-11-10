<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Personnel\Models\User;
use Illuminate\Database\Seeder;
use RuntimeException;

/**
 * Fake people for local testing. Every password is "password". Never run this on a real server.
 */
class DemoSeeder extends Seeder
{
    public function run(): void
    {
        if (app()->isProduction()) {
            throw new RuntimeException('DemoSeeder must not run in production.');
        }

        $this->call([PermissionSeeder::class, OrgUnitSeeder::class]);

        foreach ([
            ['Demo', 'Admin', 'admin@example.test', RoleCode::Admin],
            ['Demo', 'Marshal', 'marshal@example.test', RoleCode::Marshal],
            ['Demo', 'Volunteer', 'volunteer@example.test', RoleCode::Volunteer],
            ['Demo', 'Coordinator', 'coordinator@example.test', RoleCode::Coordinator],
        ] as [$first, $last, $email, $role]) {
            User::query()->where('email', $email)->exists()
                || User::factory()->role($role)->create(['first_name' => $first, 'last_name' => $last, 'email' => $email]);
        }
    }
}
