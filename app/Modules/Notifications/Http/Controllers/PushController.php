<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Contracts\PushTransport;
use App\Modules\Notifications\Models\AlertPreference;
use App\Modules\Notifications\Models\PushSubscription;
use App\Modules\Records\Contracts\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Gate;

/** The signed in person's own devices for push alerts, and their alert settings. */
class PushController
{
    /** Public key, this person's devices and settings. */
    public function show(Request $request): JsonResponse
    {
        $userId = (int) $request->user()?->id;
        $prefs = AlertPreference::query()->find($userId);

        return response()->json(['data' => [
            'public_key' => config('webpush.public_key'),
            'devices' => PushSubscription::query()->where('user_id', $userId)->orderByDesc('id')->get()
                ->map(fn (PushSubscription $s) => ['id' => $s->public_code, 'label' => $s->device_label, 'last_used_at' => $s->last_used_at?->toIso8601String(), 'endpoint_hash' => $s->endpoint_hash]),
            'settings' => [
                'sound_muted' => $prefs->sound_muted ?? false,
                'push_muted' => $prefs->push_muted ?? false,
                'quiet_start' => $prefs->quiet_start ?? null,
                'quiet_end' => $prefs->quiet_end ?? null,
            ],
        ]]);
    }

    public function subscribe(Request $request, AuditLogger $audit): JsonResponse
    {
        Gate::authorize('create', PushSubscription::class);
        $data = $request->validate([
            'endpoint' => ['required', 'url:https', 'max:2000'],
            'keys.p256dh' => ['required', 'string', 'max:255'],
            'keys.auth' => ['required', 'string', 'max:255'],
            'label' => ['nullable', 'string', 'max:80'],
        ]);

        $sub = PushSubscription::query()->updateOrCreate(
            ['endpoint_hash' => PushSubscription::hash($data['endpoint'])],
            ['user_id' => (int) $request->user()?->id, 'endpoint' => $data['endpoint'], 'public_key' => $data['keys']['p256dh'], 'auth_token' => $data['keys']['auth'], 'device_label' => $data['label'] ?? null, 'last_used_at' => now()],
        );
        if ($sub->wasRecentlyCreated) {
            $audit->log('push.enabled', $sub);
        }

        return response()->json(['data' => ['id' => $sub->public_code, 'endpoint_hash' => $sub->endpoint_hash]], $sub->wasRecentlyCreated ? 201 : 200);
    }

    /** Removes this device (used on sign out and when the person turns alerts off). */
    public function unsubscribe(Request $request, AuditLogger $audit): Response
    {
        $endpoint = $request->validate(['endpoint' => ['required', 'string', 'max:2000']])['endpoint'];
        $sub = PushSubscription::query()->where('endpoint_hash', PushSubscription::hash($endpoint))->where('user_id', $request->user()?->id)->first();
        if ($sub !== null) {
            Gate::authorize('delete', $sub);
            $audit->log('push.disabled', $sub);
            $sub->delete();
        }

        return response()->noContent();
    }

    public function destroy(PushSubscription $subscription, AuditLogger $audit): Response
    {
        Gate::authorize('delete', $subscription);
        $audit->log('push.disabled', $subscription);
        $subscription->delete();

        return response()->noContent();
    }

    /** Sends a test push to every device of the person. */
    public function test(Request $request, PushTransport $transport): JsonResponse
    {
        Gate::authorize('create', PushSubscription::class);
        $payload = ['title' => 'DRRMO EAMS test', 'body' => 'Alerts work on this device.', 'url' => '/', 'urgent' => false, 'tag' => 'test'];
        $sent = 0;
        foreach (PushSubscription::query()->where('user_id', $request->user()?->id)->get() as $sub) {
            $result = $transport->deliver($sub, $payload, false);
            if ($result === 'gone') {
                $sub->delete();
            } elseif ($result === 'sent') {
                $sent++;
            }
        }

        return response()->json(['data' => ['sent' => $sent]]);
    }

    public function settings(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sound_muted' => ['sometimes', 'boolean'],
            'push_muted' => ['sometimes', 'boolean'],
            'quiet_start' => ['sometimes', 'nullable', 'date_format:H:i'],
            'quiet_end' => ['sometimes', 'nullable', 'date_format:H:i'],
        ]);
        $prefs = AlertPreference::query()->firstOrNew(['user_id' => (int) $request->user()?->id]);
        $prefs->fill($data)->save();

        return response()->json(['data' => [
            'sound_muted' => $prefs->sound_muted, 'push_muted' => $prefs->push_muted,
            'quiet_start' => $prefs->quiet_start, 'quiet_end' => $prefs->quiet_end,
        ]]);
    }
}
