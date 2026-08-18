import type { MetadataRoute } from "next";

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://crosscheck-red.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/guide", "/index", "/wallets", "/airdrop", "/partner", "/privacy"];
  return paths.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "/" ? "always" : "daily",
    priority: path === "/" ? 1 : 0.6,
  }));
}
