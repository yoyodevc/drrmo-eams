<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Models\Assignment;
use App\Modules\Monitoring\Enums\EmergencyStatus;
use App\Modules\Monitoring\Events\EmergencyReported;
use App\Modules\Monitoring\Http\Requests\StoreEmergencyRequest;
use App\Modules\Monitoring\Models\EmergencyReport;
use App\Modules\Monitoring\Models\LocationPing;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Emergency reports. The sender is always the signed in person on duty. Reviewers (the global marshals
 * and holders of `reports.view`) list, read, acknowledge and resolve. The location is only in `show`,
 * and every `show` is audited.
 */
class EmergencyController
{
    /** Saves an emergency from a person on duty. Sending the same client id twice returns the report already saved. */
    public function store(StoreEmergencyRequest $request, Assignment $assignment, AuditLogger $audit): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        Gate::authorize('send', [EmergencyReport::class, $assignment]);

        $existing = EmergencyReport::query()->where('user_id', $user->id)->where('client_id', $request->validated('client_id'))->first();
        if ($existing !== null) {
            return response()->json(['data' => self::ownRow($existing)]);
        }

        $report = DB::transaction(function () use ($request, $assignment, $user, $audit): EmergencyReport {
            $photo = $request->file('photo');
            $path = $photo?->store('emergencies', 'local');
            $ping = LocationPing::query()->where('assignment_id', $assignment->id)->orderByDesc('captured_at')->first();

            $report = EmergencyReport::query()->create([
                'assignment_id' => $assignment->id,
                'event_id' => $assignment->event_id,
                'user_id' => $user->id,
                'client_id' => $request->validated('client_id'),
                'type' => $request->validated('type'),
                'note' => $request->validated('note'),
                'photo_path' => $path === false ? null : $path,
                'photo_name' => $photo?->getClientOriginalName(),
                'latitude' => $ping?->latitude,
                'longitude' => $ping?->longitude,
                'accuracy_m' => $ping?->accuracy_m,
                'location_captured_at' => $ping?->captured_at,
                'status' => EmergencyStatus::Sent->value,
            ]);
            $audit->log('emergency.sent', $report, meta: ['event_id' => $report->event_id, 'type' => $report->type->value, 'has_photo' => $path !== null, 'has_location' => $report->hasLocation()]);

            return $report;
        });

        EmergencyReported::dispatch($report);

