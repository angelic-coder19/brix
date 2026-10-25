/* Static product visuals for the landing page. */
import { VirtualCard } from "@/components/brand/VirtualCard";

export function CardStack() {
  return (
    <div className="card-stack" aria-hidden="true">
      <VirtualCard purpose="Notion trial" last4="4242" limit={10} expiry="11/26" tilt={false} />
    </div>
  );
}
