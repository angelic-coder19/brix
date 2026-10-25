import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  createApiKey,
  deleteApiKeys,
  listApiKeys,
  revokeApiKey,
  RATE_LIMIT_PER_MINUTE,
} from "../lib/api/keys";
import { deleteData, getState } from "../lib/store";
import { openApiDocument, operations } from "../lib/api/openapi";
import * as me from "../app/api/v1/me/route";
import * as charges from "../app/api/v1/charges/route";
import * as upcoming from "../app/api/v1/charges/upcoming/route";
import * as chargeById from "../app/api/v1/charges/[id]/route";
import * as trials from "../app/api/v1/trials/route";
import * as summary from "../app/api/v1/summary/route";
import * as reminders from "../app/api/v1/reminders/route";
import * as reminderById from "../app/api/v1/reminders/[id]/route";
import * as cards from "../app/api/v1/cards/route";

process.env.BRIX_DEMO_MODE = "true";
const base = "https://brix.test/api/v1";
const call = (
  handler: (
    r: Request,
    c?: { params: Promise<Record<string, string>> },
  ) => Promise<Response>,
  secret: string | null,
  path: string,
  init: RequestInit & { params?: Record<string, string> } = {},
) =>
  handler(
    new Request(base + path, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(secret ? { authorization: `Bearer ${secret}` } : {}),
        ...(init.headers as Record<string, string>),
      },
    }),
    { params: Promise.resolve(init.params ?? {}) },
  );

async function withUser(fn: (uid: string) => Promise<void>) {
  const uid = `api-${randomUUID()}`;
  try {
    await getState(uid); // seeds the demo workspace
    await fn(uid);
  } finally {
    await deleteApiKeys(uid);
    await deleteData(uid);
  }
}

test("keys: secret shown once, only hash stored, scopes validated, revocation works", () =>
  withUser(async (uid) => {
    await assert.rejects(
      createApiKey(uid, "", ["charges:read"]),
      /Name the key/,
    );
    await assert.rejects(createApiKey(uid, "x", []), /at least one scope/);
    await assert.rejects(createApiKey(uid, "x", ["money:move"]), /scope/);
    const { key, secret } = await createApiKey(uid, "Laptop script", [
      "charges:read",
    ]);
    assert.match(secret, /^brix_sk_[\w-]{32}$/);
    assert.ok(!JSON.stringify(await listApiKeys(uid)).includes(secret));
    assert.equal((await call(me.GET, secret, "/me")).status, 200);
    await revokeApiKey(uid, key.id);
    assert.equal((await call(me.GET, secret, "/me")).status, 401);
    assert.equal((await listApiKeys(uid)).length, 0);
  }));

test("auth: missing, malformed, and unknown keys get a typed 401", async () => {
  for (const secret of [null, "nope", "brix_sk_unknown"]) {
    const res = await call(me.GET, secret, "/me");
    assert.equal(res.status, 401);
    const body = await res.json();
    assert.equal(body.error.type, "authentication_failed");
    assert.match(body.error.request_id, /^req_/);
  }
});

test("scopes: a read key cannot write and gets 403 insufficient_scope", () =>
  withUser(async (uid) => {
    const { secret } = await createApiKey(uid, "read", ["charges:read"]);
    const listRes = await call(charges.GET, secret, "/charges");
    assert.equal(listRes.status, 200);
    const list = await listRes.json();
    assert.equal(list.object, "list");
    assert.ok(list.data.length > 0);
    assert.equal(list.data[0].object, "charge");
    assert.ok(!("plaidStreamId" in list.data[0]));
    const res = await call(trials.POST, secret, "/trials", {
      method: "POST",
      body: JSON.stringify({
        merchant: "X",
        end_date: "2099-01-01",
        amount: 1,
      }),
    });
    assert.equal(res.status, 403);
    assert.equal((await res.json()).error.type, "insufficient_scope");
    assert.equal((await call(cards.GET, secret, "/cards")).status, 403);
  }));

test("charges: filters, upcoming, get by id, mark to cancel and undo", () =>
  withUser(async (uid) => {
    const { secret } = await createApiKey(uid, "rw", [
      "charges:read",
      "charges:write",
    ]);
    assert.equal(
      (await call(charges.GET, secret, "/charges?status=bogus")).status,
      400,
    );
    const up = await (
      await call(upcoming.GET, secret, "/charges/upcoming?days=7")
    ).json();
    assert.equal(up.days, 7);
    assert.equal(
      (await call(upcoming.GET, secret, "/charges/upcoming?days=900")).status,
      400,
    );
    const first = (await (await call(charges.GET, secret, "/charges")).json())
      .data[0];
    const got = await call(chargeById.GET, secret, `/charges/${first.id}`, {
      params: { id: first.id },
    });
    assert.equal((await got.json()).merchant, first.merchant);
    assert.equal(
      (
        await call(chargeById.GET, secret, "/charges/missing", {
          params: { id: "missing" },
        })
      ).status,
      404,
    );
    const patch = (body: unknown) =>
      call(chargeById.PATCH, secret, `/charges/${first.id}`, {
        method: "PATCH",
        params: { id: first.id },
        body: JSON.stringify(body),
      });
    assert.equal((await patch({ status: "cancelled" })).status, 400);
    assert.equal((await patch({ status: "to_cancel", amount: 0 })).status, 400);
    const marked = await (await patch({ status: "to_cancel" })).json();
    assert.equal(marked.status, "to_cancel");
    assert.match(marked.message, /marked to cancel/);
    assert.equal(
      (await getState(uid)).charges.find((c) => c.id === first.id)?.status,
      "to_cancel",
    );
    assert.equal(
      (await (await patch({ status: "active" })).json()).status,
      "active",
    );
  }));

