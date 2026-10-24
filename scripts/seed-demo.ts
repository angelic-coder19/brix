import { demoState, saveState } from "../lib/store";
const uid =
  process.argv[2] ??
  (process.env.BRIX_DEMO_MODE === "true" ? "demo-maya" : undefined);
if (!uid)
  throw new Error(
    "Provide the Firebase UID to seed, or set BRIX_DEMO_MODE=true for local sample data.",
  );
saveState(uid, demoState(uid))
  .then(() => console.log(`Seeded clearly labeled sample charges for ${uid}.`))
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
