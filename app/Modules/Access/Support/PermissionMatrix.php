<?php

declare(strict_types=1);

namespace App\Modules\Access\Support;

use App\Modules\Access\Enums\Role;

/**
 * The single source of truth for permission codes and the role matrix.
 * It must match the table in docs/SECURITY_AND_PRIVACY.md section 1.
 * A test compares the two.
 */
final class PermissionMatrix
{
    /**
     * Permission code => [description, grantable, roles that hold it].
     *
     * @return array<string, array{description: string, grantable: bool, roles: list<Role>}>
     */
    public static function permissions(): array
    {
        $admin = [Role::Admin];
        $field = [Role::Marshal, Role::Volunteer];

        return [
            'people.view' => ['description' => 'List and view all people', 'grantable' => true, 'roles' => $admin],
            'people.manage' => ['description' => 'Create, edit, import people', 'grantable' => true, 'roles' => $admin],
            'registrations.review' => ['description' => 'Approve or reject sign up requests', 'grantable' => true, 'roles' => $admin],
            'volunteers.toggle' => ['description' => 'Set volunteer active or inactive', 'grantable' => true, 'roles' => $admin],
            'access.manage' => ['description' => 'Create and revoke grants', 'grantable' => false, 'roles' => $admin],
            'events.view_all' => ['description' => 'See every event', 'grantable' => true, 'roles' => $admin],
            'events.manage' => ['description' => 'Create and edit events and requirements', 'grantable' => true, 'roles' => $admin],
            'assignments.manage' => ['description' => 'Assign, change, cancel', 'grantable' => true, 'roles' => $admin],
            'events.view_department' => ['description' => 'See event notices for own department or campus wide', 'grantable' => false, 'roles' => [Role::Admin, Role::Coordinator]],
            'assignments.own' => ['description' => 'See and acknowledge own assignments, start and end own duty', 'grantable' => false, 'roles' => $field],
            'location.send_own' => ['description' => 'Send own pings while on duty', 'grantable' => false, 'roles' => $field],
            'location.view' => ['description' => 'See the map and ping trails', 'grantable' => true, 'roles' => $admin],
            'reports.submit' => ['description' => 'Submit site reports for one event', 'grantable' => true, 'roles' => $admin],
            'reports.view' => ['description' => 'Read the site report feed', 'grantable' => true, 'roles' => $admin],
            'memos.view' => ['description' => 'Search and read memos', 'grantable' => false, 'roles' => Role::cases()],
            'memos.manage' => ['description' => 'Post, edit, delete memos', 'grantable' => true, 'roles' => $admin],
            'messages.use' => ['description' => 'Send and read own messages', 'grantable' => false, 'roles' => Role::cases()],
            'messages.office_inbox' => ['description' => 'Read and answer the DRRMO inbox', 'grantable' => true, 'roles' => $admin],
            'notifications.view' => ['description' => 'Read the notification log', 'grantable' => true, 'roles' => $admin],
            'audit.view' => ['description' => 'Read the audit log', 'grantable' => true, 'roles' => $admin],
            'data.export' => ['description' => 'Export lists (CSV)', 'grantable' => true, 'roles' => $admin],
            'profile.own' => ['description' => 'Read own profile, edit own contact number and emergency contacts, export own data', 'grantable' => false, 'roles' => Role::cases()],
        ];
    }

    /**
     * Permission codes held by one role.
     *
     * @return list<string>
     */
    public static function codesFor(Role $role): array
    {
        $codes = [];
        foreach (self::permissions() as $code => $def) {
            if (in_array($role, $def['roles'], true)) {
                $codes[] = $code;
            }
        }

        return $codes;
    }
}
