import type { Metadata } from "next";
import BrixApp from "@/components/BrixApp";
export const metadata: Metadata = { title: "Settings" };
export default function Page() {
  return <BrixApp view="settings" />;
}
