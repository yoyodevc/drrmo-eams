import { afterEach, describe, expect, it, vi } from 'vitest';
import { fileKind, fileSize, saveMemo } from './api';

describe('fileKind', () => {
    it('names each allowed type in a plain word', () => {
        expect(fileKind('application/pdf')).toBe('PDF');
        expect(
            fileKind('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
        ).toBe('Word');
        expect(fileKind('image/png')).toBe('Image');
        expect(fileKind('application/zip')).toBe('File');
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('saveMemo', () => {
    it('posts a new memo and sends an edit as POST with _method=PATCH, so a file can go along', async () => {
        const fetchMock = vi.fn<typeof fetch>(() =>
            Promise.resolve(new Response(JSON.stringify({ data: { id: 7 } }), { status: 200 })),
        );
        vi.stubGlobal('fetch', fetchMock);
        const input = {
            title: 'Fire Drill',
            category: 'procedure',
            body: 'Walk.',
            file: null,
            removeFile: true,
        };

        await saveMemo(null, input);
        await saveMemo('m7', input);

        const [newUrl, newInit] = fetchMock.mock.calls[0];
        const [editUrl, editInit] = fetchMock.mock.calls[1];
        expect(newUrl).toBe('/api/memos');
        expect((newInit?.body as FormData).get('_method')).toBeNull();
        expect(editUrl).toBe('/api/memos/m7');
        expect(editInit?.method).toBe('POST');
        expect((editInit?.body as FormData).get('_method')).toBe('PATCH');
        expect((editInit?.body as FormData).get('remove_file')).toBe('1');
    });
});

describe('fileSize', () => {
    it('reads in KB under 1 MB and in MB above', () => {
        expect(fileSize(200)).toBe('1 KB');
        expect(fileSize(240 * 1024)).toBe('240 KB');
        expect(fileSize(3.4 * 1024 * 1024)).toBe('3.4 MB');
    });
});
