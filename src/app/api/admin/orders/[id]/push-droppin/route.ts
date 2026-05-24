import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { pushOrderToDroppin } from "@/lib/orders-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const result = await pushOrderToDroppin(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, trackingNumber: result.trackingNumber });
}
