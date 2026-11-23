<?php

declare(strict_types=1);

namespace App\Modules\Records\Http\Controllers;

use App\Modules\Events\Models\Assignment;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Personnel\Models\EmergencyContact;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use App\Modules\Records\Models\ConsentRecord;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/** A person downloads their own data as JSON. It only ever reads the signed-in person's rows. */
class MyDataExportController
{
    public function __invoke(Request $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('manageOwnProfile', User::class);

        /** @var User $user */
        $user = $request->user();
        $user->loadMissing(['role', 'department']);

        $data = [
            'exported_at' => now()->toIso8601String(),
            'profile' => [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'contact_number' => $user->contact_number,
                'role' => $user->role?->name,
                'department' => $user->department?->name,
                'team' => $user->teamName(),
                'availability' => $user->status->value,
                'account_status' => $user->account_status->value,
                'created_at' => $user->created_at?->toIso8601String(),
                'last_login_at' => $user->last_login_at?->toIso8601String(),
            ],
            'emergency_contacts' => EmergencyContact::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (EmergencyContact $c) => ['name' => $c->name, 'relationship' => $c->relationship, 'phone' => $c->phone])->all(),
            'assignments' => Assignment::query()->where('user_id', $user->id)->with(['event', 'dutyType'])->orderBy('id')->get()
                ->map(fn (Assignment $a) => [
                    'event' => $a->event?->title,
                    'duty' => $a->dutyType?->name,
                    'starts_at' => $a->event?->starts_at?->toIso8601String(),
                    'ends_at' => $a->event?->ends_at?->toIso8601String(),
                    'status' => $a->status,
                    'acknowledged_at' => $a->acknowledged_at?->toIso8601String(),
                    'duty_started_at' => $a->duty_started_at?->toIso8601String(),
                    'duty_ended_at' => $a->duty_ended_at?->toIso8601String(),
                    'cancelled_at' => $a->cancelled_at?->toIso8601String(),
                ])->all(),
            'alert_devices' => PushSubscription::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (PushSubscription $s) => ['device' => $s->device_label, 'added_at' => $s->created_at?->toIso8601String(), 'last_alert_at' => $s->last_used_at?->toIso8601String()])->all(),
            'consents' => ConsentRecord::query()->where('user_id', $user->id)->orderBy('id')->get()
                ->map(fn (ConsentRecord $c) => [
                    'purpose' => $c->purpose->value,
                    'notice_version' => $c->notice_version,
                    'consented_at' => $c->consented_at?->toIso8601String(),
                    'withdrawn_at' => $c->withdrawn_at?->toIso8601String(),
                ])->all(),
        ];

        $audit->log('data.exported', $user);

        return response()->json($data, 200, [
            'Content-Disposition' => 'attachment; filename="my-drrmo-data.json"',
            'Cache-Control' => 'no-store',
        ], JSON_PRETTY_PRINT);
    }
}
