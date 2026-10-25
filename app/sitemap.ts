import type { MetadataRoute } from "next";

const site = process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "https://www.usebrix.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: site, changeFrequency: "weekly", priority: 1 },
    { url: `${site}/dashboard`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
