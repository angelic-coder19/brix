# Devpost submission: Brix

Paste each section into the matching Devpost field.

---

## Elevator pitch (200 characters max)

Catch money moments before they pass. Brix warns students before trials bill, spots borrowed money in aid refunds, and saves gift cards from expiring, by app, WhatsApp or a phone call.

---

## About the project

## Inspiration

Two things that happened to people around me made me build Brix.

My roommate had almost nothing left on his card except the money he'd set aside for health insurance. He signed up for a one-month LinkedIn Premium free trial, forgot about it, and got charged. LinkedIn did refund him, but only after two months of emails and follow-ups, with his health insurance money stuck the whole time.

A friend showed me about ten gift cards, each with around $10 left. He couldn't use them: tax would push a purchase just past the balance, or the checkout wouldn't take a gift card for such a small amount. That's roughly $100 sitting in a drawer.

It isn't just them. **48%** of Americans, and **59%** of Gen Z, have paid for a trial they forgot to cancel. About **$27 billion** sits on unspent U.S. gift cards. **28%** of first-year students with federal loans said they had none, so many don't realize part of their aid refund is borrowed. And **48%** of Gen Z investors learned investing from social media.

The information is already in a student's bank account. What's missing is someone who turns it into a decision **at the moment it matters**. FNB asked how technology can turn information into understanding, understanding into confidence, and confidence into action. Brix does that at four moments.

## What it does

