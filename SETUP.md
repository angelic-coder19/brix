# Run Brix

The repository supports a local, credential-free demo and a configured sandbox integration mode. Demo charges are sample data, demo cards cannot be used, and demo reminders do not contact anyone.

## Local demo

```sh
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The example enables both `BRIX_DEMO_MODE` and `NEXT_PUBLIC_BRIX_DEMO_MODE`. Keep this shared demo on localhost: it intentionally does not require a Firebase login. Data is stored in `.data/`, which is ignored by Git. Use the admin screen to reset the demo.

```sh
npm run typecheck
npm test
npm run build
```

## What the team needs to supply

1. **Firebase:** create a project and Firestore database, register a web app, enable Google and Phone authentication, and add localhost plus the eventual deployment domain to authorized domains. Copy web configuration and server service-account values into `.env.local` or Vercel environment variables. Never commit the service-account file. Deploy `firestore.rules` before using real accounts.
2. **Plaid:** obtain sandbox client ID and secret. Keep `PLAID_ENV=sandbox`; the application is for sandbox banking. Use the sandbox test credentials listed in the README.
3. **OpenAI:** provide an API key with billing access and an explicitly selected function-calling model in `OPENAI_MODEL`.
4. **Twilio:** activate the WhatsApp sandbox, fill account SID, auth token, and sandbox sender. Put the display number and join code in the public WhatsApp environment fields. Have each demo phone join the sandbox and send a fresh message before the presentation.
5. **Vapi:** create a voice assistant, attach a phone number, set the server secret, and enter the assistant and phone-number IDs. Configure its tools from `lib/agent/toolSchemas.ts`, use the shared prompt in `lib/agent/systemPrompt.ts`, and point them at `/api/vapi/tools`. Voice proposes actions; users confirm them in the signed-in app. Card confirmation also requires the user's PIN. See [INTEGRATIONS.md](INTEGRATIONS.md) for exact payloads and configuration.
6. **Hosting:** connect this GitHub repo to Vercel, add environment variables, and set `APP_URL` to the exact public HTTPS origin. Set **both demo flags to `false` before deploying the live app**. Rebuild after changing any `NEXT_PUBLIC_*` variable. Add the deployment domain in Firebase Auth.
7. **Access control:** set `ADMIN_EMAILS` to the Google account used for demo controls. Generate separate random values for `CRON_SECRET` and `VAPI_SERVER_SECRET`. Keep them server-side.
8. **Optional:** add a Lithic sandbox key for sandbox issuing. A mock card is available only in explicit demo mode. Merchant news and outbound phone calls remain deferred; the news environment variable is reserved for future implementation.

Do not paste API keys into chat. Add them to the ignored `.env.local` file and the hosting provider's secret settings.

## Webhook endpoints

| Service | URL | Verification |
| --- | --- | --- |
| Twilio inbound WhatsApp | `https://YOUR_APP/api/whatsapp/webhook` | Twilio request signature using the exact public URL |
| Vapi tool calls | `https://YOUR_APP/api/vapi/tools` | Server secret |
| Reminder job | `https://YOUR_APP/api/jobs/reminders` | Cron bearer secret or authenticated admin |

For local integration testing use an HTTPS tunnel, set `APP_URL` to its origin, and update the provider webhook URLs. Run an end-to-end check with your own verified phone before demoing another person's data.

## Presentation work

- Create the Devpost project and add teammates; confirm submission time and allowed tracks in the event's Discord.
- Interview students and use actual counts, such as “4 of 8,” rather than invented statistics.
- Record a three-minute demo and keep a backup video on two devices.
- Describe marked cancellations as estimated avoided charges: users must finish cancellation on the merchant website.
- Do not promise that a virtual card always prevents trial conversion. Sandbox cards do not move real money, and production behavior depends on issuer controls and merchant billing.

## Deployment limits

Local demo storage is not a hosted database. Live mode uses Firestore. Provider-backed flows need the credentials above and must be tested against those accounts; successful local demo tests do not establish that WhatsApp delivery, phone calls, bank sync, or card issuing work in your account.
