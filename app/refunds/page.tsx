import type { Metadata } from "next";
import BrixApp from "@/components/BrixApp";
export const metadata: Metadata = { title: "Refunds" };
export default function Page() {
  return <BrixApp view="refunds" />;
}
