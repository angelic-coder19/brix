# Read-only Gmail subscription import

This optional connection is separate from Google sign-in. Nothing connects until the signed-in user starts the flow and consents on Google's page. Demo mode never fabricates a connected mailbox or sample email detections.

## Server setup

Set these server-only environment variables using your deployment's secret manager (never NEXT_PUBLIC):

- `GOOGLE_GMAIL_CLIENT_ID`: a **dedicated** Google OAuth web application client ID for Gmail import.
- `GOOGLE_GMAIL_CLIENT_SECRET`: that client's secret.
- `GMAIL_TOKEN_ENCRYPTION_KEY`: 32 random bytes encoded in base64. Generate locally with `openssl rand -base64 32`; keep it stable. Changing it makes existing refresh tokens unreadable; users must reconnect. Do not commit it.
- `APP_URL`: the exact application origin, HTTPS except localhost.

In the Google Cloud project, enable Gmail API, configure OAuth consent and test users, and register `APP_URL/api/email/callback` as the exact authorized redirect URI. Use a dedicated OAuth client so revoking Gmail does not unintentionally revoke another feature's grant. Enable Firebase Google sign-in separately and disable `BRIX_DEMO_MODE` to use a real mailbox.

The only requested permission is `https://www.googleapis.com/auth/gmail.readonly`. It allows reading the mailbox, not just subscriptions. The UI must say this clearly before consent: Brix searches recent subscription emails but Google's permission covers read access to the whole mailbox. Brix cannot send, edit or delete email. This is a **restricted scope**: external public deployment needs Google's restricted-scope verification; server-side handling of restricted data may require a security assessment. Test-mode grants can expire and university Workspace administrators may block consent. Do not promise production availability before approval. See [Google scope requirements](https://developers.google.com/workspace/gmail/api/auth/scopes) and [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server).

No Cloud configuration, credentials, or external account connections are created by this implementation.

## UI / API contract

All endpoints require the normal Firebase bearer token except Google's callback. Always use the existing authenticated `request` helper. Gmail tokens are never returned to the browser.

- `GET /api/email`: `{configured, connected, demo, candidates, email?, lastScannedAt?, setupRequired?}`. Display connected only from this response, never based on a redirect query string.
- `POST /api/email/connect`: returns `{url}` and sets an encrypted HttpOnly, SameSite=Lax browser cookie. Navigate with `window.location.assign(url)`. Google returns to `/connect?email=connected|denied|error`. Reload status and offer scan; callback itself does **not** fetch messages.
- `POST /api/email/scan`: returns `{candidates, scanned, limited, lastScannedAt}`. User-triggered only; scans up to 30 matching messages from the last 90 days, newest candidate per supported merchant. `limited` means additional search results were not fetched. No silent background scanning. One-minute cooldown after a successful scan.
- `POST /api/email/import`: `{candidates:[{id,merchant,amount,nextDate,frequency,kind}]}`. Show an explicit review form before submitting. `amount` is USD, `nextDate` a future/today `YYYY-MM-DD`, `frequency` one of weekly/monthly/annual/unknown and `kind` subscription/trial. Returns `{imported,skipped}`. Existing active merchants and already-imported IDs are skipped. Then refresh app state and email status.
- `DELETE /api/email`: forgets local token, pending OAuth flow and suggestions, then requests Google revocation. Returns `{disconnected:true,revoked:boolean,message?}`. If revocation cannot be confirmed, display the message and a link to [Google Account connections](https://myaccount.google.com/connections). Already imported charges remain because they were reviewed; users can remove them separately.

Candidate shape: `{id,merchant,amount:number|null,nextDate:string|null,frequency,kind,subject,senderDomain,receivedAt}`. Null fields mean uncertain or missing, **not zero**. Require corrections before importing. Subjects and sender domains are plain untrusted text; never render HTML. Emails are suggestions, not proof of an active charge. Sender headers can be spoofed; the review step is required.

## Data and security

OAuth uses a cryptographically random state, browser-bound encrypted cookie, ten-minute expiry, PKCE S256, one-time state consumption, and server-side UID binding established from the Firebase token at connect start. The callback cannot accept a UID from the URL. A new flow or disconnect invalidates an in-progress callback. The redirect destination comes only from configured APP_URL.

Refresh tokens are AES-256-GCM encrypted with per-user authenticated context in `secrets/{uid}.gmail`. Access tokens remain in request memory. Private candidates store only extracted fields, short subject, sender domain and message timestamp; message IDs are hashed. Raw bodies and attachments are never persisted, sent to an LLM, displayed as HTML or loaded as remote images. The existing Firestore rules deny client access to `secrets/**`.

Parsing is intentionally conservative: known merchant sender domains, explicit subscription/trial/renewal language, only an unambiguous USD amount, only explicit ISO renewal dates. Ambiguous or missing amounts/dates stay null. This can miss subscriptions or need a date correction. Existing `Charge.source` is `manual` for user-reviewed imports, with a Gmail provenance note; nothing is labeled as a bank detection.

Account deletion must call `disconnectEmail(uid)` before deleting app data to request revocation. Deleting `secrets/{uid}` erases stored Gmail tokens and suggestions. The module does not create other collections or change security rules.

## Validation and remaining setup

Automated tests cover parser ambiguity, known-domain matching, required evidence, exact dates, and encryption/state tamper resistance. No real mailbox test can run until an operator configures the OAuth client, supplies credentials, enables Gmail API, and a user explicitly consents. Test connect/deny, expired state, account switching, scan, review, duplicate import, disconnect, and revoked permission before publishing.

Google API references: [message search](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list), [message retrieval](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/get).
