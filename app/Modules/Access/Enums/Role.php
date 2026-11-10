<?php

declare(strict_types=1);

namespace App\Modules\Access\Enums;

/**
 * The four built-in roles. They cannot be renamed or deleted, and code relies on them: Admin holds
 * everything, Marshal and Volunteer are the roles events staff by, Coordinator reads department notices.
 * Admins can add custom roles on top (Role model with is_system false). Admin and Director share
 * the admin role for now.
 */
enum Role: string
{
    case Admin = 'admin';
    case Marshal = 'marshal';
    case Volunteer = 'volunteer';
    case Coordinator = 'coordinator';

    public function label(): string
    {
        return ucfirst($this->value);
    }

    public function description(): string
    {
        return match ($this) {
            self::Admin => 'DRRMO office staff. Full access to every screen.',
            self::Marshal => 'Marshals on duty at events.',
            self::Volunteer => 'Student volunteers assigned to events.',
            self::Coordinator => 'Department coordinators who read event notices.',
        };
    }

    /** True for the roles that can be assigned to event duty. */
    public function isField(): bool
    {
        return $this === self::Marshal || $this === self::Volunteer;
    }
}
