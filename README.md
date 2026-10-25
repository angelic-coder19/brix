<div align="center">

<a href="https://www.usebrix.app"><img src="app/opengraph-image.png" alt="Brix: catch the charge before it catches you" width="100%" /></a>

# Brix

### Catch money moments before they pass.

An AI money assistant for college students. Brix spots the moments students most often get money wrong: a free trial about to bill, borrowed money hidden in an aid refund, a gift card about to expire, a first investment. For each one it gives a single clear next step, in the app, on WhatsApp or over a phone call.

[![Live app](https://img.shields.io/badge/live-usebrix.app-C8462A?style=for-the-badge)](https://www.usebrix.app)
[![API docs](https://img.shields.io/badge/API-docs-292920?style=for-the-badge)](https://www.usebrix.app/developers)
[![HackPSU Fall 2026](https://img.shields.io/badge/HackPSU-Fall%202026-1E407C?style=for-the-badge)](https://hackpsu.org)

![Next.js 16](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React 19](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Claude](https://img.shields.io/badge/AI-Claude%20Opus%205.5-D97757)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%2B%20Firestore-FFCA28?logo=firebase&logoColor=black)
![Tests](https://img.shields.io/badge/tests-71%20unit%20·%20150%2B%20browser%20·%2044%20live-2F7D4F)

**Built for the FNB Challenge: Trust, Decisions & Financial Confidence**

[Try it](#try-it-in-60-seconds) · [The problem](#the-problem) · [What Brix does](#what-brix-does) · [How it works](#how-it-works) · [Trust](#trust-by-design) · [API](#developer-api) · [Run it](#run-it-locally)

</div>

---

## Try it in 60 seconds

| Channel | How |
|---|---|
| 🌐 **Web app** | Open **[usebrix.app](https://www.usebrix.app)** and sign in with Google. Link the Plaid sandbox bank with `user_good` / `pass_good`. |
| 📞 **Phone call** | Call **+1 (870) 395-8999**. Brix answers, reads your charges and proposes actions you confirm in the app. |
| 💬 **WhatsApp** | Send `join frozen-partly` to **+1 (415) 523-8886** (Twilio sandbox), then ask *"what's coming up?"* |
| 🧑‍💻 **API** | Create a key on the Developers page in the app, then `curl https://www.usebrix.app/api/v1/me -H "Authorization: Bearer $BRIX_API_KEY"` |

> [!NOTE]
> Bank data is Plaid **sandbox** data and cards are Lithic **sandbox** cards. No real money moves anywhere in Brix, by design.

---

## The problem

Students rarely lose money in one big mistake. They lose it at small moments nobody warns them about. The information already exists in bank statements and award letters. Nobody turns it into a decision **at the moment it matters**.

| Moment | The data | Source |
|---|---|---|
| 🔔 **Forgotten trials** | **48%** of Americans paid for a trial they forgot to cancel. **59%** of Gen Z. | 2024 U.S. survey (via 9to5Mac) |
| 🎁 **Unspent gift cards** | **$27B** sits unspent on U.S. gift cards. **43%** of adults hold at least one. | Bankrate, 2023–2024 |
| 🎓 **Hidden loans** | **28%** of first-year students with federal loans said they had none. | Akers & Chingos, Brookings |
| 📈 **Who to trust** | **48%** of Gen Z investors learned investing from social media. | FINRA Foundation & CFA Institute, 2023 |

FNB asks how technology can turn **information → understanding → confidence → action**. Brix does that at four specific, high-stakes moments in a student's money life.

---

## What Brix does

<table>
<tr>
<td width="50%" valign="top">

### 1 · Before a charge hits
Links a bank (Plaid), finds every subscription and free trial, predicts the next charge date, and reaches out **7 days and 2 days before** each one: in the app, on WhatsApp or with a phone call. Keep it, mark it to cancel (with the merchant's cancel link), set a reminder, or create a **single-use card** with a hard limit so a trial can never bill you.

</td>
<td width="50%"><img src="docs/images/dashboard.jpg" alt="Brix overview: the next decision, monthly recurring total and upcoming charges" /></td>
</tr>
<tr>
<td width="50%"><img src="docs/images/refunds.jpg" alt="Refund planner showing 110 days left to return borrowed money free" /></td>
<td width="50%" valign="top">

### 2 · When a school refund lands
Brix detects the aid refund deposit and points out what most students miss: **part of it may be borrowed**. Federal loan money returned within **120 days** is cancelled with no interest or fees. Brix shows the exact return-by date, the interest you'd otherwise pay, and a plan: essentials, an emergency buffer, then saving. It also flags when scholarship money may be **taxable**, with citations to studentaid.gov and IRS Publication 970.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 3 · Before a gift card expires
Add a gift card by filling in a gift card. Brix tracks balances and expiry dates, reminds you **14 and 3 days** before a card expires, and when you ask about a store you're about to pay, reminds you to use the card first. One-time cards are edited the same way, on a real Brix card with templates such as *Free trial · $1*.

</td>
<td width="50%"><img src="docs/images/cards.jpg" alt="Cards page: edit a single-use Brix card and a gift card in place" /></td>
</tr>
<tr>
<td width="50%"><img src="docs/images/invest.jpg" alt="Practice investing: shaded price history chart and Brix coins leaderboard" /></td>
<td width="50%" valign="top">

### 4 · Before you risk real money
A **practice portfolio** with virtual money at **real Yahoo Finance prices**. Buy fractional shares, set stop-loss and take-profit, schedule auto-invest, compare yourself with the S&P 500, and climb a **leaderboard of Brix coins** that rewards habits (trading, auto-investing) more than luck. Orders never fill without a real price.

</td>
</tr>
</table>

**One decision at a time.** The dashboard opens with the single most important decision right now, such as *"$1,200 of your refund is borrowed. Return it by Feb 12"*, instead of a wall of numbers.

**One assistant, everywhere.** The web chat, WhatsApp and phone calls all share **13 tools** that read the student's own data. Every answer is labelled with where it came from.

<p align="center">
  <img src="docs/images/chat.jpg" alt="Brix chat answering whether a refund is borrowed, with a source label" width="85%" />
</p>

<p align="center">
  <img src="docs/images/mobile-dashboard.jpg" alt="Brix on a phone: overview" width="28%" />
  &nbsp;
  <img src="docs/images/mobile-cards.jpg" alt="Brix on a phone: cards" width="28%" />
  &nbsp;
  <img src="docs/images/mobile-invest.jpg" alt="Brix on a phone: invest" width="28%" />
</p>
<p align="center"><sub>Fully responsive from 360px phones to 1920px desktops, with a bottom tab bar on mobile.</sub></p>

---

## How it works

### The journey: information → understanding → confidence → action

```mermaid
flowchart LR
    A["🏦 Bank data<br/>Plaid sandbox"] --> B["🔍 Understand<br/>recurring charges, refunds,<br/>gift cards, prices"]
    B --> C["🧭 Decide<br/>one next decision,<br/>ranked by urgency"]
    C --> D{"Where is<br/>the student?"}
    D -->|app| E["🌐 Web dashboard<br/>+ chat"]
    D -->|messages| F["💬 WhatsApp"]
    D -->|on the go| G["📞 Phone call"]
    E & F & G --> H["✅ Act<br/>remind · mark to cancel ·<br/>one-time card · plan refund ·<br/>practice trade"]
    H --> I["📒 Activity log<br/>+ money avoided"]

    style A fill:#F7F5EF,stroke:#292920,color:#292920
    style C fill:#C8462A,stroke:#A9321D,color:#fff
    style H fill:#2F7D4F,stroke:#1F5A38,color:#fff
```

### System architecture: one brain, three channels

```mermaid
flowchart TB
    subgraph Channels
        WEB["🌐 Next.js web app<br/>React 19 · PWA"]
        WA["💬 WhatsApp<br/>Twilio webhook"]
        VOICE["📞 Phone<br/>Vapi assistant"]
        API["🧑‍💻 Public REST API<br/>/api/v1 · scoped keys"]
    end

    subgraph Server["Next.js 16 route handlers on Vercel"]
        AUTH["🔐 Verify every request<br/>Firebase ID token · Twilio signature ·<br/>Vapi secret · hashed API key · cron secret"]
        AGENT["🧠 Claude agent loop<br/>claude-opus-5-5 · tool use ·<br/>time budget · server fallback"]
        TOOLS["🧰 Shared tool layer · 13 tools<br/>lib/tools"]
        CONFIRM["✋ Propose → confirm<br/>per channel · expires in 10 min ·<br/>applied exactly once"]
    end

    subgraph Data["Data, providers and outreach"]
        FS[("🔥 Firestore<br/>users · secrets · portfolios ·<br/>phoneIndex · apiKeys · newsCache")]
        PLAID["🏦 Plaid sandbox"]
        LITHIC["💳 Lithic sandbox<br/>single-use cards"]
        NEWS["📰 Google News RSS<br/>+ Yahoo Finance"]
        OUT["📣 Proactive reminders<br/>WhatsApp or Vapi call,<br/>7 and 2 days before a charge"]
    end

    CRON["⏰ Vercel cron<br/>reminders daily · practice rules weekdays"]

    WEB & WA & VOICE & API --> AUTH
    AUTH --> AGENT
    AUTH --> TOOLS
    AGENT --> TOOLS
    TOOLS --> CONFIRM
    TOOLS --> FS & PLAID & LITHIC & NEWS
    CRON --> TOOLS
    TOOLS --> OUT
```

**Key decision: one tool layer.** Every capability (read charges, set a reminder, mark to cancel, create a card, plan a refund, place a practice trade, read news) is one TypeScript function in [`lib/tools`](lib/tools). Claude calls it from web and WhatsApp, Vapi calls it over HTTP from a phone call, and the UI and public API call it through routes. One implementation and one set of safety rules for every channel.

### Every action waits for your yes

```mermaid
sequenceDiagram
    autonumber
    actor S as Student
    participant C as Channel (web, WhatsApp, voice)
    participant B as Brix agent (Claude)
    participant T as Tool layer
    participant DB as Firestore

    S->>C: "Make me a card for the Notion trial, $1 limit"
    C->>B: message + verified identity
    B->>T: create_one_time_card(purpose, limit)
    T->>DB: store PENDING action for this channel (10 min)
    T-->>B: "Create a $1.00 single-use card? Reply yes"
    B-->>S: proposal + source labels
    S->>C: "yes"
    Note over C,T: Voice can't confirm money actions.<br/>The student confirms in the app, plus a PIN for cards.
    C->>T: confirmAction (atomic, applied once)
    T->>DB: card issued (Lithic, idempotency key) + activity event
    T-->>S: "Card ending 4242 created. View it in Cards."
```

### The refund planner

```mermaid
flowchart TD
    R["🎓 Refund deposit detected<br/>e.g. PENN STATE BURSAR REFUND"] --> Q{"Any of it<br/>borrowed?"}
    Q -->|loan| W{"Within 120 days<br/>of disbursement?"}
    W -->|yes| RET["↩️ Return unused loan money<br/>cancelled with no interest or fees<br/>shows the return-by date + interest avoided"]
    W -->|no| PAY["💸 Prepay the loan early<br/>shows interest saved"]
    Q -->|grant or scholarship| TAX["🧾 Tax note<br/>money not spent on tuition or books<br/>may be taxable (IRS Pub 970)"]
    RET & PAY & TAX --> E1["Step 1 · Essentials until<br/>the next disbursement"]
    E1 --> E2["Step 2 · Starter emergency buffer"]
    E2 --> E3["Step 3 · Save the rest<br/>optional same-size practice portfolio"]

    style R fill:#F7F5EF,stroke:#292920
    style RET fill:#2F7D4F,color:#fff,stroke:#1F5A38
    style TAX fill:#FFF4DB,stroke:#C9962F
```

Every figure is computed by code from the student's inputs and labelled as an estimate. Brix never assumes a loan rate; the student enters it.

---

## Trust by design

Trust is the FNB brief, so it is built into the architecture rather than added later.

| Principle | How Brix enforces it |
|---|---|
| 🔒 **Never moves money** | Read-only Plaid access. Brix never cancels at a merchant; it records your decision and hands you the cancel link. Investing is practice-only. |
| ✋ **Confirm before acting** | The AI can only *propose*. Proposals are stored per channel, expire after 10 minutes and are applied **exactly once**, even if two confirmations arrive at the same instant (tested). |
| 📞 **Voice can't spend** | A spoken "yes" never applies a change. Card creation from a call needs in-app confirmation **plus a 4-digit PIN** (hashed, and locked for 15 minutes after 5 wrong tries). |
| 🔢 **No invented numbers** | Amounts and dates come from code, never the model. The system prompt forbids personal investment advice. |
| 🏷️ **Every answer cites its source** | Replies carry labels like *Your charges*, *Brix's math (estimate)*, *News: Google News* or *General info, not your data*. Demo data is always marked *(sample)*. |
| 🛡️ **Every request verified** | Firebase ID tokens, Twilio signatures, a Vapi shared secret, a cron secret and SHA-256-hashed, scoped API keys. Firestore rules deny all client writes and every read of secrets. |
| 🧑‍⚖️ **You stay in control** | Full activity log, a bank-disconnect button, revocable API keys and a complete **delete my data** that also removes your bank link and portfolio (verified by the live test). |
| 👀 **Privacy** | Raw transactions are never stored, only detected charges and refunds. The leaderboard shows first names and initials only. |

---

## Why Brix fits the FNB criteria

| FNB asks | Brix shows it with |
|---|---|
| **Information → understanding** | Recurring charges, refunds and gift cards explained in one plain line each |
| **Understanding → confidence** | One "next decision" card, a 14-day timeline, a 120-day refund countdown, practice before real risk |
| **Confidence → action** | One tap, one WhatsApp reply or one phone call to remind, cancel, protect a trial or plan a refund |
| **Moments that matter most** | Reminders 7 and 2 days before a charge, 14 and 3 days before a gift card expires, and as soon as a refund lands |
| **Knowing what to trust** | Source labels on every answer, confirm-before-act, read-only data, no advice, an audit trail |
| **AI, personalization, prediction, automation** | A Claude tool-use agent on the student's own data, next-charge prediction, auto-invest rules, scheduled reminders |

---

## Feature checklist

- [x] Google sign-in, Google One Tap and phone verification (Firebase Auth)
- [x] Plaid sandbox link, transaction sync, recurring-charge detection and next-date prediction
- [x] Free-trial tracking, reminders, mark-to-cancel with merchant cancel links
- [x] Single-use virtual cards (Lithic sandbox) with templates and colours
- [x] Refund detection from bank deposits and a 120-day loan-return planner with tax notes
- [x] Gift card balances, expiry alerts and "use it first" nudges
- [x] Practice portfolio: live prices, fractional shares, stop-loss and take-profit, auto-invest, S&P 500 comparison, price-history chart, coins leaderboard
- [x] Merchant pricing news (Google News) and stock news (Yahoo Finance) with a shared cache and a stale-data fallback
- [x] Claude assistant across web, WhatsApp and phone (Vapi), with source labels on every answer
- [x] Proactive reminders by WhatsApp and outbound phone call (daily cron)
- [x] Public REST API v1 with scoped keys, rate limits, an OpenAPI 3.1 spec and generated docs
- [x] Accessible (axe checks pass on every main screen), responsive, respects reduced motion

---

## Developer API

Brix is also a small platform. Students and other apps can pull Brix data into spreadsheets, Discord bots or dashboards using keys the student creates and revokes.

```bash
curl https://www.usebrix.app/api/v1/charges/upcoming?days=14 \
  -H "Authorization: Bearer $BRIX_API_KEY"
```

| Scope | Grants |
|---|---|
| `charges:read` / `charges:write` | Charges, upcoming charges and the summary; add trials, mark to cancel |
| `reminders:read` / `reminders:write` | List, create and delete reminders |
| `cards:read` | Single-use cards, masked (never card numbers) |
| `news:read` | Pricing news about your merchants |
| `refunds:read` | School refunds and their plans |
| `practice:read` | The practice portfolio: value, positions, rules and orders |

<p align="center"><img src="docs/images/developers.jpg" alt="Brix developer docs: quickstart with curl, JavaScript and Python" width="85%" /></p>

Keys are SHA-256 hashed at rest, shown once, limited to 5 per user and 120 requests per minute. Trial creation is idempotent. Full reference: **[usebrix.app/developers](https://www.usebrix.app/developers)** · [docs/API.md](docs/API.md) · [`/api/v1/openapi.json`](https://www.usebrix.app/api/v1/openapi.json)

---

## Tech stack

| Layer | Choice |
|---|---|
| App | **Next.js 16** (App Router, route groups, persistent app shell), **React 19**, **TypeScript** |
| AI | **Claude Opus 5.5** via the Anthropic SDK: a manual tool-use loop with per-channel time budgets (12s WhatsApp, 10s otherwise) and a server-side fallback model |
| Identity and data | **Firebase Auth** (Google, One Tap, phone) and **Firestore** through the Admin SDK |
| Banking | **Plaid** sandbox (`/transactions/sync`, recurring streams) |
| Cards | **Lithic** sandbox `SINGLE_USE` cards with idempotency keys |
| Voice | **Vapi** assistant on a Twilio number, with tools pointing at `/api/vapi/tools` |
| Messaging | **Twilio** WhatsApp, with signature-validated webhooks |
| Markets and news | **Yahoo Finance** quotes and history, **Google News RSS**, cached in Firestore |
| Hosting | **Vercel** with two cron jobs (reminders daily, practice rules on weekdays) |
| Quality | `node:test`, **Playwright** (desktop + mobile), **axe-core**, a live production smoke test |
| Design | Hand-written CSS design tokens, Figtree and Instrument Serif, Lucide icons, an SVG mascot with moods |

---

## Quality and testing

| Suite | What it covers | Result |
|---|---|---|
| **Unit** (`npm test`) | Recurring detection, refund classifier and planner maths, the order engine, the confirmation model, RSS parsing, quotes and history parsing, leaderboard scoring, API keys | **71 / 71 passing** |
| **Browser** (`npm run test:e2e`) | Every screen on desktop and mobile, the chat, cards, refunds, practice, the API, keyboard shortcuts, accessibility scans, horizontal-overflow checks | **150+ passing** |
| **Live smoke** (`scripts/smoke-live.mts`) | 44 steps against **production** with a throwaway account: Plaid sync, refund detection, Claude replies with sources, Lithic, signed WhatsApp and voice webhooks, live-price trades, price history, leaderboard, news, crons, then full data deletion | **44 / 44 passing** |

---

## Run it locally

Requires **Node 22+**. The local demo needs no API keys; it uses persistent sample data for "Maya", a college sophomore.

```bash
git clone https://github.com/Timeless-Dave/brix.git && cd brix
npm install
cp .env.example .env.local      # demo mode is on by default
npm run dev                     # http://localhost:3000
```

```bash
npm run lint && npm run typecheck
npm test                        # unit tests
npm run test:e2e                # production build + Playwright
npm run check:config            # which live integrations are configured (never prints secrets)
```

To connect real sandbox providers (Firebase, Plaid, Anthropic, Twilio, Vapi, Lithic), follow **[SETUP.md](SETUP.md)** and **[INTEGRATIONS.md](INTEGRATIONS.md)**.

> [!IMPORTANT]
> `BRIX_DEMO_MODE` and `NEXT_PUBLIC_BRIX_DEMO_MODE` must both be `false` in production. Demo mode refuses to turn on in a Vercel production deployment.

<details>
<summary><b>Project structure</b></summary>

```
brix/
├─ app/
│  ├─ page.tsx                    # Landing page
│  ├─ (workspace)/                # The signed-in app: one persistent shell
│  │  ├─ layout.tsx               #   renders the app shell once for every page
│  │  ├─ dashboard/ subscriptions/ cards/ refunds/ practice/
│  │  └─ connect/ settings/ developer/ admin/
│  ├─ developers/                 # Public API docs (generated from the OpenAPI spec)
│  ├─ onboarding/                 # Guided setup
│  └─ api/                        # 53 route handlers
│     ├─ agent/ whatsapp/ vapi/   #   the three assistant channels
│     ├─ plaid/ cards/ trials/ refunds/ gift-cards/ practice/ market/ news/
│     ├─ jobs/                    #   cron: reminders, practice rules
│     └─ v1/                      #   public REST API
├─ lib/
│  ├─ agent/                      # Claude loop, system prompt, tool schemas, moods, source labels
│  ├─ tools/                      # THE shared tool layer (web, WhatsApp, voice, API)
│  ├─ refunds/                    # detection + 120-day planner
│  ├─ practice/                   # order engine, rules, leaderboard
│  ├─ market/ news/               # quotes, history, RSS, cache
│  ├─ api/                        # API keys, scopes, OpenAPI spec
│  └─ store.ts                    # Firestore transactions (local files in demo mode)
├─ components/                    # App shell, sidebar, ticker, cards studio, practice, chat, brand
├─ tests/                         # unit tests + Playwright browser tests
├─ scripts/                       # live smoke test, config check, Vapi tool export, seeding
└─ docs/                          # API reference, Devpost write-up, pitch script, Vapi prompt
```

</details>

---

## Business model

| Stream | How it works |
|---|---|
| **Free core** | Bank link, charge detection, in-app reminders, refund planner, practice portfolio |
| **Brix Plus** (to validate) | WhatsApp and phone reminders, one-time cards, news briefings, at a student price |
| **Bank and credit-union white-label** | Banks such as FNB embed Brix's assistant in their own app to win and keep young customers |
| **Interchange** | A share of the card fee when Brix issues real one-time cards through a sponsor bank |
| **API** | Paid tiers for apps that build on Brix data, with each student's permission |

**Go-to-market:** one campus first (student orgs, orientation, financial-aid offices), then bank and credit-union partners near campuses.

## What's next

- Sponsor-bank partnership and compliance review, then real cards and production bank data
- A pilot inside a bank app (white-label)
- Hand-off from practice to low-cost brokers, without Brix ever holding money
- OAuth and webhooks for the API, so other student apps can build on Brix

---

<div align="center">

<img src="public/brix-mark.svg" alt="" width="56" />

**Brix: your money, brick by brick.**

Built in 24 hours at **HackPSU Fall 2026** by **David Adedeji** and Team Brix.

[usebrix.app](https://www.usebrix.app) · [API docs](https://www.usebrix.app/developers) · [Devpost write-up](docs/DEVPOST.md)

</div>
