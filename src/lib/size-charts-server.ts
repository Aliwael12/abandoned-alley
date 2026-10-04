import { sql, withJson } from "@/lib/db";
import type { SizeChart, SizeChartColumnDef, SizeChartRow } from "@/lib/size-charts";

function normalizeRow(raw: unknown): SizeChartRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const size = String(r.size ?? "").trim();
  if (!size) return null;
  const measurements: Record<string, string> = {};
  if (r.measurements && typeof r.measurements === "object") {
    for (const [k, v] of Object.entries(r.measurements as Record<string, unknown>)) {
      measurements[k] = String(v ?? "").trim();
    }
  }
  return { size, measurements };
}

function normalizeColumnDefs(
  raw: unknown,
  handle: string,
  fallbackLabels: string[]
): SizeChartColumnDef[] {
  if (Array.isArray(raw)) {
    const defs: SizeChartColumnDef[] = [];
    const seenIds = new Set<string>();
    for (let i = 0; i < raw.length; i++) {
      const entry = raw[i];
      if (!entry || typeof entry !== "object") continue;
      const e = entry as Record<string, unknown>;
      const label = String(e.label ?? "").trim();
      if (!label) continue;
      let id = String(e.id ?? "").trim() || `${handle}-col-${i}`;
      while (seenIds.has(id)) id = `${id}-${i}`;
      seenIds.add(id);
      defs.push({ id, label });
    }
    if (defs.length > 0) return defs;
  }
  return fallbackLabels.map((label, i) => ({
    id: `${handle}-col-${i}`,
    label,
  }));
}

function normalize(raw: Record<string, unknown>): SizeChart | null {
  if (!raw || typeof raw.handle !== "string") return null;
  const handle = String(raw.handle);
  const fallbackColumns = Array.isArray(raw.columns)
    ? raw.columns.map((c) => String(c).trim()).filter(Boolean)
    : [];
  const columnDefs = normalizeColumnDefs(raw.columnDefs, handle, fallbackColumns);
  const columns = columnDefs.map((c) => c.label);
  const rows = Array.isArray(raw.rows)
    ? raw.rows
        .map((row) => normalizeRow(row))
        .filter((row): row is SizeChartRow => row !== null)
    : [];
  const name = String(raw.name ?? "").trim();
  if (!name) return null;
  return {
    handle,
    name,
    columns,
    columnDefs,
    rows,
    note: typeof raw.note === "string" ? raw.note.trim() || undefined : undefined,
  };
}

export async function getAllSizeCharts(): Promise<SizeChart[]> {
  try {
    const rows = await sql`select * from size_charts`;
    return rows
      .map((r) => normalize(r))
      .filter((c): c is SizeChart => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("getAllSizeCharts failed:", err);
    return [];
  }
}

export async function getSizeChartByHandle(handle: string): Promise<SizeChart | null> {
  try {
    const [row] = await sql`select * from size_charts where handle = ${handle}`;
    if (row) return normalize(row);
  } catch (err) {
    console.error("getSizeChartByHandle failed:", err);
  }
  return null;
}

export async function upsertSizeChart(chart: SizeChart): Promise<void> {
  const columnDefs =
    chart.columnDefs ??
    chart.columns.map((label, i) => ({
      id: `${chart.handle}-col-${i}`,
      label,
    }));
  const note = typeof chart.note === "string" ? chart.note.trim() : "";
  const row = withJson(
    sql,
    {
      handle: chart.handle,
      name: chart.name,
      note: note || null,
      columns: chart.columns,
      columnDefs,
      rows: chart.rows,
      updatedAt: new Date(),
    },
    ["columnDefs", "rows"]
  );
  await sql`
    insert into size_charts ${sql(row)}
    on conflict (handle) do update set ${sql(row)}`;
}

export async function deleteSizeChart(handle: string): Promise<void> {
  await sql`delete from size_charts where handle = ${handle}`;
}
