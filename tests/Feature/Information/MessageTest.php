<?php

declare(strict_types=1);

use App\Modules\Access\Enums\Role as RoleCode;
use App\Modules\Information\Models\Message;
use App\Modules\Personnel\Models\User;

beforeEach(function () {
    $this->withHeaders(['Referer' => 'http://localhost', 'X-Requested-With' => 'XMLHttpRequest']);
    $this->seed();
});

it('lets every role write to the office and read the answers', function (RoleCode $role) {
    $person = User::factory()->role($role)->create();

    withAuthCookies(loginCookies($person))->postJson('/api/me/messages', ['body' => '  Is the drill still on Friday?  '])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Is the drill still on Friday?')
        ->assertJsonPath('data.from_office', false)
        ->assertJsonPath('data.sender', 'You');

    $message = Message::query()->sole();
    expect($message->sender_id)->toBe($person->id)->and($message->recipient_id)->toBeNull()->and($message->read_at)->toBeNull();
})->with([RoleCode::Volunteer, RoleCode::Marshal, RoleCode::Coordinator, RoleCode::Admin]);

it('validates the text of a message', function () {
    $cookies = loginCookies(User::factory()->role(RoleCode::Volunteer)->create());

    withAuthCookies($cookies)->postJson('/api/me/messages', ['body' => '   '])->assertUnprocessable()->assertJsonValidationErrors('body');
    withAuthCookies($cookies)->postJson('/api/me/messages', ['body' => str_repeat('a', 1001)])->assertUnprocessable()->assertJsonValidationErrors('body');
    withAuthCookies($cookies)->postJson('/api/me/messages', ['body' => str_repeat('a', 1000)])->assertCreated();

    expect(Message::query()->count())->toBe(1);
});

it('shows a person only their own conversation, oldest first', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $ben = User::factory()->role(RoleCode::Volunteer)->create();
    $admin = User::factory()->role(RoleCode::Admin)->create(['first_name' => 'Dina', 'last_name' => 'Reyes']);

    Message::factory()->create(['sender_id' => $ana->id, 'body' => 'First from Ana', 'sent_at' => now()->subMinutes(10)]);
    Message::factory()->create(['sender_id' => $admin->id, 'recipient_id' => $ana->id, 'body' => 'Answer to Ana', 'sent_at' => now()->subMinutes(5)]);
    Message::factory()->create(['sender_id' => $ben->id, 'body' => 'Secret from Ben']);
    Message::factory()->create(['sender_id' => $admin->id, 'recipient_id' => $ben->id, 'body' => 'Answer to Ben']);

    $response = withAuthCookies(loginCookies($ana))->getJson('/api/me/messages')->assertOk();

    expect(array_column($response->json('data'), 'body'))->toBe(['First from Ana', 'Answer to Ana']);
    // The person sees the office, not the name of the admin.
    expect(array_column($response->json('data'), 'sender'))->toBe(['You', 'DRRMO']);
    $response->assertJsonPath('unread', 1);
});

it('counts and clears only the answers meant for the person', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $ben = User::factory()->role(RoleCode::Volunteer)->create();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    Message::factory()->count(2)->create(['sender_id' => $admin->id, 'recipient_id' => $ana->id]);
    Message::factory()->create(['sender_id' => $admin->id, 'recipient_id' => $ben->id]);
    // What Ana wrote herself is never "unread" for her.
    Message::factory()->create(['sender_id' => $ana->id]);

    $cookies = loginCookies($ana);
    withAuthCookies($cookies)->getJson('/api/me/messages/unread')->assertOk()->assertJsonPath('unread', 2);

    withAuthCookies($cookies)->postJson('/api/me/messages/read')->assertOk()->assertJsonPath('unread', 0);

    withAuthCookies($cookies)->getJson('/api/me/messages/unread')->assertJsonPath('unread', 0);
    // Ben's answer stays unread.
    expect(Message::query()->unreadFor($ben->id)->count())->toBe(1);
});

