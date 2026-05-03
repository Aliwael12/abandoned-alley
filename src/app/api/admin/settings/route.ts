import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { getShippingFee, setShippingFee } from "@/lib/settings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const shippingFee = await getShippingFee();
  return NextResponse.json({ shippingFee });
}

export async function PUT(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body as { shippingFee?: unknown })?.shippingFee;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return NextResponse.json({ error: "Invalid shipping fee" }, { status: 400 });
  }

  try {
    await setShippingFee(value);
  } catch (err) {
    console.error("setShippingFee failed:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shippingFee: value });
}
