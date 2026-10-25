import test from "node:test";
import assert from "node:assert/strict";
import { handleVapiTools } from "../lib/vapi-tools";
import { HttpError } from "../lib/auth";

const call = (id: string, name: string, args: unknown = {}) => ({
  id,
  function: { name, arguments: args },
});
const body = (toolCallList: unknown) => ({
  message: { call: { customer: { number: "+15555550100" } }, toolCallList },
});
test("unrecognized voice callers receive onboarding instructions correlated to each tool", async () => {
  const result = await handleVapiTools(
    body([call("a", "get_subscriptions")]),
    async () => null,
    async () => {
      assert.fail("must not execute for unknown caller");
    },
  );
  assert.equal(result.results[0].toolCallId, "a");
  assert.match(result.results[0].result, /verify this phone number/);
});
test("voice tools resolve identity server-side, preserve ambiguity, and reject malformed arguments", async () => {
  const result = await handleVapiTools(
    body([
      call("a", "get_subscriptions", '{"uid":"someone-else"}'),
      call("b", "set_reminder", "null"),
      call("c", "mark_to_cancel"),
    ]),
    async () => "verified-user",
    async (uid, name) => {
      assert.equal(uid, "verified-user");
      if (name === "mark_to_cancel")
        throw new HttpError(400, "Which one: Spotify, Spotify Family?");
      return { monthlyTotal: 12 };
    },
  );
  assert.match(result.results[0].result, /monthlyTotal/);
  assert.match(result.results[1].result, /must be an object/);
  assert.match(result.results[2].result, /Which one/);
});
test("one Vapi batch cannot silently overwrite a mutation proposal", async () => {
  let executions = 0;
  const result = await handleVapiTools(
    body([call("a", "mark_to_cancel"), call("b", "set_reminder")]),
    async () => "user",
    async () => {
      executions++;
      return { confirmationRequired: true, reply: "Confirm in the app." };
    },
  );
  assert.equal(executions, 1);
  assert.match(result.results[1].result, /Confirm the first voice proposal/);
});
test("invalid voice batches fail as client errors before identity lookup", async () => {
  for (const calls of [[], [null], [call("a", "x"), call("a", "x")]]) {
    await assert.rejects(
      handleVapiTools(
        body(calls),
        async () => {
          assert.fail("must validate first");
        },
        async () => null,
      ),
      (error) => error instanceof HttpError && error.status === 400,
    );
  }
});
