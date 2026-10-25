# Devpost submission: Brix

Paste each section into the matching Devpost field. Replace every `[[…]]` before submitting.

---

## Project name

Brix

## Tagline (Elevator pitch, 200 characters max)

Catch the charge before it catches you. An AI money assistant that spots trials and subscriptions before they bill, and lets students act by web, WhatsApp, or a phone call.

## Links

- Live app: https://www.usebrix.app
- Code: https://github.com/Timeless-Dave/brix
- Developer API docs: https://www.usebrix.app/developers
- Demo video: [[YouTube or Vimeo link]]

## Tracks / prizes to select

- HackPSU Grand Prize
- FNB Challenge: Trust, Decisions & Financial Confidence (primary)
- Nittany AI Challenge

---

## About the project (main description)

### Inspiration

Students rarely lose money in one big mistake. They lose it in small charges they never really decided on: a free trial that quietly converts, a subscription they stopped using, a renewal that lands the week rent is due. The information is already in their bank statement. What's missing is someone who turns it into a decision **the week before** the charge, not after.

[[Hallway interviews: "X of Y students we asked at HackPSU had been charged for a trial they forgot." Use real counts only.]]

FNB asked how technology can turn information into understanding, understanding into confidence, and confidence into action. Brix is our answer for the moment that matters most for a student's money: right before a charge hits.

### What it does

- **Finds every recurring charge.** Students link a bank through Plaid (sandbox). Brix reads recurring transactions, normalizes them, and predicts the next charge date for each subscription. Free trials can be added by hand.
- **Reaches out before the money moves.** A daily job checks every account and sends a reminder 7 days and 2 days before each charge, in the app or on WhatsApp.
- **Lets students act from anywhere.**
  - **Web chat:** a Claude-powered assistant that reads their real charges and can mark one to cancel, set a reminder, or make a one-time card.
  - **WhatsApp:** the same assistant over text.
  - **Phone call:** call the Brix number and ask "what's coming up?" A Vapi voice agent answers using the same tools, recognising the caller by their verified phone number.
- **Protects trials with single-use cards.** Brix can create a single-use card with a hard spending limit (Lithic sandbox), so a trial can't silently turn into a recurring charge. Cards can be closed at any time.
- **Explains, never decides.** For each charge it shows the amount, the date, and a direct cancel link. It surfaces merchant pricing and renewal news, labelled as news rather than a confirmed change to your plan.
- **Catches the refund moment.** When a school refund lands (leftover financial aid), Brix spots the deposit and builds a plan: essentials until the next disbursement, a starter emergency fund, and returning unused *borrowed* money while federal loans can still be cancelled with no interest (120 days). It flags when scholarship money spent on rent may be taxable.
- **Lets students learn investing safely.** A practice portfolio sized to their refund uses virtual money at real market prices: buy and sell index funds and large companies, set auto-invest rules (dollar-cost averaging), stop-losses and take-profits, follow news on their holdings, and compare against the S&P 500. No real money ever moves.
- **Opens up to other tools.** A public, documented REST API with personal, scoped keys lets students pull their charges into a spreadsheet, a Discord bot, or a phone shortcut.

### The trust design (what makes this an FNB answer, not an API wrapper)

- **Brix never moves money.** Bank access is read-only, and Brix never cancels at a merchant. It records the decision and hands you the cancel link.
- **Confirm before acting, on every channel.** The AI can only *propose* a change. Nothing happens until the user says yes. Each proposal is stored per channel, expires after 10 minutes, and can be confirmed only once, even if two confirmations arrive at the same moment.
- **Voice can't spend.** A spoken "yes" never applies a change. The user confirms in the signed-in app, and creating a card from a call also needs a 4-digit PIN (hashed, locked after 5 wrong tries).
- **No invented numbers, no advice.** The assistant answers only from tool results, and its prompt rules out investment advice.
- **Every request is verified.** Twilio signatures on WhatsApp, a shared secret on Vapi calls, a secret on the cron job, Firebase ID tokens in the app, and hashed, scoped keys for the API.
- **The user stays in control.** There's an activity log of every action, a bank-disconnect button, and a full "delete my data" option.

