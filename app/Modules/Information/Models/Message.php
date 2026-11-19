<?php

declare(strict_types=1);

namespace App\Modules\Information\Models;

use App\Modules\Personnel\Models\User;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Database\Factories\MessageFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One message between a person and the DRRMO office. Each conversation belongs to one person:
 * what they send has no recipient (the office inbox), and an admin's answer names the person.
 *
 * @property CarbonImmutable|Carbon $sent_at
 * @property CarbonImmutable|Carbon|null $read_at
 */
class Message extends Model
{
    /** @use HasFactory<MessageFactory> */
    use HasFactory;

    public $timestamps = false;

    protected $fillable = ['sender_id', 'recipient_id', 'body', 'sent_at', 'read_at'];

    /** @return array<string, string> */
    protected function casts(): array
    {
        return ['sent_at' => 'datetime', 'read_at' => 'datetime'];
    }

    /**
     * The conversation of one person: what they sent to the office and what the office answered.
     *
     * @param  Builder<Message>  $query
     * @return Builder<Message>
     */
    public function scopeConversationOf(Builder $query, int $personId): Builder
    {
        return $query->where(fn (Builder $q) => $q
            ->where(fn (Builder $s) => $s->where('sender_id', $personId)->whereNull('recipient_id'))
            ->orWhere('recipient_id', $personId));
    }

    /**
     * Answers from the office that this person has not opened yet.
     *
     * @param  Builder<Message>  $query
     * @return Builder<Message>
     */
    public function scopeUnreadFor(Builder $query, int $personId): Builder
    {
        return $query->where('recipient_id', $personId)->whereNull('read_at');
    }

    /**
     * Messages to the office that no admin has opened yet. The inbox is shared, so one admin opening
     * a conversation marks it read for all.
     *
     * @param  Builder<Message>  $query
     * @return Builder<Message>
     */
    public function scopeUnreadByOffice(Builder $query): Builder
    {
        return $query->whereNull('recipient_id')->whereNull('read_at');
    }

    /** @return BelongsTo<User, $this> */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    protected static function newFactory(): MessageFactory
    {
        return MessageFactory::new();
    }
}
