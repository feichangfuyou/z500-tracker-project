import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const site = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://crosscheck-red.vercel.app";

const title = "Crosscheck — unofficial ansem.io launch tracker";
const description =
  "Crosscheck is an unofficial tracker for coins launching on ansem.io. See market cap, on-chain $ANSEM burns, wallet checks, and warning flags. Not built or endorsed by ansem.io.";

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: { default: title, template: "%s — Crosscheck" },
  description,
  applicationName: "Crosscheck",
  openGraph: {
    title,
    description,
    type: "website",
    siteName: "Crosscheck",
    locale: "en_US",
    url: "/",
  },
  twitter: { card: "summary_large_image", title, description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080c",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-dvh bg-bg font-sans text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:border focus:border-accent focus:bg-accent focus:px-3 focus:py-2 focus:text-void"
        >
          Skip to content
        </a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
