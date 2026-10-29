import { requireUser, errorResponse } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { addIncome } from "@/lib/income";
import { updateState } from "@/lib/store";
import type { IncomeSource } from "@/lib/types";
export const runtime = "nodejs";
/** Adds money in: `kind`, `amount`, `frequency`, optional `receivedOn`. */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    let entry: IncomeSource | undefined;
    await updateState(uid, (s) => {
      entry = addIncome(s, body);
    });
    return Response.json({ income: entry }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
