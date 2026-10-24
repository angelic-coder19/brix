import type { Metadata, Viewport } from "next";
import { Figtree, Instrument_Serif } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
  display: "swap",
});
const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-instrument",
  display: "swap",
});

const siteUrl = process.env.APP_URL?.startsWith("http")
  ? process.env.APP_URL
  : "https://www.usebrix.app";
const description =
  "Brix is a friendly money assistant for college students. It spots recurring charges, flags free trials before they bill, and reminds you on the web, WhatsApp, or a quick call. It never moves your money.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Brix · Your money, brick by brick",
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
    <html lang="en" className={`${figtree.variable} ${instrument.variable}`}>
      <body>{children}</body>
    </html>
  );
}
