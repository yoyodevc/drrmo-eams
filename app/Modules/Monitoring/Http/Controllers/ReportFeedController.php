<?php

declare(strict_types=1);

namespace App\Modules\Monitoring\Http\Controllers;

use App\Modules\Events\Models\CampusLocation;
use App\Modules\Events\Models\Event;
use App\Modules\Monitoring\Models\SiteReport;
use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The admin report feed (S4.8). Newest first. A person sees only the events their `reports.view` covers. */
class ReportFeedController
{
    private const TIMEZONE = 'Asia/Manila';

    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', SiteReport::class);
        /** @var User $user */
        $user = $request->user();

        $f = $request->validate([
            'event_id' => ['nullable', 'integer'],
            'location_id' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'],
            'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
        ]);

        $scoped = $this->scoped($user);
        $query = (clone $scoped)->with(['assignment.user:id,first_name,last_name', 'assignment.event:id,title,campus_location_id', 'assignment.event.location:id,name']);
        if (! empty($f['event_id'])) {
            $query->whereHas('assignment', fn ($q) => $q->where('event_id', (int) $f['event_id']));
        }
        if (! empty($f['location_id'])) {
            $query->whereHas('assignment.event', fn ($q) => $q->where('campus_location_id', (int) $f['location_id']));
        }
        if (! empty($f['from'])) {
            $query->where('due_at', '>=', Carbon::parse($f['from'], self::TIMEZONE)->startOfDay()->utc());
        }
        if (! empty($f['to'])) {
            $query->where('due_at', '<', Carbon::parse($f['to'], self::TIMEZONE)->addDay()->startOfDay()->utc());
        }

        // Slots that are not yet due carry no news, so they stay out of the feed.
        $page = $query->where('due_at', '<=', now())->orderByDesc('due_at')->orderByDesc('id')->paginate(15);

        return response()->json([
            'data' => $page->getCollection()->map(fn (SiteReport $r) => $this->row($r))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            // The filter lists come from what this person may see, so they never name other events.
            'filters' => $this->filterOptions($scoped),
        ]);
    }

    public function show(SiteReport $report): JsonResponse
    {
        Gate::authorize('view', $report);
        $report->load(['assignment.user:id,first_name,last_name', 'assignment.event:id,title,campus_location_id', 'assignment.event.location:id,name']);

        return response()->json(['data' => $this->row($report)]);
    }

    public function photo(SiteReport $report): StreamedResponse
    {
        Gate::authorize('view', $report);
        abort_if($report->photo_path === null || ! Storage::disk('local')->exists($report->photo_path), 404);

        return Storage::disk('local')->response($report->photo_path);
    }

    /** @return Builder<SiteReport> */
    private function scoped(User $user): Builder
    {
        $query = SiteReport::query();
        if ($user->hasPermission('reports.view')) {
            return $query;
        }

        // Only the events named in the person's own active grants.
        $eventIds = $user->activeGrants()->get()
            ->filter(fn ($g) => $g->permission->code === 'reports.view' && $g->event_id !== null)
            ->pluck('event_id');

        return $query->whereHas('assignment', fn ($q) => $q->whereIn('event_id', $eventIds));
    }

    /**
     * @param  Builder<SiteReport>  $scoped
     * @return array{events: list<array{id: int, title: string}>, locations: list<array{id: int, name: string}>}
     */
    private function filterOptions(Builder $scoped): array
    {
        $eventIds = (clone $scoped)->join('assignments', 'assignments.id', '=', 'site_reports.assignment_id')->distinct()->pluck('assignments.event_id');
        $events = Event::query()->whereIn('id', $eventIds)->orderBy('title')->get(['id', 'title', 'campus_location_id']);
        $locations = CampusLocation::query()->whereIn('id', $events->pluck('campus_location_id'))->orderBy('name')->get(['id', 'name']);

        return [
            'events' => $events->map(fn (Event $e) => ['id' => $e->id, 'title' => $e->title])->values()->all(),
            'locations' => $locations->map(fn (CampusLocation $l) => ['id' => $l->id, 'name' => $l->name])->values()->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function row(SiteReport $r): array
    {
        $assignment = $r->assignment;

        return [
            'id' => $r->id,
            'status' => $r->status->value,
            'due_at' => $r->due_at->toIso8601String(),
            'submitted_at' => $r->submitted_at?->toIso8601String(),
            'summary' => $r->summary,
            'has_photo' => $r->photo_path !== null,
            'author' => $assignment->user->name ?? null,
            'event' => ['id' => $assignment->event_id, 'title' => $assignment->event->title ?? null],
            'location' => $assignment->event->location->name ?? null,
        ];
    }
}
