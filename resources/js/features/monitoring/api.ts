// Typed calls to the Monitoring module endpoints.
import { api } from '@/shared/api/client';

export async function startDuty(assignmentId: number): Promise<void> {
    await api(`/api/me/assignments/${assignmentId}/start-duty`, { method: 'POST' });
}

export async function endDuty(assignmentId: number): Promise<void> {
    await api(`/api/me/assignments/${assignmentId}/end-duty`, { method: 'POST' });
}

export type PingPoint = {
    lat: number;
    lng: number;
    accuracy_m: number | null;
    captured_at: string;
};

export async function uploadPings(
    assignmentId: number,
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
    assignment_id: number;
    event_id: number;
    event_title: string | null;
    name: string;
    state: MapState;
    ping: PingPoint | null;
};

export type LatestMap = { people: MapPerson[]; stale_after_seconds: number; generated_at: string };

export async function getLatestMap(eventId?: number): Promise<LatestMap> {
    const query = eventId ? `?event_id=${eventId}` : '';
    const response = await api<{ data: LatestMap }>(`/api/map/latest${query}`);
    return response.data;
}

export async function getTrail(assignmentId: number): Promise<PingPoint[]> {
    const response = await api<{ data: { points: PingPoint[] } }>(`/api/map/trail/${assignmentId}`);
    return response.data.points;
}
