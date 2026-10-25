import type { MetadataRoute } from "next";

const site = process.env.APP_URL?.startsWith("http") ? process.env.APP_URL : "https://www.usebrix.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
