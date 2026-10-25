import { timingSafeEqual } from "node:crypto";

/** True when the request carries CRON_SECRET (Vercel Cron sends it as a bearer token). */
export function isCron(request: Request) {
  const supplied =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ||
      request.headers.get("x-cron-secret") ||
      "",
    expected = process.env.CRON_SECRET;
  return (
    !!expected &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
