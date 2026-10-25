# Brix API

Read a Brix user's subscriptions and free trials, mark charges to cancel, and schedule reminders from your own code. The same reference is published at [`/developers`](https://www.usebrix.app/developers), and the machine-readable spec is at [`/api/v1/openapi.json`](https://www.usebrix.app/api/v1/openapi.json) (OpenAPI 3.1).

- **Base URL:** `https://www.usebrix.app/api/v1`
- **Auth:** `Authorization: Bearer brix_sk_…`
- **Format:** JSON, `snake_case` fields, USD amounts as decimals, dates as `YYYY-MM-DD`
- **Rate limit:** 120 requests per minute per key
- **Version header:** `Brix-Version: 2026-10-24`

## Quickstart

1. Sign in at [usebrix.app](https://www.usebrix.app) and open **Settings → Developer API keys**.
2. Name the key, choose only the scopes you need, and copy the key. It is shown once.
3. Keep it server-side, for example in an environment variable called `BRIX_API_KEY`. Never ship it in a browser page, a mobile app, or a public repository.

```bash
curl https://www.usebrix.app/api/v1/me \
  -H "Authorization: Bearer $BRIX_API_KEY"
```

```js
const res = await fetch("https://www.usebrix.app/api/v1/charges/upcoming?days=7", {
  headers: { Authorization: `Bearer ${process.env.BRIX_API_KEY}` },
});
if (!res.ok) throw new Error((await res.json()).error.message);
const { data } = await res.json();
for (const c of data) console.log(`${c.merchant}: $${c.amount} on ${c.next_date}`);
```

```python
import os, requests

r = requests.post(
    "https://www.usebrix.app/api/v1/reminders",
    headers={"Authorization": f"Bearer {os.environ['BRIX_API_KEY']}"},
    json={"merchant": "Spotify", "when": "2 days before"},
    timeout=10,
)
r.raise_for_status()
print(r.json()["remind_at"])
```

## Keys and scopes

Keys are personal: each one acts as the user who created it. Brix stores only a SHA-256 hash, so a lost key can't be recovered; revoke it and create another. A user can have up to 5 active keys, and revoking a key stops it on the next request.

| Scope | Allows |
| --- | --- |
| `charges:read` | Read charges, upcoming charges, and the spending summary. |
| `charges:write` | Add trials and mark charges to cancel or active. |
| `reminders:read` | List reminders. |
| `reminders:write` | Create and delete reminders. |
| `cards:read` | List single-use cards (masked; never card numbers). |
| `news:read` | Read subscription news about your merchants. |

`GET /me` works with any valid key.

## Endpoints

| Method | Path | Scope | What it does |
| --- | --- | --- | --- |
| GET | `/me` | any | The key you're using and its scopes. |
| GET | `/charges` | `charges:read` | All charges. Filters: `status` (`active`, `trial`, `to_cancel`, `cancelled`), `kind` (`subscription`, `trial`). |
| GET | `/charges/upcoming` | `charges:read` | Charges due in the next `days` days (1–90, default 14). |
| GET | `/charges/{id}` | `charges:read` | One charge. |
| PATCH | `/charges/{id}` | `charges:write` | `{"status": "to_cancel"}` to mark for cancellation, `{"status": "active"}` to undo. |
| POST | `/trials` | `charges:write` | Add a free trial: `merchant`, `end_date`, `amount`. |
| GET | `/summary` | `charges:read` | Monthly subscription total, counts, next 14 days, amount avoided this month. |
| GET | `/reminders` | `reminders:read` | All reminders, earliest first. |
| POST | `/reminders` | `reminders:write` | `charge_id` or `merchant`, plus `when`. |
| DELETE | `/reminders/{id}` | `reminders:write` | Delete a reminder that hasn't been sent. |
| GET | `/cards` | `cards:read` | Single-use cards, last four digits only. |
| GET | `/news` | `news:read` | Recent pricing and renewal news about the user's top merchants. |

### Objects

A **charge**:

```json
{
  "object": "charge",
  "id": "5d1f…",
  "kind": "subscription",
  "merchant": "Spotify",
  "amount": 11.99,
  "currency": "usd",
  "frequency": "monthly",
  "status": "active",
  "source": "plaid",
  "last_date": "2026-10-03",
  "next_date": "2026-11-03",
  "cancel_url": "https://www.spotify.com/account/subscription/"
}
```

A **reminder**:

```json
{
  "object": "reminder",
  "id": "manual:5d1f…:2026-11-01T12:00:00.000Z",
  "charge_id": "5d1f…",
  "remind_at": "2026-11-01T12:00:00.000Z",
  "channel": "whatsapp",
  "status": "pending",
  "created_by": "api"
}
```

Lists are wrapped as `{ "object": "list", "data": [ … ] }`. `/charges/upcoming` also returns `days`; `/news` also returns a `message`.

### Examples

Mark a charge to cancel. Brix records the decision and returns the merchant's cancel link; it never cancels or moves money itself.

```bash
curl -X PATCH https://www.usebrix.app/api/v1/charges/5d1f… \
  -H "Authorization: Bearer $BRIX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"to_cancel"}'
```

Add a trial, safely retryable:

```bash
curl -X POST https://www.usebrix.app/api/v1/trials \
  -H "Authorization: Bearer $BRIX_API_KEY" \
  -H "Idempotency-Key: notion-trial-nov" \
  -H "Content-Type: application/json" \
  -d '{"merchant":"Notion AI","end_date":"2026-11-15","amount":10}'
```

Create a reminder. `when` accepts a future `YYYY-MM-DD`, an ISO timestamp, or `N days before` (relative to the charge's next date). It is delivered on WhatsApp when the user turned that on, otherwise in the app.

```bash
curl -X POST https://www.usebrix.app/api/v1/reminders \
  -H "Authorization: Bearer $BRIX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"merchant":"Netflix","when":"3 days before"}'
```

## Errors

Every error has the same shape. Include `request_id` when you report a problem; it is also in the `X-Request-Id` header of every response.

```json
{
  "error": {
    "type": "insufficient_scope",
    "message": "This key is missing the `charges:write` scope.",
    "request_id": "req_4f1c9a0b2e7d4c3a8b19"
  }
}
```

| Status | `type` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | A parameter or field is missing or invalid. |
| 401 | `authentication_failed` | Key missing, malformed, unknown, or revoked. |
| 403 | `insufficient_scope` | The key lacks this endpoint's scope. |
| 404 | `not_found` | No such charge or reminder for this user. |
| 409 | `conflict` | Conflicts with current state (e.g. the reminder was already sent). |
| 413 | `request_too_large` | Body over 64 KB. |
| 429 | `rate_limited` | Over 120 requests this minute. Wait `Retry-After` seconds. |
| 502 | `upstream_unavailable` | A provider (such as news) didn't respond. |
| 500 | `api_error` | Our fault. Retry with backoff. |

## Rate limits and retries

Each response includes `X-RateLimit-Limit` and `X-RateLimit-Remaining`. The window resets every minute. On `429`, wait the `Retry-After` seconds. Retry `5xx` and network errors with exponential backoff. `GET`, `PATCH`, and `DELETE` are safe to retry; `POST /trials` is safe when you send the same `Idempotency-Key`; `POST /reminders` is naturally idempotent for the same charge and time.

## Versioning

`/v1` only grows: we add endpoints and fields, and never remove or rename existing ones. Ignore fields you don't recognize. Breaking changes would ship as `/v2`.

## Not in the API, by design

- **Creating cards.** A card is a payment instrument, so the user confirms it in the app (and with a PIN for voice). `GET /cards` lists them, masked.
- **Linking banks.** Plaid Link runs in the app. Bank-detected charges appear in `/charges` with `source: "plaid"`.
- **Chatting with the assistant.** Every message runs a language model and costs money, so chat stays in the app, WhatsApp, and voice.
- **Acting for other users.** There is no OAuth yet. Build for yourself, or ask each user to paste their own key.

## Data and safety

Bank data is Plaid sandbox data and cards are Lithic sandbox cards that can't spend real money. Treat a key like a password: anyone holding it can read that user's subscriptions. If a key leaks, revoke it in Settings.

## For Brix maintainers

- Routes: `app/api/v1/**`. Every handler is wrapped in `apiRoute(scope, handler)` from `lib/api/v1.ts`, which authenticates, enforces scope and the rate limit, and formats errors.
- Keys: `lib/api/keys.ts`. Production stores `apiKeys/{sha256(secret)}` in Firestore (client access denied in `firestore.rules`); demo mode uses `.data/api-keys.json`.
- Session-authenticated key management: `GET/POST /api/developer/keys`, `DELETE /api/developer/keys/{id}`.
- Reference: edit `operations` in `lib/api/openapi.ts`; it feeds both `/api/v1/openapi.json` and `/developers`. Add a new route there and in `tests/api-v1.test.ts` together.
- Business logic is shared with the app and assistant (`lib/tools`, `lib/trials.ts`), so an API change and an in-app change behave the same.
