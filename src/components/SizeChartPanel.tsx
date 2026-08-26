"use client";

import { useState } from "react";
import type { SizeChart } from "@/lib/size-charts";
import { Button } from "./ui";

export default function SizeChartPanel({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        SIZE GUIDE {open ? "▲" : "▼"}
      </Button>
      {open && (
        <div
          style={{
            border: "1px solid var(--border-default)",
            padding: "var(--space-5)",
            marginTop: "var(--space-3)",
          }}
        >
          <div className="aa-eyebrow" style={{ marginBottom: "var(--space-3)" }}>
            SIZE GUIDE — {chart.name}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border-default)" }}>
                  <th className="aa-caption" style={{ textAlign: "left", padding: "var(--space-2) var(--space-3) var(--space-2) 0" }}>
                    SIZE
                  </th>
                  {chart.columns.map((col, ci) => (
                    <th
                      key={`${col}-${ci}`}
                      className="aa-caption"
                      style={{ textAlign: "left", padding: "var(--space-2) var(--space-3)", whiteSpace: "nowrap" }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, ri) => (
                  <tr key={`${row.size}-${ri}`} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "var(--space-2) var(--space-3) var(--space-2) 0", fontWeight: 600 }}>
                      {row.size}
                    </td>
                    {chart.columns.map((col, ci) => (
                      <td key={`${ci}-${col}`} style={{ padding: "var(--space-2) var(--space-3)", color: "var(--text-muted)" }}>
                        {row.measurements[col] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.note && (
            <p className="aa-body" style={{ color: "var(--text-muted)", marginTop: "var(--space-3)" }}>
              {chart.note}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
