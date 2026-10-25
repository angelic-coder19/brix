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

test("production never honors the local demo authentication bypass", async () => {
  const previousDemo = process.env.BRIX_DEMO_MODE;
  const previousTarget = process.env.VERCEL_ENV;
  try {
    process.env.BRIX_DEMO_MODE = "true";
    process.env.VERCEL_ENV = "production";
    await assert.rejects(
      requireUser(new Request("https://www.usebrix.app/api/state")),
      (error) => error instanceof HttpError && error.status === 401,
    );
  } finally {
    if (previousDemo === undefined) delete process.env.BRIX_DEMO_MODE;
    else process.env.BRIX_DEMO_MODE = previousDemo;
    if (previousTarget === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previousTarget;
  }
});
