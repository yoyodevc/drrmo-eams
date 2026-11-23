<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;

/**
 * How one person wants alerts. Sound mute and push mute never touch urgent emergencies' push, and
 * quiet hours never block an urgent push (decided by the owner).
 *
 * @property bool $sound_muted
 * @property bool $push_muted
 * @property string|null $quiet_start
 * @property string|null $quiet_end
 */
class AlertPreference extends Model
{
    protected $primaryKey = 'user_id';

    public $incrementing = false;

    protected $fillable = ['user_id', 'sound_muted', 'push_muted', 'quiet_start', 'quiet_end'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['sound_muted' => 'boolean', 'push_muted' => 'boolean'];
    }

    /** True when now falls inside the quiet window (it may cross midnight). Times are Manila time. */
    public function quietAt(CarbonInterface $now): bool
    {
        if ($this->quiet_start === null || $this->quiet_end === null || $this->quiet_start === $this->quiet_end) {
            return false;
        }
        $t = $now->copy()->setTimezone('Asia/Manila')->format('H:i');

        return $this->quiet_start < $this->quiet_end
            ? ($t >= $this->quiet_start && $t < $this->quiet_end)
            : ($t >= $this->quiet_start || $t < $this->quiet_end);
    }
}