### How we built it

- **App:** Next.js 16 (App Router) with React 19 and TypeScript, deployed on Vercel. A Vercel cron job runs the daily reminder check.
- **Identity and data:** Firebase Authentication (Google and phone sign-in) and Firestore. All writes go through server routes. Firestore rules deny every client write and every read of secrets.
- **AI:** Claude (`claude-opus-5-5`) through the Anthropic SDK, with a manual tool-use loop. Seven tools share one tool layer across web, WhatsApp, and voice. The loop has a 10-second budget, and a server-side fallback model handles any refused request.
- **Voice:** a Vapi assistant on a Twilio number. Its tool calls hit `/api/vapi/tools`, which finds the caller by verified phone number and runs the same tools as the web chat.
- **Messaging:** Twilio WhatsApp, with signature validation on inbound messages.
- **Money data:** Plaid sandbox (`/transactions/sync` and recurring streams) for charges, and Lithic sandbox for single-use cards. Card creation uses idempotency keys, and an uncertain failure is never retried automatically.
- **News:** NewsAPI, filtered to the user's top merchants and to pricing and renewal stories.
- **Developer platform:** a versioned `/api/v1` with SHA-256-hashed personal keys, six scopes, per-key rate limits, idempotent trial creation, an OpenAPI 3.1 spec, and a docs page generated from that same spec.
- **Quality:** 37 unit tests and 67 Playwright browser tests (desktop and mobile). They cover confirmation races, malformed requests, concurrent API load, the cron secret, and WCAG AA accessibility checks with axe.

### Challenges we ran into

- **One brain, three channels.** Web, WhatsApp, and voice each needed the same tools but different confirmation rules. We stored a pending action per channel and made confirmations atomic, so a double-tap or a retried webhook can't apply an action twice.
- **Knowing who's calling.** A voice call carries only a phone number. We only accept numbers verified through Firebase phone sign-in, and we keep a server-only phone index. Unknown callers get onboarding instructions instead of data.
- **Production crash at cold start.** Firebase Admin pulled in an ES module through CommonJS, and every API route returned 500 on Vercel. We traced it and pinned a compatible dependency. We also added a test that cold-starts Firebase Auth the way the serverless runtime does.
- **Demo mode vs. real users.** We wanted a credential-free demo for judges without risking a demo shortcut in production. Demo mode now refuses to turn on in a Vercel production environment, even if the flag is copied over.
- **Ambiguous provider failures.** A card-creation timeout may or may not have created a card. We mark it for review instead of retrying, because two real cards is worse than one error message.

### Accomplishments that we're proud of

- A real phone call to Brix runs the same tools, under the same safety rules, as the app.
- The confirmation model holds up under concurrent requests. The tests fire duplicate confirmations at once and check that exactly one wins.
- We turned Brix into a small platform: documented, versioned, and scoped, with keys that users can create and revoke themselves.
- Accessibility checks pass on every main screen, on desktop and mobile.

### What we learned

[[Edit to match your own experience. Judges score Growth on this section.]]

- How Plaid's recurring-transaction streams work, and how to predict next charge dates across weekly, monthly, and annual cycles.
- How to wire a voice agent (Vapi + Twilio) to our own backend safely: authenticating webhooks, identifying callers, and keeping voice from authorising money actions.
- How card issuing works in Lithic's sandbox: single-use cards, spend limits, and idempotency.
- That trust is a product feature you design on purpose: confirm-before-act, read-only access, and saying "estimated" when a number is an estimate.

### What's next for Brix

