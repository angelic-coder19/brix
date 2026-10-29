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

/** Broker home pages, for places with no ticker in context (Connections). */
export function brokerHomes(): BrokerLink[] {
  return [
    { broker: "Robinhood", url: "https://robinhood.com/us/en/" },
    { broker: "Fidelity", url: "https://www.fidelity.com/" },
    { broker: "Cash App", url: "https://cash.app/investing" },
  ];
}
