<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Modules\Personnel\Models\Department;
use App\Modules\Personnel\Models\Team;
use Illuminate\Database\Seeder;

/**
 * Starting teams and departments for local testing and a first install. Safe to run again:
 * it only adds what is missing and never renames or reactivates anything an admin changed.
 */
class OrgUnitSeeder extends Seeder
{
    public function run(): void
    {
        foreach ([
            'ert' => 'ERT',
            'security' => 'Security team',
            'fire_suppression' => 'Fire suppression',
            'crowd_control' => 'Crowd control',
            'first_aid' => 'First aid and medical',
            'cctv' => 'CCTV monitoring',
        ] as $code => $name) {
            Team::query()->firstOrCreate(['code' => $code], ['name' => $name, 'active' => true]);
        }

        foreach ([
            'College of Arts, Humanities and Social Sciences',
            'College of Engineering and Technology',
            'College of Information and Computing Sciences',
            'College of Maritime Education',
            'College of Teacher Education',
            'School of Business Administration',
            'Security Office',
            'DRRM Office',
        ] as $name) {
            Department::query()->firstOrCreate(['name' => $name], ['active' => true]);
        }
    }
}
