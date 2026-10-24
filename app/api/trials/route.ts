import { randomUUID } from "node:crypto";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { updateState } from "@/lib/store";
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await request.json();
    const merchant =
      typeof body.merchant === "string" ? body.merchant.trim() : "";
    const nextDate = body.endDate ?? body.nextDate;
    const amount = Number(body.amount);
    if (
      !merchant ||
      merchant.length > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(nextDate ?? "") ||
      !Number.isFinite(Date.parse(nextDate)) ||
      new Date(nextDate).toISOString().slice(0, 10) !== nextDate ||
      nextDate < new Date().toISOString().slice(0, 10) ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      amount > 100000
    )
      throw new HttpError(
        400,
        "Enter a name, a future end date, and a valid price.",
      );
    const charge = {
      id: randomUUID(),
      kind: "trial" as const,
      merchant,
      amount: Math.round(amount * 100) / 100,
      frequency: "monthly" as const,
      lastDate: null,
      nextDate,
      status: "trial" as const,
      source: "manual" as const,
    };
    await updateState(uid, (state) => {
      state.charges.push(charge);
      state.events.push({
        id: randomUUID(),
        type: "trial_added",
        channel: "web",
        text: `Added ${merchant} trial.`,
        createdAt: new Date().toISOString(),
      });
    });
    return Response.json({ charge }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
