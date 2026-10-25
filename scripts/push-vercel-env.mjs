// Copies values from .env.local to the linked Vercel project (Production and Preview).
// Dry run by default; pass --apply to write. Values go through stdin and are never printed.
//   node scripts/push-vercel-env.mjs            # show the plan
//   node scripts/push-vercel-env.mjs --apply    # write it
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

// Deployment-specific values that must differ from local development.
const SKIP = new Set(["APP_URL", "BRIX_DEMO_MODE", "NEXT_PUBLIC_BRIX_DEMO_MODE"]);
// Not secret: keep readable in the Vercel dashboard.
const PLAIN = new Set([
  "ANTHROPIC_MODEL",
  "PLAID_ENV",
  "LITHIC_ENV",
  "ADMIN_EMAILS",
  "VAPI_ASSISTANT_ID",
  "VAPI_PHONE_NUMBER_ID",
  "TWILIO_PHONE_NUMBER",
  "TWILIO_WHATSAPP_FROM",
  "FIREBASE_ADMIN_PROJECT_ID",
]);

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (value.length > 1 && value[0] === '"' && value.at(-1) === '"')
    value = value.slice(1, -1);
  env[m[1]] = value;
}

const apply = process.argv.includes("--apply");
let failed = 0;
for (const [name, value] of Object.entries(env)) {
  if (SKIP.has(name)) {
    console.log(`skip  ${name} (set per deployment in the dashboard)`);
    continue;
  }
  if (!value) {
    console.log(`skip  ${name} (empty locally)`);
    continue;
  }
  const sensitive = !(name.startsWith("NEXT_PUBLIC_") || PLAIN.has(name));
  for (const target of ["production", "preview"]) {
    if (!apply) {
      console.log(`plan  ${name} -> ${target}${sensitive ? " (sensitive)" : ""}`);
      continue;
    }
    const r = spawnSync(
      "vercel",
      ["env", "add", name, target, "--force", sensitive ? "--sensitive" : "--no-sensitive"],
      { input: value, encoding: "utf8" },
    );
    if (r.status === 0) console.log(`set   ${name} -> ${target}`);
    else {
      failed++;
      console.log(`FAIL  ${name} -> ${target}: ${(r.stderr || r.stdout).trim().split("\n").at(-1)}`);
    }
  }
}
if (!apply) console.log("\nDry run. Re-run with --apply to write, then redeploy.");
else if (!failed)
  console.log("\nDone. Redeploy so builds pick up NEXT_PUBLIC_* values: vercel deploy --prod");
process.exitCode = failed ? 1 : 0;
