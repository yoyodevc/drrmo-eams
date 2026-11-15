<?php

declare(strict_types=1);

namespace App\Modules\Information\Http\Controllers;

use App\Modules\Information\Enums\MemoCategory;
use App\Modules\Information\Http\Requests\SaveMemoRequest;
use App\Modules\Information\Models\Memo;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** The memo library (S5.1). Everyone with `memos.view` reads. `memos.manage` posts, edits and deletes. */
class MemoController
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', Memo::class);
        $f = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'category' => ['nullable', Rule::enum(MemoCategory::class)],
        ]);

        $matching = $this->matching((string) ($f['q'] ?? ''));
        // Counts follow the search but not the category, so each chip says what a click would show.
        $counts = (clone $matching)->toBase()->select('category')->selectRaw('count(*) as n')
            ->groupBy('category')->pluck('n', 'category');

        $page = $matching->with('poster:id,first_name,last_name')
            ->when($f['category'] ?? null, fn ($q, $c) => $q->where('category', $c))
            ->orderByDesc('posted_at')->orderByDesc('id')
            ->paginate(20);

        return response()->json([
            'data' => $page->getCollection()->map(fn (Memo $m) => $this->row($m))->values(),
            'meta' => ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total()],
            'categories' => array_map(fn (MemoCategory $c) => [
                'value' => $c->value,
                'label' => $c->label(),
                'count' => (int) ($counts[$c->value] ?? 0),
            ], MemoCategory::cases()),
        ]);
    }

    /**
     * Memos that match every search word (S5.2). MySQL uses FULLTEXT with prefix match, so "fire dril"
     * finds "Fire Drill Procedure". When that finds nothing, or on another database, LIKE is used.
     *
     * @return Builder<Memo>
     */
    private function matching(string $search): Builder
    {
        $clean = trim((string) preg_replace('/[^\pL\pN]+/u', ' ', $search));
        $words = array_values(array_filter(explode(' ', $clean), fn (string $w) => mb_strlen($w) >= 2));
        $query = Memo::query();
        if ($words === []) {
            return $query;
        }

        // InnoDB skips words under 3 letters, so FULLTEXT is used only when every word is long enough.
        $long = array_filter($words, fn (string $w) => mb_strlen($w) >= 3);
        if ($query->getModel()->getConnection()->getDriverName() === 'mysql' && count($long) === count($words)) {
            $terms = implode(' ', array_map(fn (string $w) => '+'.$w.'*', $words));
            $full = (clone $query)->whereFullText(['title', 'body'], $terms, ['mode' => 'boolean']);
            if ($full->exists()) {
                return $full;
            }
        }

        foreach ($words as $word) {
            $like = '%'.addcslashes($word, '%_\\').'%';
            $query->where(fn (Builder $q) => $q->where('title', 'like', $like)->orWhere('body', 'like', $like));
        }

        return $query;
    }

    public function show(Memo $memo): JsonResponse
    {
        Gate::authorize('view', $memo);

        return response()->json(['data' => [...$this->row($memo->load('poster:id,first_name,last_name')), 'body' => $memo->body]]);
    }

    public function file(Memo $memo): StreamedResponse
    {
        Gate::authorize('view', $memo);
        abort_if($memo->file_path === null || ! Storage::disk('local')->exists($memo->file_path), 404);

        // Inline, so a phone opens a PDF in its own viewer. The stored type was read from the content.
        return Storage::disk('local')->response($memo->file_path, $memo->file_name, [
            'Content-Type' => $memo->file_mime ?? 'application/octet-stream',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function store(SaveMemoRequest $request): JsonResponse
    {
        Gate::authorize('create', Memo::class);

        $memo = new Memo([
            ...$request->safe()->only(['title', 'category', 'body']),
            'posted_by' => $request->user()?->getAuthIdentifier(),
            'posted_at' => now(),
        ]);
        $this->attach($memo, $request->file('file'));
        $memo->save();

        return response()->json(['data' => [...$this->row($memo->load('poster:id,first_name,last_name')), 'body' => $memo->body]], 201);
    }

    public function update(SaveMemoRequest $request, Memo $memo): JsonResponse
    {
        Gate::authorize('update', $memo);

        $old = $memo->file_path;
        $memo->fill($request->safe()->only(['title', 'category', 'body']));
        if ($request->hasFile('file')) {
            $this->attach($memo, $request->file('file'));
        } elseif ($request->boolean('remove_file')) {
            $memo->fill(['file_path' => null, 'file_name' => null, 'file_mime' => null, 'file_size' => null]);
        }
        $memo->save();
        // Remove the old file only after the new state is saved, so a failed save loses nothing.
        if ($old !== null && $old !== $memo->file_path) {
            Storage::disk('local')->delete($old);
        }

        return response()->json(['data' => [...$this->row($memo->load('poster:id,first_name,last_name')), 'body' => $memo->body]]);
    }

    public function destroy(Memo $memo, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('delete', $memo);

        // Soft delete: the row and its file stay, so the audit trail can still name what was removed.
        $memo->delete();
        $audit->log('memo.deleted', $memo, meta: ['title' => $memo->title]);

        return response()->json(null, 204);
    }

    private function attach(Memo $memo, ?UploadedFile $file): void
    {
        if ($file === null) {
            return;
        }
        $memo->fill([
            'file_path' => $file->store('memos', 'local'),
            'file_name' => $file->getClientOriginalName(),
            'file_mime' => $file->getMimeType(),
            'file_size' => $file->getSize(),
        ]);
    }

    /** @return array<string, mixed> */
    private function row(Memo $m): array
    {
        return [
            'id' => $m->id,
            'title' => $m->title,
            'category' => $m->category->value,
            'category_label' => $m->category->label(),
            'posted_at' => $m->posted_at->toIso8601String(),
            'updated_at' => $m->updated_at?->toIso8601String(),
            'posted_by' => $m->poster->name ?? null,
            'has_body' => $m->body !== null && trim($m->body) !== '',
            'file' => $m->file_path === null ? null : [
                'name' => $m->file_name,
                'type' => $m->file_mime,
                'size' => $m->file_size,
            ],
        ];
    }
}
