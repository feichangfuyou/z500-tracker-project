import type { NextConfig } from "next";

const security = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const csp =
  "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' blob:; frame-ancestors 'none'";
const cspEmbed =
  "default-src 'self'; base-uri 'self'; form-action 'self'; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https:; media-src 'self' blob:; frame-ancestors *";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "ipfs.io", pathname: "/ipfs/**" },
      { protocol: "https", hostname: "ansem.io", pathname: "/api/banners/**" },
    ],
  },
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    return [
      {
        source: "/((?!embed/).*)",
        headers: [
          ...security,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [...security, { key: "Content-Security-Policy", value: cspEmbed }],
      },
      {
        source: "/api/public/:path*",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
