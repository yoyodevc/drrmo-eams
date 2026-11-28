// Typed calls to the Monitoring module endpoints.
import { api } from '@/shared/api/client';

export async function startDuty(assignmentId: string): Promise<void> {
    await api(`/api/me/assignments/${assignmentId}/start-duty`, { method: 'POST' });
}

export async function endDuty(assignmentId: string): Promise<void> {
    await api(`/api/me/assignments/${assignmentId}/end-duty`, { method: 'POST' });
}

export type PingPoint = {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    captured_at: string;
};

export async function uploadPings(
    assignmentId: string,
    points: PingPoint[],
): Promise<{ accepted: number; rejected: number }> {
    const response = await api<{ data: { accepted: number; rejected: number } }>(
        `/api/me/assignments/${assignmentId}/pings`,
        { method: 'POST', body: JSON.stringify({ points }) },
    );
    return response.data;
}

// Live map and ping trail (S4.3, S4.4). Admin only: needs `location.view`.
export type MapState = 'live' | 'stale' | 'none';

export type MapPerson = {
    assignment_id: string;
    event_id: string;
    event_title: string | null;
    name: string;
    state: MapState;
    ping: PingPoint | null;
};

export type LatestMap = { people: MapPerson[]; stale_after_seconds: number; generated_at: string };

export async function getLatestMap(eventId?: string): Promise<LatestMap> {
    const query = eventId ? `?event_id=${eventId}` : '';
    const response = await api<{ data: LatestMap }>(`/api/map/latest${query}`);
    return response.data;
}

export async function getTrail(assignmentId: string): Promise<PingPoint[]> {
    const response = await api<{ data: { points: PingPoint[] } }>(`/api/map/trail/${assignmentId}`);
    return response.data.points;
}

// Site report slots and the report form (S4.5, S4.6). Only for people who hold `reports.submit` for an event.
export type ReportStatus = 'pending' | 'submitted' | 'overdue' | 'late' | 'missed';

export type ReportSlot = {
    id: string;
    assignment_id: string;
    event: string | null;
    due_at: string;
    status: ReportStatus;
    summary: string | null;
    has_photo: boolean;
    submitted_at: string | null;
};

export async function listReportSlots(): Promise<ReportSlot[]> {
    const response = await api<{ data: ReportSlot[] }>('/api/me/report-slots');
    return response.data;
}

export async function submitReport(
    slotId: string,
    summary: string,
    photo: Blob | null,
): Promise<ReportSlot> {
    const form = new FormData();
    form.set('summary', summary);
    if (photo) form.set('photo', photo, 'photo.jpg');
    const response = await api<{ data: ReportSlot }>(`/api/me/report-slots/${slotId}`, {
        method: 'POST',
        body: form,
    });
    return response.data;
}

// Admin report feed (S4.8). Needs `reports.view`.
export type FeedReport = {
    id: string;
    status: ReportStatus;
    due_at: string;
    submitted_at: string | null;
    summary: string | null;
    has_photo: boolean;
    author: string | null;
    event: { id: string; title: string | null };
    location: string | null;
};

export type FeedFilters = { event_id: string; location_id: string; from: string; to: string };

export type ReportFeed = {
    data: FeedReport[];
    meta: { current_page: number; last_page: number; total: number };
    filters: { events: { id: string; title: string }[]; locations: { id: string; name: string }[] };
};

export async function getReportFeed(filters: FeedFilters, page: number): Promise<ReportFeed> {
    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
    return api<ReportFeed>(`/api/reports?${query.toString()}`);
}

export const reportPhotoUrl = (id: string) => `/api/reports/${id}/photo`;

// Emergency reports. Any person on duty can send one. Reviewers (the two global marshals and admins) read them.
export type EmergencyType = 'medical' | 'fire' | 'security' | 'other';
export const emergencyTypes: { value: EmergencyType; label: string }[] = [
    { value: 'medical', label: 'Medical' },
    { value: 'fire', label: 'Fire' },
    { value: 'security', label: 'Security' },
    { value: 'other', label: 'Other' },
];

// What the sender sees. "escalated" means nobody took it on within 5 minutes.
export type MyEmergencyStatus = 'sent' | 'acknowledged' | 'escalated' | 'resolved';

