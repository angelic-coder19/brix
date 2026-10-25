import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { planAndSave } from "@/lib/refunds";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { uid } = await requireUser(request);
    const refund = await planAndSave(
      uid,
      (await params).id,
      await readJsonObject(request, { optional: true }),
    );
    return Response.json({ refund });
  } catch (error) {
    return errorResponse(error);
  }
}
