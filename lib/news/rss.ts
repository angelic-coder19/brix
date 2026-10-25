export interface FeedItem {
  title: string;
  link: string;
  /** ISO timestamp, or "" when the feed gave no usable date. */
  publishedAt: string;
  source: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

export function decodeEntities(text: string) {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === "#")
      return String.fromCodePoint(
        code[1].toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10),
      );
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

function tag(xml: string, name: string) {
  const m = xml.match(
    new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"),
  );
  if (!m) return "";
  const raw = m[1].trim();
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return decodeEntities(cdata ? cdata[1] : raw).trim();
}

/**
 * Minimal RSS 2.0 reader for news feeds (Google News, Yahoo Finance).
 * Google titles end in " - Publisher"; that suffix becomes `source`.
 */
export function parseRss(xml: string): FeedItem[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    let title = tag(item, "title");
    const link = tag(item, "link");
    if (!title || !link) return [];
    let source = tag(item, "source");
    if (source && title.endsWith(` - ${source}`))
      title = title.slice(0, -(source.length + 3)).trim();
    if (!source) {
      try {
        source = new URL(link).hostname.replace(/^www\./, "");
      } catch {
        source = "News source";
      }
    }
    const date = Date.parse(tag(item, "pubDate"));
    return [
      {
        title,
        link,
        publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : "",
        source,
      },
    ];
  });
}
