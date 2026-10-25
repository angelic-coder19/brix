import { createPrivateKey } from "node:crypto";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";

// Local-only diagnostics: never print values or provider exception messages.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const required = {
  Firebase: [
    "NEXT_PUBLIC_FIREBASE_API_KEY",
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    "NEXT_PUBLIC_FIREBASE_APP_ID",
    "FIREBASE_ADMIN_PROJECT_ID",
    "FIREBASE_ADMIN_CLIENT_EMAIL",
    "FIREBASE_ADMIN_PRIVATE_KEY",
  ],
  Anthropic: ["ANTHROPIC_API_KEY"],
  Plaid: ["PLAID_CLIENT_ID", "PLAID_SECRET"],
  WhatsApp: [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_WHATSAPP_FROM",
    "NEXT_PUBLIC_WHATSAPP_NUMBER",
    "NEXT_PUBLIC_WHATSAPP_JOIN_CODE",
  ],
  "Inbound voice tools": [
    "VAPI_SERVER_SECRET",
    "NEXT_PUBLIC_VAPI_PHONE_NUMBER",
  ],
  "Cron and admin": ["CRON_SECRET", "ADMIN_EMAILS"],
};
let issues = 0;
for (const [service, keys] of Object.entries(required)) {
  const missing = keys.filter((key) => !process.env[key]?.trim());
  console.log(
    `${service}: ${missing.length ? `missing ${missing.join(", ")}` : "fields present"}`,
  );
  if (missing.length) issues++;
}
const check = (label: string, ok: boolean) => {
  console.log(`${label}: ${ok ? "OK" : "needs attention"}`);
  if (!ok) issues++;
};
check(
  "Firebase project IDs agree",
  !!process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_PROJECT_ID ===
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
);
let validKey = false;
try {
  validKey =
    createPrivateKey(
      process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n") || "",
    ).asymmetricKeyType === "rsa";
} catch {
  /* never expose key/parser output */
}
check("Firebase private key parses", validKey);
check(
  "Cron secret has at least 32 characters",
  (process.env.CRON_SECRET?.length || 0) >= 32,
);
check(
  "Vapi webhook secret has at least 32 characters",
  (process.env.VAPI_SERVER_SECRET?.length || 0) >= 32,
);
let publicOrigin = false;
try {
  const url = new URL(process.env.APP_URL || "");
  publicOrigin =
    url.protocol === "https:" &&
    !["localhost", "127.0.0.1"].includes(url.hostname);
} catch {
  /* report only readiness */
}
check("Public HTTPS APP_URL", publicOrigin);
check(
  "Live mode enabled on server and client",
  process.env.BRIX_DEMO_MODE !== "true" &&
    process.env.NEXT_PUBLIC_BRIX_DEMO_MODE !== "true",
);
const tracked = execFileSync("git", ["ls-files", "-z"], {
  encoding: "utf8",
}).split("\0");
check(
  "No tracked service accounts or private env files",
  !tracked.some(
    (file) =>
      /firebase-adminsdk|service-account/i.test(file) ||
      (/(^|\/)\.env($|\.)/.test(file) && file !== ".env.example"),
  ),
);
console.log(
  "Presence checks do not verify provider access, deployed settings, webhook routing, or message delivery.",
);
if (issues && process.argv.includes("--live")) process.exitCode = 1;
