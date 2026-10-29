import { randomUUID } from "node:crypto";
import { requireUser, errorResponse, HttpError } from "@/lib/auth";
import { readJsonObject } from "@/lib/http";
import { planCopy, STRATEGIES, type MixWeight } from "@/lib/practice/copy";
import { practiceOrder } from "@/lib/practice";
import { mixForCopyId } from "@/lib/practice/leaderboard";
import { updateState } from "@/lib/store";
export const runtime = "nodejs";

/** The ready-made strategies anyone can copy into practice. */
export async function GET(request: Request) {
  try {
    await requireUser(request);
    return Response.json({ strategies: STRATEGIES });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Copies a strategy (`strategy`) or a player's opted-in mix (`player`) into
 * the practice portfolio with `amount` of virtual money. Practice only.
 */
export async function POST(request: Request) {
  try {
    const { uid } = await requireUser(request);
    const body = await readJsonObject(request);
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 5 || amount > 100000)
      throw new HttpError(
        400,
        "Copy between $5 and $100,000 of practice money.",
      );
    let mix: MixWeight[] | null = null,
      from = "";
    if (typeof body.strategy === "string") {
      const s = STRATEGIES.find((x) => x.id === body.strategy);
      if (s) [mix, from] = [s.mix, s.name];
    } else if (typeof body.player === "string" && body.player.length <= 40) {
      mix = await mixForCopyId(body.player);
      from = "a player's mix";
    }
    if (!mix)
      throw new HttpError(404, "That mix isn't available to copy anymore.");
    const plan = planCopy(mix, amount);
    const key =
      typeof body.clientKey === "string" && /^[\w-]{1,60}$/.test(body.clientKey)
        ? body.clientKey
        : randomUUID();
    const orders = [];
    for (const slice of plan)
      orders.push(
        await practiceOrder(uid, {
          symbol: slice.symbol,
          side: "buy",
          amount: slice.amount,
          clientKey: `${key}-${slice.symbol}`.slice(0, 100),
        }),
      );
    const filled = orders.filter((o) => o.status === "filled");
    await updateState(uid, (s) => {
      s.events.unshift({
        id: randomUUID(),
        type: "practice_copy",
        channel: "web",
        text: `Copied ${from} into practice: ${filled.map((o) => o.symbol).join(", ") || "nothing filled"}.`,
        createdAt: new Date().toISOString(),
      });
    });
    return Response.json({ from, orders, filled: filled.length });
  } catch (error) {
    return errorResponse(error);
  }
}