- **Real investing hand-off:** after practice, point students to low-cost brokers and keep tracking their goals, without Brix ever holding money.
- **Real cards and live bank data:** this needs a sponsor bank and a compliance review. Until then, all money data is sandbox.
- **Bank and credit-union white-label:** offer the leak detector and assistant inside a bank's own app, branded as theirs.
- **Brix Plus for students:** a low monthly price (to be validated with users) for WhatsApp, voice, and one-time cards.
- **OAuth and webhooks for the API**, so other student apps can build on Brix with each user's permission.

---

## Built with (Devpost tags)

nextjs, react, typescript, vercel, firebase, firestore, firebase-authentication, anthropic, claude, vapi, twilio, whatsapp, plaid, lithic, newsapi, openapi, playwright, node.js

---

## Credits and citations (required by HackPSU rules)

All Brix code was written during HackPSU Fall 2026. Open-source packages and services used:

- Next.js, React, React DOM: https://github.com/vercel/next.js, https://github.com/facebook/react
- Anthropic TypeScript SDK (`@anthropic-ai/sdk`): https://github.com/anthropics/anthropic-sdk-typescript
- Firebase JS SDK and Firebase Admin SDK: https://github.com/firebase/firebase-js-sdk, https://github.com/firebase/firebase-admin-node
- `@google-cloud/firestore`: https://github.com/googleapis/nodejs-firestore
- Twilio Node SDK: https://github.com/twilio/twilio-node
- `react-plaid-link`: https://github.com/plaid/react-plaid-link
- Lucide icons (`lucide-react`): https://github.com/lucide-icons/lucide
- Playwright and `@axe-core/playwright`: https://github.com/microsoft/playwright, https://github.com/dequelabs/axe-core-npm
- TypeScript, ESLint, Prettier, tsx
- Fonts: Figtree and Instrument Serif via Google Fonts
- Services: Vercel, Firebase, Anthropic API, Vapi, Twilio, Plaid (sandbox), Lithic (sandbox), NewsAPI
- Development tools: [[list the AI coding assistants you used, e.g. Claude Code]]

---

## Demo video script (5 minutes max; aim for 3:30)

Rules: who you are, why you built it, how you implemented it, and future plans.

1. **0:00–0:30 · Who and why.** Introduce yourself. The problem: small charges students never decided on. Give your hallway-interview number.
2. **0:30–1:15 · The dashboard.** Link the Plaid sandbox bank. Recurring charges appear with their next dates and cancel links. Add a free trial.
3. **1:15–2:00 · Web chat.** Ask "what's coming up this week?" Then "cancel Netflix": Brix proposes, you confirm, the activity log updates, and the cancel link appears.
4. **2:00–2:45 · Phone call.** Call the Brix number on speaker and ask what's due. Ask it to remind you about Spotify, then show the proposal waiting in the app. Explain that voice can't spend money.
5. **2:45–3:15 · One-time card.** Create a $10 single-use card for a trial, confirm it, then close it.
6. **3:15–3:40 · How it's built.** Show the architecture slide: one tool layer, three channels, confirm-before-act. Show `/developers` for the public API.
7. **3:40–4:00 · What's next.** A real-investing hand-off after practice, a sponsor bank for real cards, and the bank white-label.

Record the call segment ahead of time as a backup.

---

## Before you hit submit

- [ ] Every teammate added on Devpost (prizes are split only among listed members)
- [ ] Tracks selected: Grand Prize, FNB Challenge, Nittany AI
- [ ] Video uploaded (under 5 minutes) and linked
- [ ] All `[[…]]` placeholders replaced
- [ ] Screenshots: landing, dashboard, chat, phone-call proposal in the app, cards, `/developers`
- [ ] Latest code pushed to GitHub (the repo is public; no secrets in history, checked)
- [ ] Project created before **12:00 AM Sunday**; hard deadline **12:00 PM Sunday**; editing ends 1:45 PM
- [ ] At least one teammate presenting at the judging expo
