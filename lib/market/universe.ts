// What students can practice with: broad index funds first, then large,
// well-known companies. A fixed list keeps prices reliable and keeps
// practice away from penny stocks and leveraged products.

export interface Security {
  symbol: string;
  name: string;
  kind: "index fund" | "bond fund" | "stock";
}

export const UNIVERSE: Security[] = [
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "index fund" },
  {
    symbol: "VTI",
    name: "Vanguard Total Stock Market ETF",
    kind: "index fund",
  },
  { symbol: "SPY", name: "SPDR S&P 500 ETF", kind: "index fund" },
  { symbol: "IVV", name: "iShares Core S&P 500 ETF", kind: "index fund" },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100)", kind: "index fund" },
  {
    symbol: "VXUS",
    name: "Vanguard Total International Stock ETF",
    kind: "index fund",
  },
  { symbol: "VT", name: "Vanguard Total World Stock ETF", kind: "index fund" },
  {
    symbol: "SCHD",
    name: "Schwab U.S. Dividend Equity ETF",
    kind: "index fund",
  },
  { symbol: "VUG", name: "Vanguard Growth ETF", kind: "index fund" },
  { symbol: "VTV", name: "Vanguard Value ETF", kind: "index fund" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", kind: "index fund" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", kind: "bond fund" },
  {
    symbol: "AGG",
    name: "iShares Core U.S. Aggregate Bond ETF",
    kind: "bond fund",
  },
  {
    symbol: "SGOV",
    name: "iShares 0-3 Month Treasury Bond ETF",
    kind: "bond fund",
  },
  { symbol: "AAPL", name: "Apple", kind: "stock" },
  { symbol: "MSFT", name: "Microsoft", kind: "stock" },
  { symbol: "NVDA", name: "NVIDIA", kind: "stock" },
  { symbol: "AMZN", name: "Amazon", kind: "stock" },
  { symbol: "GOOGL", name: "Alphabet (Google)", kind: "stock" },
  { symbol: "META", name: "Meta Platforms", kind: "stock" },
  { symbol: "TSLA", name: "Tesla", kind: "stock" },
  { symbol: "BRK-B", name: "Berkshire Hathaway", kind: "stock" },
  { symbol: "JPM", name: "JPMorgan Chase", kind: "stock" },
  { symbol: "V", name: "Visa", kind: "stock" },
  { symbol: "MA", name: "Mastercard", kind: "stock" },
  { symbol: "COST", name: "Costco", kind: "stock" },
  { symbol: "WMT", name: "Walmart", kind: "stock" },
  { symbol: "KO", name: "Coca-Cola", kind: "stock" },
  { symbol: "PEP", name: "PepsiCo", kind: "stock" },
  { symbol: "MCD", name: "McDonald's", kind: "stock" },
  { symbol: "NKE", name: "Nike", kind: "stock" },
  { symbol: "DIS", name: "Disney", kind: "stock" },
  { symbol: "NFLX", name: "Netflix", kind: "stock" },
  { symbol: "SPOT", name: "Spotify", kind: "stock" },
  { symbol: "AMD", name: "AMD", kind: "stock" },
  { symbol: "INTC", name: "Intel", kind: "stock" },
  { symbol: "JNJ", name: "Johnson & Johnson", kind: "stock" },
  { symbol: "PG", name: "Procter & Gamble", kind: "stock" },
  { symbol: "XOM", name: "Exxon Mobil", kind: "stock" },
  { symbol: "UBER", name: "Uber", kind: "stock" },
];

const BY_SYMBOL = new Map(UNIVERSE.map((s) => [s.symbol, s]));
export const BENCHMARK = "VOO";

/** Normalises user input ("brk.b", " voo ") and returns the listed security. */
export function findSecurity(input: unknown): Security | undefined {
  if (typeof input !== "string") return undefined;
  return BY_SYMBOL.get(input.trim().toUpperCase().replace(".", "-"));
}
