"use client";
import { InvestingNewsPanel } from "./practice/InvestingNews";
import type { RequestFn } from "./brix/useBrixChat";
export function OverviewNews({ request }: { request: RequestFn }) {
  return (
    <div className="overview-news">
      <InvestingNewsPanel request={request} title="Your market rundown" />
    </div>
  );
}
