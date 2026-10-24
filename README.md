# Brix — your money, brick by brick

> **HackPSU Fall 2026 · Target track: FNB Challenge — Trust, Decisions & Financial Confidence**
> Also eligible: HackPSU Grand Prize, Nittany AI Challenge (confirm multi-track submission on Discord).

Brix is an AI money assistant for college students that **catches money leaks before they happen** — free trials that turn into charges, forgotten subscriptions, surprise renewals — and lets students act on them from **anywhere**: the web app, a **phone call**, or **WhatsApp**.

Students link a bank (Plaid sandbox for the demo). Brix finds every recurring charge, predicts the next one, and reaches out *a week before* it hits. The student can say "cancel it," "remind me Friday," or "make me a one-time card for this trial" — by voice, text, or tap.

**Brix never moves money and never tells anyone what to buy.** It reads charges, explains them, reminds, and helps the user act. That boundary is the trust story for FNB.

## Implementation status

The runnable Next.js application now includes the landing page, dashboard, trial tracking, charge actions, masked demo cards, connections, settings, and admin reminder controls. Start with [SETUP.md](SETUP.md): `npm install`, `cp .env.example .env.local`, then `npm run dev`. The default example explicitly enables a local demo with persistent sample data; turn both demo flags off for live deployment.

Firebase, Plaid sandbox, OpenAI, Twilio WhatsApp, Vapi tools, and Lithic sandbox integration paths are implemented but require account configuration and provider-backed testing. Voice proposes changes that the signed-in user confirms in the app; voice card confirmation also requires a PIN. Outbound calls and merchant news are not implemented. The sections below are the original product brief, including planned features, rather than a claim that every milestone has shipped.

For this prototype, live state is stored atomically at `users/{uid}.state`, with server-only secrets and phone lookup documents. The UI refreshes state every five seconds. This differs from the proposed subcollection/realtime-listener design below. Raw Plaid transactions are not retained; sync cursors and normalized recurring charges are. Move large histories into subcollections before production use.

---

## Table of contents

