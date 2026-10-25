import { brands, type BrandSlug } from "@/lib/brands";
import { faviconUrl, merchantDomain } from "@/lib/merchant-domains";
import { LogoImage } from "./LogoImage";

const aliases: [RegExp, BrandSlug][] = [
  [/spotify/, "spotify"],
  [/netflix/, "netflix"],
  [/icloud|apple one/, "icloud"],
  [/youtube/, "youtube"],
  [/duolingo/, "duolingo"],
  [/notion/, "notion"],
  [/apple music/, "applemusic"],
  [/apple tv/, "appletv"],
  [/^(hbo )?max\b/, "max"],
];

// Fallback tints for merchants without a mark (Adobe, local gyms, etc.).
const fallback: Record<string, [string, string]> = {
  adobe: ["#fbe3df", "#b3261e"],
};
const tints: [string, string][] = [
  ["#f0eee6", "#4a493f"],
  ["#e4f0e4", "#296847"],
  ["#efdee5", "#8f3b59"],
  ["#e0e9f1", "#40648a"],
  ["#f3ecd8", "#80662e"],
];

export function brandFor(merchant: string): BrandSlug | undefined {
  const m = merchant.toLowerCase();
  return aliases.find(([re]) => re.test(m))?.[1];
}

/**
 * Square merchant tile. In order: our crisp brand mark, the bank's logo, the
 * merchant's site icon, then a tinted initial.
 */
export default function MerchantLogo({
  merchant,
  logoUrl,
  website,
  size = 40,
  className = "",
}: {
  merchant: string;
  logoUrl?: string;
  website?: string;
  size?: number;
  className?: string;
}) {
  const slug = brandFor(merchant);
  const style = { width: size, height: size };
  if (slug) {
    const b = brands[slug];
    return (
      <span className={`merchant-logo ${className}`} style={style} aria-hidden>
        <svg
          viewBox="0 0 24 24"
          width={size * 0.52}
          height={size * 0.52}
          fill={b.hex}
        >
          <path d={b.path} />
        </svg>
      </span>
    );
  }
  const initial = (
    <Initial merchant={merchant} size={size} className={className} />
  );
  const domain = merchantDomain(merchant, website);
  const src = logoUrl ?? (domain ? faviconUrl(domain) : undefined);
  if (src)
    return (
      <LogoImage
        src={src}
        size={size}
        className={className}
        fallback={initial}
      />
    );
  return initial;
}

function Initial({
  merchant,
  size,
  className,
}: {
  merchant: string;
  size: number;
  className: string;
}) {
  const style = { width: size, height: size };
  const key = merchant.toLowerCase().split(/\s/)[0];
  const [bg, fg] =
    fallback[key] ??
    tints[
      [...merchant].reduce((a, c) => a + c.charCodeAt(0), 0) % tints.length
    ];
  return (
    <span
      className={`merchant-logo merchant-logo--initial ${className}`}
      style={{ ...style, background: bg, color: fg, fontSize: size * 0.42 }}
      aria-hidden
    >
      {merchant.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Monochrome brand mark for logo rows. */
export function BrandMark({
  slug,
  size = 22,
}: {
  slug: BrandSlug;
  size?: number;
}) {
  const b = brands[slug];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      role="img"
      aria-label={b.title}
    >
      <path d={b.path} />
    </svg>
  );
}
