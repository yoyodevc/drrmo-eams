// Typed calls to the Events module endpoints.
import { api } from '@/shared/api/client';

export interface CampusLocation {
    id: number;
    name: string;
}

export interface EventSummary {
    id: number;
    title: string;
    event_type: { value: string; label: string };
    requirements?: Requirement[];
    description: string | null;
    status: 'draft' | 'published' | 'cancelled' | 'completed';
    starts_at: string;
    ends_at: string;
    location?: CampusLocation;
}

export interface NewEvent {
    title: string;
    event_type: string;
    description: string;
    campus_location_id: number;
    // ISO 8601 with offset.
    starts_at: string;
    ends_at: string;
}

export async function listEvents(): Promise<EventSummary[]> {
    const body = await api<{ data: EventSummary[] }>('/api/events');
    return body.data;
}

export async function createEvent(input: NewEvent): Promise<EventSummary> {
    const body = await api<{ data: EventSummary }>('/api/events', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return body.data;
}

export interface Option {
    id: number;
    name: string;
}

export interface Lookups {
    locations: CampusLocation[];
    event_types: { value: string; label: string }[];
    task_types: Option[];
}

export interface Assignment {
    id: number;
    person: { id: number; name: string; email: string };
    role: 'marshal' | 'volunteer';
    task_type: Option;
    status: 'assigned' | 'acknowledged' | 'on_duty' | 'completed' | 'cancelled' | 'no_show';
    acknowledged_at: string | null;
    // Why an admin added this person after the duty was full.
    override_reason: string | null;
}

export interface Candidate {
    id: number;
    name: string;
    role: 'marshal' | 'volunteer';
    // Title of an event whose shift overlaps this one, when there is one.
    conflict: string | null;
}

export async function getLookups(): Promise<Lookups> {
    const body = await api<{ data: Lookups }>('/api/event-lookups');
    return body.data;
}

export async function getEvent(id: number): Promise<EventSummary> {
    const body = await api<{ data: EventSummary }>(`/api/events/${id}`);
    return body.data;
}

export interface Requirement {
    id: number;
    duty_type: Option;
    role: 'marshal' | 'volunteer';
    team_needed: string | null;
    headcount: number;
    shift_starts_at: string;
    shift_ends_at: string;
    instructions: string | null;
    assignments: Assignment[];
}

export interface NewRequirement {
    duty_type_id: number;
    role: string;
    team_needed: string;
    headcount: number;
    // ISO 8601 with offset.
    shift_starts_at: string;
    shift_ends_at: string;
    instructions: string;
}

export async function createRequirement(
    eventId: number,
    input: NewRequirement,
): Promise<Requirement> {
    const body = await api<{ data: Requirement }>(`/api/events/${eventId}/requirements`, {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return body.data;
}

export async function removeRequirement(id: number): Promise<void> {
    await api(`/api/requirements/${id}`, { method: 'DELETE' });
}

export async function listCandidates(requirementId: number): Promise<Candidate[]> {
    const body = await api<{ data: Candidate[] }>(`/api/requirements/${requirementId}/candidates`);
    return body.data;
}

export async function assignPerson(
    requirementId: number,
    userId: number,
    overrideReason?: string,
): Promise<void> {
    await api(`/api/requirements/${requirementId}/assignments`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, override_reason: overrideReason || undefined }),
    });
}

export async function removeAssignment(id: number): Promise<void> {
    await api(`/api/assignments/${id}`, { method: 'DELETE' });
}

export async function publishEvent(id: number): Promise<void> {
    await api(`/api/events/${id}/publish`, { method: 'POST' });
}

export async function cancelEvent(id: number): Promise<void> {
    await api(`/api/events/${id}/cancel`, { method: 'POST' });
}

export interface MyAssignment {
    id: number;
    status: Assignment['status'];
    acknowledged_at: string | null;
    duty_started_at: string | null;
    duty_ended_at: string | null;
    event: { id: number; title: string; status: string; location: string | null };
    duty_type: string | null;
    team_needed: string | null;
    instructions: string | null;
    starts_at: string;
    ends_at: string;
}

