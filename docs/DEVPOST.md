# Devpost submission: Brix

Paste each section into the matching Devpost field. Replace every `[[…]]` before submitting.

---

## Project name

Brix

## Tagline (Elevator pitch, 200 characters max)

Catch money moments before they pass. Brix flags trials before they bill, borrowed money hiding in aid refunds, and gift cards about to expire, then helps students act by app, WhatsApp or call.

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

Brix shows up at the moments students most often get money wrong, and turns each one into a single, clear next step.

**Moment 1: before a charge hits.**
- Links a bank through Plaid (sandbox), finds every recurring charge, and predicts the next date for each.
- Free trials can be added by hand.
- Reaches out 7 days and 2 days before each charge: in the app, on WhatsApp, or with a phone call for students who opt in.
- The student can keep it, mark it to cancel (with the merchant's cancel link), set a reminder, or use a single-use card with a hard limit (Lithic sandbox) so a trial can't quietly become a subscription.

**Moment 2: when a school refund lands.**
- Brix spots the aid refund deposit and points out what most students miss: part of it may be **borrowed**.
- Federal loan money returned within 120 days is cancelled with no interest or fees, so Brix shows the exact return-by date, the interest the money would otherwise build, and a plan: essentials until the next disbursement, a starter emergency fund, then saving.
- It flags that scholarship or grant money spent on rent can be taxable.
- Students who want to invest first try a **practice portfolio**: virtual money at real prices, auto-invest rules and a comparison with the S&P 500. No real money ever moves.

**Moment 3: before a gift card expires.**
- Unspent gift card balances ("breakage") are money students already have.
- Brix tracks balances and expiry dates, reminds students 14 and 3 days before a card expires, and when they ask about a store they pay, reminds them to use the card first.

**One decision at a time.** The dashboard opens with the single most important decision right now (for example, "$1,200 of your refund is borrowed, return by Feb 12"), not a wall of numbers.

**The same assistant everywhere.** The web chat, WhatsApp and a phone call (Vapi) all use the same 12 tools on the student's own data. Merchant and stock news (Google News and Yahoo Finance) is filtered to real pricing stories and labelled as news, not a confirmed change. A public, scoped REST API lets students pull their data into their own tools.

### The trust design (what makes this an FNB answer, not an API wrapper)

- **Brix never moves money.** Bank access is read-only, and Brix never cancels at a merchant. It records the decision and hands you the cancel link.
- **Confirm before acting, on every channel.** The AI can only *propose* a change. Nothing happens until the user says yes. Each proposal is stored per channel, expires after 10 minutes, and can be confirmed only once, even if two confirmations arrive at the same moment.
- **Voice can't spend.** A spoken "yes" never applies a change. The user confirms in the signed-in app, and creating a card from a call also needs a 4-digit PIN (hashed, locked after 5 wrong tries).
- **No invented numbers, no advice.** Every amount and date is calculated by code from the student's data; the AI explains and never makes up figures. It won't tell anyone what to buy with real money.
- **Every answer shows where it came from.** Each chat reply is labelled with its sources, for example "Your charges", "Brix's math (estimate)", "News: Google News", or "General info, not your data", so students can tell their own data from estimates and general advice. Refund plans link to studentaid.gov, IRS Publication 970 and the CFPB.
- **Every request is verified.** Twilio signatures on WhatsApp, a shared secret on Vapi calls, a secret on the cron job, Firebase ID tokens in the app, and hashed, scoped keys for the API.
- **The user stays in control.** There's an activity log of every action, a bank-disconnect button, and a full "delete my data" option.

### How we built it

- **App:** Next.js 16 (App Router) with React 19 and TypeScript, deployed on Vercel. A Vercel cron job runs the daily reminder check.
- **Identity and data:** Firebase Authentication (Google and phone sign-in) and Firestore. All writes go through server routes. Firestore rules deny every client write and every read of secrets.
- **AI:** Claude (`claude-opus-5-5`) through the Anthropic SDK, with a manual tool-use loop. Twelve tools share one tool layer across web, WhatsApp, and voice. The loop has a time budget (12 seconds for WhatsApp, within Twilio's 15-second limit; 10 seconds elsewhere), and a server-side fallback model handles any refused request.
- **Voice:** a Vapi assistant on a Twilio number. Its tool calls hit `/api/vapi/tools`, which finds the caller by verified phone number and runs the same tools as the web chat.
- **Messaging:** Twilio WhatsApp, with signature validation on inbound messages.
- **Money data:** Plaid sandbox (`/transactions/sync` and recurring streams) for charges, and Lithic sandbox for single-use cards. Card creation uses idempotency keys, and an uncertain failure is never retried automatically.
- **News and prices:** Google News RSS for merchant pricing stories and Yahoo Finance for stocks, cached in Firestore with a stale-data fallback; live Yahoo prices for the practice portfolio, and orders never fill without a real price.
- **Developer platform:** a versioned `/api/v1` with SHA-256-hashed personal keys, six scopes, per-key rate limits, idempotent trial creation, an OpenAPI 3.1 spec, and a docs page generated from that same spec.
- **Quality:** 66 unit tests, 130 Playwright browser tests (desktop and mobile, including WCAG AA accessibility checks), and a 40-step live test that runs against production with a throwaway account: real Plaid sandbox sync, Claude, Lithic, signed WhatsApp and voice webhooks, refund detection, live-price trades and news.

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

1. **0:00–0:25 · Who and why.** Students lose money at moments they don't notice: a trial that bills, an aid refund that's secretly a loan, a gift card that expires. Give your "X of Y students" number.
2. **0:25–1:20 · The refund moment.** Open the dashboard: "Your next decision: $1,200 of your refund is borrowed." Open the plan: essentials, emergency fund, return $1,200 by Feb 12 (no interest), and the taxable-scholarship note with its sources.
3. **1:20–2:05 · Call Brix.** On speaker: "I just got money back from school, what should I do?" Brix explains the borrowed part. Then "remind me before Spotify renews": it prepares the request, and you confirm it in the app (voice can't spend).
4. **2:05–2:35 · Before a charge.** Show a trial billing soon, ask the chat "should I keep it?", and point to the source labels under the answer. Mark it to cancel, and show the cancel link.
5. **2:35–2:55 · Gift cards.** Show "$52.35 unspent across 2 cards," the Target card expiring in 20 days, then log a spend.
6. **2:55–3:15 · Practice, not gambling.** Start a practice portfolio with the refund amount (virtual money), buy VOO at the live price, and add a $25 weekly rule.
7. **3:15–3:40 · How it's built and why trust it.** Read-only bank access, confirm before any action, numbers calculated by code, sources on every answer, 40-step live test.
8. **3:40–4:00 · What's next.** A bank or credit-union white-label, a sponsor bank for real cards, and outbound check-ins at key aid dates.

Record the call segment ahead of time as a backup.

## Before you hit submit

- [ ] Every teammate added on Devpost (prizes are split only among listed members)
- [ ] Tracks selected: Grand Prize, FNB Challenge, Nittany AI
- [ ] Video uploaded (under 5 minutes) and linked
- [ ] All `[[…]]` placeholders replaced
- [ ] Screenshots: landing, dashboard, chat, phone-call proposal in the app, cards, `/developers`
- [ ] Latest code pushed to GitHub (the repo is public; no secrets in history, checked)
- [ ] Project created before **12:00 AM Sunday**; hard deadline **12:00 PM Sunday**; editing ends 1:45 PM
- [ ] At least one teammate presenting at the judging expo
