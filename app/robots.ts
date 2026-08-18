import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://crosscheck-red.vercel.app";
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/mod", "/api/mod/", "/api/cron/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
