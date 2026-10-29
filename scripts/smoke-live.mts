/* eslint-disable @typescript-eslint/no-explicit-any -- loosely typed JSON from live responses */
// Live end-to-end check against real providers. Creates a throwaway Firebase
// user, exercises every feature as that user, then deletes the account.
// Never places calls or sends WhatsApp messages. Costs a few Claude requests.
// Covers refunds (Plaid custom user), the practice portfolio, and live news.
//
//   node --env-file=.env.local --import tsx scripts/smoke-live.mts https://www.usebrix.app
//
// The target must run with demo mode off and the same Firebase project.
import { randomBytes } from "node:crypto";
import twilio from "twilio";
import { adminAuth, adminDb } from "../lib/firebase/admin";

const BASE = (process.argv[2] || "").replace(/\/$/, "");
if (!/^https?:\/\//.test(BASE))
  throw new Error(
    "Usage: smoke-live.mts <base URL, e.g. https://www.usebrix.app>",
  );
const env = process.env;
const results: { step: string; ok: boolean; detail: string }[] = [];
const check = (step: string, ok: boolean, detail = "") => {
  results.push({ step, ok, detail });
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${step}${detail ? ` — ${detail}` : ""}`,
  );
};
const short = (v: unknown) => JSON.stringify(v).slice(0, 140);

const uid = `smoke-${randomBytes(4).toString("hex")}`;
const phone = `+1555555${String(Math.floor(1000 + Math.random() * 8999))}`;
let token = "";

async function call(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
) {
  const res = await fetch(BASE + path, {
    method: init.method ?? (init.body === undefined ? "GET" : "POST"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* TwiML or empty */
  }
  return { status: res.status, data };
}
const chat = async (message: string) =>
  (await call("/api/agent/chat", { body: { message } })).data;
const plaid = async (endpoint: string, body: object) =>
  (
    await fetch(`https://sandbox.plaid.com${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.PLAID_CLIENT_ID,
        secret: env.PLAID_SECRET,
        ...body,
      }),
    })
  ).json();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Identity: a verified-phone test user, signed in with a real ID token.
  await adminAuth().createUser({
    uid,
    displayName: "Smoke Test",
    email: `${uid}@example.com`,
    emailVerified: true,
    phoneNumber: phone,
  });
  const custom = await adminAuth().createCustomToken(uid);
  const signIn = await (
    await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: custom, returnSecureToken: true }),
      },
    )
  ).json();
  token = signIn.idToken;
  check("Firebase sign-in (ID token)", !!token);

  const unauth = await fetch(BASE + "/api/state");
  check("Signed-out request rejected", unauth.status === 401);

  let r = await call("/api/state");
  check(
    "Load account state",
    r.status === 200,
    `charges=${r.data.charges?.length}`,
  );

  r = await call("/api/settings", {
    method: "PATCH",
    body: { displayName: "Smoke", pin: "4821" },
  });
  check(
    "Settings: name, PIN, verified phone linked",
    r.status === 200 && r.data.user?.phoneE164 === phone,
    short(r.data.user?.phoneE164),
  );

  const end = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
  r = await call("/api/trials", {
    body: { merchant: "Smoke Trial Co", endDate: end, amount: 9.99 },
  });
  check("Add a free trial", r.status === 201, r.data.charge?.merchant);

  // Plaid: link token, sandbox item standing in for Plaid Link, exchange, sync.
  r = await call("/api/plaid/link-token", { body: {} });
  check("Plaid link token", r.status === 200 && !!r.data.link_token);
  const pub = await plaid("/sandbox/public_token/create", {
    institution_id: "ins_109508",
    initial_products: ["transactions"],
    options: { override_username: "user_transactions_dynamic" },
  });
  r = await call("/api/plaid/exchange", {
    body: { public_token: pub.public_token },
  });
  check("Plaid exchange", r.status === 200, short(r.data));
  let synced = -1;
  for (let i = 0; i < 6 && synced <= 0; i++) {
    r = await call("/api/plaid/sync", { body: {} });
    synced = r.status === 200 ? r.data.synced : -1;
    if (synced <= 0) await sleep(5000);
  }
  check(
    "Plaid sync finds recurring charges",
    synced > 0,
    `synced=${synced} last=${short(r.data)}`,
  );

  const state = (await call("/api/state")).data;
  const target =
    state.charges.find((c: any) => c.status === "active") ?? state.charges[0];
  check(
    "Charges visible after sync",
    state.charges.length > 1,
    `${state.charges.length} charges`,
  );

  // Assistant (Claude) with tools, proposal, confirmation.
  let turn = await chat("What's coming up in the next 30 days?");
  check(
    "Assistant answers from real data",
    typeof turn.reply === "string" && turn.reply.length > 10,
    short(turn.reply),
  );
  turn = await chat(`Remind me about ${target.merchant} 1 day before`);
  check(
    "Assistant proposes a reminder",
    /remind/i.test(turn.reply || ""),
    short(turn.reply),
  );
  turn = await chat("yes");
  const afterReminder = (await call("/api/state")).data;
  check(
    "Confirmed reminder saved",
    afterReminder.reminders.some((x: any) => x.chargeId === target.id),
    short(turn.reply),
  );

  // Cards: Lithic sandbox, confirmation, close.
  r = await call("/api/cards", {
    body: { purpose: "Smoke test trial", spendLimit: 5 },
  });
  check(
    "Card proposal",
    r.status === 200 && r.data.confirmationRequired === true,
    short(r.data.reply),
  );
  turn = await chat("yes");
  const cards = (await call("/api/cards")).data.cards;
  check(
    "Lithic sandbox card created",
    cards[0]?.source === "lithic" && /^\d{4}$/.test(cards[0]?.last4),
    short(turn.reply),
  );
  r = await call("/api/cards", {
    method: "PATCH",
    body: { id: cards[0]?.id, state: "CLOSED" },
  });
  check(
    "Card closed at Lithic",
    r.status === 200 && r.data.cards?.[0]?.state === "CLOSED",
    short(r.data.error ?? ""),
  );

  // News.
  r = await call("/api/news");
  check(
    "Merchant news",
    r.status === 200 && Array.isArray(r.data.headlines),
    `${r.data.headlines?.length ?? 0} headlines — ${r.data.message ?? r.data.error}`,
  );

  // Voice: Vapi tool route identifies the caller by verified phone.
  const vapi = async (name: string, args: object) =>
    fetch(BASE + "/api/vapi/tools", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-vapi-secret": env.VAPI_SERVER_SECRET!,
      },
      body: JSON.stringify({
        message: {
          call: { customer: { number: phone } },
          toolCallList: [
            { id: "c1", function: { name, arguments: JSON.stringify(args) } },
          ],
        },
      }),
    }).then((x) => x.json());
  let v = await vapi("get_upcoming_charges", { days: 30 });
  check(
    "Voice tools recognise verified caller",
    !/can't find a verified/.test(v.results?.[0]?.result ?? ""),
    short(v.results?.[0]?.result),
  );
  v = await vapi("set_reminder", {
    merchant: "Smoke Trial Co",
    when: "2 days before",
  });
  check(
    "Voice proposes, app must confirm",
    /Confirm this request in the Brix app/.test(v.results?.[0]?.result ?? ""),
    short(v.results?.[0]?.result),
  );
  r = await call("/api/agent/action", {
    body: { name: "confirm_voice_action" },
  });
  const reminded = (await call("/api/state")).data.reminders.length;
  check(
    "Voice action confirmed in app",
    r.status === 200 && reminded >= 1,
    short(r.data.reply),
  );

  // WhatsApp inbound, signed exactly as Twilio signs it. Replies via TwiML only.
  await call("/api/settings", {
    method: "PATCH",
    body: { whatsappOptIn: true },
  });
  const params = {
    From: `whatsapp:${phone}`,
    Body: "What's my next charge?",
    MessageSid: `SM${randomBytes(16).toString("hex")}`,
  };
  const signature = twilio.getExpectedTwilioSignature(
    env.TWILIO_AUTH_TOKEN!,
    `${BASE}/api/whatsapp/webhook`,
    params,
  );
  const wa = await fetch(BASE + "/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
    },
    body: new URLSearchParams(params).toString(),
  });
  const twimlText = await wa.text();
  check(
    "WhatsApp webhook: signature + assistant reply",
    wa.status === 200 &&
      /<Message>/.test(twimlText) &&
      !/couldn't complete/.test(twimlText),
    twimlText
      .replace(/<[^>]+>/g, " ")
      .trim()
      .slice(0, 140),
  );
  const forged = await fetch(BASE + "/api/whatsapp/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": "forged",
    },
    body: new URLSearchParams(params).toString(),
  });
  check("WhatsApp webhook rejects forged signature", forged.status === 401);
  await call("/api/settings", {
    method: "PATCH",
    body: { whatsappOptIn: false },
  });

  // Public API with a real key.
  r = await call("/api/developer/keys", {
    body: {
      name: "smoke",
      scopes: [
        "charges:read",
        "charges:write",
        "reminders:read",
        "reminders:write",
        "cards:read",
        "news:read",
      ],
    },
  });
  const key = r.data.secret;
  check("API key created", r.status === 201 && /^brix_sk_/.test(key ?? ""));
  const api = async (
    path: string,
    method = "GET",
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetch(`${BASE}/api/v1${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: res.status,
      data: res.status === 204 ? null : await res.json(),
    };
  };
  const a1 = await api("/me");
  const a2 = await api("/charges");
  const a3 = await api("/charges/upcoming?days=30");
  const a4 = await api("/summary");
  const t1 = await api(
    "/trials",
    "POST",
    { merchant: "API Trial", end_date: end, amount: 3 },
    { "Idempotency-Key": "smoke-1" },
  );
  const t2 = await api(
    "/trials",
    "POST",
    { merchant: "API Trial", end_date: end, amount: 3 },
    { "Idempotency-Key": "smoke-1" },
  );
  const p1 = await api(`/charges/${t1.data.id}`, "PATCH", {
    status: "to_cancel",
  });
  const rem = await api("/reminders", "POST", {
    charge_id: target.id,
    when: "2 days before",
  });
  const del = await api(
    `/reminders/${encodeURIComponent(rem.data?.id ?? "x")}`,
    "DELETE",
  );
  const a5 = await api("/cards");
  const a6 = await api("/news");
  check(
    "API: me/charges/upcoming/summary",
    [a1, a2, a3, a4].every((x) => x.status === 200),
    `${a2.data.data?.length} charges, monthly $${a4.data.monthly_subscription_total}`,
  );
  check(
    "API: idempotent trial create",
    t1.status === 201 && t1.data.id === t2.data.id,
  );
  check(
    "API: manage link instead of a cancel flag",
    p1.status === 200 &&
      p1.data.status !== "to_cancel" &&
      /merchant/.test(p1.data.message ?? ""),
  );
  check(
    "API: reminder create + delete",
    rem.status === 201 && del.status === 204,
    short(rem.data?.error ?? ""),
  );
  check(
    "API: cards and news",
    a5.status === 200 && a6.status === 200,
    `${a5.data.data?.length} cards, ${a6.data.data?.length} news`,
  );

  // School refund: a Plaid custom sandbox user with an aid refund deposit.
  const refundDay = new Date(Date.now() - 5 * 86400000)
    .toISOString()
    .slice(0, 10);
  const refundItem = await plaid("/sandbox/public_token/create", {
    institution_id: "ins_109508",
    initial_products: ["transactions"],
    options: {
      override_username: "user_custom",
      override_password: JSON.stringify({
        override_accounts: [
          {
            type: "depository",
            subtype: "checking",
            starting_balance: 500,
            transactions: [
              {
                date_transacted: refundDay,
                date_posted: refundDay,
                amount: -2400,
                description: "PENN STATE BURSAR REFUND",
                currency: "USD",
              },
            ],
          },
        ],
      }),
    },
  });
  r = await call("/api/plaid/exchange", {
    body: { public_token: refundItem.public_token },
  });
  let refundsFound = 0;
  for (let i = 0; i < 8 && !refundsFound; i++) {
    const s = await call("/api/plaid/sync", { body: {} });
    refundsFound = s.data.refunds ?? 0;
    if (!refundsFound) await sleep(4000);
  }
  const refunds = (await call("/api/refunds")).data.refunds ?? [];
  const refund = refunds.find((x: any) => /BURSAR/.test(x.descriptor ?? ""));
  check(
    "Refund detected from bank deposit",
    !!refund && refund.amount === 2400,
    short(refunds.map((x: any) => x.descriptor)),
  );
  r = await call(`/api/refunds/${encodeURIComponent(refund?.id ?? "x")}/plan`, {
    body: {
      funding: "mixed",
      loanAmount: 1500,
      loanRate: 6.5,
      loanType: "unsubsidized",
      monthlyLiving: 300,
      monthsUntilNext: 2,
    },
  });
  const steps = r.data.refund?.plan?.steps?.map((x: any) => x.key) ?? [];
  check(
    "Refund plan returns unused loan money in the window",
    steps.includes("return_loan") && !!r.data.refund?.plan?.returnBy,
    short(steps),
  );
  turn = await chat(
    "I just got money back from school. What should I do with it?",
  );
  check(
    "Assistant explains the refund",
    /loan|return|120|borrow/i.test(turn.reply ?? ""),
    short(turn.reply),
  );

  // Gift cards and where-it-came-from labels.
  r = await call("/api/gift-cards", {
    body: {
      merchant: "Target",
      balance: 40,
      expiresOn: new Date(Date.now() + 10 * 86400000)
        .toISOString()
        .slice(0, 10),
    },
  });
  const g = (await call("/api/gift-cards")).data;
  check(
    "Gift card tracked, expiring soon flagged",
    r.status === 201 && g.total === 40 && g.expiringSoon?.length === 1,
    `total $${g.total}`,
  );
  turn = await chat("Do I have any gift cards I should use soon?");
  const lastReply = (await call("/api/state")).data.events.find(
    (e: any) => e.role === "assistant",
  );
  check(
    "Reply cites its sources",
    /gift/i.test(turn.reply ?? "") &&
      (lastReply?.sources ?? []).includes("Your gift cards"),
    short(lastReply?.sources),
  );

  // Practice portfolio at live prices.
  r = await call("/api/practice", { body: { refundId: refund?.id } });
  check(
    "Practice portfolio sized to the refund",
    r.status === 201 && r.data.portfolio?.total === 2400,
    short(r.data.error ?? r.data.portfolio?.total),
  );
  r = await call("/api/practice/orders", {
    body: { symbol: "VOO", side: "buy", amount: 100, clientKey: "smoke-buy" },
  });
  const fill = r.data.order;
  check(
    "Practice buy fills at a live price",
    fill?.status === "filled" && fill.price > 50 && !("sample" in fill),
    short(fill ?? r.data),
  );
  r = await call("/api/practice/rules", {
    body: { symbol: "VTI", amount: 25, cadence: "weekly" },
  });
  check(
    "Auto-invest rule saved",
    r.status === 201,
    short(r.data.rule?.nextRunOn ?? r.data),
  );
  const view = (await call("/api/practice")).data;
  check(
    "Portfolio valued with live quotes",
    view.portfolio?.positions?.[0]?.price > 0 && view.sample === false,
    `total $${view.portfolio?.total}`,
  );
  r = await call("/api/market/history?symbol=VOO&range=1mo");
  check(
    "Price history (Yahoo)",
    r.status === 200 && r.data.points?.length > 10 && !r.data.sample,
    `${r.data.points?.length} closes`,
  );
  r = await call("/api/practice/copy", {
    body: { strategy: "three-fund", amount: 60, clientKey: "smoke-copy" },
  });
  check(
    "Copy trading fills a strategy at live prices",
    r.status === 200 && r.data.filled === 3,
    `${r.data.filled} of 3 filled`,
  );
  r = await call("/api/practice/leaderboard");
  check(
    "Leaderboard ranks you by coins",
    r.status === 200 &&
      r.data.entries?.some((e: any) => e.you && e.coins >= 100),
    `${r.data.players} players`,
  );
  r = await call("/api/market/news?symbols=VOO");
  check(
    "Stock news (Yahoo)",
    r.status === 200 && r.data.headlines?.length > 0,
    `${r.data.headlines?.length} headlines${r.data.stale ? " (stale)" : ""}`,
  );
  r = await call("/api/news");
  check(
    "Merchant news (Google News)",
    r.status === 200 && !r.data.stale,
    `${r.data.headlines?.length} headlines`,
  );
  const owners = (await adminDb().collection("portfolios").get()).docs.map(
    (d) => d.id,
  );
  if (owners.every((id) => id === uid)) {
    const job = await fetch(BASE + "/api/jobs/practice", {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await job.json();
    check(
      "Practice cron runs due rules",
      job.status === 200 && body.filled >= 1,
      short(body),
    );
  } else
    check(
      "Practice cron runs due rules",
      true,
      `skipped: ${owners.length - 1} other portfolio(s) exist`,
    );

  // Cron, only when no real user could receive a message.
  const users = (await adminDb().collection("users").get()).docs.map(
    (d) => d.id,
  );
  if (users.every((id) => id === uid)) {
    const cron = await fetch(BASE + "/api/jobs/reminders", {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    const body = await cron.json();
    check(
      "Cron reminder job",
      cron.status === 200 && body.failed === 0,
      short(body),
    );
  } else
    check(
      "Cron reminder job",
      true,
      `skipped: ${users.length - 1} real user(s) exist`,
    );
}

async function cleanup() {
  if (token) {
    try {
      const r = await call("/api/account", { method: "DELETE" });
      check(
        "Delete account (Plaid removed, data and keys wiped)",
        r.status === 200,
        short(r.data),
      );
    } catch (error) {
      check("Delete account", false, (error as Error).message);
    }
  }
  await adminAuth()
    .deleteUser(uid)
    .catch(() => {});
  const leftovers = await Promise.all([
    adminDb().doc(`users/${uid}`).get(),
    adminDb().doc(`secrets/${uid}`).get(),
    adminDb().doc(`phoneIndex/${phone}`).get(),
    adminDb().collection("apiKeys").where("uid", "==", uid).get(),
    adminDb().doc(`portfolios/${uid}`).get(),
  ]);
  check(
    "No data left behind",
    !leftovers[0].exists &&
      !leftovers[1].exists &&
      !leftovers[2].exists &&
      leftovers[3].empty &&
      !leftovers[4].exists,
  );
}

try {
  await main();
} catch (error) {
  check("Unexpected error", false, (error as Error).message);
} finally {
  await cleanup();
  const failed = results.filter((x) => !x.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exitCode = failed.length ? 1 : 0;
}