it('lets an admin read the inbox, newest conversation first, with unread counts', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    $ben = User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Ben', 'last_name' => 'Lim']);
    $admin = User::factory()->role(RoleCode::Admin)->create();

    Message::factory()->create(['sender_id' => $ana->id, 'body' => 'Old question']);
    Message::factory()->create(['sender_id' => $ben->id, 'body' => 'Newer question']);
    Message::factory()->create(['sender_id' => $ben->id, 'body' => 'Newest from Ben']);
    Message::factory()->create(['sender_id' => $admin->id, 'recipient_id' => $ana->id, 'body' => 'Answer to Ana']);

    $response = withAuthCookies(loginCookies($admin))->getJson('/api/inbox')->assertOk();

    // Ana's thread has the newest activity (the answer), so she is first. An answer does not count as unread.
    expect(array_column(array_column($response->json('data'), 'person'), 'name'))->toBe(['Ana Cruz', 'Ben Lim']);
    expect(array_column($response->json('data'), 'unread'))->toBe([1, 2]);
    $response->assertJsonPath('data.0.last.body', 'Answer to Ana')->assertJsonPath('data.0.last.from_office', true)->assertJsonPath('unread', 3);
});

it('lets an admin open a conversation, mark it read for every admin, and answer', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    $first = User::factory()->role(RoleCode::Admin)->create(['first_name' => 'Dina', 'last_name' => 'Reyes']);
    $second = User::factory()->role(RoleCode::Admin)->create();
    Message::factory()->create(['sender_id' => $ana->id, 'body' => 'Where do I report?']);

    $cookies = loginCookies($first);
    withAuthCookies($cookies)->getJson("/api/inbox/{$ana->id}")->assertOk()
        ->assertJsonPath('person.name', 'Ana Cruz')
        ->assertJsonPath('data.0.body', 'Where do I report?')
        ->assertJsonPath('data.0.sender', 'Ana Cruz');

    withAuthCookies($cookies)->postJson("/api/inbox/{$ana->id}/read")->assertOk()->assertJsonPath('unread', 0);
    // The inbox is shared, so the other admin sees it as read too.
    withAuthCookies(loginCookies($second))->getJson('/api/inbox/unread')->assertOk()->assertJsonPath('unread', 0);

    withAuthCookies($cookies)->postJson("/api/inbox/{$ana->id}/reply", ['body' => 'Report to the DRRMO office, Room 2.'])
        ->assertCreated()
        ->assertJsonPath('data.from_office', true)
        ->assertJsonPath('data.sender', 'Dina Reyes');

    // Ana sees the answer, and as the office, not as Dina.
    withAuthCookies(loginCookies($ana))->getJson('/api/me/messages')->assertOk()
        ->assertJsonPath('unread', 1)
        ->assertJsonPath('data.1.sender', 'DRRMO');
});

it('does not start a conversation from the office side', function () {
    $stranger = User::factory()->role(RoleCode::Volunteer)->create();
    $cookies = loginCookies(User::factory()->role(RoleCode::Admin)->create());

    withAuthCookies($cookies)->postJson("/api/inbox/{$stranger->id}/reply", ['body' => 'Hello?'])->assertNotFound();
    withAuthCookies($cookies)->postJson("/api/inbox/{$stranger->id}/reply", ['body' => ' '])->assertUnprocessable();

    expect(Message::query()->count())->toBe(0);
});

it('keeps the inbox away from everyone without the inbox permission', function (RoleCode $role) {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    Message::factory()->create(['sender_id' => $ana->id, 'body' => 'Private question']);
    $cookies = loginCookies(User::factory()->role($role)->create());

    withAuthCookies($cookies)->getJson('/api/inbox')->assertForbidden();
    withAuthCookies($cookies)->getJson('/api/inbox/unread')->assertForbidden();
    withAuthCookies($cookies)->getJson("/api/inbox/{$ana->id}")->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/inbox/{$ana->id}/reply", ['body' => 'Hi'])->assertForbidden();
    withAuthCookies($cookies)->postJson("/api/inbox/{$ana->id}/read")->assertForbidden();

    expect(Message::query()->count())->toBe(1)->and(Message::query()->sole()->read_at)->toBeNull();
})->with([RoleCode::Volunteer, RoleCode::Marshal, RoleCode::Coordinator]);

