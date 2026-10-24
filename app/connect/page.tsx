import type { Metadata } from "next";
import BrixApp from "@/components/BrixApp";
export const metadata: Metadata = { title: "Connections" };
export default function Page() {
  return <BrixApp view="connect" />;
}
