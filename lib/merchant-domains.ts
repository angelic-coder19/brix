// Website domains for subscriptions students often add by hand, so a manual
// trial still gets its logo. Bank-linked charges use Plaid's own logo instead.
const DOMAINS: [RegExp, string][] = [
  [/linkedin/, "linkedin.com"],
  [/chegg/, "chegg.com"],
  [/hulu/, "hulu.com"],
  [/disney/, "disneyplus.com"],
  [/prime video|amazon prime|^amazon/, "amazon.com"],
  [/audible/, "audible.com"],
  [/canva/, "canva.com"],
  [/grammarly/, "grammarly.com"],
  [/quizlet/, "quizlet.com"],
  [/adobe/, "adobe.com"],
  [/chatgpt|openai/, "openai.com"],
  [/claude|anthropic/, "claude.ai"],
  [/planet fitness/, "planetfitness.com"],
  [/peacock/, "peacocktv.com"],
  [/paramount/, "paramountplus.com"],
  [/crunchyroll/, "crunchyroll.com"],
  [/xbox|game pass/, "xbox.com"],
  [/playstation/, "playstation.com"],
  [/nintendo/, "nintendo.com"],
  [/uber/, "uber.com"],
  [/doordash|dashpass/, "doordash.com"],
  [/instacart/, "instacart.com"],
  [/microsoft|office 365/, "microsoft.com"],
  [/google one|youtube premium/, "google.com"],
  [/dropbox/, "dropbox.com"],
  [/github/, "github.com"],
  [/coursera/, "coursera.org"],
  [/masterclass/, "masterclass.com"],
  [/headspace/, "headspace.com"],
  [/calm/, "calm.com"],
  [/starbucks/, "starbucks.com"],
  [/target/, "target.com"],
  [/walmart/, "walmart.com"],
  [/^apple\b/, "apple.com"],
];

const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/;

/** A merchant's website domain: the bank's when known, otherwise our list. */
export function merchantDomain(merchant: string, website?: string) {
  const site = website
    ?.toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  if (site && DOMAIN.test(site)) return site;
  const m = merchant.toLowerCase();
  return DOMAINS.find(([re]) => re.test(m))?.[1];
}

/** Only Plaid's logo CDN is trusted for bank-provided logo URLs. */
export function safeLogoUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)plaid\.com$/.test(u.hostname)
      ? u.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export const faviconUrl = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`;