1. [The problem and the user](#1-the-problem-and-the-user)
2. [What we build in 24 hours](#2-what-we-build-in-24-hours)
3. [Demo script (3 minutes)](#3-demo-script-3-minutes)
4. [Architecture](#4-architecture)
5. [Tech stack](#5-tech-stack)
6. [Repository structure](#6-repository-structure)
7. [Data model (Firestore)](#7-data-model-firestore)
8. [The agent: one brain, three channels](#8-the-agent-one-brain-three-channels)
9. [API routes](#9-api-routes)
10. [Integrations: setup and gotchas](#10-integrations-setup-and-gotchas)
11. [Design system](#11-design-system)
12. [Screens](#12-screens)
13. [Milestones and timeline](#13-milestones-and-timeline)
14. [Team split](#14-team-split)
15. [Security and trust](#15-security-and-trust)
16. [Business model](#16-business-model)
17. [Judging fit (FNB criteria)](#17-judging-fit-fnb-criteria)
18. [Risks, fallbacks and the cut list](#18-risks-fallbacks-and-the-cut-list)
19. [Environment variables](#19-environment-variables)
20. [Local setup](#20-local-setup)
21. [Devpost submission checklist](#21-devpost-submission-checklist)

---

## 1. The problem and the user

**User:** a college student with a debit or credit card, several subscriptions (streaming, music, apps, gym, software), and a habit of signing up for free trials.

**Problem:** students don't lose money in one big mistake. They lose it in small, silent charges they never decided on:

- A free trial converts to a paid plan because nobody reminded them.
- A subscription they stopped using keeps renewing.
- A price goes up and they never notice.
- The information exists (bank statements, receipts), but it's scattered, and nobody turns it into a decision *at the moment it matters* — the week before the charge.

**FNB's question, our answer:**

| FNB asks | Brix does |
|---|---|
| Turn **information** into **understanding** | Reads bank transactions and finds every recurring charge, in plain words |
| Turn **understanding** into **confidence** | Predicts the next charge and explains it: "Spotify, $11.99, Friday — you played it 2 times this month" |
| Turn **confidence** into **action** | One tap, one text, or one phone call to cancel, set a reminder, or use a one-time card |
| At the **moments that matter** | Reaches out 7 days and 2 days before a charge — not after |

> Team TODO before judging: replace this section's claims with 2–3 numbers from quick hallway interviews at HackPSU ("X of Y students we asked got charged for a trial they forgot"). Use "X of Y," never invented percentages.

---

## 2. What we build in 24 hours

### Must ship (the demo depends on these)

| # | Feature | Done when |
|---|---|---|
| F1 | **Onboarding + auth** | User signs in with Google (Firebase Auth), adds and verifies a phone number |
| F2 | **Plaid sandbox link** | User links a sandbox bank in Plaid Link; transactions sync into Firestore |
| F3 | **Leak detector** | Recurring charges found and shown as "Brix cards" with next date, amount, and a usage note |
| F4 | **Trial tracker** | User adds a free trial manually (name, end date, price after trial); it appears in the timeline |
| F5 | **WhatsApp agent** | User texts the Brix WhatsApp number; agent answers "when's my next charge?" and can set a reminder / mark to cancel |
| F6 | **Voice agent** | User calls the Brix number (Vapi); same answers and actions by voice |
| F7 | **Proactive outreach** | A "run reminders" job sends a WhatsApp message (and optionally places an outbound call) for charges due in ≤7 days |
| F8 | **Dashboard** | Upcoming charges timeline, monthly leak total, "money saved" counter |

### Should ship (high demo value, cut if behind)

| # | Feature | Done when |
|---|---|---|
| S1 | **One-time card** | Agent or UI creates a single-use virtual card (Lithic sandbox) for a free trial; card shown masked in app |
| S2 | **Money news briefing** | Agent answers "anything I should know?" with 2–3 headlines that touch the user's own merchants (e.g., a price hike) |
| S3 | **Brix mascot reactions** | The brick buddy reacts on screen (happy when money saved, worried when a trial is about to convert) |

### Won't ship (roadmap slide only)

Real money movement, real card issuing, automatic cancellation on the merchant's site, email receipt parsing, savings goals, investing.

---

## 3. Demo script (3 minutes)

The demo follows one student, **Maya**, a Penn State sophomore. Every step is live; a screen recording is the backup.

| Time | What happens | What we say |
|---|---|---|
| 0:00 | Landing page, Brix buddy waves | "Students don't go broke in one big mistake. They leak money in small charges they never chose." |
| 0:15 | Maya signs in, links a sandbox bank via Plaid | "Maya links her bank. Brix only reads. It can't move a cent." |
| 0:35 | Dashboard fills: 6 subscriptions, $63/month, next charge Friday | "In seconds Brix finds every recurring charge and when the next one hits." |
| 0:55 | Maya adds a free trial: "Notion AI, ends in 3 days, then $10/mo" | "Free trials are the biggest leak, and banks can't see them until they charge." |
| 1:10 | Admin presses "Run reminders" → Maya's phone gets a WhatsApp from Brix | "Brix reaches out before the charge, not after." |
| 1:25 | Maya replies on WhatsApp: "cancel spotify, remind me about notion friday" | "She answers like she'd text a friend." |
| 1:45 | Dashboard updates live: Spotify marked to cancel with the cancel link; reminder set; "saved" counter counts up | "Every action lands back in the app." |
| 2:00 | Teammate calls the Brix number on speaker: "When's my next charge and can you make me a one-time card for a trial?" | "Or she just calls." |
| 2:30 | Voice agent answers, creates a one-time card; card appears in the app | "That card works once. The trial can never turn into a charge." |
| 2:45 | Close on the saved counter and the brick buddy | "Information to understanding, understanding to confidence, confidence to action. That's Brix." |

**Demo prep:** a seeded Plaid sandbox user with recurring charges, Maya's phone joined to the Twilio WhatsApp sandbox, the Vapi number saved as a contact, Wi-Fi + hotspot backup.

---

## 4. Architecture

```
                          ┌─────────────────────────────┐
   Web / PWA (Next.js) ───►                             │
                          │   Next.js API routes         │
   WhatsApp ──► Twilio ───►   (Vercel, Node runtime)     │──► OpenAI (function calling)
                webhook   │                             │
   Phone ────► Vapi ──────►   /api/agent/*  (shared      │──► Plaid (sandbox)
                tool calls│    tool layer)               │──► Lithic (sandbox, one-time cards)
                          │                             │──► News API
                          └──────────────┬──────────────┘
                                         │ Firebase Admin SDK
                                         ▼
                              Firestore  ·  Firebase Auth
                                         ▲
                     Cron / "Run reminders" button triggers /api/jobs/reminders
                     → Twilio WhatsApp message + optional Vapi outbound call
```

**Key decision: one tool layer.** Every action (get next charges, set reminder, mark cancel, create card, news) is a plain TypeScript function in `lib/tools/`. The WhatsApp agent calls them through OpenAI function calling. The Vapi assistant calls the *same* functions through HTTP tool calls. The web UI calls them through API routes. One implementation, three channels, no drift.

---

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | One codebase for UI and API routes; deploys to Vercel in minutes |
| PWA | `next-pwa` or a hand-written manifest + service worker | Installs on phones for the demo |
| Styling | **Tailwind CSS** | Fast; design tokens as CSS variables |
| Components | **shadcn/ui** (copied in, restyled) | Accessible primitives; we own the styles |
| Animation | **Motion** (formerly Framer Motion) | Page and card transitions, mascot reactions |
| Effects | **React Bits** (reactbits.dev) | CountUp for money, typewriter text, click spark — copy only what we use |
| Icons | **Lucide React**, `strokeWidth={1.7}` | Matches the reference design |
| Auth | **Firebase Auth** (Google sign-in) | Zero backend auth code |
| Database | **Firestore** | Realtime listeners make WhatsApp/voice actions appear live in the UI — great demo moment |
| Server SDK | `firebase-admin` in API routes | Trusted writes, token verification |
| Banking data | **Plaid** (sandbox): Link, `/transactions/sync`, `/transactions/recurring/get` | Real bank-link flow with fake data |
| LLM | **OpenAI** (function calling), model set by `OPENAI_MODEL` | Same provider Vapi uses for voice |
| Voice | **Vapi** assistant + phone number, tools pointed at our API | Natural phone calls in an hour of setup |
| Messaging | **Twilio WhatsApp sandbox** | Works without WhatsApp Business approval |
| Cards | **Lithic sandbox**, card type `SINGLE_USE` | Real single-use card API, no real money |
| News | NewsAPI.org or GNews (free tier), filtered by the user's merchant names | Personal, not generic, news |
| Hosting | **Vercel** | Public HTTPS URL for Twilio and Vapi webhooks |
| Local tunnels | `ngrok` | Webhooks during local dev |

---

## 6. Repository structure

```
brix/
├─ app/
│  ├─ (marketing)/page.tsx              # Landing page
│  ├─ (app)/layout.tsx                  # Authenticated shell + nav
│  ├─ (app)/dashboard/page.tsx          # Timeline, leak total, saved counter
│  ├─ (app)/subscriptions/page.tsx      # All recurring charges + trials
│  ├─ (app)/cards/page.tsx              # One-time cards
│  ├─ (app)/connect/page.tsx            # Phone verify, WhatsApp join, Plaid link
│  ├─ (app)/settings/page.tsx
│  ├─ admin/page.tsx                    # Demo controls: "Run reminders", reset demo
│  └─ api/
│     ├─ plaid/link-token/route.ts
│     ├─ plaid/exchange/route.ts
│     ├─ plaid/sync/route.ts
│     ├─ trials/route.ts
│     ├─ whatsapp/webhook/route.ts      # Twilio inbound
│     ├─ vapi/tools/route.ts            # Vapi tool calls
│     ├─ vapi/events/route.ts           # Vapi end-of-call reports (optional)
│     ├─ jobs/reminders/route.ts        # Proactive outreach
│     └─ cards/route.ts
├─ lib/
│  ├─ firebase/admin.ts                 # firebase-admin init
│  ├─ firebase/client.ts                # client SDK init
│  ├─ plaid.ts
│  ├─ twilio.ts
│  ├─ vapi.ts
│  ├─ lithic.ts
│  ├─ openai.ts
│  ├─ agent/
│  │  ├─ systemPrompt.ts                # Shared persona + guardrails
│  │  ├─ toolSchemas.ts                 # JSON schemas (OpenAI + Vapi)
│  │  └─ runAgent.ts                    # Chat loop for WhatsApp/web
│  ├─ tools/                            # THE shared tool layer
│  │  ├─ getUpcomingCharges.ts
│  │  ├─ getSubscriptions.ts
│  │  ├─ setReminder.ts
│  │  ├─ markToCancel.ts
│  │  ├─ createOneTimeCard.ts
│  │  ├─ getMoneyNews.ts
│  │  └─ getSavedSummary.ts
│  ├─ recurring.ts                      # Normalize Plaid recurring streams
│  ├─ identity.ts                       # Phone number → userId, PIN check
│  └─ format.ts                         # Money/date formatting for voice and text
├─ components/
│  ├─ ui/                               # shadcn components, restyled
│  ├─ brix/BrixBuddy.tsx                # Mascot with moods
│  ├─ brix/Button3D.tsx                 # The slab button
│  ├─ ChargeCard.tsx
│  ├─ Timeline.tsx
│  ├─ LeakMeter.tsx
│  └─ SavedCounter.tsx                  # React Bits CountUp
├─ public/
│  ├─ brix/                             # Mascot PNGs (happy, worried, wave, thumbs-up)
│  └─ manifest.webmanifest
├─ scripts/
│  └─ seed-demo.ts                      # Seeds Maya's demo data
├─ firestore.rules
├─ .env.example
└─ README.md
```

---

## 7. Data model (Firestore)

```
users/{uid}
  displayName: string
  email: string
  phoneE164: string            // "+18145550123", verified
  whatsappOptIn: boolean
  callOptIn: boolean
  pinHash: string              // 4-digit PIN for sensitive voice actions
  createdAt: Timestamp

users/{uid}/plaidItems/{itemId}
  institutionName: string
  cursor: string               // for /transactions/sync
  // accessToken is NOT stored here. See "secrets" below.

secrets/{uid}                   // server-only collection, denied to clients by rules
  plaidAccessTokens: { [itemId]: string }

users/{uid}/charges/{chargeId}   // one doc per recurring stream or trial
  kind: "subscription" | "trial"
  merchant: string             // "Spotify"
  amount: number               // 11.99 (dollars, 2dp)
  frequency: "weekly" | "monthly" | "annual" | "unknown"
  lastDate: string | null      // "2026-10-03"
  nextDate: string             // "2026-11-03"
  status: "active" | "to_cancel" | "cancelled" | "trial"
  source: "plaid" | "manual" | "agent"
  plaidStreamId?: string
  cancelUrl?: string
  usageNote?: string           // optional, e.g. "you opened it 2x this month" (manual for demo)
  updatedAt: Timestamp

users/{uid}/reminders/{reminderId}
  chargeId: string
  remindAt: Timestamp
  channel: "whatsapp" | "call" | "push"
  sent: boolean
  createdBy: "web" | "whatsapp" | "voice"

users/{uid}/cards/{cardId}
  lithicToken: string
  last4: string
  type: "SINGLE_USE"
  purpose: string              // "Notion AI trial"
  spendLimit: number
  state: "OPEN" | "CLOSED" | "PAUSED"
  createdAt: Timestamp

users/{uid}/events/{eventId}     // feed + "saved" math + audit log
  type: "reminder_sent" | "marked_cancel" | "card_created" | "charge_avoided" | "agent_message"
  channel: "web" | "whatsapp" | "voice" | "system"
  amountSaved?: number
  text?: string
  createdAt: Timestamp

phoneIndex/{phoneE164}           // server-only lookup for inbound calls/messages
  uid: string
```

**Saved counter rule:** `amountSaved` is counted only when the user marks a charge to cancel *before* its `nextDate`, or a one-time card blocks a trial conversion. Label it in the UI as "Charges you avoided (estimated)" — never claim money we can't verify.

---

## 8. The agent: one brain, three channels

### System prompt (shared, `lib/agent/systemPrompt.ts`)

```
You are Brix, a friendly money assistant for college students. You help users
see their recurring charges and free trials, and act before money leaves.

Rules:
- You can READ charges and SET reminders, MARK charges to cancel, CREATE one-time
  cards (sandbox), and SHARE money news that touches the user's own merchants.
- You never move money, never give investment advice, never say "buy" or "sell"
  any security, and never guess numbers. If a tool returns nothing, say so.
- Always confirm before an action: repeat what you'll do in one sentence and wait
  for "yes". For voice, creating a card also requires the user's 4-digit PIN.
- Speak plainly. Amounts as "$11.99", dates as "Friday, November 3".
- Keep replies under 2 sentences on voice, under 4 lines on WhatsApp.
- "Mark to cancel" means you flag it and send the cancel link; the user finishes
  cancelling on the merchant's site. Say that clearly.
```

### Tools (`lib/agent/toolSchemas.ts`)

| Tool | Args | Returns | Side effect |
|---|---|---|---|
| `get_upcoming_charges` | `days?: number` (default 14) | list of `{merchant, amount, nextDate, kind}` | none |
| `get_subscriptions` | — | all active charges + monthly total | none |
| `set_reminder` | `merchant: string, when: string` (ISO date or "N days before") | reminder summary | writes `reminders` + `events` |
| `mark_to_cancel` | `merchant: string` | cancel link + amount saved estimate | updates `charges.status`, writes `events` |
| `create_one_time_card` | `purpose: string, spendLimit: number` | `{last4, spendLimit}` | Lithic sandbox call, writes `cards` + `events` |
| `get_money_news` | — | 2–3 headlines with one-line "why it matters to you" | none |
| `get_saved_summary` | — | total avoided this month | none |

Merchant matching is fuzzy (lowercase, strip punctuation, `includes`), and when two charges match the tool returns both so the agent asks which one.

### WhatsApp flow

1. Twilio POSTs to `/api/whatsapp/webhook` (form-encoded: `From`, `Body`).
2. Validate the Twilio signature (`X-Twilio-Signature`) with the auth token.
3. Look up `phoneIndex/{From without "whatsapp:"}` → `uid`. Unknown number → reply with a sign-up link.
4. Load the last ~10 messages for this user (store them in `users/{uid}/events` with `type: "agent_message"`).
5. Run `runAgent()` — an OpenAI chat-completions loop with the tool schemas; execute tool calls server-side with the resolved `uid` (never trust a `uid` from the model).
6. Reply with TwiML `<Response><Message>…</Message></Response>`, or via the Twilio REST API if the loop runs long (Twilio webhook timeout is ~15s; keep tool calls fast).

### Voice flow (Vapi)

1. Create a Vapi assistant in the dashboard: model = OpenAI, the shared system prompt, a short first message ("Hey, it's Brix. What do you want to check?").
2. Add each tool as a Vapi function tool whose server URL is `https://<app>/api/vapi/tools` (same JSON schemas).
3. Attach a phone number (Vapi-provided, or import the team's Twilio number).
4. On each tool call, Vapi POSTs the call object, including the caller's number. Resolve `uid` from `phoneIndex`. Verify Vapi's server secret header before doing anything.
5. Return `{ results: [{ toolCallId, result }] }` with short, speakable strings.
6. **Outbound:** `/api/jobs/reminders` can start a call with Vapi's create-call API (`assistantId`, `phoneNumberId`, `customer.number`), passing the charge in assistant overrides/variables so Brix opens with "Your Notion AI trial ends in 2 days."

### PIN for sensitive voice actions

Caller ID can be spoofed. Reading charges by caller ID is acceptable for the demo; **creating a card requires the 4-digit PIN** set during onboarding (hashed with bcrypt in `users.pinHash`). Say this in the pitch — FNB will care.

---

## 9. API routes

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/plaid/link-token` | Firebase ID token | Create a Plaid Link token |
| POST | `/api/plaid/exchange` | Firebase ID token | Exchange `public_token` → `access_token`, store in `secrets/{uid}` |
| POST | `/api/plaid/sync` | Firebase ID token | `/transactions/sync` + `/transactions/recurring/get` → upsert `charges` |
| POST/GET | `/api/trials` | Firebase ID token | Add / list manual trials |
| POST | `/api/cards` | Firebase ID token | Create a one-time card from the UI |
| POST | `/api/whatsapp/webhook` | Twilio signature | Inbound WhatsApp |
| POST | `/api/vapi/tools` | Vapi secret header | Voice tool calls |
| POST | `/api/vapi/events` | Vapi secret header | Optional: log call summaries to `events` |
| POST | `/api/jobs/reminders` | `CRON_SECRET` header or admin user | Send due reminders (≤7 days, and ≤2 days) |
| POST | `/api/admin/reset-demo` | admin user | Re-seed Maya's data between demos |

All authenticated routes verify the Firebase ID token with `firebase-admin` and use the token's `uid` — never a `uid` from the request body.

---

## 10. Integrations: setup and gotchas

### Plaid (sandbox)
- Create keys at the Plaid dashboard; `PLAID_ENV=sandbox`.
- Link token: `products: ["transactions"]`, `country_codes: ["US"]`.
- Sandbox login in Plaid Link: username `user_good`, password `pass_good`.
- After exchange, call `/transactions/sync` (save the cursor), then `/transactions/recurring/get` for recurring outflow streams; map each stream → a `charges` doc (merchant, average amount, frequency, last/next date).
- **Gotcha:** sandbox data may not include the exact subscriptions we want to show (Spotify, Netflix, etc.), and recurring detection can need several weeks of history. **Fallback built in from hour 1:** `scripts/seed-demo.ts` writes Maya's charges directly, marked `source: "plaid"` only if they came from Plaid — otherwise `source: "manual"`. Never fake the source label in code.

### Twilio WhatsApp (sandbox)
- Console → Messaging → Try it out → WhatsApp sandbox. Each demo phone sends the join code once.
- Set the sandbox's "When a message comes in" URL to `https://<app>/api/whatsapp/webhook`.
- **Gotcha:** outbound messages to a sandbox user only work after they joined, and freeform messages need an active 24-hour session (the user messaged recently). Before the demo, have Maya's phone send "hi" so the proactive message goes through.

### Vapi
- Create the assistant, tools, and phone number in the dashboard (faster than the API for a hackathon).
- Set a server secret and check it on every request.
- **Gotcha:** keep tool responses short and speakable; long JSON makes the voice ramble. Return a sentence, not an object.
- Test outbound calls early — some numbers need verification on trial accounts.

### Lithic (sandbox)
- Sandbox API key; create a card with `type: "SINGLE_USE"` and a `spend_limit` (in cents).
- Store only token, last4 and state. Never show the full PAN in the UI or say it on voice.
- **Fallback:** if the sandbox account isn't approved in time, `createOneTimeCard` returns a mock card with `source: "mock"` and the UI says "Demo card."

### OpenAI
- Chat completions with `tools`; loop until no tool calls or 4 iterations.
- `OPENAI_MODEL` in env so we can swap models without code changes.

### News
- Query the news API with the user's top 3 merchant names + "price" OR "subscription".
- Agent summarizes each headline in one line: why it matters to *this* user. If nothing relevant, say "Nothing that touches your subscriptions today."

---

## 11. Design system

### Direction
Warm, calm, trustworthy — **cream paper, near-black type, one burnt-orange accent**. Inspired by the color contrast of the Bizi deck (color only; nothing else is borrowed). Layout and interaction feel inspired by usebizi.app: clean cards, soft depth, tactile 3D buttons.

### Color tokens (`app/globals.css`)

```css
:root {
  --bg:            #F8F5F0;  /* cream page */
  --surface:       #FFFFFF;  /* cards on cream */
  --surface-muted: #EDE6DD;  /* beige panels, chips */
  --ink:           #1E1A18;  /* near-black text + dark cards */
  --ink-muted:     #5F5852;  /* secondary text */
  --line:          #E3DCD3;  /* borders */
  --accent:        #C8462A;  /* burnt orange — brand, primary actions */
  --accent-press:  #9E3520;  /* button slab / pressed */
  --accent-soft:   #F6DED6;  /* orange tint backgrounds */
  --success:       #2F7D4F;  /* money saved */
  --warning:       #D98A1C;  /* charge in ≤7 days */
  --danger:        #B42318;  /* trial converts tomorrow */
}
```

Rules: orange is for **one** primary action per screen and for the brand. Warnings use `--warning`/`--danger`, not orange, so urgency never looks like branding. Money saved is always `--success`.

Check contrast with a checker before shipping: white text on `--accent`, and `--ink-muted` on `--bg`, must meet WCAG AA for their size.

### Typography

| Use | Font | Weights |
|---|---|---|
| UI + body + headings | **Figtree** (Google Fonts via `next/font/google`) | 400, 500, 600, 800 |
| Accent words in hero headlines | **Instrument Serif** (italic) | 400 |
| Money amounts, card last4, dates in tables | **Geist Mono** | 400, 500 |

```ts
// app/layout.tsx
import { Figtree, Instrument_Serif } from "next/font/google";
import { GeistMono } from "geist/font/mono";
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["italic"], variable: "--font-serif" });
// body: font-family: var(--font-figtree), Arial, sans-serif;
```

Scale: hero 56/60 (800), H1 40/44 (800), H2 28/32 (700), body 16/24 (400), small 14/20, money 32 mono. Tight letter-spacing on big headings (`-0.02em`).

### The 3D slab button (`components/brix/Button3D.tsx`)

```css
.btn-3d {
  font-family: var(--font-figtree);
  font-weight: 600;
  border-radius: 12px;
  padding: 12px 20px;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 4px 0 0 #D2CBC1;          /* the slab */
  transform: translateY(0);
  transition: transform 80ms ease, box-shadow 80ms ease;
}
.btn-3d:hover  { transform: translateY(-1px); box-shadow: 0 5px 0 0 #D2CBC1; }
.btn-3d:active { transform: translateY(4px);  box-shadow: 0 0 0 0 #D2CBC1; }

.btn-3d.primary {
  background: var(--accent);
  border-color: var(--accent-press);
  color: #fff;
  box-shadow: 0 4px 0 0 var(--accent-press);
}
.btn-3d.primary:active { box-shadow: 0 0 0 0 var(--accent-press); }
.btn-3d:focus-visible { outline: 3px solid var(--accent-soft); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .btn-3d { transition: none; } }
```

Use the same slab on chips (smaller: 2px slab) and on the charge cards' action buttons.

### Icons
Lucide React, `strokeWidth={1.7}`, `size={20}`, color via `currentColor`. Common set: `CalendarClock`, `BellRing`, `Scissors` (cancel), `CreditCard`, `PhoneCall`, `MessageCircle`, `Newspaper`, `PiggyBank`, `ShieldCheck`, `Sparkles`.

### Motion and React Bits
Copy only these components into `components/bits/`:
- **CountUp** — saved counter and monthly leak total.
- **Typewriter / TextType** — hero line: "Catch the charge *before* it catches you."
- **Click Spark** — on primary 3D buttons only.
- Optional: a subtle cursor glow on the landing page only (never inside the app).

Motion rules: 150–250ms, ease-out; cards rise 8px on enter; nothing loops forever except the mascot's idle bob (2px, 3s). Respect `prefers-reduced-motion`.

### The Brix buddy (mascot)
A small clay-style **orange brick with a face**, rounded corners, soft studio lighting, cream background — matching the soft 3D look of the deck's mascot without copying it.

Generate 4 poses as transparent PNGs (one image generator, same prompt + pose):
> "A cute 3D clay-render character: a small rounded orange brick (color #C8462A) with a friendly face, big glossy black eyes, tiny smile, short stubby arms and legs, soft studio lighting, subtle texture, transparent background, Pixar-like but simple. Pose: [waving / thumbs up / worried holding a phone / celebrating with confetti]."

Moods in UI: `wave` (landing, empty states), `thumbs` (action done), `worried` (trial converts in ≤2 days), `celebrate` (money saved).

### Layout
- Landing: cream background, hero left (headline + 3D buttons), buddy right on a soft white sphere; dark `--ink` section below for "how it works", like the deck's black card.
- App: left sidebar on desktop, bottom tab bar on mobile (Home, Charges, Cards, Connect). Cards on white, 16px radius, 1px `--line` border, no heavy shadows.

---

## 12. Screens

1. **Landing** — hero, "how it works" (3 steps: link → Brix watches → you act from anywhere), channels row (app / WhatsApp / call), CTA.
2. **Connect** — 3 steps with progress: verify phone, join WhatsApp (shows the join code + QR), link bank (Plaid). Set a 4-digit PIN.
3. **Dashboard** — Leak meter (monthly recurring total), "Next 14 days" timeline, saved counter, buddy with mood, recent activity feed (shows WhatsApp/voice actions live via Firestore listener).
4. **Charges** — list of subscription and trial cards: merchant, amount, next date, status chip, actions: Remind · Mark to cancel · One-time card. "+ Add free trial" button.
5. **Cards** — one-time cards: purpose, last4, limit, state.
6. **Settings** — channels on/off, reminder timing (7 days / 2 days), PIN reset, disconnect bank, delete my data.
7. **Admin (demo only)** — "Run reminders now", "Reset demo", "Call Maya now".

---

## 13. Milestones and timeline

Hacking started **Sat Oct 24, 2:00 PM**. Devpost project must be created by **11:30 PM Saturday**. Submissions close around **2:00 PM Sunday** (confirm the exact time on Discord). Each milestone ends with a demo-able state.

| # | Window | Milestone | Acceptance criteria |
|---|---|---|---|
| M0 | Sat 2:45–3:30 PM | **Accounts + skeleton** | Repo + Vercel deploy live; Firebase project; Plaid, Twilio, Vapi, Lithic, OpenAI, News keys in Vercel env; Tailwind tokens + fonts in place |
| M1 | 3:30–6:00 PM | **Auth + data spine** | Google sign-in; `users`, `charges`, `events` writing; `seed-demo.ts` creates Maya; dashboard renders seeded charges from Firestore |
| M2 | 6:00–8:30 PM | **Plaid live** | Link → exchange → sync → recurring streams upserted into `charges`; fallback seed still works |
| M3 | 6:00–9:00 PM (parallel) | **WhatsApp agent** | Text "what's my next charge?" → correct answer; "remind me about Spotify Friday" → reminder doc + UI updates live |
| M4 | 9:00–11:30 PM | **Voice agent** | Call the Vapi number → asks next charge → correct answer; mark-to-cancel by voice works |
| ✅ | **11:30 PM** | **Devpost project created** | Title, tagline, team members added (fill content later) |
| M5 | 11:30 PM–2:00 AM | **Proactive reminders** | Admin "Run reminders" sends WhatsApp for charges ≤7 days; outbound Vapi call works for ≤2 days |
| M6 | 2:00–5:00 AM | **Trials + one-time cards** | Add trial in UI; `create_one_time_card` works from UI, WhatsApp and voice (with PIN); mock fallback ready |
| M7 | 5:00–8:00 AM | **Design pass** | 3D buttons, mascot moods, CountUp, typewriter hero, mobile layout, reduced motion; no console errors |
| M8 | 8:00–10:00 AM | **News + polish** | `get_money_news` filtered by merchants; empty/error states written; reset-demo works |
| M9 | 10:00 AM–12:00 PM | **Freeze + record** | Feature freeze at 10:00. Record the 3-minute demo video; screenshots; Devpost write-up |
| M10 | 12:00–1:30 PM | **Submit + rehearse** | Devpost submitted with video, repo link, track selection (FNB + Nittany AI + Grand Prize); 3 full rehearsals |

**Sleep:** stagger 2–3 hour naps between 2 AM and 8 AM so someone is always building.

**Rule:** if a milestone is >45 minutes late, apply its fallback (section 18) and move on.

---

## 14. Team split

| Role | Owns | Milestones |
|---|---|---|
| **A — Backend / data** | Firebase admin, Plaid, data model, seed script, reminders job | M1, M2, M5 |
| **B — Agents** | Shared tool layer, OpenAI loop, Twilio webhook, Vapi assistant + tools, PIN | M3, M4, M6 |
| **C — Frontend / design** | Design system, landing, dashboard, charges, cards, mascot, React Bits | M1 UI, M7 |
| **D — Pitch / product** (or shared) | Hallway interviews (3–4 questions), Devpost, demo script, video, slides, business model | M9, M10 |

With 3 people, merge D into C and A.

**Hallway interview (10 minutes, ask 8–10 hackers):**
1. When did you last get charged for something you forgot you signed up for? How much?
2. How do you track your subscriptions today?
3. Would you rather get a reminder by text, call, or app notification? (choose one)
4. Have you ever used a one-time or virtual card?

Log answers as "X of Y" for the pitch.

---

## 15. Security and trust

This is half of the FNB story — build it and say it.

- **Read-only bank access.** Plaid `transactions` only. Brix cannot move money.
- **Secrets server-side.** Plaid access tokens live in a server-only Firestore collection (rules deny all client reads/writes); API keys only in Vercel env vars.
- **Webhook verification.** Twilio signature on every WhatsApp request; Vapi secret on every tool call; `CRON_SECRET` on the jobs route.
- **Identity across channels.** Phone numbers verified at onboarding; `phoneIndex` maps phone → user; PIN required for creating cards by voice.
- **Confirm before acting.** The agent repeats every action and waits for "yes."
- **No advice, no guessing.** The system prompt forbids investment advice and invented numbers; tools return real data or "nothing found."
- **User control.** Disconnect bank and delete-my-data in Settings (delete removes `users/{uid}`, `secrets/{uid}`, `phoneIndex` entry, and calls Plaid `/item/remove`).
- **Audit trail.** Every agent action writes an `events` doc with channel and timestamp, visible to the user in the activity feed.

`firestore.rules` (core):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {
    match /users/{uid}/{document=**} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;            // all writes go through API routes
    }
    match /users/{uid} {
      allow read: if request.auth != null && request.auth.uid == uid;
      allow write: if false;
    }
    match /secrets/{uid}   { allow read, write: if false; }
    match /phoneIndex/{p}  { allow read, write: if false; }
  }
}
```

---

## 16. Business model

Brix earns from four streams. For the pitch, lead with the bank white-label — FNB is a bank and a judge.

| Stream | How it works | Why it fits |
|---|---|---|
| **Freemium** | Free: bank link, leak detector, app reminders. **Brix Plus** (student price, e.g. $3.99/mo — to validate): WhatsApp + phone agent, one-time cards, news briefings | Students pay small amounts for things that visibly save money |
| **Bank / credit union white-label** | Banks license Brix's agent and leak detector inside their own app, branded as theirs | Banks want engaged young customers; Brix is a ready-made "financial confidence" feature |
| **Interchange on Brix cards** | When Brix issues real one-time cards through a sponsor bank, Brix earns a share of the card fee on each purchase | Revenue from the cards students already use for trials |
| **Savings share (optional)** | Small share of charges avoided, capped and opt-in | Aligns price with value; test carefully for trust |

**Unit logic to say out loud (all assumptions, label them):** if Brix catches one unwanted $10–15 charge per student per month, a $3.99 plan pays for itself several times over. Validate with real users before quoting any conversion rate.

**Go-to-market:** campus first (student orgs, hackathons, orientation), then bank/credit-union partnerships near campuses. Real cards and real money movement come only after a sponsor-bank partnership and compliance review.

---

## 17. Judging fit (FNB criteria)

| FNB says | Brix shows it with |
|---|---|
| "Know what to trust" | Read-only data, confirm-before-act, no advice, audit trail, PIN |
| "Information → understanding" | Recurring charges explained in one line each |
| "Understanding → confidence" | Upcoming-charge timeline and leak meter: the user sees the month before it happens |
| "Confidence → action" | One reply or one call to remind, cancel or protect a trial |
| "Moments that matter most" | Outreach 7 days and 2 days before a charge |
| AI, personalized insights, predictive planning, automation | OpenAI agent with tools, merchant-matched news, next-charge prediction, proactive reminders |

**Nittany AI** criteria (clear problem, meaningful AI, creative approach, working prototype, positive impact) are covered by the same demo; mention the multi-channel agent as the creative piece.

---

## 18. Risks, fallbacks and the cut list

| Risk | Signal | Fallback |
|---|---|---|
| Plaid sandbox has no useful recurring data | `/transactions/recurring/get` returns few streams | Seeded Maya data labeled `source: "manual"`; still show the real Plaid Link flow |
| Twilio WhatsApp session expired | Outbound message fails | Maya texts "hi" right before the demo; fallback to SMS from a Twilio number |
| Vapi call fails on venue network | No connection | Play the pre-recorded call clip in the video; show the transcript in the app |
| Lithic sandbox not approved | 401/403 | Mock card labeled "Demo card" |
| LLM picks wrong tool | Wrong answer in testing | Tighten tool descriptions; add 3 few-shot examples in the system prompt |
| Webhook timeouts | Twilio retries / no reply | Reply "Got it, one sec…" immediately, then send the answer via REST |
| Running out of time | Behind at 6:00 AM | Cut in this order: news → mascot moods → outbound calls → one-time cards. **Never cut:** dashboard, WhatsApp agent, voice agent, reminders job |

---

## 19. Environment variables

```bash
# .env.example
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=          # wrap in quotes; replace \n correctly

PLAID_CLIENT_ID=
PLAID_SECRET=
PLAID_ENV=sandbox

OPENAI_API_KEY=
OPENAI_MODEL=                        # a current model with function calling

TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+1XXXXXXXXXX   # sandbox number from Twilio Console

VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_PHONE_NUMBER_ID=
VAPI_SERVER_SECRET=

LITHIC_API_KEY=
LITHIC_ENV=sandbox

NEWS_API_KEY=

CRON_SECRET=
ADMIN_EMAILS=                        # comma-separated, for /admin
APP_URL=https://<your-app>.vercel.app
```

Never commit `.env.local`. Rotate every key after the hackathon.

---

## 20. Local setup

```bash
git clone <repo> && cd brix
npm install
cp .env.example .env.local    # fill in keys
npm run dev                   # http://localhost:3000
npx ngrok http 3000           # paste the https URL into Twilio + Vapi while developing
npx tsx scripts/seed-demo.ts  # seed Maya
```

Deploy: push to `main` → Vercel builds automatically. Update Twilio and Vapi webhook URLs to the Vercel URL before the demo.

---

## 21. Devpost submission checklist

- [ ] Project created by **11:30 PM Saturday**
- [ ] Tracks selected: FNB Challenge, Nittany AI Challenge, Grand Prize (confirm multi-track rules)
- [ ] Tagline: "Catch the charge before it catches you."
- [ ] What it does / how we built it / challenges / what we learned / what's next — written from this README
- [ ] Demo video (≤3 min) uploaded and linked
- [ ] Public GitHub repo with this README; no secrets in history
- [ ] Screenshots: landing, dashboard, WhatsApp chat, voice call transcript, one-time card
- [ ] Hallway interview numbers ("X of Y") in the write-up
- [ ] Every teammate added on Devpost
- [ ] Rehearsed 3 times; backup video on two devices

---

*Built at HackPSU Fall 2026.*