it('keeps messages away from signed out visitors', function () {
    $this->getJson('/api/me/messages')->assertUnauthorized();
    $this->postJson('/api/me/messages', ['body' => 'Hi'])->assertUnauthorized();
    $this->getJson('/api/inbox')->assertUnauthorized();
});

it('limits how fast one person can send', function () {
    $cookies = loginCookies(User::factory()->role(RoleCode::Volunteer)->create());

    foreach (range(1, 20) as $i) {
        withAuthCookies($cookies)->postJson('/api/me/messages', ['body' => "Message {$i}"])->assertCreated();
    }
    withAuthCookies($cookies)->postJson('/api/me/messages', ['body' => 'One too many'])
        ->assertTooManyRequests()->assertJsonPath('code', 'too_many_messages');
});

it('lets any person write to any other active person and keeps it out of the office inbox', function (RoleCode $from, RoleCode $to) {
    $ana = User::factory()->role($from)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    $ben = User::factory()->role($to)->create(['first_name' => 'Ben', 'last_name' => 'Lim']);

    withAuthCookies(loginCookies($ana))->postJson("/api/me/chats/{$ben->id}", ['body' => ' Can you cover my shift? '])
        ->assertCreated()->assertJsonPath('data.body', 'Can you cover my shift?')->assertJsonPath('data.mine', true);

    $cookies = loginCookies($ben);
    withAuthCookies($cookies)->getJson('/api/me/messages/unread')->assertJsonPath('unread', 1);
    withAuthCookies($cookies)->getJson("/api/me/chats/{$ana->id}")->assertOk()
        ->assertJsonPath('person.name', 'Ana Cruz')->assertJsonPath('data.0.mine', false)->assertJsonPath('data.0.sender', 'Ana Cruz');
    withAuthCookies($cookies)->getJson('/api/me/chats')->assertOk()
        ->assertJsonPath('data.0.person.name', 'Ana Cruz')->assertJsonPath('data.0.unread', 1)->assertJsonPath('unread', 1);
    // The office conversation stays empty on both sides.
    withAuthCookies($cookies)->getJson('/api/me/messages')->assertJsonPath('data', [])->assertJsonPath('unread', 0);

    withAuthCookies($cookies)->postJson("/api/me/chats/{$ana->id}/read")->assertOk()->assertJsonPath('unread', 0);
    withAuthCookies($cookies)->getJson('/api/me/messages/unread')->assertJsonPath('unread', 0);

    $admin = User::factory()->role(RoleCode::Admin)->create();
    withAuthCookies(loginCookies($admin))->getJson('/api/inbox')->assertJsonPath('data', [])->assertJsonPath('unread', 0);
})->with([
    [RoleCode::Volunteer, RoleCode::Marshal],
    [RoleCode::Marshal, RoleCode::Volunteer],
    [RoleCode::Coordinator, RoleCode::Admin],
    [RoleCode::Admin, RoleCode::Volunteer],
]);

it('hides a direct conversation from everyone who is not in it', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $ben = User::factory()->role(RoleCode::Volunteer)->create();
    $eve = User::factory()->role(RoleCode::Admin)->create();
    withAuthCookies(loginCookies($ana))->postJson("/api/me/chats/{$ben->id}", ['body' => 'Private'])->assertCreated();

    // Eve, even as an admin, sees an empty conversation with Ana, and no thread with Ben.
    $cookies = loginCookies($eve);
    withAuthCookies($cookies)->getJson("/api/me/chats/{$ana->id}")->assertOk()->assertJsonPath('data', []);
    withAuthCookies($cookies)->getJson('/api/me/chats')->assertJsonPath('data', []);
});

