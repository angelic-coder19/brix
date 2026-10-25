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
  "Brix tracks subscriptions and free trials for college students. It finds recurring charges through Plaid, reminds you 7 and 2 days before they bill, and lets you cancel by chat after you say yes. It never moves money.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Brix · Subscription and free-trial tracker",
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
    "HackPSU",
  ],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Brix",
    title: "Brix · Catch the charge before it catches you",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Brix · Catch the charge before it catches you",
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
