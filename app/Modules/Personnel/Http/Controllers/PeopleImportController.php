<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Http\Controllers;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Actions\PeopleCsvReader;
use App\Modules\Personnel\Actions\PersonInviter;
use App\Modules\Personnel\Enums\AccountStatus;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/** Admin imports people from a CSV. Every row is checked first, and the import is all or nothing. */
class PeopleImportController
{
    public function template(): Response
    {
        Gate::authorize('managePeople', User::class);

        return response(PeopleCsvReader::template(), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="people-template.csv"',
        ]);
    }

    /** With `check=1` the file is only validated. Without it, a clean file is saved. */
    public function store(Request $request, PeopleCsvReader $reader, AuditLogger $audit, PersonInviter $inviter): JsonResponse
    {
        Gate::authorize('managePeople', User::class);

        $request->validate(['file' => ['required', 'file', 'max:512', 'extensions:csv,txt']]);

        $result = $reader->read($request->file('file')->getRealPath());

        if ($result['errors'] !== []) {
            return response()->json([
                'message' => 'Nothing was imported. Fix the rows below and upload the file again.',
                'errors' => $result['errors'],
            ], 422);
        }

        $rows = $result['rows'];

        if ($request->boolean('check')) {
            return response()->json(['count' => count($rows), 'imported' => false]);
        }

        $roleIds = Role::query()->pluck('id', 'code');

        $users = DB::transaction(function () use ($rows, $roleIds, $audit): array {
            $created = [];
            foreach ($rows as $row) {
                $user = new User([
                    'first_name' => $row['first_name'], 'last_name' => $row['last_name'], 'email' => $row['email'],
                    'contact_number' => $row['contact_number'], 'department_id' => $row['department_id'], 'team' => $row['team'],
                ]);
                $user->role_id = (int) $roleIds[$row['role']];
                $user->password = Str::random(48);
                $user->account_status = AccountStatus::Active;
                $user->email_verified_at = now();
                $user->save();

                $audit->log('person.created', $user, meta: ['source' => 'csv_import', 'after' => [...$row]]);
                $created[] = $user;
            }
            $audit->log('people.imported', 'people', meta: ['count' => count($created)]);

            return $created;
        });

        // Emails go out after the save, so a mail failure never undoes the import.
        $failed = collect($users)->reject(fn (User $u) => $inviter->send($u))->map(fn (User $u) => $u->email)->values();

        return response()->json(['count' => count($users), 'imported' => true, 'invites_failed' => $failed], 201);
    }
}
