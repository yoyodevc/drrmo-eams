// A-Person form (S2.1). Admin adds a person or edits one. A new person gets a set-password email.
// One white card split into two groups. Phones stack the buttons full width, Save on top.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    errorMessage,
    fieldErrors,
    getPerson,
    listDepartments,
    roleLabels,
    savePerson,
    teamLabels,
    type Person,
    type PersonInput,
    type RoleCode,
} from '@/features/personnel/people';
import { BackLink } from '@/features/personnel/components/ui';
import { Alert } from '@/shared/ui/Alert';
import { Button } from '@/shared/ui/Button';
import { TextField } from '@/shared/ui/TextField';

const empty: PersonInput = {
    first_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    role: 'volunteer',
    team: '',
    department_id: '',
};

function fromPerson(p: Person): PersonInput {
    return {
        first_name: p.first_name,
        last_name: p.last_name,
        email: p.email,
        contact_number: p.contact_number ?? '',
        role: p.role ?? 'volunteer',
        team: p.team ?? '',
        department_id: p.department ? String(p.department.id) : '',
    };
}

const selectClass =
    'block min-h-12 w-full rounded-control border border-stone-300 bg-white px-3.5 text-base text-stone-900 hover:border-stone-400 focus:border-maroon-700 focus:ring-3 focus:ring-maroon-700/15 focus:outline-none';

function SelectField({
    label,
    error,
    children,
    ...rest
}: {
    label: string;
    error?: string;
    children: ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <label className="block text-sm font-medium text-stone-800">
            <span className="mb-1.5 block">{label}</span>
            <select className={selectClass} aria-invalid={error ? true : undefined} {...rest}>
                {children}
            </select>
            {error && (
                <span className="mt-1.5 block text-sm font-medium text-red-700">{error}</span>
            )}
        </label>
    );
}

export function PersonForm() {
    const { id } = useParams();
    const personId = id ? Number(id) : null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    // null until the admin types, so the form shows what is on file.
    const [draft, setDraft] = useState<PersonInput | null>(null);

    const person = useQuery({
        queryKey: ['person', personId],
        queryFn: () => getPerson(personId as number),
        enabled: personId !== null,
    });
    const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments });
    const values = draft ?? (person.data ? fromPerson(person.data) : empty);

    const save = useMutation({
        mutationFn: () => savePerson(personId, values),
        onSuccess: async (result) => {
            await queryClient.invalidateQueries({ queryKey: ['people'] });
            await queryClient.invalidateQueries({ queryKey: ['person'] });
            // A new person lands on their profile, which says whether the email went out.
            void navigate(`/admin/people/${result.data.id}`, {
                state: personId === null ? { invited: result.invite_sent !== false } : undefined,
            });
        },
    });

    const errors = fieldErrors(save.error);
    const general = save.isError && Object.keys(errors).length === 0;
    const set = (key: keyof PersonInput) => (e: { target: { value: string } }) =>
        setDraft({ ...values, [key]: e.target.value });

    function submit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    const back = personId === null ? '/admin/people' : `/admin/people/${personId}`;
    const adding = personId === null;
    const loading = !adding && person.isPending;

    return (
        <div className="mx-auto max-w-2xl">
            <BackLink to={back}>{adding ? 'People' : (person.data?.name ?? 'Profile')}</BackLink>
            <div className="brand-stripe mt-2 h-1 w-12 rounded-full" aria-hidden="true" />
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                {adding ? 'Add person' : 'Edit details'}
            </h1>
            <p className="mt-1 text-pretty text-stone-600">
                {adding
                    ? 'We email them a link to choose their own password.'
                    : 'Changes are recorded in the audit log.'}
            </p>

            {person.isError && (
                <div className="mt-6 space-y-3">
                    <Alert tone="error">
                        This person did not load. Check your connection and try again.
                    </Alert>
                    <Button
                        variant="secondary"
                        size="md"
                        loading={person.isFetching}
                        onClick={() => void person.refetch()}
                    >
                        {person.isFetching ? 'Retrying...' : 'Retry'}
                    </Button>
                </div>
            )}

            {loading && (
                <div
                    className="mt-8 h-[520px] animate-pulse rounded-card bg-stone-200"
                    aria-busy="true"
                >
                    <p role="status" className="sr-only">
                        Loading...
                    </p>
                </div>
            )}

            {!loading && !person.isError && (
                <form
                    onSubmit={submit}
                    className="mt-8 rounded-card bg-white p-4 ring-1 ring-stone-200 md:p-6"
                    noValidate
                >
                    <fieldset className="space-y-4">
                        <legend className="text-lg font-semibold text-stone-900">
                            Name and contact
                        </legend>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <TextField
                                label="First name"
                                autoComplete="off"
                                value={values.first_name}
                                onChange={set('first_name')}
                                error={errors.first_name}
                                maxLength={100}
                                required
                            />
                            <TextField
                                label="Last name"
                                autoComplete="off"
                                value={values.last_name}
                                onChange={set('last_name')}
                                error={errors.last_name}
                                maxLength={100}
                                required
                            />
                        </div>
                        <TextField
                            label="Email"
                            type="email"
                            inputMode="email"
                            autoComplete="off"
                            value={values.email}
                            onChange={set('email')}
                            error={errors.email}
                            maxLength={255}
                            required
                        />
                        <TextField
                            label="Contact number"
                            type="tel"
                            inputMode="tel"
                            autoComplete="off"
                            value={values.contact_number}
                            onChange={set('contact_number')}
                            error={errors.contact_number}
                            hint="Optional. For example 0917 123 4567."
                        />
                    </fieldset>

                    <fieldset className="mt-8 space-y-4 border-t border-stone-200 pt-6">
                        <legend className="sr-only">Role and team</legend>
                        <h2 aria-hidden="true" className="text-lg font-semibold text-stone-900">
                            Role and team
                        </h2>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <SelectField
                                label="Role"
                                value={values.role}
                                onChange={set('role')}
                                error={errors.role}
                            >
                                {(Object.keys(roleLabels) as RoleCode[]).map((value) => (
                                    <option key={value} value={value}>
                                        {roleLabels[value]}
                                    </option>
                                ))}
                            </SelectField>
                            <SelectField
                                label="Team"
                                value={values.team}
                                onChange={set('team')}
                                error={errors.team}
                            >
                                <option value="">No team</option>
                                {Object.entries(teamLabels).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </SelectField>
                        </div>
                        <SelectField
                            label="Department"
                            value={values.department_id}
                            onChange={set('department_id')}
                            error={errors.department_id}
                        >
                            <option value="">No department</option>
                            {departments.data?.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </SelectField>
                    </fieldset>

                    {general && (
                        <div className="mt-6">
                            <Alert tone="error">{errorMessage(save.error)}</Alert>
                        </div>
                    )}

                    <div className="mt-8 flex flex-col gap-3 border-t border-stone-200 pt-6 sm:flex-row-reverse sm:justify-end">
                        <Button type="submit" loading={save.isPending} className="w-full sm:w-auto">
                            {save.isPending
                                ? 'Saving...'
                                : adding
                                  ? 'Add and send email'
                                  : 'Save changes'}
                        </Button>
                        <Link
                            to={back}
                            className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-stone-300 bg-white px-5 text-base font-semibold text-stone-800 transition-colors hover:bg-stone-50 active:bg-stone-100 sm:w-auto"
                        >
                            Cancel
                        </Link>
                    </div>
                </form>
            )}
        </div>
    );
}