export type MyEmergency = {
    id: string;
    client_id: string;
    type: EmergencyType;
    note: string | null;
    event: string | null;
    has_photo: boolean;
    status: MyEmergencyStatus;
    sent_at: string;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
};

export async function sendEmergency(input: {
    assignmentId: string;
    clientId: string;
    type: EmergencyType;
    note: string;
    photo: Blob | null;
}): Promise<MyEmergency> {
    const form = new FormData();
    form.set('client_id', input.clientId);
    form.set('type', input.type);
    if (input.note) form.set('note', input.note);
    if (input.photo) form.set('photo', input.photo, 'photo.jpg');
    const response = await api<{ data: MyEmergency }>(
        `/api/me/assignments/${input.assignmentId}/emergencies`,
        { method: 'POST', body: form },
    );
    return response.data;
}

export async function listMyEmergencies(): Promise<MyEmergency[]> {
    const response = await api<{ data: MyEmergency[] }>('/api/me/emergencies');
    return response.data;
}

export type ReviewEmergency = {
    id: string;
    type: EmergencyType;
    note: string | null;
    has_photo: boolean;
    has_location: boolean;
    status: 'sent' | 'acknowledged' | 'resolved';
    escalated: boolean;
    sent_at: string;
    escalated_at: string | null;
    event: { id: string; title: string | null };
    reporter: string | null;
    acknowledged_by: string | null;
    acknowledged_at: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    resolution_note: string | null;
    // Only in the single report. Opening it is audited.
    location?: {
        lat: number;
        lng: number;
        accuracy_m: number | null;
        captured_at: string | null;
    } | null;
};

export async function listEmergencies(status: string): Promise<ReviewEmergency[]> {
    const query = status ? `?status=${status}` : '';
    const response = await api<{ data: ReviewEmergency[] }>(`/api/emergencies${query}`);
    return response.data;
}

export async function getEmergency(id: string): Promise<ReviewEmergency> {
    const response = await api<{ data: ReviewEmergency }>(`/api/emergencies/${id}`);
    return response.data;
}

export async function acknowledgeEmergency(id: string): Promise<void> {
    await api(`/api/emergencies/${id}/acknowledge`, { method: 'POST' });
}

export async function resolveEmergency(id: string, note: string): Promise<void> {
    await api(`/api/emergencies/${id}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note: note || null }),
    });
}

export const emergencyPhotoUrl = (id: string) => `/api/emergencies/${id}/photo`;
export const myEmergencyPhotoUrl = (id: string) => `/api/me/emergencies/${id}/photo`;

// Settings: the (at most 2) marshals who review every report and emergency. Needs `access.manage`.
export type ReportReviewerSettings = {
    max: number;
    user_ids: string[];
    candidates: { id: string; name: string; email: string }[];
};

export async function getReportReviewers(): Promise<ReportReviewerSettings> {
    const response = await api<{ data: ReportReviewerSettings }>('/api/report-reviewers');
    return response.data;
}

export async function saveReportReviewers(userIds: string[]): Promise<void> {
    await api('/api/report-reviewers', {
        method: 'PUT',
        body: JSON.stringify({ user_ids: userIds }),
    });
}

// Emergencies of the event since the last report, for the report form. No place and no photo.
export type SinceEmergency = {
    id: string;
    type: EmergencyType;
    note: string | null;
    status: 'sent' | 'acknowledged' | 'resolved';
    reporter: string | null;
    sent_at: string;
};

export async function listEmergenciesSinceLastReport(slotId: string): Promise<SinceEmergency[]> {
    const response = await api<{ data: SinceEmergency[] }>(
        `/api/me/report-slots/${slotId}/emergencies`,
    );
    return response.data;
}

// The needs attention view (admins and reviewer marshals).
export type Attention = {
    emergencies: {
        id: string;
        type: EmergencyType;
        status: 'sent' | 'acknowledged';
        escalated: boolean;
        sent_at: string;
        event: string | null;
        reporter: string | null;
        acknowledged_by: string | null;
    }[];
    reports: {
        id: string;
        status: 'overdue' | 'missed';
        due_at: string;
        event: string | null;
        author: string | null;
    }[];
    events: {
        event_id: string;
        event: string | null;
        on_time: number;
        late: number;
        overdue: number;
        missed: number;
    }[];
};

export async function getAttention(): Promise<Attention> {
    const response = await api<{ data: Attention }>('/api/attention');
    return response.data;
}
