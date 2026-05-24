"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SizeChart } from "@/lib/size-charts";

export default function SizeChartPanel({ chart }: { chart: SizeChart }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-white/15 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs tracking-[0.25em] uppercase hover:bg-white/5 transition"
        aria-expanded={open}
      >
        Size chart
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-[11px] tracking-[0.2em] uppercase text-white/50">
            {chart.name}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse min-w-[280px]">
              <thead>
                <tr className="border-b border-white/15">
                  <th className="text-left py-2 pr-4 text-[10px] tracking-[0.2em] uppercase text-white/50 font-normal">
                    Size
                  </th>
                  {chart.columns.map((col, ci) => (
                    <th
                      key={`${col}-${ci}`}
                      className="text-left py-2 pr-4 text-[10px] tracking-[0.15em] uppercase text-white/50 font-normal whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row, ri) => (
                  <tr key={`${row.size}-${ri}`} className="border-b border-white/10">
                    <td className="py-2 pr-4 font-medium tracking-wide">{row.size}</td>
                    {chart.columns.map((col, ci) => (
                      <td key={`${ci}-${col}`} className="py-2 pr-4 text-white/80 tabular-nums">
                        {row.measurements[col] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.note && (
            <p className="text-xs text-white/50 leading-relaxed">{chart.note}</p>
          )}
        </div>
      )}
    </div>
  );
}
