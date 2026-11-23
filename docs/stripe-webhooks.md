# Stripe webhooks

DirectFanz takes payments as **direct charges on each artist's Stripe Connect
(Express) account**, with the platform fee taken as an application fee. Stripe
therefore sends the payment events from the artist's account, not the
platform's. Both kinds of event go to one URL:

```
POST https://<app host>/api/payments/webhooks
```

Stripe gives each endpoint its own signing secret. The route tries both and
the one that verifies the delivery tells it which endpoint sent it.

| Endpoint in the Stripe dashboard | Listens to | Env var for its signing secret |
| --- | --- | --- |
| Platform endpoint | Events on your account | `STRIPE_WEBHOOK_SECRET` |
| Connect endpoint | Events on connected accounts | `STRIPE_CONNECT_WEBHOOK_SECRET` |

Without the Connect endpoint, fans can pay but nothing gets unlocked, because
the "paid" events never arrive.

## Events to select

Connect endpoint (all of these arrive with `event.account` = the artist's
connected account):

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired` (gives back a held drop unit)
- `charge.refunded`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `account.updated` (turns the artist's "can take payments" flag on or off)
- `account.application.deauthorized`

Platform endpoint: nothing is required today. Keep it if you already have one;
platform-signed events are still accepted.

## Safety checks in the route

- A delivery that neither secret verifies gets 400.
- A Connect-signed delivery without `event.account` gets 400.
- Every event is recorded in `stripe_webhook_events` before it is applied, so
  a repeated delivery is acknowledged and skipped.
- A Connect event can only change records on its own account: a purchase
  whose `stripeAccountId` differs, or a membership checkout for another
  artist, is logged and ignored.

## Local testing

`stripe listen --forward-to localhost:3000/api/payments/webhooks
--forward-connect-to localhost:3000/api/payments/webhooks` prints one signing
secret for both. Put it in `STRIPE_WEBHOOK_SECRET` (or both variables).