**1. Before a charge hits.** Students link a bank through Plaid. Brix finds every subscription, predicts the next charge date, and shows each merchant's real logo. Free trials can be added by hand, because a bank can't see a trial until it bills. Brix reminds the student **7 days and 2 days before** each charge, in the app, on WhatsApp, or with a phone call. From there they can mark the charge to cancel (with the merchant's cancel link), set a reminder, or create a **single-use card** with a hard limit, such as $1 for a free trial, so the trial can never turn into a charge.

**2. When a school refund lands.** Brix detects the aid refund deposit in the bank feed and points out what most students miss: part of it may be **borrowed**. Federal loan money returned within **120 days** is cancelled with no interest or fees, so Brix shows the exact return-by date, the interest the student avoids, and a plan: essentials first, then an emergency buffer, then saving. It also flags that scholarship money spent on rent can be taxable, with links to studentaid.gov and IRS Publication 970.

**3. Before a gift card expires.** Students add gift cards by filling in a gift card on screen. Brix keeps every balance in one place, reminds them **14 and 3 days** before a card expires, and when they ask about a store, reminds them to use the card first.

**4. Before risking real money.** A **practice portfolio** uses virtual money at real Yahoo Finance prices. Students can buy fractional shares, set stop-loss and take-profit, schedule auto-invest, compare themselves with the S&P 500, and see a price-history chart. A leaderboard of **Brix coins** rewards good habits (trading, auto-investing) more than lucky bets. Orders never fill without a real price.

**One decision at a time.** The dashboard opens with the single most important decision right now, for example *"$1,200 of your refund is borrowed. Return it by Feb 12"*, rather than a wall of numbers.

**One assistant, everywhere.** The web chat, WhatsApp and phone calls share **13 tools** that work on the student's own data. Every answer is labelled with where it came from: *Your charges*, *Brix's math (estimate)*, *News: Google News*, or *General info, not your data*.

**Open to other apps.** A public REST API with scoped, revocable keys lets students pull Brix data into spreadsheets, Discord bots or their own dashboards.

## The trust design

- **Brix never moves money.** Bank access is read-only, and Brix never cancels at a merchant. It records the decision and hands over the cancel link. Investing is practice-only.
- **Confirm before acting, on every channel.** The AI can only *propose* a change. Each proposal is stored per channel, expires after 10 minutes, and is applied **exactly once**, even if two confirmations arrive at the same moment (I test this).
- **Voice can't spend.** A spoken "yes" never applies a change. The student confirms in the signed-in app. Creating a card from a call also needs a 4-digit PIN, hashed and locked for 15 minutes after 5 wrong tries.
- **No invented numbers, no advice.** Every amount and date is computed by code from the student's data. The AI explains; it never makes up figures or gives personal investment advice.
- **Every request is verified:** Firebase ID tokens, Twilio signatures, a Vapi shared secret, a cron secret, and SHA-256-hashed, scoped API keys. Firestore rules deny every client write and every read of secrets.
- **The student stays in control:** an activity log, a bank-disconnect button, revocable keys, and a full "delete my data". Raw transactions are never stored, and the leaderboard shows first names and initials only.

## How I built it

- **App:** Next.js 16 (App Router, with one persistent app shell), React 19 and TypeScript on Vercel. Two Vercel cron jobs run daily reminders and weekday auto-invest rules.
- **AI:** Claude (`claude-opus-5-5`) through the Anthropic SDK, with a manual tool-use loop over 13 shared tools. The loop has a time budget (12 seconds for WhatsApp, inside Twilio's 15-second limit; 10 seconds elsewhere) and a server-side fallback model.
- **Voice:** a Vapi assistant on a Twilio number. Its tool calls hit `/api/vapi/tools`, which identifies the caller by verified phone number and runs the same tools as the web chat. Brix also places reminder calls 2 days before a charge.
- **Messaging:** Twilio WhatsApp, with signature validation on every inbound message.
- **Identity and data:** Firebase Authentication (Google, Google One Tap, phone) and Firestore. All writes go through server routes.
- **Money data:** Plaid sandbox (`/transactions/sync` and recurring streams) for charges, refund detection and merchant logos. Lithic sandbox for single-use cards, with idempotency keys.
- **Markets and news:** Yahoo Finance quotes and price history, and Google News RSS for merchant pricing stories, cached in Firestore with a stale-data fallback.
- **Developer platform:** a versioned `/api/v1` with eight scopes, per-key rate limits, an OpenAPI 3.1 spec, and a docs page generated from that spec.
- **Quality:** 72 unit tests, 151 Playwright browser tests on desktop and mobile (including axe accessibility scans), and a 44-step live test that runs against production with a throwaway account and then deletes all of its data.

## Challenges I ran into

- **One brain, three channels.** Web, WhatsApp and voice needed the same tools but different confirmation rules. I store a pending action per channel and make confirmations atomic, so a double-tap or a retried webhook can't apply an action twice.
- **Knowing who's calling.** A call carries only a phone number. I accept only numbers verified through Firebase phone sign-in, kept in a server-only index. Unknown callers get onboarding instructions instead of data.
- **WhatsApp's 15-second limit.** Twilio drops a webhook reply after 15 seconds, so the agent loop works within a 12-second budget and falls back gracefully.
- **Refunds hide in the bank feed.** Aid refunds don't look the same at every school. I built a classifier for bursar, financial-aid and refund-processor descriptions, and test it against real-style statements, including deposits that only *look* like refunds.
- **Demo mode vs. real users.** I wanted a credential-free demo without risking a shortcut in production. Demo mode refuses to turn on in a Vercel production environment, even if the flag is copied over.
- **Ambiguous provider failures.** A card-creation timeout may or may not have created a card, so I mark it for review instead of retrying. Two real cards is worse than one error message.

## Accomplishments that we're proud of

- You can call Brix on a real phone, and it uses the same tools under the same safety rules as the app.
- Brix spots borrowed money in a refund straight from the bank feed and turns it into a dated plan.
- The confirmation model holds up under concurrent requests: the tests fire duplicate confirmations at once and check that exactly one wins.
- Brix is a small platform, not just an app: documented, versioned and scoped.
- Accessibility checks pass on every main screen, on desktop and mobile.

## What I learned

- How Plaid's transaction sync and recurring streams work, and how to predict the next charge across weekly, monthly and annual cycles.
- How federal aid refunds work: the 120-day loan-return window, and when scholarship money becomes taxable.
- How to wire a voice agent to our own backend safely: authenticated webhooks, verified callers, and no money actions by voice.
- That trust is a feature you design on purpose: confirm-before-act, read-only access, source labels, and saying "estimate" when a number is an estimate.

## What's next for Brix

- **Make gift card leftovers usable:** combine small balances, or split one purchase across a gift card and your own card, so ten cards with $10 each become $100 you can spend.
- **A first-campus pilot**, then more campuses with student ambassadors.
- **Bank and credit-union white-label:** Brix inside a bank's own app, branded as theirs, for banks like FNB.
- **Real cards and production bank data** with a sponsor bank, after a compliance review.
- **Brix Plus** for students ($3.99 a month, to be validated), and OAuth and webhooks for the API.

---

## Built with (tags)

nextjs, react, typescript, node.js, vercel, firebase, firestore, firebase-authentication, anthropic, claude, vapi, twilio, whatsapp, plaid, lithic, yahoo-finance, google-news, openapi, playwright, axe-core

## "Try it out" links

- https://www.usebrix.app
- https://github.com/Timeless-Dave/brix
- https://www.usebrix.app/developers

---

## Additional info (judges only)

**Did you implement a generative AI model or API? How and why?**

Yes. Brix uses Anthropic's Claude (`claude-opus-5-5`) through the Anthropic SDK as the assistant behind the web chat, WhatsApp and phone calls. Claude never sees raw bank data or invents numbers. It calls 13 server-side tools that read the student's own charges, refunds, gift cards and practice portfolio, then explains the results in plain language and labels every answer with its sources. Claude can only *propose* actions (a reminder, marking a charge to cancel, a single-use card, a practice trade); the student must confirm each one, and voice can never confirm money actions. I used generative AI because students ask about money in their own words, at odd moments and on different channels, and a tool-using model can turn that into a precise, verifiable answer from their real data.

**AI tools used this weekend:** Anthropic. Also tick OpenAI if you used ChatGPT or Codex, and use "Other" for Vapi (voice).

**Sponsor / special prizes:** FNB Challenge: Trust, Decisions & Financial Confidence, and Nittany AI Challenge.
