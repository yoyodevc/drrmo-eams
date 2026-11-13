<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Enums;

enum NotificationType: string
{
    case AssignmentCreated = 'assignment.created';
    case AssignmentChanged = 'assignment.changed';
    case AssignmentCancelled = 'assignment.cancelled';
    case ReminderEvening = 'reminder.evening';
    case ReminderHour = 'reminder.hour';
    case ConsentWithdrawn = 'consent.withdrawn';
    case ReportOverdue = 'report.overdue';
}
