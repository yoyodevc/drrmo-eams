<?php

declare(strict_types=1);

use App\Modules\Access\AccessServiceProvider;
use App\Modules\Events\EventsServiceProvider;
use App\Modules\Monitoring\MonitoringServiceProvider;
use App\Modules\Notifications\NotificationsServiceProvider;
use App\Modules\Personnel\PersonnelServiceProvider;
use App\Modules\Records\RecordsServiceProvider;
use App\Providers\AppServiceProvider;

return [
    AppServiceProvider::class,
    AccessServiceProvider::class,
    EventsServiceProvider::class,
    MonitoringServiceProvider::class,
    NotificationsServiceProvider::class,
    PersonnelServiceProvider::class,
    RecordsServiceProvider::class,
];
