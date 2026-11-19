<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Information\Models\Message;
use App\Modules\Personnel\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Message> */
class MessageFactory extends Factory
{
    protected $model = Message::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'sender_id' => User::factory(),
            'recipient_id' => null,
            'body' => fake()->sentence(),
            'sent_at' => now(),
        ];
    }
}
