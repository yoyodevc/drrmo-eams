<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Modules\Information\Enums\MemoCategory;
use App\Modules\Information\Models\Memo;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Memo> */
class MemoFactory extends Factory
{
    protected $model = Memo::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'title' => fake()->sentence(4),
            'category' => MemoCategory::Procedure,
            'body' => fake()->paragraph(),
            'posted_at' => now(),
        ];
    }
}
