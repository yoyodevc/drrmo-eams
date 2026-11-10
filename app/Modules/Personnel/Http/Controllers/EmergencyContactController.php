<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Personnel\Http\Requests\EmergencyContactRequest;
use App\Modules\Personnel\Models\EmergencyContact;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A person's own emergency contacts, plus the admin read of someone else's. */
class EmergencyContactController
{
    public const MAX_CONTACTS = 5;

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('manageOwnProfile', User::class);

        return $this->list($request->user());
    }

    public function store(EmergencyContactRequest $request, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        abort_if($user->emergencyContacts()->count() >= self::MAX_CONTACTS, 422, 'You can keep up to '.self::MAX_CONTACTS.' contacts. Delete one first.');

        $contact = $user->emergencyContacts()->create($request->validated());
        $audit->log('emergency_contact.created', $contact);

        return response()->json(['data' => $this->present($contact)], 201);
    }

    public function update(EmergencyContactRequest $request, EmergencyContact $contact, AuditLogger $audit): JsonResponse
    {
        abort_unless($contact->user_id === $request->user()?->id, 403);

        $contact->update($request->validated());
        $audit->log('emergency_contact.updated', $contact);

        return response()->json(['data' => $this->present($contact)]);
    }

    public function destroy(Request $request, EmergencyContact $contact, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('manageOwnProfile', User::class);
        abort_unless($contact->user_id === $request->user()?->id, 403);

        $audit->log('emergency_contact.deleted', $contact);
        $contact->delete();

        return response()->json(['data' => null]);
    }

    /** Admin: read one person's contacts. Viewing is audited. */
    public function forPerson(User $user, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('viewPeople', User::class);

        $audit->log('emergency_contact.viewed', $user);

        return $this->list($user);
    }

    private function list(User $user): JsonResponse
    {
        $rows = $user->emergencyContacts()->orderBy('id')->get();

        return response()->json(['data' => $rows->map(fn (EmergencyContact $c) => $this->present($c))->values()]);
    }

    /** @return array<string, mixed> */
    private function present(EmergencyContact $c): array
    {
        return ['id' => $c->id, 'name' => $c->name, 'relationship' => $c->relationship, 'phone' => $c->phone];
    }
}
