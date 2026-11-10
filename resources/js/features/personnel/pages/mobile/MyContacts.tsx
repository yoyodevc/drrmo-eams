// M-Emergency contacts (S2.3). A person adds, edits and deletes their own contacts.
// Opened from the Me tab. Mobile first at 360 px: one column, big tap targets.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
    deleteContact,
    MAX_CONTACTS,
    myContacts,
    saveContact,
    type ContactInput,
    type EmergencyContact,
} from '@/features/personnel/contacts';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { TextField } from '@/shared/ui/TextField';

const empty: ContactInput = { name: '', relationship: '', phone: '' };

type FieldErrors = Partial<Record<keyof ContactInput, string>>;

function fieldErrors(error: unknown): FieldErrors {
    if (!(error instanceof ApiError) || error.status !== 422) return {};
    const raw = (error.body as { errors?: Record<string, string[]> } | null)?.errors ?? {};
    return Object.fromEntries(Object.entries(raw).map(([key, list]) => [key, list[0]]));
}

function message(error: unknown): string {
    if (error instanceof ApiError && error.status === 422) {
        const text = (error.body as { message?: string } | null)?.message;
        if (text) return text;
    }
    return 'That did not save. Check your connection and try again.';
}

function ContactForm({
    contact,
    onDone,
}: {
    contact: EmergencyContact | null;
    onDone: () => void;
}) {
    const queryClient = useQueryClient();
    const [values, setValues] = useState<ContactInput>(
        contact
            ? { name: contact.name, relationship: contact.relationship, phone: contact.phone }
            : empty,
    );
    const save = useMutation({
        mutationFn: () => saveContact(contact?.id ?? null, values),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ['my-contacts'] });
            onDone();
        },
    });
    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;

    function submit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    return (
        <form
            onSubmit={submit}
            className="mt-6 space-y-4 rounded-card bg-white p-4 ring-1 ring-stone-200"
        >
            <h2 className="text-lg font-semibold text-stone-900">
                {contact ? 'Edit contact' : 'Add a contact'}
            </h2>
            {general && <Alert tone="error">{message(save.error)}</Alert>}
            <TextField
                label="Full name"
                autoComplete="off"
                value={values.name}
                onChange={(e) => setValues({ ...values, name: e.target.value })}
                error={errors.name}
                maxLength={120}
                required
            />
            <TextField
                label="Relationship"
                hint="For example Mother, Spouse, Friend."
                autoComplete="off"
                value={values.relationship}
                onChange={(e) => setValues({ ...values, relationship: e.target.value })}
                error={errors.relationship}
                maxLength={64}
                required
            />
            <TextField
                label="Phone number"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={values.phone}
                onChange={(e) => setValues({ ...values, phone: e.target.value })}
                error={errors.phone}
                maxLength={32}
                required
            />
            <div className="flex flex-col gap-2">
                <Button type="submit" block loading={save.isPending}>
                    {save.isPending ? 'Saving...' : 'Save contact'}
                </Button>
                <Button variant="secondary" block onClick={onDone} disabled={save.isPending}>
                    Cancel
                </Button>
            </div>
        </form>
    );
}

function Skeleton() {
    return (
        <div className="mt-6" aria-busy="true">
            <p role="status" className="sr-only">
                Loading your contacts...
            </p>
            <div aria-hidden="true" className="h-24 animate-pulse rounded-card bg-stone-200" />
        </div>
    );
}

export function MyContacts() {
    const queryClient = useQueryClient();
    const query = useQuery({ queryKey: ['my-contacts'], queryFn: myContacts });
    // null = list view, 'new' = add form, a contact = edit form.
    const [editing, setEditing] = useState<EmergencyContact | 'new' | null>(null);
    const [removing, setRemoving] = useState<EmergencyContact | null>(null);

    const remove = useMutation({
        mutationFn: (contact: EmergencyContact) => deleteContact(contact.id),
        onSuccess: async () => {
            setRemoving(null);
            await queryClient.invalidateQueries({ queryKey: ['my-contacts'] });
        },
    });

    const contacts = query.data ?? [];
    const full = contacts.length >= MAX_CONTACTS;

    return (
        <div className="mx-auto max-w-2xl">
            <Link
                to="/me/profile"
                className="-mt-2 -ml-2 inline-flex min-h-12 items-center gap-1 rounded-control px-2 text-sm font-medium text-stone-700 transition-colors hover:text-stone-900"
            >
                <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="m15 6-6 6 6 6" />
                </svg>
                Me
            </Link>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                Emergency contacts
            </h1>
            <p className="mt-1 text-base text-pretty text-stone-600">
                People DRRMO can call if something happens to you on duty. Only you and DRRMO admins
                can see them.
            </p>

            {editing ? (
                <ContactForm
                    key={editing === 'new' ? 'new' : editing.id}
                    contact={editing === 'new' ? null : editing}
                    onDone={() => setEditing(null)}
                />
            ) : (
                <>
                    {query.isPending && <Skeleton />}

                    {query.isError && (
                        <div className="mt-6 space-y-3">
                            <Alert tone="error">
                                Your contacts did not load. Check your connection and try again.
                            </Alert>
                            <Button
                                variant="secondary"
                                block
                                loading={query.isFetching}
                                onClick={() => void query.refetch()}
                            >
                                {query.isFetching ? 'Retrying...' : 'Retry'}
                            </Button>
                        </div>
                    )}

                    {query.data && (
                        <div className="mt-6">
                            {contacts.length === 0 ? (
                                <p className="rounded-card bg-white p-4 text-base text-pretty text-stone-600 ring-1 ring-stone-200">
                                    You have not added anyone yet. Add at least one person we can
                                    reach.
                                </p>
                            ) : (
                                <ul className="divide-y divide-stone-100 overflow-hidden rounded-card bg-white ring-1 ring-stone-200">
                                    {contacts.map((c) => (
                                        <li key={c.id} className="p-4">
                                            <p className="font-semibold text-stone-900">{c.name}</p>
                                            <p className="text-sm text-stone-600">
                                                {c.relationship}
                                            </p>
                                            <a
                                                href={`tel:${c.phone.replace(/[^+\d]/g, '')}`}
                                                className="mt-1 inline-block text-base font-medium text-maroon-700 tabular-nums underline-offset-2 hover:underline"
                                            >
                                                {c.phone}
                                            </a>
                                            <div className="mt-3 flex gap-2">
                                                <Button
                                                    size="md"
                                                    variant="secondary"
                                                    onClick={() => setEditing(c)}
                                                    aria-label={`Edit ${c.name}`}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="md"
                                                    variant="secondary"
                                                    onClick={() => {
                                                        remove.reset();
                                                        setRemoving(c);
                                                    }}
                                                    aria-label={`Delete ${c.name}`}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="mt-4">
                                <Button block disabled={full} onClick={() => setEditing('new')}>
                                    Add a contact
                                </Button>
                                {full && (
                                    <p className="mt-2 text-sm text-stone-600">
                                        You can keep up to {MAX_CONTACTS} contacts. Delete one to
                                        add another.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            <ConfirmDialog
                open={removing !== null}
                title="Delete this contact?"
                description={
                    removing ? `${removing.name} will be removed from your emergency contacts.` : ''
                }
                confirmLabel="Delete contact"
                loadingLabel="Deleting..."
                tone="danger"
                loading={remove.isPending}
                error={remove.isError ? 'That did not delete. Try again.' : null}
                onConfirm={() => removing && remove.mutate(removing)}
                onCancel={() => setRemoving(null)}
            />
        </div>
    );
}
