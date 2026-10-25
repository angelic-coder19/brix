# Brix demo video: recording guide (under 5 minutes)

Devpost asks for: **who you are, why you built it, how you built it, and what's next.** This script covers all four, in that order, as a story.

**Deck:** https://claude.ai/artifact/2XDUSkAowBZCmjDaKxhjKy (10 slides)
**App:** https://www.usebrix.app, signed in to your own account

> The lines below are written the way people talk. You don't have to say them word for word. If a sentence comes out differently, that's fine. Keep the idea and keep moving.

---

## Part 1 · Your account is ready (2-minute check)

Everything the video needs is already in your account on usebrix.app:

| Where | What you'll see |
|---|---|
| **Connections** | A linked sandbox bank. Brix found **Spotify, Netflix, Apple (iCloud), Chegg and Planet Fitness** from it, with their real logos. |
| **Charges** | Those five, plus two free trials: **LinkedIn Premium** ($39.99, ends in 5 days) and **Notion AI** ($10, ends in 20 days). |
| **Refunds** | A **$1,850** "UNIVERSITY BURSAR REFUND" that arrived **Oct 15**, from the bank feed, marked "A mix" with **$1,200 borrowed**. |
| **Overview** | "Your next decision": **"$1,200.00 of your refund is borrowed. Federal loan money you return by Fri, Feb 12 is cancelled with no interest or fees."** |
| **Cards** | Four small gift cards: Target $9.40, Amazon $7.15, Starbucks $10.00 (expires in 10 days), Campus store $12.60. |
| **Invest** | $300 of VOO bought with your $1,000 of virtual money, and a $25 weekly VTI auto-invest rule. |

Before recording:
1. Open **Overview** and click the **×** on the "Setup" pill, if it's there, so the top of the page is clean.
2. **Phone (optional):** call **+1 (870) 395-8999** once to test it. Ask: *"I just got money back from school. What should I do?"*

---

## Part 2 · Set up the Mac

- **Space 1:** the deck, in **Present** mode, full screen. Use **→** or the space bar for the next slide.
- **Space 2:** Chrome, full screen, at `www.usebrix.app/dashboard`.
- **Switch between them:** three-finger swipe, or **Control + ←/→**.
- **Record:** press **⌘ ⇧ 5**, choose **Record Entire Screen**, and set **Options → Microphone** to your mic. Recording the whole screen captures both Spaces as you switch.
- Do one practice run first. Speak slower than feels natural.

---

## Part 3 · The script

Times are approximate. The whole run is about **4:40**. If you're running long, see "If you're running long" at the end.

### 1 · Who I am and why I built it · Deck, slide 1 (Cover) · 0:00–1:00

> Hey, I'm David, and this is Brix, an AI money assistant for college students.
>
> I built it because of two things I watched happen to people around me.
>
> The first was my roommate. The only money left on his card was what he'd saved for his health insurance. He signed up for a one-month free trial of LinkedIn Premium, forgot about it, and it charged him. LinkedIn did refund him, but it took two months of emails and follow-ups. Two months, with his health insurance money stuck.
>
> The second was a friend who showed me about ten gift cards with around ten dollars left on each. He couldn't use any of them. Tax would push the price just past the balance, or the checkout wouldn't let him use a gift card for such a small amount. That's about a hundred dollars just sitting in a drawer.

### 2 · The problem is bigger than my friends · Press → to slide 2 (Problem) · 1:00–1:25

> And it's not just them. Almost half of Americans, and 59% of Gen Z, have paid for a trial they forgot about. There's 27 billion dollars sitting on unused gift cards. A lot of students don't even realize part of their school refund is a loan. And most of us learn investing from social media.
>
> The information is already out there. Nobody warns you at the moment it actually matters.

### 3 · The idea · Press → to slide 3 (Solution) · 1:25–1:35

> So that's what Brix does. It shows up at those moments and gives you one clear next step. Let me show you.

**→ Switch to Chrome (Control + →).**

### 4 · The live demo · App · 1:35–3:20

**Overview.** Point at "Your next decision".

> This is my dashboard. My bank's linked through Plaid, and Brix already found my subscriptions. But up top, it shows the one thing I should deal with right now: twelve hundred dollars of my school refund is actually borrowed. If I give it back by February 12th, it's cancelled. No interest, no fees.

**Click "Plan my refund".** On the Refunds page, type **600** in "Rent, food and bills per month", then click **Make my plan**. Scroll the plan slowly.

> Three quick questions, and Brix makes me a plan: cover my essentials first, keep a small emergency fund, and return the borrowed part before the deadline. And it links to studentaid.gov and the IRS, so I can check where every number comes from.

**Click "Charges" in the sidebar.** Point at LinkedIn Premium.

