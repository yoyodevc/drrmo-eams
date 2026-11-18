// A-Event types. Admin adds, renames, deactivates and removes the types used on the event form and
// the event filters. A type that events still use can be set inactive, not deleted.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import {
    deleteEventType,
    listEventTypes,
    saveEventType,
    type EventTypeRow,
} from '@/features/events/api';
import { errorMessage, fieldErrors } from '@/features/personnel/people';
import { EditIcon, PlusIcon, TrashIcon, chipBase } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

const iconButton =
    'inline-flex size-12 items-center justify-center rounded-control text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 active:bg-stone-200 md:size-10';

function count(n: number) {
    return n === 1 ? '1 event' : `${n} events`;
}

export function EventTypes() {
    const queryClient = useQueryClient();
    const list = useQuery({ queryKey: ['event-types'], queryFn: listEventTypes });
    // editing: null = closed, 'new' = add dialog, else the type being edited.
    const [editing, setEditing] = useState<EventTypeRow | 'new' | null>(null);
    const [name, setName] = useState('');
    const [active, setActive] = useState(true);
    const [removing, setRemoving] = useState<EventTypeRow | null>(null);

    const refresh = () =>
        Promise.all([
            queryClient.invalidateQueries({ queryKey: ['event-types'] }),
            queryClient.invalidateQueries({ queryKey: ['event-lookups'] }),
            queryClient.invalidateQueries({ queryKey: ['events'] }),
        ]);
    const save = useMutation({
        mutationFn: (input: { code: string | null; name: string; active: boolean }) =>
            saveEventType(input.code, { name: input.name, active: input.active }),
        onSuccess: async () => {
            await refresh();
            setEditing(null);
            setRemoving(null);
        },
    });
    const remove = useMutation({
        mutationFn: (type: EventTypeRow) => deleteEventType(type.code),
        onSuccess: async () => {
            await refresh();
            setRemoving(null);
        },
    });

    function open(type: EventTypeRow | 'new') {
        save.reset();
        setName(type === 'new' ? '' : type.name);
        setActive(type === 'new' ? true : type.active);
        setEditing(type);
    }

    function submit(e?: FormEvent) {
        e?.preventDefault();
        if (name.trim() === '' || save.isPending) return;
        save.mutate({
            code: editing === 'new' || editing === null ? null : editing.code,
            name: name.trim(),
            active,
        });
    }

    const nameError = fieldErrors(save.error).name;
    const types = list.data ?? [];
    const inUse = removing !== null && removing.events_count > 0;
    const canDeactivate = removing?.active ?? false;

    let removeTitle = '';
    let removeText = '';
    if (removing) {
        if (!inUse) {
            removeTitle = `Delete ${removing.name}?`;
            removeText =
                'No event uses this type. Deleting it removes it from every list. You cannot undo this.';
        } else {
            removeTitle = `${removing.name} is in use`;
            removeText = canDeactivate
                ? `${count(removing.events_count)} use this type, so it cannot be deleted. Set it inactive to hide it from new events. Existing events keep it.`
                : `${count(removing.events_count)} use this type, so it cannot be deleted. It is already inactive.`;
        }
    }

    return (
        <div className="mx-auto max-w-3xl">
            <header>
                <div className="brand-stripe h-1 w-12 rounded-full" aria-hidden="true" />
                <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                    Event types
                </h1>
                <p className="mt-1 max-w-2xl text-pretty text-stone-600">
                    Every event has one type. These fill the choice on the event form and the filter
                    on the Events page.
                </p>
            </header>

            <section
                aria-labelledby="event-types-title"
                className="mt-8 overflow-hidden rounded-card bg-white ring-1 ring-stone-200"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 px-4 py-4 md:px-6 md:py-5">
                    <h2 id="event-types-title" className="text-lg font-semibold text-stone-900">
                        Types
                        {list.isSuccess && (
                            <span className="ml-2 text-base font-normal text-stone-500 tabular-nums">
                                {types.length}
                            </span>
                        )}
                    </h2>
                    <Button
                        variant="secondary"
                        size="md"
                        className="shrink-0 max-sm:min-h-12 max-sm:w-full max-sm:text-base"
                        onClick={() => open('new')}
                    >
                        <PlusIcon className="size-5 sm:size-4" />
                        Add type
                    </Button>
                </div>

                {list.isPending && <p className="px-6 py-8 text-stone-500">Loading...</p>}
                {list.isError && (
                    <div className="space-y-3 px-4 py-5 md:px-6">
                        <Alert tone="error">
                            The list did not load. Check your connection and try again.
                        </Alert>
                        <Button
                            variant="secondary"
                            size="md"
                            loading={list.isFetching}
                            onClick={() => void list.refetch()}
                        >
                            Retry
                        </Button>
                    </div>
                )}
                {list.isSuccess && types.length === 0 && (
                    <p className="px-6 py-10 text-center text-stone-600">
                        No event types yet. Add the first one to use it on events.
                    </p>
                )}
                {list.isSuccess && types.length > 0 && (
                    <ul className="divide-y divide-stone-100">
                        {types.map((t) => (
                            <li
                                key={t.code}
                                className="flex items-center gap-3 py-2 pr-2 pl-4 md:min-h-16 md:pr-3 md:pl-6"
                            >
                                <div className="min-w-0 flex-1 py-1">
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                        <p
                                            className={`font-medium break-words ${t.active ? 'text-stone-900' : 'text-stone-600'}`}
                                        >
                                            {t.name}
                                        </p>
                                        {!t.active && (
                                            <span
                                                className={`${chipBase} bg-stone-100 text-stone-600 ring-stone-200`}
                                            >
                                                Inactive
                                            </span>
                                        )}
                                    </div>
                                    <p className="mt-0.5 text-sm text-stone-500 tabular-nums">
                                        {t.events_count > 0
                                            ? count(t.events_count)
                                            : 'No events yet'}
                                    </p>
                                </div>
                                <div className="flex shrink-0">
                                    <button
                                        type="button"
                                        className={iconButton}
                                        aria-label={`Edit ${t.name}`}
                                        title="Edit"
                                        onClick={() => open(t)}
                                    >
                                        <EditIcon className="size-5" />
                                    </button>
                                    <button
                                        type="button"
                                        className={`${iconButton} hover:text-red-700`}
                                        aria-label={`Delete ${t.name}`}
                                        title="Delete"
                                        onClick={() => {
                                            remove.reset();
                                            save.reset();
                                            setRemoving(t);
                                        }}
                                    >
                                        <TrashIcon className="size-5" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <ConfirmDialog
                open={editing !== null}
                title={editing === 'new' ? 'Add an event type' : 'Edit event type'}
                description={
                    editing === 'new'
                        ? 'It shows up in the type choices on the event form and the Events filter.'
                        : 'A new name shows on every event of this type.'
                }
                confirmLabel={editing === 'new' ? 'Add type' : 'Save changes'}
                loadingLabel="Saving..."
                loading={save.isPending && editing !== null}
                confirmDisabled={name.trim() === ''}
                error={
                    save.isError && !nameError && editing !== null ? errorMessage(save.error) : null
                }
                onConfirm={() => submit()}
                onCancel={() => setEditing(null)}
            >
                <form onSubmit={submit} className="space-y-4">
                    <TextField
                        label="Name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={nameError}
                        hint="For example, Outreach."
                        maxLength={100}
                        autoFocus
                    />
                    <label className="flex min-h-12 items-start gap-3 py-1 text-stone-800">
                        <input
                            type="checkbox"
                            checked={active}
                            onChange={(e) => setActive(e.target.checked)}
                            className="mt-0.5 size-5 shrink-0 accent-maroon-700"
                        />
                        <span>
                            <span className="block text-sm font-medium">Active</span>
                            <span className="block text-sm text-stone-500">
                                Can be picked for new events. Turn off to retire it without changing
                                existing events.
                            </span>
                        </span>
                    </label>
                </form>
            </ConfirmDialog>

            <ConfirmDialog
                open={removing !== null}
                title={removeTitle}
                description={removeText}
                confirmLabel={inUse ? (canDeactivate ? 'Set inactive' : 'OK') : 'Delete'}
                loadingLabel="Saving..."
                tone={inUse ? 'primary' : 'danger'}
                loading={remove.isPending || (save.isPending && removing !== null)}
                error={
                    removing !== null && (remove.isError || save.isError)
                        ? errorMessage(remove.error ?? save.error)
                        : null
                }
                onConfirm={() => {
                    if (!removing) return;
                    if (!inUse) remove.mutate(removing);
                    else if (canDeactivate)
                        save.mutate({ code: removing.code, name: removing.name, active: false });
                    else setRemoving(null);
                }}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
