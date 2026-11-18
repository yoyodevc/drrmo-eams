// Typed calls to the Information module endpoints (memos).
import { api } from '@/shared/api/client';

export interface MemoFile {
    name: string;
    type: string;
    size: number;
    // Word files only: the server's PDF copy for the preview pane. Left out or null for other files.
    preview?: 'ready' | 'converting' | 'unavailable' | null;
}

export interface Memo {
    id: number;
    title: string;
    category: string;
    category_label: string;
    posted_at: string;
    updated_at: string | null;
    posted_by: string | null;
    has_body: boolean;
    file: MemoFile | null;
    // Only the single memo call returns the text.
    body?: string | null;
}

export interface Category {
    value: string;
    label: string;
    // Memos in this category that match the current search.
    count: number;
}

export interface MemoPage {
    data: Memo[];
    meta: { current_page: number; last_page: number; total: number };
    categories: Category[];
}

export interface MemoInput {
    title: string;
    category: string;
    body: string;
    file: File | null;
    removeFile: boolean;
}

// Same limit as the server (docs/SECURITY_AND_PRIVACY.md section 6), checked early to save a slow upload.
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const FILE_ACCEPT = '.pdf,.docx,.jpg,.jpeg,.png';

export async function listMemos(
    filters: { q?: string; category?: string; page?: number } = {},
): Promise<MemoPage> {
    const query = new URLSearchParams();
    if (filters.q) query.set('q', filters.q);
    if (filters.category) query.set('category', filters.category);
    if (filters.page && filters.page > 1) query.set('page', String(filters.page));
    const qs = query.toString();
    return api<MemoPage>(`/api/memos${qs ? `?${qs}` : ''}`);
}

export async function getMemo(id: number): Promise<Memo> {
    const body = await api<{ data: Memo }>(`/api/memos/${id}`);
    return body.data;
}

export async function saveMemo(id: number | null, input: MemoInput): Promise<Memo> {
    const form = new FormData();
    form.set('title', input.title);
    form.set('category', input.category);
    form.set('body', input.body);
    if (input.file) form.set('file', input.file);
    if (input.removeFile) form.set('remove_file', '1');
    // Browsers cannot send a file with PATCH, so an edit is a POST that Laravel reads as PATCH.
    if (id !== null) form.set('_method', 'PATCH');
    const body = await api<{ data: Memo }>(id === null ? '/api/memos' : `/api/memos/${id}`, {
        method: 'POST',
        body: form,
    });
    return body.data;
}

export async function deleteMemo(id: number): Promise<void> {
    await api(`/api/memos/${id}`, { method: 'DELETE' });
}

export const memoFileUrl = (id: number) => `/api/memos/${id}/file`;
export const memoPreviewUrl = (id: number) => `/api/memos/${id}/preview`;

// The raw bytes of a memo file or its PDF copy, for the preview pane to draw.
export async function fetchMemoBytes(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`The file did not load (${response.status}).`);
    return response.arrayBuffer();
}

// "240 KB", "3.4 MB".
export function fileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// A plain word for the file type, so a list never relies on an icon alone.
export function fileKind(type: string): 'PDF' | 'Word' | 'Image' | 'File' {
    if (type === 'application/pdf') return 'PDF';
    if (type.includes('wordprocessingml')) return 'Word';
    if (type.startsWith('image/')) return 'Image';
    return 'File';
}

const day = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
export const postedOn = (iso: string) => day.format(new Date(iso));
