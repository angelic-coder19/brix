import { timingSafeEqual } from "node:crypto";
export function verifyVapi(request: Request) {
  const expected = process.env.VAPI_SERVER_SECRET;
  const supplied =
    request.headers.get("x-vapi-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer /, "") ||
    "";
  return (
    !!expected &&
    Buffer.byteLength(supplied) === Buffer.byteLength(expected) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))
  );
}
