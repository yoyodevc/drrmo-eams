<?php

declare(strict_types=1);

namespace App\Modules\Personnel\Actions;

use App\Modules\Access\Models\Role;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\Team;
use App\Modules\Personnel\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Reads a people CSV and checks every row without saving anything.
 * Columns: first_name, last_name, email, contact_number, role, team, department.
 * Team and department are matched by name, ignoring case. Unknown or inactive ones are errors.
 */
class PeopleCsvReader
{
    public const MAX_ROWS = 200;

    public const COLUMNS = ['first_name', 'last_name', 'email', 'contact_number', 'role', 'team', 'department'];

    private const REQUIRED = ['first_name', 'last_name', 'email', 'role'];

    /** The file a person fills in. Made up people, so it is safe to share. */
    public static function template(): string
    {
        return implode("\r\n", [
            implode(',', self::COLUMNS),
            'Ana,Reyes,ana.reyes@example.test,0917 123 4567,volunteer,ERT,',
            'Ben,Cruz,ben.cruz@example.test,,marshal,Security team,',
        ])."\r\n";
    }

    /**
     * @return array{rows: list<array<string, mixed>>, errors: list<array{row: int, field: string, message: string}>}
     *
     * `row` in an error is the line number in the file (the header is line 1).
     * `rows` is only filled in when there are no errors.
     */
    public function read(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            return $this->fileError('The file could not be read.');
        }

        $header = fgetcsv($handle, escape: '');
        if (! is_array($header) || $header === [null]) {
            fclose($handle);

            return $this->fileError('The file is empty.');
        }
        $header = array_map(fn ($h) => Str::lower(trim(preg_replace('/^\xEF\xBB\xBF/', '', (string) $h) ?? '')), $header);

        $missing = array_values(array_diff(self::REQUIRED, $header));
        if ($missing !== []) {
            fclose($handle);

            return $this->fileError('The header row is missing: '.implode(', ', $missing).'. Download the template to see the columns.');
        }

        $lines = [];
        $line = 1;
        while (($cells = fgetcsv($handle, escape: '')) !== false) {
            $line++;
            if ($cells === [null] || trim(implode('', array_map('strval', $cells))) === '') {
                continue; // blank line
            }
            if (count($lines) >= self::MAX_ROWS) {
                fclose($handle);

                return $this->fileError('The file has more than '.self::MAX_ROWS.' people. Split it into smaller files.');
            }
            $row = [];
            foreach ($header as $i => $name) {
                if (in_array($name, self::COLUMNS, true)) {
                    $row[$name] = trim((string) ($cells[$i] ?? ''));
                }
            }
            $lines[$line] = $row + array_fill_keys(self::COLUMNS, '');
        }
        fclose($handle);

        if ($lines === []) {
            return $this->fileError('The file has a header but no people.');
        }

        return $this->check($lines);
    }

    /**
     * @param  array<int, array<string, string>>  $lines  keyed by file line number
     * @return array{rows: list<array<string, mixed>>, errors: list<array{row: int, field: string, message: string}>}
     */
    private function check(array $lines): array
    {
        $roles = Role::query()->pluck('code')->all();
        $teams = Team::query()->get()->keyBy(fn (Team $t) => Str::lower($t->name));
        $departments = Department::query()->get()->keyBy(fn (Department $d) => Str::lower($d->name));
        $taken = User::query()->whereIn('email', collect($lines)->pluck('email')->map(fn ($e) => Str::lower($e))->all())
            ->pluck('email')->map(fn ($e) => Str::lower($e))->flip();

        $errors = [];
        $rows = [];
        $seen = [];

        foreach ($lines as $line => $row) {
            $row['email'] = Str::lower($row['email']);
            $row['role'] = Str::lower($row['role']);

            $validator = Validator::make($row, [
                'first_name' => ['required', 'string', 'max:100'],
                'last_name' => ['required', 'string', 'max:100'],
                'email' => ['required', 'string', 'email', 'max:255'],
                'contact_number' => ['nullable', 'string', 'regex:/^\+?[0-9][0-9 \-]{6,30}$/'],
                'role' => ['required', Rule::in($roles)],
            ], [
                'role.in' => 'Role must be one of: '.implode(', ', $roles).'.',
                'contact_number.regex' => 'Use digits only, for example 0917 123 4567.',
            ]);
            foreach ($validator->errors()->messages() as $field => $messages) {
                $errors[] = ['row' => $line, 'field' => $field, 'message' => $messages[0]];
            }

            if ($row['email'] !== '' && ! $validator->errors()->has('email')) {
                if ($taken->has($row['email'])) {
                    $errors[] = ['row' => $line, 'field' => 'email', 'message' => 'Someone already uses this email.'];
                } elseif (isset($seen[$row['email']])) {
                    $errors[] = ['row' => $line, 'field' => 'email', 'message' => "Same email as line {$seen[$row['email']]}."];
                }
                $seen[$row['email']] ??= $line;
            }

            $team = null;
            if ($row['team'] !== '') {
                $team = $teams->get(Str::lower($row['team']));
                if ($team === null) {
                    $errors[] = ['row' => $line, 'field' => 'team', 'message' => "No team named \"{$row['team']}\"."];
                } elseif (! $team->active) {
                    $errors[] = ['row' => $line, 'field' => 'team', 'message' => "Team \"{$team->name}\" is inactive."];
                }
            }

            $department = null;
            if ($row['department'] !== '') {
                $department = $departments->get(Str::lower($row['department']));
                if ($department === null) {
                    $errors[] = ['row' => $line, 'field' => 'department', 'message' => "No department named \"{$row['department']}\"."];
                } elseif (! $department->active) {
                    $errors[] = ['row' => $line, 'field' => 'department', 'message' => "Department \"{$department->name}\" is inactive."];
                }
            }

            $rows[] = [
                'first_name' => $row['first_name'],
                'last_name' => $row['last_name'],
                'email' => $row['email'],
                'contact_number' => $row['contact_number'] === '' ? null : $row['contact_number'],
                'role' => $row['role'],
                'team' => $team?->code,
                'department_id' => $department?->id,
            ];
        }

        return ['rows' => $errors === [] ? $rows : [], 'errors' => $errors];
    }

    /** @return array{rows: list<array<string, mixed>>, errors: list<array{row: int, field: string, message: string}>} */
    private function fileError(string $message): array
    {
        return ['rows' => [], 'errors' => [['row' => 0, 'field' => 'file', 'message' => $message]]];
    }
}
