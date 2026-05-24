import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  getAllSizeCharts,
  getSizeChartByHandle,
  upsertSizeChart,
} from "@/lib/size-charts-server";
import { createBlankSizeChart } from "@/lib/size-charts";
import { getAllProducts } from "@/lib/products-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [charts, products] = await Promise.all([
    getAllSizeCharts(),
    getAllProducts(),
  ]);
  const assigned = new Map<string, string[]>();
  for (const p of products) {
    if (!p.sizeChartId) continue;
    const list = assigned.get(p.sizeChartId) ?? [];
    list.push(p.handle);
    assigned.set(p.sizeChartId, list);
  }
  return NextResponse.json({
    charts: charts.map((c) => ({
      ...c,
      assignedProductHandles: assigned.get(c.handle) ?? [],
    })),
  });
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = String(body.name ?? body.title ?? "").trim() || "New size chart";
  const handleInput = String(body.handle ?? "").trim();
  const handle = slugify(handleInput || title);
  if (!handle) {
    return NextResponse.json({ error: "Could not derive handle" }, { status: 400 });
  }

  const existing = await getSizeChartByHandle(handle);
  if (existing) {
    return NextResponse.json(
      { error: `Size chart "${handle}" already exists` },
      { status: 409 }
    );
  }

  const sizes = Array.isArray(body.sizes)
    ? body.sizes.map((s) => String(s).trim()).filter(Boolean)
    : ["S", "M", "L", "XL"];

  const chart = createBlankSizeChart(handle, title, sizes);
  if (typeof body.note === "string" && body.note.trim()) {
    chart.note = body.note.trim();
  }

  try {
    await upsertSizeChart(chart);
  } catch (err) {
    console.error("Create size chart error:", err);
    const msg =
      err instanceof Error && /permission|insufficient/i.test(err.message)
        ? "Firestore denied the write. Deploy updated firestore.rules (sizeCharts collection)."
        : "Failed to save";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  return NextResponse.json({ ok: true, chart });
}
