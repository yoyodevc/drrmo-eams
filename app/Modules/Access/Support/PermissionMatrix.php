<?php

declare(strict_types=1);

namespace App\Modules\Access\Support;

use App\Modules\Access\Enums\Role;

/**
 * The single source of truth for permission codes, their labels and groups, the default role
 * matrix and the cells nobody may change. Permissions live in code because code checks them.
 * Which role holds which permission is data an admin can edit, starting from these defaults.
 *
 * The defaults must match the table in docs/SECURITY_AND_PRIVACY.md section 1. A test compares the two.
 */
final class PermissionMatrix
{
    /** Only the Admin role may hold it. Map access and event scoped reports reach others through a grant. */
    public const LOCK_ADMIN = 'admin';

    /** Held by Marshal and Volunteer only, because event requirements staff by those two roles. */
    public const LOCK_FIELD = 'field';

    /** Every role holds it. Nobody can use the app without it. */
    public const LOCK_EVERYONE = 'everyone';

    /** @var array<string, string> Group key => heading, in the order the screens show them. */
    public const GROUPS = [
        'personnel' => 'People',
        'events' => 'Events and duty',
        'monitoring' => 'Map and site reports',
        'information' => 'Memos and messages',
        'records' => 'Records and exports',
        'access' => 'Access control',
        'self' => 'Own account',
    ];