it('does not let a person message themselves or someone who cannot sign in', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $gone = User::factory()->role(RoleCode::Volunteer)->create(['disabled_at' => now()]);
    $cookies = loginCookies($ana);

    withAuthCookies($cookies)->postJson("/api/me/chats/{$ana->id}", ['body' => 'Hi me'])->assertUnprocessable();
    withAuthCookies($cookies)->postJson("/api/me/chats/{$gone->id}", ['body' => 'Hi'])->assertUnprocessable();
    withAuthCookies($cookies)->postJson('/api/me/chats/'.User::factory()->create()->id, ['body' => ' '])->assertUnprocessable();

    expect(Message::query()->count())->toBe(0);
});

it('finds people by name for a new conversation, without the caller or closed accounts', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create(['first_name' => 'Ana', 'last_name' => 'Cruz']);
    User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Anabel', 'last_name' => 'Reyes']);
    User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Anders', 'last_name' => 'Gone', 'disabled_at' => now()]);
    User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Ben', 'last_name' => 'Lim']);

    $response = withAuthCookies(loginCookies($ana))->getJson('/api/me/chats/people?q=an')->assertOk();

    expect(array_column($response->json('data'), 'name'))->toBe(['Anabel Reyes']);
    expect(array_keys($response->json('data.0')))->toBe(['id', 'name']);
});

it('keeps direct messages away from signed out visitors', function () {
    $this->getJson('/api/me/chats')->assertUnauthorized();
    $this->getJson('/api/me/chats/people')->assertUnauthorized();
    $this->postJson('/api/me/chats/1', ['body' => 'Hi'])->assertUnauthorized();
});

it('tells the sender when their message was seen, on every kind of conversation', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    $ben = User::factory()->role(RoleCode::Marshal)->create();
    $admin = User::factory()->role(RoleCode::Admin)->create();
    $anaCookies = loginCookies($ana);

    // To the office: seen once an admin opens the conversation.
    withAuthCookies($anaCookies)->postJson('/api/me/messages', ['body' => 'Is the drill on?'])->assertJsonPath('data.seen', false);
    $adminCookies = loginCookies($admin);
    withAuthCookies($adminCookies)->postJson("/api/inbox/{$ana->id}/read")->assertOk();
    withAuthCookies($anaCookies)->getJson('/api/me/messages')->assertJsonPath('data.0.seen', true);

    // The office answer: seen once the person opens it.
    withAuthCookies($adminCookies)->postJson("/api/inbox/{$ana->id}/reply", ['body' => 'Yes, at 8.'])->assertJsonPath('data.seen', false);
    withAuthCookies($anaCookies)->postJson('/api/me/messages/read')->assertOk();
    withAuthCookies($adminCookies)->getJson("/api/inbox/{$ana->id}")->assertJsonPath('data.1.seen', true)->assertJsonPath('data.0.seen', false);

    // Person to person: seen once the other person opens it, and never set on their side.
    withAuthCookies($anaCookies)->postJson("/api/me/chats/{$ben->id}", ['body' => 'Hi Ben'])->assertJsonPath('data.seen', false);
    $benCookies = loginCookies($ben);
    withAuthCookies($benCookies)->postJson("/api/me/chats/{$ana->id}/read")->assertOk();
    withAuthCookies($benCookies)->getJson("/api/me/chats/{$ana->id}")->assertJsonPath('data.0.seen', false);
    withAuthCookies($anaCookies)->getJson("/api/me/chats/{$ben->id}")->assertJsonPath('data.0.seen', true);
});

it('finds people by their full name', function () {
    $ana = User::factory()->role(RoleCode::Volunteer)->create();
    User::factory()->role(RoleCode::Marshal)->create(['first_name' => 'Demo', 'last_name' => 'Marshal']);

    $response = withAuthCookies(loginCookies($ana))->getJson('/api/me/chats/people?q=demo%20mar')->assertOk();

    expect(array_column($response->json('data'), 'name'))->toBe(['Demo Marshal']);
});
