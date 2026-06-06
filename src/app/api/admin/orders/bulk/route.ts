import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { runOrderAction, type OrderAction } from "@/lib/order-actions-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: OrderAction[] = ["approve", "deliver", "cancel"];

function isAction(v: unknown): v is OrderAction {
  return typeof v === "string" && (ACTIONS as string[]).includes(v);
}

type PerOrderResult = {
  id: string;
  ok: boolean;
  status?: string;
  error?: string;
  dispatch?: { ok: boolean; error?: string };
};

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { action?: unknown; ids?: unknown };
  try {
    body = (await request.json()) as { action?: unknown; ids?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAction(body.action)) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
  const action = body.action;

  const ids = Array.isArray(body.ids)
    ? Array.from(
        new Set(body.ids.map((x) => String(x)).filter((x) => x.length > 0))
      )
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }
  if (ids.length > 200) {
    return NextResponse.json({ error: "Too many orders" }, { status: 400 });
  }

  // Run sequentially: each action is a Firestore transaction, and approvals of
  // different orders can contend on the same product stock — serializing keeps
  // the per-order error messages accurate and avoids transaction retries.
  const results: PerOrderResult[] = [];
  for (const id of ids) {
    const r = await runOrderAction(action, id);
    if (r.ok) {
      results.push({ id, ok: true, status: r.status, dispatch: r.dispatch });
    } else {
      results.push({ id, ok: false, error: r.error });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  return NextResponse.json({
    action,
    total: ids.length,
    succeeded,
    failed: ids.length - succeeded,
    results,
  });
}
