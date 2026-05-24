import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  getDefaultSizeChartHandle,
  getShippingFees,
  setDefaultSizeChartHandle,
  setShippingFees,
} from "@/lib/settings-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [fees, defaultSizeChartHandle] = await Promise.all([
    getShippingFees(),
    getDefaultSizeChartHandle(),
  ]);
  return NextResponse.json({
    metroShippingFee: fees.metro,
    outerShippingFee: fees.outer,
    defaultSizeChartHandle,
  });
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

  const b = (body ?? {}) as {
    metroShippingFee?: unknown;
    outerShippingFee?: unknown;
    defaultSizeChartHandle?: unknown;
  };
  const metro = Number(b.metroShippingFee);
  const outer = Number(b.outerShippingFee);
  const hasDefaultChart = b.defaultSizeChartHandle !== undefined;
  const defaultSizeChartHandle =
    typeof b.defaultSizeChartHandle === "string"
      ? b.defaultSizeChartHandle.trim()
      : "";
  if (!Number.isFinite(metro) || metro < 0) {
    return NextResponse.json(
      { error: "Invalid Cairo/Giza shipping fee" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(outer) || outer < 0) {
    return NextResponse.json(
      { error: "Invalid other-governorates shipping fee" },
      { status: 400 }
    );
  }

  try {
    await setShippingFees({ metro, outer });
    if (hasDefaultChart) {
      await setDefaultSizeChartHandle(defaultSizeChartHandle || null);
    }
  } catch (err) {
    console.error("setShippingFees failed:", err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    metroShippingFee: metro,
    outerShippingFee: outer,
    ...(hasDefaultChart ? { defaultSizeChartHandle: defaultSizeChartHandle || null } : {}),
  });
}
