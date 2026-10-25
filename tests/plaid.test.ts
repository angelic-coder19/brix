import { test } from "node:test";
import assert from "node:assert/strict";
import { syncPlaid } from "../lib/plaid";
import {
  setSecret,
  getSecret,
  getState,
  updateState,
  deleteData,
} from "../lib/store";
test("Plaid restarts pagination from its original cursor and upserts without undoing cancellation", async () => {
  const uid = `test-plaid-${process.pid}`;
  const originalFetch = global.fetch;
  const previous = {
    demo: process.env.BRIX_DEMO_MODE,
    id: process.env.PLAID_CLIENT_ID,
    secret: process.env.PLAID_SECRET,
  };
  process.env.BRIX_DEMO_MODE = "true";
  process.env.PLAID_CLIENT_ID = "test";
  process.env.PLAID_SECRET = "test";
  try {
    await setSecret(uid, {
      plaidAccessTokens: { item: "test-token" },
      plaidCursors: { item: "original" },
    });
    await updateState(uid, (state) => {
      state.charges.push({
        id: "plaid-stream",
        kind: "subscription",
        merchant: "Example",
        amount: 10,
        frequency: "monthly",
        lastDate: "2026-01-01",
        nextDate: "2026-02-01",
        status: "to_cancel",
        source: "plaid",
      });
    });
    let calls = 0;
    const cursors: string[] = [];
    global.fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/transactions/sync")) {
        const body = JSON.parse(String(init?.body));
        cursors.push(body.cursor);
        calls++;
        if (calls === 1)
          return Response.json({ next_cursor: "intermediate", has_more: true });
        if (calls === 2)
          return Response.json(
            { error_code: "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" },
            { status: 400 },
          );
        return Response.json({ next_cursor: "final", has_more: false });
      }
      return Response.json({
        outflow_streams: [
          {
            stream_id: "stream",
            merchant_name: "Example",
            average_amount: { amount: 12 },
            frequency: "MONTHLY",
            last_date: "2026-01-01",
            predicted_next_date: "2026-02-01",
            is_active: true,
          },
        ],
      });
    };
    assert.deepEqual(await syncPlaid(uid), { synced: 1, refunds: 0 });
    assert.deepEqual(cursors, ["original", "intermediate", "original"]);
    assert.equal((await getSecret(uid)).plaidCursors?.item, "final");
    const charges = (await getState(uid)).charges.filter(
      (c) => c.id === "plaid-stream",
    );
    assert.equal(charges.length, 1);
    assert.equal(charges[0].status, "to_cancel");
    assert.equal(charges[0].amount, 12);
  } finally {
    await deleteData(uid);
    global.fetch = originalFetch;
    for (const [key, value] of [
      ["BRIX_DEMO_MODE", previous.demo],
      ["PLAID_CLIENT_ID", previous.id],
      ["PLAID_SECRET", previous.secret],
    ]) {
      if (value === undefined) delete process.env[key!];
      else process.env[key!] = value;
    }
  }
});
