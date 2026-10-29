import type { Metadata, Viewport } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});

const siteUrl = process.env.APP_URL?.startsWith("http")
  ? process.env.APP_URL
  : "https://www.usebrix.app";
const description =
  "Built by Gen Z, for Gen Z. Build investing reps with practice money, give your school refund a game plan, and keep cards and subscriptions in one wallet. Real trades happen with your broker.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Brix · Your money, your move",
    template: "%s · Brix",
  },
  description,
  applicationName: "Brix",
  manifest: "/manifest.webmanifest",
  keywords: [
    "subscription tracker",
    "free trial reminder",
    "student budgeting",
    "money assistant",
    "Gen Z finance",
    "practice investing",
    "school refunds",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Brix",
    title: "Brix · Your money, your move",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Brix · Your money, your move",
    description,
  },
  other: {
    "facebook-domain-verification": "ahqdg4ikey59filxc4cwlkbey97keg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={figtree.variable}>
      <body>{children}</body>
    </html>
  );
}
