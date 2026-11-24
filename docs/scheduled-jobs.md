# Scheduled jobs

Two routes do background work. A scheduler calls them over HTTPS with
`Authorization: Bearer <CRON_SECRET>`. Both answer 404 until `CRON_SECRET` is
set, and 401 for a wrong secret. `GET` and `POST` both work.

| Route | Suggested cadence | What it does |
| --- | --- | --- |
| `/api/cron/marketing-events` | every 5 minutes | Retries marketing feed events whose first send failed (backoff up to 6 hours, 10 tries), then deletes delivered or failed events older than 30 days. Does nothing but the clean-up while the feed is off. |
| `/api/cron/party-reminders` | every 5 to 10 minutes | Emails ticket holders about one hour before a listening party. |

## Safe to repeat or overlap

- Marketing events: each run claims a row with a conditional update before
  sending, so two overlapping runs never send the same event at once. The
  event id goes in the `X-DirectFanz-Event-Id` header so the receiver can drop
  a repeat.
- Party reminders: each ticket's reminder is claimed (`reminderSentAt`) before
  the email goes, and released if the send fails, so a ticket gets one
  reminder however often the route runs.

A run that fails returns 500 and changes nothing that the next run can't pick
up, so a scheduler retry is harmless.