> Here are the subscriptions it found in my bank: Spotify, Netflix, Chegg. And here's my roommate's problem: a LinkedIn Premium trial that ends in five days. A bank can't see a trial until it charges you, so I added it in two taps. Brix reminds me a week before and two days before, in the app, on WhatsApp, or it'll actually call my phone.

**Click "Cards".** Click the **Free trial** template, then **Review card**. When the chat opens, type **yes** and press Enter.

> And next time I sign up for a trial, I don't use my real card. I pick "Free trial", which gives the card a one-dollar limit. Brix asks me to confirm first; it never does anything without my yes. Done. That trial can't charge me anymore.

Scroll down to the gift cards.

> And here's my friend's problem: little balances on Target, Amazon and Starbucks, all in one place. Brix reminds me before one expires, so I spend it instead of my own money.

**Click "Invest".** Point at the chart, then the leaderboard.

> And before I risk real money, I can practice: virtual money, real prices, auto-invest every week, and a leaderboard where you earn coins for good habits, not lucky bets.

**Optional, about 20 seconds: the phone call.** Put your phone on speaker near the mic and call **+1 (870) 395-8999**. Ask: *"I just got money back from school. What should I do?"* Let it answer, then hang up.

> Same assistant, on a phone call. It knows my refund, and it can't spend anything. I confirm in the app.

### 5 · How I built it · Stay in the app · 3:20–3:45

> Real quick on how it's built. It's a Next.js app on Vercel. Claude is the brain, and it uses the same set of tools whether you're on the website, on WhatsApp through Twilio, or on a phone call through Vapi. Plaid reads your bank data, read-only, so Brix can never move your money. Lithic makes the one-time cards. And there's a public API, so other student apps can build on top of Brix.

**← Switch back to the deck (Control + ←).** Press → until you're on slide 4.

### 6 · Why Brix is different · Slide 4 (Competition) · 3:45–4:00

> Apps like Rocket Money and YNAB exist, but they're built for adults in general, and you pay for the useful parts. None of them catch the refund moment, track your gift cards or let you practice investing.

### 7 · How it makes money · Slides 5 and 6 (Market, Model) · 4:00–4:20

On **Market**:

> There are 19.4 million college students in the US, so the market is big, but we'll start with a pilot on one campus.

Press → to **Model**:

> The basics are free. Brix Plus is $3.99 a month for WhatsApp, calls and the extras. Banks and credit unions, like FNB, can put Brix inside their own app for about a dollar per member a month. Developers pay for the API. And later, real cards earn a small fee on each purchase.

### 8 · What's next · Slide 7 (Plan) · 4:20–4:40

> Next: a pilot on one campus, then ten campuses, then twenty-five with two bank partners.
>
> And one thing I really want to build is for my friend with the ten gift cards: letting you combine those small leftover balances, or split one purchase across a gift card and your own card. So ten cards with ten dollars each turns into a hundred dollars you can actually spend.

### 9 · Close · Press → through slides 8 and 9 to slide 10 (Close) · 4:40–4:50

You can click past Ask and Impact without speaking, or say one line on each (see below).

> Brix: your money, brick by brick. Scan the code to try it at usebrix.app. I'm David Adedeji. Thanks for watching.

**Stop the recording:** click the stop button in the menu bar, or press **⌘ ⌃ Esc**.

---

## Optional lines if you have time

- **Slide 8 · Ask:** "Whatever we win goes straight into Brix: product and security first, then a bank pilot, then a campus launch."
- **Slide 9 · Impact:** "At fifty thousand students, that's millions of dollars kept: trials not charged, loan interest not paid, gift cards actually spent."

## If you're running long

Cut in this order:

1. The phone call (say "it also works over a phone call" instead)
2. The Market slide line
3. The Invest stop in the demo

**Never cut:** your two stories, the refund decision, the $1 trial card, the gift cards, and the future plan.

## If something goes wrong on camera

- **The call is slow or drops:** "I'll skip the call. It's the same assistant you just saw in the chat," and move on.
- **A page loads slowly:** keep talking about what's coming; don't wait in silence.
- **The card confirmation doesn't appear:** say "Brix asks me to confirm before it creates anything," and move to gift cards.

## Sources for the numbers you say

- Forgotten trials: 2024 U.S. survey reported by 9to5Mac (48% overall, 59% Gen Z).
- Gift cards: Bankrate, 2024 (about $27B unspent; 43% of adults hold one).
- Hidden loans: Akers and Chingos, Brookings (28% of first-year borrowers said they had no federal loans).
- Investing: FINRA Foundation and CFA Institute, 2023 (48% of Gen Z investors learned from social media).
- Enrollment: National Student Clearinghouse Research Center, fall 2025 (19.4 million).
- Competitors: public pricing pages, October 2026.
