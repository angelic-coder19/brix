import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Brix · Your money, brick by brick",
  description:
    "Catch the charge before it catches you. Track subscriptions, protect trials, and talk to your money assistant.",
  manifest: "/manifest.webmanifest",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