test("trials: validation, creation, and idempotent retries", () =>
  withUser(async (uid) => {
    const { secret } = await createApiKey(uid, "rw", ["charges:write"]);
    const post = (body: unknown, headers: Record<string, string> = {}) =>
      call(trials.POST, secret, "/trials", {
        method: "POST",
        body: JSON.stringify(body),
        headers,
      });
    for (const body of [
      {},
      { merchant: "A", end_date: "2001-01-01", amount: 1 },
      { merchant: "A", end_date: "2099-02-30", amount: 1 },
    ])
      assert.equal((await post(body)).status, 400);
    assert.equal(
      (
        await post(
          { merchant: "A", end_date: "2099-01-01", amount: 1 },
          { "idempotency-key": "bad key!" },
        )
      ).status,
      400,
    );
    const body = { merchant: "Notion AI", end_date: "2099-01-01", amount: 10 };
    const a = await post(body, { "idempotency-key": "trial-1" });
    assert.equal(a.status, 201);
    const b = await post(body, { "idempotency-key": "trial-1" });
    assert.equal((await a.json()).id, (await b.json()).id);
    await post(body);
    assert.equal(
      (await getState(uid)).charges.filter((c) => c.merchant === "Notion AI")
        .length,
      2,
    );
  }));

test("reminders: create by merchant, list, delete; summary shape", () =>
  withUser(async (uid) => {
    const { secret } = await createApiKey(uid, "rem", [
      "reminders:read",
      "reminders:write",
      "charges:read",
    ]);
    const charge = (await getState(uid)).charges.find(
      (c) => c.merchant === "Duolingo",
    )!;
    const make = (body: unknown) =>
      call(reminders.POST, secret, "/reminders", {
        method: "POST",
        body: JSON.stringify(body),
      });
    assert.equal((await make({ merchant: "Duolingo" })).status, 400);
    assert.equal((await make({ when: "2 days before" })).status, 400);
    assert.equal(
      (await make({ charge_id: "nope", when: "2 days before" })).status,
      404,
    );
    assert.equal(
      (await make({ merchant: "Duolingo", when: "2001-01-01" })).status,
      400,
    );
    const created = await make({ merchant: "duolingo", when: "2 days before" });
    assert.equal(created.status, 201);
    const r = await created.json();
    assert.equal(r.charge_id, charge.id);
    assert.equal(r.status, "pending");
    const listed = await (
      await call(reminders.GET, secret, "/reminders")
    ).json();
    assert.ok(listed.data.some((x: { id: string }) => x.id === r.id));
    const del = await call(reminderById.DELETE, secret, `/reminders/${r.id}`, {
      method: "DELETE",
      params: { id: r.id },
    });
    assert.equal(del.status, 204);
    assert.equal(
      (
        await call(reminderById.DELETE, secret, "/reminders/x", {
          method: "DELETE",
          params: { id: "x" },
        })
      ).status,
      404,
    );
    const s = await (await call(summary.GET, secret, "/summary")).json();
    assert.equal(s.object, "summary");
    assert.ok(s.monthly_subscription_total > 0);
  }));

test("rate limit: requests past the per-minute limit get 429 with Retry-After", () =>
  withUser(async (uid) => {
    const { secret } = await createApiKey(uid, "busy", ["charges:read"]);
    let last: Response | undefined;
    for (let i = 0; i <= RATE_LIMIT_PER_MINUTE; i++)
      last = await call(me.GET, secret, "/me");
    assert.equal(last!.status, 429);
    assert.equal(last!.headers.get("retry-after"), "60");
    assert.equal((await last!.json()).error.type, "rate_limited");
  }));

test("openapi: every operation has a route, a scope that exists, and responses", () => {
  const doc = openApiDocument("https://brix.test");
  assert.equal(doc.openapi, "3.1.0");
  assert.equal(doc.servers[0].url, "https://brix.test/api/v1");
  for (const op of operations) {
    const entry = doc.paths[op.path][op.method] as { responses: object };
    assert.ok(Object.keys(entry.responses).length >= 2, op.path);
  }
  assert.equal(
    new Set(operations.map((o) => `${o.method} ${o.path}`)).size,
    operations.length,
  );
});
