# Marketing event feed

DirectFanz can tell an outside marketing tool when fans follow, join a fan list,
buy, and opt in or out. It sends a signed JSON webhook for each event. It is
vendor-neutral: GoHighLevel is the first intended receiver, but anything that
accepts a webhook works. DirectFanz makes no calls to any marketing tool's API.

Code: `src/lib/marketing-events.ts`. Retry route:
`src/app/api/cron/marketing-events/route.ts`.

## Switching it on

The feed is off by default. Nothing is stored or sent until both of these are
set:

| Variable                   | What it is                                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------------------------- |
| `MARKETING_WEBHOOK_URL`    | The receiver's URL. Must be `https://` (plain `http://` only for localhost).                              |
| `MARKETING_WEBHOOK_SECRET` | A long random string, shared with the receiver, used to sign each request.                                |
| `CRON_SECRET`              | Lets a scheduler call the retry route. Without it the route returns 404 and failed sends are not retried. |

Each event is sent once straight away, with a 3-second timeout. If that fails, a
scheduler must call the retry route, for example every 5 minutes:

```
GET /api/cron/marketing-events
Authorization: Bearer <CRON_SECRET>
```

On Vercel this is a cron entry in `vercel.json`
(`{"path": "/api/cron/marketing-events", "schedule": "*/5 * * * *"}`); Vercel
sends the `CRON_SECRET` bearer itself. Vercel's Hobby plan only allows daily
crons.

Retries back off from 30 seconds, doubling each time, up to 6 hours between
tries, for 10 tries in all. A `4xx` reply other than 408 or 429 means the
receiver refused the event, so it is not retried. Delivered and failed events
are deleted after 30 days, since they hold contact details.

## The request

```
POST <MARKETING_WEBHOOK_URL>
Content-Type: application/json
X-DirectFanz-Event-Id: 5b0c…            same as body.id; use it to drop duplicates
X-DirectFanz-Event-Type: drop.purchased
X-DirectFanz-Signature: t=1795000000,v1=<hex>
```

`v1` is HMAC-SHA256, keyed with `MARKETING_WEBHOOK_SECRET`, over
`"<t>.<raw body>"`. A receiver should recompute it, compare in constant time,
and reject a `t` more than 5 minutes old. `verifySignature()` in
`src/lib/marketing-events.ts` does exactly this. A retry keeps the same event
id, so a receiver that saw it already can ignore it.

```json
{
  "id": "5b0c9a6e-…",
  "type": "drop.purchased",
  "createdAt": "2026-12-01T12:00:00.000Z",
  "artist": { "id": "usr_…", "name": "Nahvee" },
  "fan": {
    "id": "usr_…",
    "name": "Fan One",
    "email": "fan@example.com",
    "phone": "+13125550100"
  },
  "data": {
    "purchaseId": "…",
    "itemType": "DROP",
    "itemId": "…",
    "title": "…",
    "amount": "5",
    "currency": "usd"
  }
}
```

**Contact details.** `fan.email` is present only while the fan gets that
artist's email, and `fan.phone` only while they get that artist's texts. A fan
who hasn't opted in to a channel never has that address sent. Opt-out events are
always sent, and carry the fan id only (`"fan": { "id": "…" }`).

## Events

| Type                   | When                                                                  | `data`                               |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------ |
| `fan.followed`         | A fan follows an artist for the first time (joining a list follows)   | none                                 |
| `email.opted_in`       | A fan joins an artist's email list (`source`: `SIGNUP` or `PURCHASE`) | `source`                             |
| `email.opted_out`      | Leaves the list, or uses the unsubscribe link                         | `reason`                             |
| `sms.opted_in`         | Opts in to an artist's texts                                          | none                                 |
| `sms.opted_out`        | Opts out on the site, or texts STOP (one event per artist list)       | `reason`                             |
| `purchase.completed`   | Any other one-time purchase is paid                                   | purchase fields                      |
| `drop.purchased`       | A drop is paid                                                        | purchase fields                      |
| `ticket.purchased`     | A listening-party (live stream) ticket is paid                        | purchase fields                      |
| `membership.started`   | A membership starts or restarts                                       | `tierId`, `amount`, `subscriptionId` |
| `membership.cancelled` | A membership ends                                                     | `tierId`, `subscriptionId`           |

Purchase fields: `purchaseId`, `itemType`, `itemId`, `title`, `amount` (a
decimal string), `currency`. Refunds are not sent yet.

## Mapping to GoHighLevel

Set this up in GoHighLevel itself; no API key or app is needed.

1. **Custom field.** Add a contact field "DirectFanz fan id" (text). Every
   workflow below writes `fan.id` into it, so the contact can be found again.
2. **Workflow trigger.** Create a workflow with the **Inbound Webhook** trigger.
   GoHighLevel gives it a URL: that is `MARKETING_WEBHOOK_URL`. Send one test
   event so it can map the fields, then add an If/Else branch on `type`.
3. **Contacts.** For `email.opted_in`, `sms.opted_in`, purchases and
   memberships, use **Create/Update Contact** with `fan.email`, `fan.phone`,
   `fan.name` and the fan id field. GoHighLevel matches existing contacts by
   email or phone, so an event without either (a fan who bought but never joined
   a list) can't make a reachable contact; skip those, or keep them only as a
   tag on an existing contact.
4. **Tags.** Suggested, one per artist so lists stay separate:

   | Event                  | Tag                                     |
   | ---------------------- | --------------------------------------- |
   | `fan.followed`         | `df-follower-<artist>`                  |
   | `email.opted_in`       | add `df-email-<artist>`                 |
   | `sms.opted_in`         | add `df-sms-<artist>`                   |
   | `drop.purchased`       | `df-buyer-<artist>`, `df-drop-<itemId>` |
   | `ticket.purchased`     | `df-ticket-<itemId>`                    |
   | `membership.started`   | add `df-member-<artist>`                |
   | `membership.cancelled` | remove `df-member-<artist>`             |
   | `email.opted_out`      | remove `df-email-<artist>`              |
   | `sms.opted_out`        | remove `df-sms-<artist>`                |

5. **Workflows off the tags.** For example: a thank-you after `drop.purchased`,
   a reminder sequence for `df-ticket-<itemId>` before the party, a win-back
   after `membership.cancelled`.
6. **Opt-outs.** Opt-outs carry only the fan id. GoHighLevel finds contacts by
   email or phone, so an opt-out has to be matched on the "DirectFanz fan id"
   field before the tag can be removed or Do Not Disturb set for that channel.
   If that lookup isn't available in your GoHighLevel plan, opt-outs can't be
   applied there yet; DirectFanz itself always stops sending, whatever the
   marketing tool does. Never send a fan marketing from GoHighLevel on a channel
   DirectFanz shows them as opted out of.

**Signature checking.** GoHighLevel's Inbound Webhook trigger doesn't check
signatures. Its URL is long and unguessable, which is the only protection in
that setup. For a stronger setup, point `MARKETING_WEBHOOK_URL` at a small relay
that calls `verifySignature()` and then forwards to GoHighLevel.

## Testing

`src/lib/__tests__/marketing-events.test.ts` runs a fake receiver (a local HTTP
server) that checks every signature, and covers the off switch, contact fields,
opt-outs, retries with backoff, giving up, duplicate claims and pruning.
