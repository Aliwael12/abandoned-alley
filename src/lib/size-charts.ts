export type SizeChartColumnDef = {
  id: string;
  label: string;
};

export type SizeChartRow = {
  size: string;
  /** Values keyed by column label (same strings as `columns`). */
  measurements: Record<string, string>;
};

export type SizeChart = {
  handle: string;
  name: string;
  /** Measurement column headers in display order (storefront). */
  columns: string[];
  /** Stable column ids for admin editing; persisted in Firestore when set. */
  columnDefs?: SizeChartColumnDef[];
  rows: SizeChartRow[];
  note?: string;
};

export const DEFAULT_SIZE_CHART_COLUMNS = [
  "Chest (cm)",
  "Length (cm)",
  "Shoulder (cm)",
];

export function emptyRow(columns: string[], size = ""): SizeChartRow {
  const measurements: Record<string, string> = {};
  for (const col of columns) measurements[col] = "";
  return { size, measurements };
}

export function defaultSizeChartRows(
  sizes: string[],
  columns: string[] = DEFAULT_SIZE_CHART_COLUMNS
): SizeChartRow[] {
  return sizes.map((size) => emptyRow(columns, size));
}

export function createBlankSizeChart(
  handle: string,
  name: string,
  sizes = ["S", "M", "L", "XL"]
): SizeChart {
  const columnDefs: SizeChartColumnDef[] = DEFAULT_SIZE_CHART_COLUMNS.map(
    (label, i) => ({
      id: `${handle}-col-${i}`,
      label,
    })
  );
  const columns = columnDefs.map((c) => c.label);
  return {
    handle,
    name,
    columns,
    columnDefs,
    rows: defaultSizeChartRows(sizes, columns),
  };
}
