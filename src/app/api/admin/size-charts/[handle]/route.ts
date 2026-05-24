import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import {
  deleteSizeChart,
  getSizeChartByHandle,
  upsertSizeChart,
} from "@/lib/size-charts-server";
import { assignSizeChartToProducts } from "@/lib/products-server";
import type { SizeChart, SizeChartColumnDef, SizeChartRow } from "@/lib/size-charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeRows(
  raw: unknown,
  columns: string[]
): SizeChartRow[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SizeChartRow[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const e = entry as Record<string, unknown>;
    const size = String(e.size ?? "").trim();
    if (!size) return null;
    const measurements: Record<string, string> = {};
    const rawMeas =
      e.measurements && typeof e.measurements === "object"
        ? (e.measurements as Record<string, unknown>)
        : {};
    for (const col of columns) {
      measurements[col] = String(rawMeas[col] ?? "").trim();
    }
    out.push({ size, measurements });
  }
  return out;
}

function normalizeColumnDefs(raw: unknown): SizeChartColumnDef[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SizeChartColumnDef[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i];
    if (!entry || typeof entry !== "object") return null;
    const e = entry as Record<string, unknown>;
    const label = String(e.label ?? "").trim();
    if (!label) return null;
    let id = String(e.id ?? "").trim() || `col-${i}`;
    while (seen.has(id)) id = `${id}-${i}`;
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;
  const chart = await getSizeChartByHandle(handle);
  if (!chart) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ chart });
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await getSizeChartByHandle(handle);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const next: SizeChart = { ...existing };

  if (typeof body.name === "string" && body.name.trim()) {
    next.name = body.name.trim();
  }
  if (body.columns !== undefined) {
    if (!Array.isArray(body.columns)) {
      return NextResponse.json({ error: "Invalid columns" }, { status: 400 });
    }
    const columns = body.columns.map((c) => String(c).trim()).filter(Boolean);
    if (columns.length === 0) {
      return NextResponse.json(
        { error: "At least one measurement column required" },
        { status: 400 }
      );
    }
    next.columns = columns;
    next.columnDefs = columns.map((label, i) => ({
      id: next.columnDefs?.[i]?.id ?? `${handle}-col-${i}`,
      label,
    }));
    if (body.rows === undefined) {
      next.rows = existing.rows.map((row) => {
        const measurements: Record<string, string> = {};
        for (const col of columns) {
          measurements[col] = row.measurements[col] ?? "";
        }
        return { size: row.size, measurements };
      });
    }
  }
  if (body.columnDefs !== undefined) {
    const defs = normalizeColumnDefs(body.columnDefs);
    if (!defs || defs.length === 0) {
      return NextResponse.json(
        { error: "At least one measurement column required" },
        { status: 400 }
      );
    }
    next.columnDefs = defs;
    next.columns = defs.map((d) => d.label);
  }
  if (body.rows !== undefined) {
    const rows = normalizeRows(body.rows, next.columns);
    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { error: "At least one size row required" },
        { status: 400 }
      );
    }
    next.rows = rows;
  }
  if (body.note !== undefined) {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note) next.note = note;
    else delete next.note;
  }

  try {
    await upsertSizeChart(next);
  } catch (err) {
    console.error("Update size chart error:", err);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  if (Array.isArray(body.assignedProductHandles)) {
    const handles = body.assignedProductHandles
      .map((h) => String(h).trim())
      .filter(Boolean);
    try {
      await assignSizeChartToProducts(handle, handles);
    } catch (err) {
      console.error("Assign size chart error:", err);
      return NextResponse.json(
        { error: "Chart saved but product assignment failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true, chart: next });
}

export async function DELETE(
  _request: Request,
  ctx: { params: Promise<{ handle: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { handle } = await ctx.params;

  try {
    await assignSizeChartToProducts(handle, []);
    await deleteSizeChart(handle);
  } catch (err) {
    console.error("Delete size chart error:", err);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
