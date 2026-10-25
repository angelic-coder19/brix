import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addTrial } from "@/lib/trials";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const charge = await addTrial(uid, "web", await readJsonObject(request));
    return Response.json({ charge }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
