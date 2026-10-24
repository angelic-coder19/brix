import type { Metadata } from "next";
import BrixApp from "@/components/BrixApp";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };
export default function Page() {
  return <BrixApp view="admin" />;
}
