<?php

declare(strict_types=1);

use App\Modules\Access\Models\RefreshToken;
use App\Modules\Personnel\Models\User;
use App\Modules\Records\Models\AuditLog;
use Database\Seeders\PermissionSeeder;
use Firebase\JWT\JWT;

beforeEach(function () {
    $this->seed(PermissionSeeder::class);
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
});

function accessName(): string
{
    return (string) config('jwt.cookies.access');
}

function refreshName(): string
{
    return (string) config('jwt.cookies.refresh');
}

function testSecret(): string
{
    return (string) base64_decode(substr((string) config('jwt.secret'), 7), true);
}

/** @param  array<string, mixed>  $overrides */
function forgedToken(User $user, array $overrides = [], ?string $secret = null, ?string $kid = 'v1'): string
{
    $now = now()->getTimestamp();

    return JWT::encode(array_merge([
        'iss' => config('jwt.issuer'),
        'aud' => config('jwt.audience'),
        'sub' => (string) $user->id,
        'iat' => $now,
        'nbf' => $now,
        'exp' => $now + 900,
        'jti' => 'forged-'.$now,
    ], $overrides), $secret ?? testSecret(), 'HS256', $kid);
}

it('signs in with two HttpOnly SameSite cookies and no token in the body', function () {
    $user = User::factory()->create();

    $response = $this->postJson('/api/login', ['email' => $user->email, 'password' => 'password'])->assertOk();

    foreach ([accessName(), refreshName()] as $name) {
        $cookie = $response->getCookie($name, false);
        expect($cookie)->not->toBeNull()
            ->and($cookie->isHttpOnly())->toBeTrue()
            ->and($cookie->getSameSite())->toBe('lax')
            ->and($cookie->getPath())->toBe('/api');
    }

    expect($response->getContent())
        ->not->toContain($response->getCookie(accessName(), false)->getValue())
        ->and(AuditLog::query()->where('action', 'auth.login')->where('entity_id', $user->id)->exists())->toBeTrue();
});

it('stores only a hash of the refresh token', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    $row = RefreshToken::query()->sole();
    expect($row->token_hash)->toBe(hash('sha256', $cookies[refreshName()]))
        ->and($row->token_hash)->not->toBe($cookies[refreshName()]);
});

it('reads the user from the access cookie', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->getJson('/api/me')->assertOk()->assertJsonPath('data.id', $user->public_code);
    withAuthCookies([])->getJson('/api/me')->assertUnauthorized();
});

it('refreshes an expired access token and rotates the refresh token', function () {
    $user = User::factory()->create();
    $first = loginCookies($user);

    $this->travel(16)->minutes();
    withAuthCookies($first)->getJson('/api/me')->assertUnauthorized();

    $response = withAuthCookies($first)->postJson('/api/refresh')->assertNoContent();
    $second = $this->authCookiesFrom($response);

    expect($second[refreshName()])->not->toBe($first[refreshName()]);
    withAuthCookies($second)->getJson('/api/me')->assertOk();
});

it('revokes the whole family and audits it when an old refresh token is used again', function () {
    $user = User::factory()->create();
    $first = loginCookies($user);
    $second = $this->authCookiesFrom(withAuthCookies($first)->postJson('/api/refresh')->assertNoContent());

    $this->travel(2)->minutes();

    // Someone replays the first token: refused, and the newer token dies with it.
    withAuthCookies($first)->postJson('/api/refresh')->assertUnauthorized()->assertJsonPath('code', 'session_ended');
    withAuthCookies($second)->postJson('/api/refresh')->assertUnauthorized();

    expect(RefreshToken::query()->whereNull('revoked_at')->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.token_reuse_detected')->where('entity_id', $user->id)->exists())->toBeTrue();
});

it('lets two tabs refresh with the same token at the same moment', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    withAuthCookies($cookies)->postJson('/api/refresh')->assertNoContent();
    withAuthCookies($cookies)->postJson('/api/refresh')->assertNoContent();

    expect(AuditLog::query()->where('action', 'auth.token_reuse_detected')->exists())->toBeFalse();
});