        return response()->json(['data' => self::ownRow($report->load('event:id,title'))], 201);
    }

    /** The signed in person's own emergencies from the last day, newest first, with their status. */
    public function mine(Request $request): JsonResponse
    {
        $rows = EmergencyReport::query()->with(['event:id,title', 'acknowledger:id,first_name,last_name'])
            ->where('user_id', $request->user()?->id)->where('created_at', '>=', now()->subDay())
            ->orderByDesc('id')->limit(20)->get();

        return response()->json(['data' => $rows->map(fn (EmergencyReport $r) => self::ownRow($r))->values()]);
    }

    /** The reporter may look at the photo they sent. */
    public function minePhoto(Request $request, EmergencyReport $emergency): StreamedResponse
    {
        abort_unless($emergency->user_id === $request->user()?->id, 403);

        return $this->photoResponse($emergency);
    }

    /** Newest first, open ones on top. No coordinates here: only `show` gives them, and audits it. */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', EmergencyReport::class);
        $f = $request->validate(['status' => ['nullable', 'in:sent,acknowledged,resolved,open']]);

        $query = EmergencyReport::query()->with(['event:id,title', 'reporter:id,first_name,last_name', 'acknowledger:id,first_name,last_name', 'resolver:id,first_name,last_name']);
        if (($f['status'] ?? null) === 'open') {
            $query->where('status', '!=', EmergencyStatus::Resolved->value);
        } elseif (! empty($f['status'])) {
            $query->where('status', $f['status']);
        }
        $page = $query->orderByRaw("status = 'resolved'")->orderByDesc('id')->paginate(25);

        return response()->json([
            'data' => $page->getCollection()->map(fn (EmergencyReport $r) => self::reviewRow($r))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
        ]);
    }

    /** One emergency with its place. Viewing it is audited. */
    public function show(EmergencyReport $emergency, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('review', $emergency);
        $emergency->load(['event:id,title', 'reporter:id,first_name,last_name', 'acknowledger:id,first_name,last_name', 'resolver:id,first_name,last_name']);

        $audit->log($emergency->hasLocation() ? 'emergency.location_viewed' : 'emergency.viewed', $emergency, meta: ['event_id' => $emergency->event_id]);

        return response()->json(['data' => self::reviewRow($emergency) + [
            'location' => $emergency->hasLocation() ? [
                'lat' => $emergency->latitude,
                'lng' => $emergency->longitude,
                'accuracy_m' => $emergency->accuracy_m,
                'captured_at' => $emergency->location_captured_at?->toIso8601String(),
            ] : null,
        ]]);
    }

    public function photo(EmergencyReport $emergency, AuditLogger $audit): StreamedResponse
    {
        Gate::authorize('review', $emergency);
        $audit->log('emergency.photo_viewed', $emergency);

        return $this->photoResponse($emergency);
    }

    /** Takes the emergency on. Doing it twice, or after it is resolved, changes nothing. */
    public function acknowledge(Request $request, EmergencyReport $emergency, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('review', $emergency);

        DB::transaction(function () use ($request, $emergency, $audit): void {
            $locked = EmergencyReport::query()->whereKey($emergency->id)->lockForUpdate()->firstOrFail();
            if ($locked->status !== EmergencyStatus::Sent) {
                return;
            }
            $locked->update(['status' => EmergencyStatus::Acknowledged->value, 'acknowledged_by' => $request->user()?->id, 'acknowledged_at' => now()]);
            $audit->log('emergency.acknowledged', $locked, meta: ['event_id' => $locked->event_id, 'escalated' => $locked->escalated_at !== null]);
        });

        return response()->json(['data' => self::reviewRow($emergency->fresh(['event:id,title', 'reporter:id,first_name,last_name', 'acknowledger:id,first_name,last_name', 'resolver:id,first_name,last_name']) ?? $emergency)]);
    }

    /** Closes the emergency with an optional note. Doing it twice changes nothing. */
    public function resolve(Request $request, EmergencyReport $emergency, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('review', $emergency);
        $data = $request->validate(['note' => ['nullable', 'string', 'max:500']]);

        DB::transaction(function () use ($request, $emergency, $audit, $data): void {
            $locked = EmergencyReport::query()->whereKey($emergency->id)->lockForUpdate()->firstOrFail();
            if ($locked->status === EmergencyStatus::Resolved) {
                return;
            }
            $locked->update(['status' => EmergencyStatus::Resolved->value, 'resolved_by' => $request->user()?->id, 'resolved_at' => now(), 'resolution_note' => $data['note'] ?? null]);
            $audit->log('emergency.resolved', $locked, meta: ['event_id' => $locked->event_id, 'has_note' => ! empty($data['note'])]);
        });

        return response()->json(['data' => self::reviewRow($emergency->fresh(['event:id,title', 'reporter:id,first_name,last_name', 'acknowledger:id,first_name,last_name', 'resolver:id,first_name,last_name']) ?? $emergency)]);
    }

    private function photoResponse(EmergencyReport $emergency): StreamedResponse
    {
        abort_if($emergency->photo_path === null || ! Storage::disk('local')->exists($emergency->photo_path), 404);

        return Storage::disk('local')->response($emergency->photo_path);
    }

    /** What the reporter sees: "escalated" while a sent report waits past the limit. */
    public static function displayStatus(EmergencyReport $r): string
    {
        return $r->status === EmergencyStatus::Sent && $r->escalated_at !== null ? 'escalated' : $r->status->value;
    }

    /** @return array<string, mixed> */
    public static function ownRow(EmergencyReport $r): array
    {
        return [
            'id' => $r->id,
            'client_id' => $r->client_id,
            'type' => $r->type->value,
            'note' => $r->note,
            'event' => $r->event->title ?? null,
            'has_photo' => $r->photo_path !== null,
            'status' => self::displayStatus($r),
            'sent_at' => $r->created_at->toIso8601String(),
            'acknowledged_by' => $r->acknowledged_by === null ? null : ($r->acknowledger->name ?? null),
            'acknowledged_at' => $r->acknowledged_at?->toIso8601String(),
            'resolved_at' => $r->resolved_at?->toIso8601String(),
            'resolution_note' => $r->resolution_note,
        ];
    }

    /** @return array<string, mixed> */
    public static function reviewRow(EmergencyReport $r): array
    {
        return [
            'id' => $r->id,
            'type' => $r->type->value,
            'note' => $r->note,
            'has_photo' => $r->photo_path !== null,
            'has_location' => $r->hasLocation(),
            'status' => $r->status->value,
            'escalated' => $r->escalated_at !== null,
            'sent_at' => $r->created_at->toIso8601String(),
            'escalated_at' => $r->escalated_at?->toIso8601String(),
            'event' => ['id' => $r->event_id, 'title' => $r->event->title ?? null],
            'reporter' => $r->reporter->name ?? null,
            'acknowledged_by' => $r->acknowledger->name ?? null,
            'acknowledged_at' => $r->acknowledged_at?->toIso8601String(),
            'resolved_by' => $r->resolver->name ?? null,
            'resolved_at' => $r->resolved_at?->toIso8601String(),
            'resolution_note' => $r->resolution_note,
        ];
    }
}