    /**
     * Permission code => definition.
     * - label: a short name for buttons and lists.
     * - description: one sentence on what it allows.
     * - group: a key of GROUPS.
     * - admin: true when it opens an admin screen or action. Used for the "no escalation" rule.
     * - grantable: may be given to one person for a while.
     * - lock: one of the LOCK_* values, or null when an admin may switch it per role.
     * - roles: the built-in roles that hold it by default.
     *
     * @return array<string, array{label: string, description: string, group: string, admin: bool, grantable: bool, lock: string|null, roles: list<Role>}>
     */
    public static function permissions(): array
    {
        $admin = [Role::Admin];
        $field = [Role::Marshal, Role::Volunteer];
        $all = Role::cases();

        return [
            'people.view' => ['label' => 'View people', 'description' => 'List and view all people', 'group' => 'personnel', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'people.manage' => ['label' => 'Add and edit people', 'description' => 'Create, edit, import people', 'group' => 'personnel', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'registrations.review' => ['label' => 'Review sign ups', 'description' => 'Approve or reject sign up requests', 'group' => 'personnel', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'volunteers.toggle' => ['label' => 'Set volunteer status', 'description' => 'Set volunteer active or inactive', 'group' => 'personnel', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'access.manage' => ['label' => 'Manage roles and access', 'description' => 'Edit roles and their permissions, give and revoke grants', 'group' => 'access', 'admin' => true, 'grantable' => false, 'lock' => self::LOCK_ADMIN, 'roles' => $admin],
            'events.view_all' => ['label' => 'View all events', 'description' => 'See every event', 'group' => 'events', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'events.manage' => ['label' => 'Create and edit events', 'description' => 'Create and edit events and requirements', 'group' => 'events', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'assignments.manage' => ['label' => 'Assign people to duty', 'description' => 'Assign, change, cancel', 'group' => 'events', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'events.view_department' => ['label' => 'Department event notices', 'description' => 'See event notices for own department or campus wide', 'group' => 'events', 'admin' => false, 'grantable' => false, 'lock' => null, 'roles' => [Role::Admin, Role::Coordinator]],
            'assignments.own' => ['label' => 'Do own duty', 'description' => 'See and acknowledge own assignments, start and end own duty', 'group' => 'self', 'admin' => false, 'grantable' => false, 'lock' => self::LOCK_FIELD, 'roles' => $field],
            'location.send_own' => ['label' => 'Share location on duty', 'description' => 'Send own pings while on duty', 'group' => 'self', 'admin' => false, 'grantable' => false, 'lock' => self::LOCK_FIELD, 'roles' => $field],
            'location.view' => ['label' => 'View the live map', 'description' => 'See the map and ping trails', 'group' => 'monitoring', 'admin' => true, 'grantable' => true, 'lock' => self::LOCK_ADMIN, 'roles' => $admin],
            'reports.submit' => ['label' => 'Submit site reports', 'description' => 'Submit site reports for one event', 'group' => 'monitoring', 'admin' => true, 'grantable' => true, 'lock' => self::LOCK_ADMIN, 'roles' => $admin],
            'reports.view' => ['label' => 'Read site reports', 'description' => 'Read the site report feed', 'group' => 'monitoring', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'memos.view' => ['label' => 'Read memos', 'description' => 'Search and read memos', 'group' => 'information', 'admin' => false, 'grantable' => false, 'lock' => self::LOCK_EVERYONE, 'roles' => $all],
            'memos.manage' => ['label' => 'Post memos', 'description' => 'Post, edit, delete memos', 'group' => 'information', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'messages.use' => ['label' => 'Send messages', 'description' => 'Send and read own messages', 'group' => 'information', 'admin' => false, 'grantable' => false, 'lock' => self::LOCK_EVERYONE, 'roles' => $all],
            'messages.office_inbox' => ['label' => 'Answer the DRRMO inbox', 'description' => 'Read and answer the DRRMO inbox', 'group' => 'information', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'notifications.view' => ['label' => 'View notification log', 'description' => 'Read the notification log', 'group' => 'records', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'audit.view' => ['label' => 'View audit log', 'description' => 'Read the audit log', 'group' => 'records', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'data.export' => ['label' => 'Export lists', 'description' => 'Export lists (CSV)', 'group' => 'records', 'admin' => true, 'grantable' => true, 'lock' => null, 'roles' => $admin],
            'profile.own' => ['label' => 'Own profile', 'description' => 'Read own profile, edit own contact number and emergency contacts, export own data', 'group' => 'self', 'admin' => false, 'grantable' => false, 'lock' => self::LOCK_EVERYONE, 'roles' => $all],
        ];
    }

    /**
     * Default permission codes of one built-in role.
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

    /**
     * Codes that open an admin screen or action.
     *
     * @return list<string>
     */
    public static function adminCodes(): array
    {
        return array_keys(array_filter(self::permissions(), fn (array $def) => $def['admin']));
    }

    /**
     * Whether a role must hold (true) or must not hold (false) a permission, or null when an admin
     * may choose. $roleCode is the role's code, so custom roles work too.
     */
    public static function forced(string $code, string $roleCode): ?bool
    {
        if ($roleCode === Role::Admin->value) {
            return true;
        }

        return match (self::permissions()[$code]['lock'] ?? null) {
            self::LOCK_ADMIN => false,
            self::LOCK_EVERYONE => true,
            self::LOCK_FIELD => in_array($roleCode, [Role::Marshal->value, Role::Volunteer->value], true),
            default => null,
        };
    }

    /** Plain words for why a cell cannot be changed, or null when it can. */
    public static function lockReason(string $code, string $roleCode): ?string
    {
        if (self::forced($code, $roleCode) === null) {
            return null;
        }
        if ($roleCode === Role::Admin->value) {
            return 'The Admin role always has every permission.';
        }

        return match (self::permissions()[$code]['lock']) {
            self::LOCK_ADMIN => $code === 'access.manage'
                ? 'Only the Admin role can manage access.'
                : 'Admin only. Give it to someone for a limited time with a grant instead.',
            self::LOCK_EVERYONE => 'Every role needs this to use the app.',
            default => 'Only Marshal and Volunteer go on duty, because event requirements staff by those roles.',
        };
    }

    /**
     * The codes a role ends up with after the locks are applied to the codes asked for.
     *
     * @param  array<int, mixed>  $codes
     * @return list<string>
     */
    public static function applyLocks(string $roleCode, array $codes): array
    {
        $result = [];
        foreach (array_keys(self::permissions()) as $code) {
            $forced = self::forced($code, $roleCode);
            if ($forced === true || ($forced === null && in_array($code, $codes, true))) {
                $result[] = $code;
            }
        }

        return $result;
    }
}
