<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Policies;

use App\Modules\Personnel\Models\User;

class UserPolicy
{
    /** Listing, approving and rejecting sign up requests. */
    public function reviewRegistrations(User $actor): bool
    {
        return $actor->hasPermission('registrations.review');
    }

    /** Listing volunteers, switching them active or inactive and reading their status history. */
    public function toggleVolunteers(User $actor): bool
    {
        return $actor->hasPermission('volunteers.toggle');
    }

    /** A person adding, editing and deleting their own emergency contacts. */
    public function manageOwnProfile(User $actor): bool
    {
        return $actor->hasPermission('profile.own');
    }

    /** Admin reading another person's emergency contacts. */
    public function viewPeople(User $actor): bool
    {
        return $actor->hasPermission('people.view');
    }

    /** Admin creating, editing and inviting people. */
    public function managePeople(User $actor): bool
    {
        return $actor->hasPermission('people.manage');
    }
}
