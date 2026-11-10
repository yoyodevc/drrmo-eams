<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Notifications\Contracts\MailSender;
use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\Team;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Illuminate\Http\UploadedFile;
use Tests\Support\FakeMailSender;

beforeEach(function () {
    $this->seed();
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->mail = new FakeMailSender;
    app()->instance(MailSender::class, $this->mail);
    Team::query()->updateOrCreate(['code' => 'ert'], ['name' => 'ERT', 'active' => true]);
    Department::query()->create(['name' => 'Security Office', 'active' => true]);
    Department::query()->create(['name' => 'Old Office', 'active' => false]);
    Team::query()->updateOrCreate(['code' => 'retired'], ['name' => 'Retired team', 'active' => false]);
});

const IMPORT_HEADER = "first_name,last_name,email,contact_number,role,team,department\n";

function csv(string $body): UploadedFile
{
    return UploadedFile::fake()->createWithContent('people.csv', IMPORT_HEADER.$body);
}

it('imports every row, audits it and emails each person', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();

    withAuthCookies(loginCookies($admin))->post('/api/people/import', [
        'file' => csv("Ana,Reyes,ANA@example.test,0917 123 4567,volunteer,ert,Security Office\nBen,Cruz,ben@example.test,,Marshal,,\n"),
    ])->assertCreated()->assertJsonPath('count', 2)->assertJsonPath('imported', true);

    $ana = User::query()->where('email', 'ana@example.test')->sole();
    expect($ana->team)->toBe('ert')->and($ana->department?->name)->toBe('Security Office')
        ->and(User::query()->where('email', 'ben@example.test')->sole()->roleCode())->toBe(RoleCode::Marshal);
    expect($this->mail->sent)->toHaveCount(2);
    expect(AuditLog::query()->where('action', 'person.created')->count())->toBe(2)
        ->and(AuditLog::query()->where('action', 'people.imported')->exists())->toBeTrue();
});

it('saves nothing when one row is wrong and lists every problem by line', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    User::factory()->create(['email' => 'taken@example.test']);
    $before = User::query()->count();

    $res = withAuthCookies(loginCookies($admin))->post('/api/people/import', [
        'file' => csv(implode("\n", [
            'Ana,Reyes,ana@example.test,,volunteer,,',
            'Bad,Role,bad@example.test,,king,,',
            'Dup,Taken,taken@example.test,,volunteer,,',
            'Same,Again,ana@example.test,,volunteer,,',
            'Old,Team,old@example.test,,volunteer,Retired team,Old Office',
            'No,Team,no@example.test,abc,volunteer,Nope,Nowhere',
        ])."\n"),
    ])->assertUnprocessable();

    $got = collect($res->json('errors'))->map(fn ($e) => "{$e['row']}:{$e['field']}")->all();
    expect($got)->toContain('3:role', '4:email', '5:email', '6:team', '6:department', '7:team', '7:department', '7:contact_number')
        ->and(User::query()->count())->toBe($before);
    expect($this->mail->sent)->toBeEmpty();
});

it('only checks the file when asked to', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $before = User::query()->count();

    withAuthCookies(loginCookies($admin))->post('/api/people/import', ['check' => 1, 'file' => csv("Ana,Reyes,ana@example.test,,volunteer,,\n")])
        ->assertOk()->assertJsonPath('count', 1)->assertJsonPath('imported', false);
    expect(User::query()->count())->toBe($before)->and($this->mail->sent)->toBeEmpty();
});

it('rejects a file with the wrong header, no rows or too many rows', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $post = fn (string $content) => withAuthCookies(loginCookies($admin))->post('/api/people/import', [
        'file' => UploadedFile::fake()->createWithContent('people.csv', $content),
    ]);

    $post("name,email\nAna,ana@example.test\n")->assertUnprocessable()->assertJsonPath('errors.0.field', 'file');
    $post(IMPORT_HEADER)->assertUnprocessable()->assertJsonPath('errors.0.field', 'file');
    $post(IMPORT_HEADER.str_repeat("A,B,x@example.test,,volunteer,,\n", 201))->assertUnprocessable()->assertJsonPath('errors.0.field', 'file');
});

it('serves the template and keeps non-admins out', function () {
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $volunteer = User::factory()->role(RoleCode::Volunteer)->create();

    withAuthCookies(loginCookies($admin))->get('/api/people/import/template')->assertOk()->assertHeader('Content-Disposition', 'attachment; filename="people-template.csv"');
    withAuthCookies(loginCookies($volunteer))->get('/api/people/import/template')->assertForbidden();
    withAuthCookies(loginCookies($volunteer))->post('/api/people/import', ['file' => csv("Ana,Reyes,ana@example.test,,volunteer,,\n")])->assertForbidden();
    $this->post('/api/people/import', [])->assertUnauthorized();
    expect(User::query()->where('email', 'ana@example.test')->exists())->toBeFalse();
});
