// Article preview images: the publisher's own og:image, fetched server-side
// and cached. Never invented; a story without one simply shows no photo.

const TTL_MS = 6 * 60 * 60 * 1000;
const MAX_BYTES = 300_000;
const cache = new Map<string, { at: number; image: string | null }>();

/** Only public https pages: no IP literals, localhost or credentials. */
export function isPublicHttps(raw: string) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" || u.username || u.password) return false;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return false;
    if (/^[\d.]+$/.test(host) || host.includes(":")) return false;
    return host.includes(".");
  } catch {
    return false;
  }
}

/** Pulls og:image or twitter:image out of a page's HTML. */
export function findPreviewImage(html: string, pageUrl: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const key of ["og:image:secure_url", "og:image", "twitter:image"]) {
    for (const tag of tags) {
      const prop = tag.match(/\b(?:property|name)=["']([^"']+)["']/i)?.[1];
      if (prop?.toLowerCase() !== key) continue;
      const content = tag.match(/\bcontent=["']([^"']+)["']/i)?.[1];
      if (!content) continue;
      try {
        const url = new URL(content.replace(/&amp;/g, "&"), pageUrl).href;
        if (isPublicHttps(url)) return url;
      } catch {}
    }
  }
  return null;
}

async function readCapped(res: Response) {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    size += value.length;
  }
  void reader.cancel().catch(() => {});
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/** The article's preview image, or null. Cached for six hours either way. */
export async function previewImage(
  pageUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const hit = cache.get(pageUrl);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.image;
  let image: string | null = null;
  if (isPublicHttps(pageUrl)) {
    try {
      const res = await fetcher(pageUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
          Accept: "text/html",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(3500),
      });
      if (res.ok && isPublicHttps(res.url || pageUrl))
        image = findPreviewImage(await readCapped(res), res.url || pageUrl);
    } catch {}
  }
  cache.set(pageUrl, { at: Date.now(), image });
  return image;
}
