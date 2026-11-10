<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Access\Models\Permission;
use App\Modules\Access\Models\Role;
use App\Modules\Access\Support\PermissionMatrix;
use Illuminate\Database\Seeder;

/**
 * Safe to run again on every deploy. It writes the permission list from PermissionMatrix, gives a
 * new built-in role its default permissions, and gives existing roles any permission that is new
 * in this release. Changes an admin made to a role are kept. The locks are applied every time.
 */
class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RoleSeeder::class);

        $matrix = PermissionMatrix::permissions();
        $before = Permission::query()->pluck('code')->all();

        foreach ($matrix as $code => $def) {
            Permission::query()->updateOrCreate(
                ['code' => $code],
                ['description' => $def['description'], 'grantable' => $def['grantable']],
            );
        }

        Permission::query()->whereNotIn('code', array_keys($matrix))->delete();

        $new = array_values(array_diff(array_keys($matrix), $before));
        $ids = Permission::query()->pluck('id', 'code');

        foreach (Role::query()->with('permissions')->get() as $role) {
            $current = $role->permissions->pluck('code')->all();
            $builtIn = $role->builtIn();
            $defaults = $builtIn === null ? [] : PermissionMatrix::codesFor($builtIn);

            $wanted = $current === []
                ? $defaults
                : array_merge($current, array_intersect($new, $defaults));

            $codes = PermissionMatrix::applyLocks($role->code, array_values(array_unique($wanted)));
            $role->permissions()->sync(array_map(fn (string $code) => $ids[$code], $codes));
        }
    }
}
