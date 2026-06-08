# Push server — deploy guide (Cloudflare Worker)

The worker (`cloudflare.js`) does two jobs:

1. **HTTP API** — `/vapidPublicKey`, `/subscribe`, `/unsubscribe`, `/notify` (admin broadcast).
2. **Cron dispatcher** — runs every minute (`scheduled`) and fires each device's
   precomputed schedule, so prayer/azkar notifications arrive **even when the app
   is closed**.

The client (`js/notifications.js`) computes prayer times locally with adhan.js and
uploads a ~7-day schedule of `{tag, title, body, url, ts}` events on each app open
(and whenever location/settings change). The server does **no** prayer-time math —
it just delivers what's due.

## Architecture (why it's reliable)

```
client (adhan.js)  --/subscribe {subscription, schedule[7d], tzOffset}-->  KV
                                                                            |
Cloudflare cron (* * * * *) --> dispatchDue() --> for each sub: send due events
```

- Dedup: each record keeps a `lastDispatch` cursor; an event fires once when
  `lastDispatch < ts <= now`. Past events are pruned after firing.
- Stale guard: events more than 15 min late are skipped (e.g. after a cron gap),
  so you never get yesterday's Fajr at noon.
- No duplicates with the in-app scheduler: when a device is subscribed, the local
  scheduler defers prayer/azkar/Kahf to the server (see `pushActive` in
  notifications.js). Streak reminders stay local (server can't know activity).

## One-time setup

```bash
npm install -g wrangler        # if needed
wrangler login

# 1) KV namespace for subscriptions
wrangler kv namespace create PUSH_SUBS
#   → copy the printed id into wrangler.toml ([[kv_namespaces]] id = "...")

# 2) VAPID keys (generate once; keep the private key secret)
npx web-push generate-vapid-keys
wrangler secret put VAPID_PUBLIC_KEY     # paste the public key
wrangler secret put VAPID_PRIVATE_KEY    # paste the private key
```

**Important:** the public key you set here must match
`NotificationSystem.config.vapidPublicKey` in `js/notifications.js` (the client
uses it as a fallback when `/vapidPublicKey` can't be fetched). The client also
fetches `/vapidPublicKey` at subscribe time, so the server value is authoritative.

## Deploy

```bash
wrangler deploy
```

The worker URL must match `NotificationSystem.config.serverUrl`
(`https://zad-push-server.solimananas2012.workers.dev`).

## Verify

```bash
# Cron registered?  Dashboard → Workers → zad-push-server → Triggers → Cron.
# Tail live logs (watch the per-minute dispatcher + any send failures):
wrangler tail

# Admin broadcast to all devices (test path that doesn't wait for a prayer time):
curl -X POST https://zad-push-server.solimananas2012.workers.dev/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"🧪 اختبار","body":"يعمل ✅","tag":"test"}'
```

To watch the scheduled path end-to-end: open the app (grants notification
permission → uploads the schedule), then close it and wait for the next prayer /
pre-reminder minute. `wrangler tail` shows the dispatch.

## Scaling note

`dispatchDue` does one KV `list` + a `get` per subscriber every minute. That's
fine for a personal/small deployment (free-tier KV ≈ 100k reads/day → ~70 subs at
1-min cadence). For larger scale, shard subscribers or index upcoming events by
minute so the cron reads only what's due.

## Local Node variant

`server.js` (Express + web-push) is an **unused reference** implementation with its
own scheduler. The deployed system is the Cloudflare Worker above.
