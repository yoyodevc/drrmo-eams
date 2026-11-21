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
    case ReportReminder = 'report.reminder';
    case ReportDue = 'report.due';
    case ReportMissed = 'report.missed';
    case EmergencyReminder = 'emergency.reminder';
    case EmergencyReported = 'emergency.reported';
    case EmergencyEscalated = 'emergency.escalated';

    /** How loud this alert is. Memos and messages are not types here, so they are never urgent. */
    public function urgency(): Urgency
    {
        return match ($this) {
            self::EmergencyReported, self::EmergencyReminder, self::EmergencyEscalated, self::ReportMissed => Urgency::Urgent,
            self::ReportOverdue, self::ReportDue, self::AssignmentCreated, self::AssignmentChanged, self::AssignmentCancelled => Urgency::Important,
            default => Urgency::Normal,
        };
    }

    /**
     * Short generic push text. Never a name, a place or a memo (see SECURITY_AND_PRIVACY).
     *
     * @return array{0: string, 1: string}
     */
    public function pushText(): array
    {
        return match ($this) {
            self::EmergencyReported => ['Emergency reported', 'Open the app now.'],
            self::EmergencyReminder, self::EmergencyEscalated => ['Emergency not acknowledged', 'Open the app now.'],
            self::ReportMissed => ['Site report missed', 'Open the app.'],
            self::ReportOverdue => ['Site report overdue', 'Open the app.'],
            self::ReportDue => ['Site report due now', 'Open the app.'],
            self::AssignmentCreated => ['New duty assignment', 'Open the app.'],
            self::AssignmentChanged => ['Duty assignment changed', 'Open the app.'],
            self::AssignmentCancelled => ['Duty cancelled', 'Open the app.'],
            default => ['DRRMO EAMS', 'You have a new alert.'],
        };
    }
}
