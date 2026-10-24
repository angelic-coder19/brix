import test from "node:test";
import assert from "node:assert/strict";
import { readJsonObject } from "../lib/http";
import { HttpError } from "../lib/auth";

const req = (body: string) =>
  new Request("http://localhost/api", { method: "POST", body });

async function status(body: string, optional = false) {
  try {
    await readJsonObject(req(body), { optional });
    return 200;
  } catch (error) {
    assert.ok(error instanceof HttpError);
    return error.status;
  }
}

test("readJsonObject accepts plain objects only", async () => {
  assert.deepEqual(await readJsonObject(req('{"a":1}')), { a: 1 });
  assert.equal(await status(""), 400);
  assert.equal(await status("", true), 200);
  assert.equal(await status("{nope"), 400);
  assert.equal(await status("null"), 400);
  assert.equal(await status("[1,2]"), 400);
  assert.equal(await status('"text"'), 400);
  assert.equal(await status("42"), 400);
});

test("readJsonObject rejects bodies over 64KB", async () => {
  assert.equal(await status(JSON.stringify({ m: "x".repeat(70_000) })), 413);
});
