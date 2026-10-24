# Integration handoff

Use [SETUP.md](SETUP.md) for installation and account setup. `BRIX_DEMO_MODE=true` is local-only, uses sample data, and disables external messaging and card issuing even when provider keys are present. Live mode never silently falls back to mock data.

## Web actions and confirmation

Authenticated requests use `Authorization: Bearer <Firebase ID token>`. Identity always comes from the verified token, never a body `uid`.

| Request | Body | Result |
| --- | --- | --- |
| `POST /api/agent` (also `/api/agent/chat`) | `{"message":"cancel Spotify"}` | `{reply,state}`; proposes and persists a pending action |
| `POST /api/agent` | `{"message":"yes"}` | Executes the pending web action once; returns `{reply,state}` |
| `POST /api/agent` | `{"message":"no"}` | Clears an unstarted web proposal |
| `POST /api/agent/action` | `{"name":"set_reminder","args":{"merchant":"Spotify","when":"2026-11-06"}}` | `{reply,confirmationRequired:true}` |
| `GET /api/cards` | — | `{cards}` containing masked metadata |
| `POST /api/cards` | `{"purpose":"Notion trial","spendLimit":10}` | Proposes a card; confirm separately through web chat |
| `POST /api/agent/action` | `{"name":"confirm_voice_action","pin":"1234"}` | Confirms the stored voice proposal; PIN required for voice card creation |

Supported action names are `mark_to_cancel`, `set_reminder`, and `create_one_time_card`. Proposal arguments are sanitized and stored server-side. Passing `confirmed:true`, changing tool arguments, or asking the model to bypass confirmation does not execute a mutation. Proposals expire after ten minutes and are scoped by user and channel. Only the exact affirmative message (`yes`, `yes please`, `confirm`, or `go ahead`) consumes a chat proposal.

Marking cancellation does not cancel with a merchant. The returned link is where the student finishes. The saved amount is an estimate. Reminder dates accept ISO dates or `N days before`. Credential-free demo chat also understands weekdays such as Friday, one action at a time.

## WhatsApp

1. Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, and the exact public `APP_URL` origin.
2. Configure the Twilio sandbox incoming message URL as `POST https://YOUR_APP/api/whatsapp/webhook`.
3. Verify the user's phone in Brix, enable WhatsApp, join the sandbox, and send a fresh message to open the messaging session.
4. Send `what's my next charge?`, then `cancel Spotify`. Verify the charge stays active until a separate `yes` message arrives.

The webhook validates `X-Twilio-Signature` against the configured public URL and all received form fields. It resolves `From` through the server phone index and claims `MessageSid` before running the agent. Replayed IDs receive empty TwiML rather than repeating an action. Unknown numbers receive a link to onboarding.

OpenAI requests share a ten-second budget across a maximum of four tool rounds to leave room under Twilio's approximate fifteen-second webhook timeout. Storage and card-provider latency add overhead, so the timeout remains an integration risk. This build replies synchronously with TwiML; it does not implement a background queue or delayed REST reply. Test slow-provider behavior before the presentation. A claimed message that times out is not replayed automatically; check the app's activity and card state before requesting another mutation.

## Vapi

Create a saved assistant with the prompt from `lib/agent/systemPrompt.ts`. Add functions with the names, descriptions, and parameter schemas exported from `lib/agent/toolSchemas.ts`. Set each tool's server URL to `https://YOUR_APP/api/vapi/tools`. Configure a saved server credential to send `x-vapi-secret: <VAPI_SERVER_SECRET>` (a bearer header containing the same secret is also accepted). Use a strong secret; an empty secret never authenticates.

Expected request shape:

```json
{
  "message": {
    "call": {"customer": {"number": "+18145550123"}},
    "toolCallList": [
      {"id": "call-1", "function": {"name": "get_upcoming_charges", "arguments": {"days": 14}}}
    ]
  }
}
```

Responses use `{"results":[{"toolCallId":"call-1","result":"..."}]}`. A phone must already map to a verified Brix account. Tool arguments may be objects or JSON strings.

**Current voice boundary:** voice tools read data and propose actions; the student confirms proposals in the authenticated app. This intentionally differs from the README's fully voice-operated demo. No model-generated confirmation flag authorizes a mutation. A voice card proposal also requires the PIN through `/api/agent/action`; PINs are never saved in pending actions or sent to the language model. Five incorrect PIN attempts lock verification for fifteen minutes. The authenticated app should display `state.pendingActions.voice.summary` before confirmation.

`POST /api/vapi/events` checks the secret and acknowledges events; it does not currently retain recordings or call summaries. Outbound calls are deferred. Provider-supplied caller ID is sufficient only for this sandbox prototype's read access; production voice identity needs stronger authentication.

## Reminder job

Invoke `POST /api/jobs/reminders` using `Authorization: Bearer <CRON_SECRET>`, `x-cron-secret`, or a Firebase token for an email in `ADMIN_EMAILS`. The route processes all stored users. Configure an external scheduler to POST; no schedule is installed automatically.

The job creates charge/date/threshold IDs for seven-day and two-day outreach, claims each reminder transactionally, then sends outside the transaction. WhatsApp requires current opt-in and a linked phone; otherwise automatic reminders appear in the app. Demo runs only create in-app reminders. Call reminders are skipped until outbound calling is implemented.

`sent` counts provider-accepted WhatsApp requests; it is not a delivery receipt. `inApp` counts in-app notifications. `failed` counts failed or uncertain sends. A timeout can mean the provider accepted a request, so failed or stuck `sending` reminders are not automatically retried. Inspect Twilio logs using the stored provider ID where available before an operator resets a reminder. The activity feed distinguishes in-app reminders from WhatsApp accepted for delivery.

## Sandbox cards and failure review

Set `LITHIC_API_KEY` and keep `LITHIC_ENV=sandbox`. The adapter creates `SINGLE_USE` cards with a cent-denominated lifetime spending limit. Only masked last four digits, purpose, limit, state, and source enter public app state. The provider token is stored in server-only secrets. Explicit demo cards have `source: "mock"`.

A card request keeps its proposal ID as the provider idempotency key. While processing, further proposals on that channel are blocked. On provider/persistence failure, the pending action stays `failed`, preserving its ID for review; it is not silently retried or replaced. Inspect provider logs and the server-only `card_<proposal-id>` secret, reconcile any issued card into app state, then clear the pending action through an authorized operator workflow. There is no self-service retry/reconciliation UI yet. Never retry under a fresh ID before resolving an uncertain card request.

## Checks that need your accounts

- Firebase Google sign-in, phone verification, rules deployment, and cross-account isolation.
- Plaid sandbox Link, token exchange, transaction sync, and recurring-stream availability.
- OpenAI key/model compatibility with Chat Completions function calling, including slow-response handling.
- Twilio signed inbound request, phone lookup, separate-message confirmation, and actual sandbox delivery.
- Vapi saved tool credentials, verified caller lookup, spoken answers, and app/PIN confirmation.
- Lithic sandbox permissions, single-use creation, and provider idempotency behavior.
- Authenticated admin and cron access on the deployed HTTPS URL.

Live news retrieval and outbound voice calls are deferred. `get_money_news` explicitly reports that briefing is not connected; setting `NEWS_API_KEY` alone does not enable it.

Official references consulted: [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling), [Twilio webhook validation](https://www.twilio.com/docs/usage/webhooks/webhooks-security), [Vapi server authentication](https://docs.vapi.ai/server-url/server-authentication), and [Lithic card creation](https://docs.lithic.com/docs/create-card).
