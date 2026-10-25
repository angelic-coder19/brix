import { toolSchemas } from "../lib/agent/toolSchemas";

// No env loading: this export must never contain webhook credentials.
const origin = process.argv[2];
if (!origin) throw new Error("Usage: npm run vapi:tools -- https://YOUR_APP");
const url = new URL(origin);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
)
  throw new Error(
    "Use a public HTTPS origin without credentials, query, or fragment.",
  );
console.log(
  JSON.stringify(
    toolSchemas.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
      server: { url: `${url.origin}/api/vapi/tools` },
    })),
    null,
    2,
  ),
);