it('refuses an expired refresh token', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    $this->travel(8)->days();

    withAuthCookies($cookies)->postJson('/api/refresh')->assertUnauthorized();
});

it('signs out: revokes the refresh family, denylists the access token and clears the cookies', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    $response = withAuthCookies($cookies)->postJson('/api/logout')->assertNoContent();

    expect($response->getCookie(accessName(), false)?->getValue())->toBe('')
        ->and($response->getCookie(refreshName(), false)?->getValue())->toBe('')
        ->and(RefreshToken::query()->whereNull('revoked_at')->count())->toBe(0)
        ->and(AuditLog::query()->where('action', 'auth.logout')->where('entity_id', $user->id)->exists())->toBeTrue();

    // A copy of the old cookies is useless afterwards.
    withAuthCookies($cookies)->getJson('/api/me')->assertUnauthorized();
    withAuthCookies($cookies)->postJson('/api/refresh')->assertUnauthorized();
});

it('rejects forged, tampered, expired and wrong audience tokens', function (Closure $makeToken) {
    $user = User::factory()->create();

    withAuthCookies([accessName() => $makeToken($user)])->getJson('/api/me')->assertUnauthorized();
})->with([
    // The parameter is typed Closure, so Pest passes these through without calling them.
    'tampered signature' => [function (User $user) {
        $token = forgedToken($user);

        return substr($token, 0, -2).(str_ends_with($token, 'AA') ? 'BB' : 'AA');
    }],
    'alg none' => [function (User $user) {
        $encode = fn (array $part) => rtrim(strtr(base64_encode((string) json_encode($part)), '+/', '-_'), '=');
        $now = now()->getTimestamp();

        return $encode(['alg' => 'none', 'typ' => 'JWT', 'kid' => 'v1']).'.'.$encode([
            'iss' => config('jwt.issuer'), 'aud' => config('jwt.audience'), 'sub' => (string) $user->id,
            'iat' => $now, 'nbf' => $now, 'exp' => $now + 900, 'jti' => 'none',
        ]).'.';
    }],
    'wrong secret' => [fn (User $user) => forgedToken($user, [], str_repeat('x', 40))],
    'expired' => [fn (User $user) => forgedToken($user, ['iat' => now()->subHour()->getTimestamp(), 'nbf' => now()->subHour()->getTimestamp(), 'exp' => now()->subMinutes(30)->getTimestamp()])],
    'wrong audience' => [fn (User $user) => forgedToken($user, ['aud' => 'https://evil.example.test'])],
    'no key id' => [fn (User $user) => forgedToken($user, [], null, null)],
    'garbage' => [fn (User $user) => 'not-a-token'],
]);

it('accepts a correctly signed token, so the forged cases fail for the right reason', function () {
    $user = User::factory()->create();

    withAuthCookies([accessName() => forgedToken($user)])->getJson('/api/me')->assertOk();
});

it('cuts off a disabled account at once and at refresh', function () {
    $user = User::factory()->create();
    $cookies = loginCookies($user);

    $user->forceFill(['disabled_at' => now()])->save();

    withAuthCookies($cookies)->getJson('/api/me')->assertUnauthorized();
    withAuthCookies($cookies)->postJson('/api/refresh')->assertUnauthorized();
    expect(RefreshToken::query()->whereNull('revoked_at')->count())->toBe(0);
});

it('blocks state changing calls without the app header or from another origin', function () {
    $user = User::factory()->create();
    $body = ['email' => $user->email, 'password' => 'password'];

    $this->withHeaders(['X-Requested-With' => ''])->postJson('/api/login', $body)
        ->assertForbidden()->assertJsonPath('code', 'bad_origin');

    $this->withHeaders(['X-Requested-With' => 'XMLHttpRequest', 'Origin' => 'https://evil.example.test'])
        ->postJson('/api/login', $body)->assertForbidden();

    $this->withHeaders(['Origin' => 'http://localhost'])->postJson('/api/login', $body)->assertOk();
});
