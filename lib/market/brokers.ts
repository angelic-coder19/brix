// Plain links to a broker's own page for a ticker. Brix never logs in,
// places orders, or moves money: the student finishes on the broker's site.

export interface BrokerLink {
  broker: string;
  url: string;
}

/** "BRK-B" is Yahoo's spelling; brokers write "BRK.B". */
const brokerSymbol = (symbol: string) =>
  encodeURIComponent(symbol.toUpperCase().replace("-", "."));

export function brokerLinks(symbol: string): BrokerLink[] {
  const s = brokerSymbol(symbol);
  return [
    { broker: "Robinhood", url: `https://robinhood.com/us/en/stocks/${s}/` },
    {
      broker: "Fidelity",
      url: `https://digital.fidelity.com/prgw/digital/research/quote/dashboard/summary?symbol=${s}`,
    },
    // Cash App has no public page per ticker, so this opens its investing
    // page and the student searches the ticker there.
    { broker: "Cash App", url: "https://cash.app/investing" },
  ];
}

export type Broker = "Robinhood" | "Cash App" | "Fidelity";

export interface BrokerHandoff {
  broker: Broker;
  /** Where "Open" goes: the ticker page when the broker has one. */
  url: string;
  /** Fallback when the ticker page fails to load. */
  homeUrl: string;
  carriesSymbol: boolean;
  /**
   * No broker takes a dollar amount in a public link, so this is always
   * false. The handoff screen says so instead of pretending.
   */
  carriesAmount: false;
  /** Plain steps to finish at the broker, in order. */
  steps: (amount: string, side: "buy" | "sell") => string[];
}

const verb = (side: "buy" | "sell") => (side === "buy" ? "Buy" : "Sell");

/** What the "Buy this stock for real" handoff shows for each broker. */
export function brokerHandoffs(symbol: string): BrokerHandoff[] {
  const links = Object.fromEntries(
    brokerLinks(symbol).map((l) => [l.broker, l.url]),
  );
  const homes = Object.fromEntries(
    brokerHomes().map((l) => [l.broker, l.url]),
  );
  const s = symbol.toUpperCase().replace("-", ".");
  return [
    {
      broker: "Robinhood",
      url: links.Robinhood,
      homeUrl: homes.Robinhood,
      carriesSymbol: true,
      carriesAmount: false,
      steps: (amount, side) => [
        `Robinhood opens on the ${s} page. Log in if it asks.`,
        `Tap ${verb(side)}. If it asks for shares, switch the order to dollars.`,
        `Type ${amount}.`,
        "Review the order in Robinhood before you submit it.",
      ],
    },
    {
      broker: "Cash App",
      url: links["Cash App"],
      homeUrl: homes["Cash App"],
      carriesSymbol: false,
      carriesAmount: false,
      steps: (amount, side) => [
        "Open Cash App and go to the Investing tab.",
        `Search for ${s}.`,
        `Tap ${verb(side)} and type ${amount}.`,
        "Review the order in Cash App before you confirm it.",
      ],
    },
    {
      broker: "Fidelity",
      url: links.Fidelity,
      homeUrl: homes.Fidelity,
      carriesSymbol: true,
      carriesAmount: false,
      steps: (amount, side) => [
        `Fidelity opens on the ${s} quote page. Log in if it asks.`,
        `Choose Trade, then ${verb(side)}.`,
        `Pick dollars as the amount type and type ${amount}.`,
        "Preview the order in Fidelity before you place it.",
      ],
    },
  ];
}

/** Broker home pages, for places with no ticker in context (Connections). */
export function brokerHomes(): BrokerLink[] {
  return [
    { broker: "Robinhood", url: "https://robinhood.com/us/en/" },
    { broker: "Fidelity", url: "https://www.fidelity.com/" },
    { broker: "Cash App", url: "https://cash.app/investing" },
  ];
}
