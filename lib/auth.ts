import { adminAuth } from "./firebase/admin";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const isDemo = () => {
  const on = process.env.BRIX_DEMO_MODE === "true";
  // An accidentally copied local flag must never bypass production identity.
  return on && process.env.VERCEL_ENV !== "production";
};
export async function requireUser(request: Request): Promise<{
  uid: string;
  email?: string;
  phone_number?: string;
  email_verified?: boolean;
}> {
  if (isDemo()) return { uid: "demo-maya", email: "maya@example.com" };
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new HttpError(401, "Sign in to continue.");
  try {
    return await adminAuth().verifyIdToken(token, true);
  } catch {
    throw new HttpError(401, "Your session expired. Please sign in again.");
  }
}
export async function requireAdmin(request: Request) {
  const user = await requireUser(request);
  if (
    !isDemo() &&
    (!user.email_verified ||
      !process.env.ADMIN_EMAILS?.split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .includes(user.email?.toLowerCase() ?? ""))
  )
    throw new HttpError(403, "Admin access required.");
  return user;
}
export function errorResponse(error: unknown) {
  const status =
    error instanceof HttpError
      ? error.status
      : error instanceof SyntaxError
        ? 400
        : 500;
  if (status === 500)
    console.error(
      "Brix request failed:",
      error instanceof Error ? error.message : "unknown error",
    );
  return Response.json(
    {
      error:
        status === 500
          ? "This service is unavailable. Check the server configuration and try again."
          : error instanceof Error
            ? error.message
            : "Invalid request.",
    },
    { status },
  );
}
