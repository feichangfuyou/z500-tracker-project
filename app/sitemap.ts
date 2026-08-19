import type { MetadataRoute } from "next";

const site = "https://www.crosscheck.markets";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/z500", "/radar", "/guide", "/index", "/wallets", "/airdrop", "/partner", "/privacy"];
  return paths.map((path) => ({
    url: `${site}${path}`,
    changeFrequency: path === "/" ? "always" : "daily",
    priority: path === "/" ? 1 : 0.6,
  }));
}