export async function listMyAssignments(): Promise<MyAssignment[]> {
    const body = await api<{ data: MyAssignment[] }>('/api/me/assignments');
    return body.data;
}

export async function updateEvent(id: number, input: NewEvent): Promise<EventSummary> {
    const body = await api<{ data: EventSummary }>(`/api/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
    });
    return body.data;
}

export async function cancelAssignment(id: number, reason: string): Promise<void> {
    await api(`/api/assignments/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
    });
}

export async function markNoShow(id: number): Promise<void> {
    await api(`/api/assignments/${id}/no-show`, { method: 'POST' });
}

export async function acknowledgeAssignment(id: number): Promise<void> {
    await api(`/api/me/assignments/${id}/acknowledge`, { method: 'POST' });
}

export interface DashboardRow {
    id: number;
    person: string;
    status: Assignment['status'];
    event: { id: number; title: string };
    duty: string | null;
    starts_at: string | null;
    ends_at: string | null;
    duty_started_at: string | null;
}

export interface Dashboard {
    today_events: {
        id: number;
        title: string;
        location: string | null;
        starts_at: string;
        ends_at: string;
        people_count: number;
        on_duty_count: number;
        places_needed: number;
    }[];
    on_duty: DashboardRow[];
    unacknowledged: DashboardRow[];
    not_on_duty: DashboardRow[];
}

export async function getDashboard(): Promise<Dashboard> {
    const body = await api<{ data: Dashboard }>('/api/dashboard');
    return body.data;
}

export interface EventNotice {
    id: number;
    title: string;
    description: string | null;
    event_type: string;
    location: string | null;
    campus_wide: boolean;
    starts_at: string;
    ends_at: string;
}

export async function listEventNotices(): Promise<EventNotice[]> {
    const body = await api<{ data: EventNotice[] }>('/api/me/event-notices');
    return body.data;
}

export interface CalendarEvent {
    id: number;
    title: string;
    status: EventSummary['status'];
    event_type: { value: string; label: string };
    location: string | null;
    starts_at: string;
    ends_at: string;
    people_count: number;
    places_needed: number;
}

export async function getCalendar(from: string, to: string): Promise<CalendarEvent[]> {
    const query = new URLSearchParams({ from, to });
    const body = await api<{ data: CalendarEvent[] }>(`/api/events/calendar?${query.toString()}`);
    return body.data;
}

export interface EventTypeRow {
    code: string;
    name: string;
    active: boolean;
    events_count: number;
}

export async function listEventTypes(): Promise<EventTypeRow[]> {
    const body = await api<{ data: EventTypeRow[] }>('/api/event-types');
    return body.data;
}

export async function saveEventType(
    code: string | null,
    input: { name: string; active: boolean },
): Promise<void> {
    await api(code === null ? '/api/event-types' : `/api/event-types/${code}`, {
        method: code === null ? 'POST' : 'PATCH',
        body: JSON.stringify(input),
    });
}

export async function deleteEventType(code: string): Promise<void> {
    await api(`/api/event-types/${code}`, { method: 'DELETE' });
}

export interface LocationRow {
    id: number;
    name: string;
    latitude: number;
    longitude: number;
    active: boolean;
    events_count: number;
}

export async function listLocations(): Promise<LocationRow[]> {
    const body = await api<{ data: LocationRow[] }>('/api/campus-locations');
    return body.data;
}

export async function saveLocation(
    id: number | null,
    input: { name: string; latitude: number; longitude: number; active: boolean },
): Promise<void> {
    await api(id === null ? '/api/campus-locations' : `/api/campus-locations/${id}`, {
        method: id === null ? 'POST' : 'PATCH',
        body: JSON.stringify(input),
    });
}

export async function deleteLocation(id: number): Promise<void> {
    await api(`/api/campus-locations/${id}`, { method: 'DELETE' });
}
