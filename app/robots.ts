import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = "https://www.crosscheck.markets";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/mod", "/api/mod/", "/api/cron/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
