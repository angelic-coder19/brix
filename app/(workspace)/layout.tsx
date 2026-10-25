import type { ReactNode } from "react";
import BrixApp from "@/components/BrixApp";

/**
 * One app shell for every workspace page. Navigating between them keeps the
 * sidebar, header, market ticker and loaded data mounted instead of
 * rebuilding the whole app on each click.
 */
export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <BrixApp />
      {children}
    </>
  );
}
