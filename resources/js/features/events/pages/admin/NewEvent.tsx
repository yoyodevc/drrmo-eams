// A-Event form (SCREENS.md). Admin creates an event: title, campus location, start and end.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { parseDayKey } from '@/features/events/calendar';
import { createEvent, getEvent, getLookups, updateEvent } from '@/features/events/api';
import { controlClass, duration, pickerClass } from '@/features/events/components/fields';
import { ChevronIcon } from '@/features/events/components/icons';
import { SelectField, SelectOption } from '@/features/events/components/SelectField';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

type Errors = Record<string, string[]>;

const DESCRIPTION_MAX = 5000;

// An ISO moment as the value a datetime-local field expects, in the browser's time zone.
function toLocalInput(iso: string): string {
    const date = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FieldError({ id, children }: { id: string; children: ReactNode }) {
    return (
        <p id={id} className="mt-1.5 text-sm font-medium text-red-700">
            {children}
        </p>
    );
}

function Section({
    title,
    intro,
    children,
}: {
    title: string;
    intro: string;
    children: ReactNode;
}) {
    return (
        <section className="grid gap-x-10 gap-y-5 px-6 py-7 lg:grid-cols-3">
            <div>
                <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
                <p className="mt-1 text-sm text-pretty text-stone-600">{intro}</p>
            </div>
            <div className="space-y-5 lg:col-span-2">{children}</div>
        </section>
    );
}

export function NewEvent() {
    const navigate = useNavigate();
    const editingId = useParams().id ?? null;
    const queryClient = useQueryClient();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventType, setEventType] = useState('');
    const [locationId, setLocationId] = useState('');
    // "New event" on a calendar day opens with ?date=2026-11-10. Start with office hours that day.
    const [params] = useSearchParams();
    const pickedDay = editingId ? null : parseDayKey(params.get('date'));
    const pickedKey = pickedDay ? params.get('date') : null;
    const [startsAt, setStartsAt] = useState(pickedKey ? `${pickedKey}T08:00` : '');
    const [endsAt, setEndsAt] = useState(pickedKey ? `${pickedKey}T17:00` : '');
    const [errors, setErrors] = useState<Errors>({});
    const [failure, setFailure] = useState<string | null>(null);

    const lookups = useQuery({ queryKey: ['event-lookups'], queryFn: getLookups });
    const existing = useQuery({
        queryKey: ['event', editingId],
        queryFn: () => getEvent(editingId ?? ''),
        enabled: editingId !== null,
    });
    const [filled, setFilled] = useState(false);
    if (existing.data && !filled) {
        setFilled(true);
        setTitle(existing.data.title);
        setDescription(existing.data.description ?? '');
        setEventType(existing.data.event_type.value);
        setLocationId(String(existing.data.location?.id ?? ''));
        setStartsAt(toLocalInput(existing.data.starts_at));
        setEndsAt(toLocalInput(existing.data.ends_at));
    }

    const save = useMutation({
        mutationFn: (input: Parameters<typeof createEvent>[0]) =>
            editingId ? updateEvent(editingId, input) : createEvent(input),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['events'] });
            await queryClient.invalidateQueries({ queryKey: ['event'] });
            await navigate(editingId ? `/admin/events/${editingId}` : '/admin/events');
        },
        onError: (error) => {
            if (error instanceof ApiError && error.status === 422) {
                const body = error.body as { errors?: Errors } | null;
                setErrors(body?.errors ?? {});
            } else {
                setFailure('The event was not saved. Check your connection and try again.');
            }
        },
    });

    function submit(event: FormEvent) {
        event.preventDefault();
        setErrors({});
        setFailure(null);
        save.mutate({
            title: title.trim(),
            event_type: eventType,
            description: description.trim(),
            campus_location_id: locationId,
            // The date fields give local time. Convert so the server gets an exact moment.
            starts_at: startsAt ? new Date(startsAt).toISOString() : '',
            ends_at: endsAt ? new Date(endsAt).toISOString() : '',
        });
    }

    const first = (key: string) => errors[key]?.[0] ?? null;
    const hasErrors = Object.keys(errors).length > 0;
    const descriptionError = first('description');
    const locationPlaceholder = lookups.isPending
        ? 'Loading locations...'
        : lookups.isError
          ? 'Locations did not load'
          : 'Choose a location';

    const backTo = editingId ? `/admin/events/${editingId}` : '/admin/events';
    const backLabel = editingId ? (existing.data?.title ?? 'Back to event') : 'Events';
    const locked =
        existing.data !== undefined &&
        existing.data.status !== 'draft' &&
        existing.data.status !== 'published';

    const back = (
        <Link
            to={backTo}
            className="-ml-1 inline-flex max-w-full items-center gap-1 rounded-control px-1 py-1 text-sm font-medium text-stone-600 transition-colors hover:text-maroon-700"
        >
            <ChevronIcon className="size-4 shrink-0 rotate-90" />
            <span className="truncate">{backLabel}</span>
        </Link>
    );

    if (editingId && existing.isPending) {
        return (
            <div className="mx-auto max-w-5xl" aria-busy="true">
                {back}
                <p role="status" className="sr-only">
                    Loading the event...
                </p>
                <div className="mt-4 h-1 w-12 rounded-full bg-stone-200" aria-hidden="true" />
                <div
                    className="mt-4 h-7 w-48 animate-pulse rounded bg-stone-200"
                    aria-hidden="true"
                />
                <div
                    className="mt-8 grid gap-10 rounded-card bg-white p-6 ring-1 ring-stone-200 lg:grid-cols-3"
                    aria-hidden="true"
                >
                    <div className="space-y-2">
                        <div className="h-5 w-24 animate-pulse rounded bg-stone-200" />
                        <div className="h-4 w-40 animate-pulse rounded bg-stone-200" />
                    </div>
                    <div className="space-y-5 lg:col-span-2">
                        <div className="h-12 animate-pulse rounded-control bg-stone-200" />
                        <div className="h-28 animate-pulse rounded-control bg-stone-200" />
                        <div className="h-12 animate-pulse rounded-control bg-stone-200" />
                    </div>
                </div>
            </div>
        );
    }

    if (editingId && (existing.isError || locked)) {
        const missing = existing.error instanceof ApiError && existing.error.status === 404;
        return (
            <div className="mx-auto max-w-5xl">
                {back}
                <div className="mt-6 max-w-xl space-y-3">
                    <Alert tone={locked ? 'info' : 'error'}>
                        {locked
                            ? `This event is ${existing.data?.status}, so it can no longer be edited.`
                            : missing
                              ? 'This event does not exist or was removed.'
                              : 'The event did not load. Check your connection and try again.'}
                    </Alert>
                    {existing.isError && !missing && (
                        <Button
                            variant="secondary"
                            size="md"
                            loading={existing.isFetching}
                            onClick={() => void existing.refetch()}
                        >
                            {existing.isFetching ? 'Retrying...' : 'Retry'}
                        </Button>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-5xl">
            {back}

            <header className="mt-4">
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    {editingId ? 'Edit event' : 'New event'}
                </h1>
                <p className="mt-1 text-pretty text-stone-600">
                    {editingId
                        ? 'Change the details, place or time. Duties and people stay as they are.'
                        : 'The event is saved as a draft. You set the duty requirements next.'}
                </p>
            </header>

            {existing.data?.status === 'published' && (
                <div className="mt-6 max-w-3xl">
                    <Alert tone="info">
                        This event is published. Assigned people see the new details as soon as you
                        save.
                    </Alert>
                </div>
            )}

            <form
                onSubmit={submit}
                noValidate
                className="mt-8 divide-y divide-stone-200 rounded-card bg-white ring-1 ring-stone-200"
            >
                <Section title="Details" intro="The name and notes personnel will see.">
                    <div className="grid gap-5 sm:grid-cols-3">
                        <TextField
                            className="sm:col-span-2"
                            label="Title"
                            placeholder="For example, University Foundation Day"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            error={first('title')}
                            maxLength={255}
                            required
                        />
                        <SelectField
                            label="Event type"
                            placeholder={lookups.isPending ? 'Loading...' : 'Choose a type'}
                            value={eventType}
                            onChange={(e) => setEventType(e.target.value)}
                            disabled={!lookups.isSuccess}
                            error={first('event_type')}
                            required
                        >
                            {lookups.data?.event_types.map((type) => (
                                <SelectOption key={type.value} value={type.value}>
                                    {type.label}
                                </SelectOption>
                            ))}
                            {/* An event may still use a type that was retired after it was made. */}
                            {existing.data &&
                                eventType === existing.data.event_type.value &&
                                !lookups.data?.event_types.some((t) => t.value === eventType) && (
                                    <SelectOption value={eventType}>
                                        {existing.data.event_type.label}
                                    </SelectOption>
                                )}
                        </SelectField>
                    </div>

                    <div>
                        <div className="mb-1.5 flex items-baseline justify-between gap-4">
                            <label
                                htmlFor="event-description"
                                className="text-sm font-medium text-stone-800"
                            >
                                Description{' '}
                                <span className="font-normal text-stone-500">(optional)</span>
                            </label>
                            <span
                                className="text-xs text-stone-500 tabular-nums"
                                aria-hidden="true"
                            >
                                {description.length} / {DESCRIPTION_MAX}
                            </span>
                        </div>
                        <textarea
                            id="event-description"
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={DESCRIPTION_MAX}
                            placeholder="What happens, who attends, and anything personnel should know."
                            aria-invalid={descriptionError ? true : undefined}
                            aria-describedby={
                                descriptionError ? 'event-description-error' : undefined
                            }
                            className={`${controlClass(Boolean(descriptionError))} min-h-28 resize-y py-3 leading-relaxed`}
                        />
                        {descriptionError && (
                            <FieldError id="event-description-error">{descriptionError}</FieldError>
                        )}
                    </div>
                </Section>

                <Section
                    title="Where and when"
                    intro={
                        editingId
                            ? 'Every duty shift must still fit inside the new start and end.'
                            : 'Pick the campus spot and the duty window.'
                    }
                >
                    <div>
                        <SelectField
                            label="Campus location"
                            placeholder={locationPlaceholder}
                            value={locationId}
                            onChange={(e) => setLocationId(e.target.value)}
                            disabled={!lookups.isSuccess}
                            error={first('campus_location_id')}
                            required
                        >
                            {lookups.data?.locations.map((location) => (
                                <SelectOption key={location.id} value={location.id}>
                                    {location.name}
                                </SelectOption>
                            ))}
                            {/* An event may still use a location that was retired after it was made. */}
                            {existing.data?.location &&
                                String(existing.data.location.id) === locationId &&
                                !lookups.data?.locations.some(
                                    (l) => l.id === existing.data.location?.id,
                                ) && (
                                    <SelectOption value={existing.data.location.id}>
                                        {existing.data.location.name}
                                    </SelectOption>
                                )}
                        </SelectField>
                        {lookups.isError && (
                            <div className="mt-3 space-y-3">
                                <Alert tone="error">
                                    The locations and event types did not load.
                                </Alert>
                                <Button
                                    variant="secondary"
                                    size="md"
                                    loading={lookups.isFetching}
                                    onClick={() => void lookups.refetch()}
                                >
                                    {lookups.isFetching ? 'Retrying...' : 'Retry'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <div className={`grid gap-5 sm:grid-cols-2 ${pickerClass}`}>
                        <TextField
                            label="Starts"
                            type="datetime-local"
                            value={startsAt}
                            onChange={(e) => setStartsAt(e.target.value)}
                            error={first('starts_at')}
                            required
                        />
                        <TextField
                            label="Ends"
                            type="datetime-local"
                            value={endsAt}
                            min={startsAt || undefined}
                            onChange={(e) => setEndsAt(e.target.value)}
                            error={first('ends_at')}
                            hint={duration(startsAt, endsAt) ?? 'Use the time personnel can leave.'}
                            required
                        />
                    </div>
                </Section>

                <div className="space-y-4 rounded-b-card bg-stone-50 px-6 py-4">
                    {failure && <Alert tone="error">{failure}</Alert>}
                    {hasErrors && !failure && (
                        <Alert tone="error">
                            Some fields need a fix. Check the messages above.
                        </Alert>
                    )}
                    <div className="flex flex-wrap items-center justify-end gap-3">
                        <Link
                            to={backTo}
                            className="inline-flex min-h-10 items-center rounded-control border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100"
                        >
                            Cancel
                        </Link>
                        <Button type="submit" size="md" loading={save.isPending}>
                            {save.isPending
                                ? 'Saving...'
                                : editingId
                                  ? 'Save changes'
                                  : 'Save event'}
                        </Button>
                    </div>
                </div>
            </form>
        </div>
    );
}
