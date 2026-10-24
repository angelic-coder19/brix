import type { Metadata } from "next";
import BrixApp from "@/components/BrixApp";
export const metadata: Metadata = { title: "One-time cards" };
export default function Page() {
  return <BrixApp view="cards" />;
}
