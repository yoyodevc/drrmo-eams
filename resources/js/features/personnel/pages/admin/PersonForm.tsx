// A-Person form (S2.1). Admin adds a person or edits one. A new person gets a set-password email.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
    errorMessage,
    fieldErrors,
    getPerson,
    listDepartments,
    roleLabels,
    savePerson,
    teamLabels,
    type PersonInput,
    type RoleCode,
} from '@/features/personnel/people';
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
            {error && <span className="mt-1.5 block text-sm text-red-700">{error}</span>}
        </label>
    );
}

export function PersonForm() {
    const { id } = useParams();
    const personId = id ? Number(id) : null;
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [values, setValues] = useState<PersonInput>(empty);

    const person = useQuery({
        queryKey: ['person', personId],
        queryFn: () => getPerson(personId as number),
        enabled: personId !== null,
    });
    const departments = useQuery({ queryKey: ['departments'], queryFn: listDepartments });

    useEffect(() => {
        const p = person.data;
        if (!p) return;
        setValues({
            first_name: p.first_name,
            last_name: p.last_name,
            email: p.email,
            contact_number: p.contact_number ?? '',
            role: p.role ?? 'volunteer',
            team: p.team ?? '',
            department_id: p.department ? String(p.department.id) : '',
        });
    }, [person.data]);

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
        setValues((v) => ({ ...v, [key]: e.target.value }));

    function submit(event: FormEvent) {
        event.preventDefault();
        save.mutate();
    }

    const back = personId === null ? '/admin/people' : `/admin/people/${personId}`;

    return (
        <div className="max-w-2xl">
            <Link to={back} className="text-sm font-medium text-stone-700 hover:text-stone-900">
                Back
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-stone-900">
                {personId === null ? 'Add person' : 'Edit person'}
            </h1>
            {personId === null && (
                <p className="mt-1 text-stone-600">
                    We email them a link to choose their own password.
                </p>
            )}

            {person.isError && (
                <div className="mt-4">
                    <Alert tone="error">Could not load this person.</Alert>
                </div>
            )}

            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                        label="First name"
                        value={values.first_name}
                        onChange={set('first_name')}
                        error={errors.first_name}
                        maxLength={100}
                        required
                    />
                    <TextField
                        label="Last name"
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
                    value={values.email}
                    onChange={set('email')}
                    error={errors.email}
                    maxLength={255}
                    required
                />
                <TextField
                    label="Contact number"
                    type="tel"
                    value={values.contact_number}
                    onChange={set('contact_number')}
                    error={errors.contact_number}
                    hint="Optional. For example 0917 123 4567."
                />
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

                {general && <Alert tone="error">{errorMessage(save.error)}</Alert>}

                <div className="flex gap-3 pt-2">
                    <Button type="submit" loading={save.isPending}>
                        {personId === null ? 'Add and send email' : 'Save changes'}
                    </Button>
                    <Link
                        to={back}
                        className="inline-flex min-h-12 items-center rounded-control border border-stone-300 bg-white px-5 font-semibold text-stone-800 hover:bg-stone-50"
                    >
                        Cancel
                    </Link>
                </div>
            </form>
        </div>
    );
}
