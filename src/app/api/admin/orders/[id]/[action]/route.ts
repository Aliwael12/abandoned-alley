import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { runOrderAction, type OrderAction } from "@/lib/order-actions-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: OrderAction[] = ["approve", "deliver", "cancel", "refund"];

function isAction(v: string): v is OrderAction {
  return (ACTIONS as string[]).includes(v);
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string; action: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, action } = await ctx.params;
  if (!isAction(action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  const result = await runOrderAction(action, id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json(result);
}
