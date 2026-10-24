import { test } from "node:test";
import assert from "node:assert/strict";
import { requireUser, HttpError } from "../lib/auth";
test("demo access is disabled unless explicitly enabled", async () => {
  const previous = process.env.BRIX_DEMO_MODE;
  try {
    delete process.env.BRIX_DEMO_MODE;
    await assert.rejects(
      requireUser(new Request("https://brix.test/api/state")),
      (e) => e instanceof HttpError && e.status === 401,
    );
    process.env.BRIX_DEMO_MODE = "true";
    assert.equal(
      (await requireUser(new Request("https://brix.test/api/state"))).uid,
      "demo-maya",
    );
  } finally {
    if (previous === undefined) delete process.env.BRIX_DEMO_MODE;
    else process.env.BRIX_DEMO_MODE = previous;
  }
});
