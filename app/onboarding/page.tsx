import type { Metadata } from "next";
import Onboarding from "@/components/onboarding/Onboarding";

export const metadata: Metadata = { title: "Set up Brix" };

export default function Page() {
  return <Onboarding />;
}
