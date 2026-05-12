"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  GitCompareArrows,
} from "lucide-react";

export type DateRange = { start: string; end: string };

const DAY_MS = 86_400_000;
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function toIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return isNaN(dt.getTime()) ? null : dt;
}

function parseLooseDate(s: string): Date | null {
  const trimmed = s.trim();
  if (!trimmed) return null;
  const iso = parseIso(trimmed);
  if (iso) return iso;
  const t = Date.parse(trimmed);
  if (isNaN(t)) return null;
  const d = new Date(t);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function addYears(d: Date, n: number): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate())
  );
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfWeek(d: Date): Date {
  return addDays(d, -d.getUTCDay());
}

function startOfQuarter(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth() / 3) * 3, 1)
  );
}

function startOfYear(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
}

function todayUtc(): Date {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function isBetween(d: Date, a: Date, b: Date): boolean {
  const t = d.getTime();
  return t >= a.getTime() && t <= b.getTime();
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function formatLong(d: Date): string {
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function formatRangePill(start: string, end: string): string {
  const a = parseIso(start);
  const b = parseIso(end);
  if (!a || !b) return `${start} – ${end}`;
  const shortMo = (d: Date) =>
    MONTHS[d.getUTCMonth()].slice(0, 3) + " " + d.getUTCDate();
  if (sameDay(a, b)) {
    return `${shortMo(a)}, ${a.getUTCFullYear()}`;
  }
  if (a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${shortMo(a)}–${shortMo(b)}, ${b.getUTCFullYear()}`;
  }
  return `${shortMo(a)}, ${a.getUTCFullYear()} – ${shortMo(b)}, ${b.getUTCFullYear()}`;
}

type PresetId =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "last90"
  | "wtd"
  | "mtd"
  | "qtd"
  | "ytd";

const PRIMARY_GROUPS: {
  heading?: string;
  items: { id: PresetId; label: string }[];
}[] = [
  {
    items: [
      { id: "today", label: "Today" },
      { id: "yesterday", label: "Yesterday" },
    ],
  },
  {
    heading: "Last",
    items: [
      { id: "last7", label: "Last 7 days" },
      { id: "last30", label: "Last 30 days" },
      { id: "last90", label: "Last 90 days" },
    ],
  },
  {
    heading: "Period to date",
    items: [
      { id: "wtd", label: "Week to date" },
      { id: "mtd", label: "Month to date" },
      { id: "qtd", label: "Quarter to date" },
      { id: "ytd", label: "Year to date" },
    ],
  },
];

function presetRange(p: PresetId): DateRange {
  const today = todayUtc();
  switch (p) {
    case "today":
      return { start: toIso(today), end: toIso(today) };
    case "yesterday": {
      const y = addDays(today, -1);
      return { start: toIso(y), end: toIso(y) };
    }
    case "last7":
      return { start: toIso(addDays(today, -6)), end: toIso(today) };
    case "last30":
      return { start: toIso(addDays(today, -29)), end: toIso(today) };
    case "last90":
      return { start: toIso(addDays(today, -89)), end: toIso(today) };
    case "wtd":
      return { start: toIso(startOfWeek(today)), end: toIso(today) };
    case "mtd":
      return { start: toIso(startOfMonth(today)), end: toIso(today) };
    case "qtd":
      return { start: toIso(startOfQuarter(today)), end: toIso(today) };
    case "ytd":
      return { start: toIso(startOfYear(today)), end: toIso(today) };
  }
}

function matchPrimaryPreset(r: DateRange): PresetId | "custom" {
  const ids: PresetId[] = [
    "today",
    "yesterday",
    "last7",
    "last30",
    "last90",
    "wtd",
    "mtd",
    "qtd",
    "ytd",
  ];
  for (const id of ids) {
    const p = presetRange(id);
    if (p.start === r.start && p.end === r.end) return id;
  }
  return "custom";
}

type CompareId = "none" | "prev_period" | "prev_year" | "custom";

const COMPARE_GROUPS: { items: { id: CompareId; label: string }[] }[] = [
  {
    items: [
      { id: "none", label: "No comparison" },
      { id: "prev_period", label: "Previous period" },
      { id: "prev_year", label: "Previous year" },
    ],
  },
];

export function previousPeriod(r: DateRange): DateRange {
  const a = parseIso(r.start);
  const b = parseIso(r.end);
  if (!a || !b) return r;
  const len = diffDays(a, b) + 1;
  const prevEnd = addDays(a, -1);
  const prevStart = addDays(prevEnd, -(len - 1));
  return { start: toIso(prevStart), end: toIso(prevEnd) };
}

function previousYear(r: DateRange): DateRange {
  const a = parseIso(r.start);
  const b = parseIso(r.end);
  if (!a || !b) return r;
  return { start: toIso(addYears(a, -1)), end: toIso(addYears(b, -1)) };
}

function matchComparePreset(
  c: DateRange | null,
  primary: DateRange
): CompareId | "custom" {
  if (!c) return "none";
  const pp = previousPeriod(primary);
  if (pp.start === c.start && pp.end === c.end) return "prev_period";
  const py = previousYear(primary);
  if (py.start === c.start && py.end === c.end) return "prev_year";
  return "custom";
}

function MonthGrid({
  month,
  selStart,
  selEnd,
  hover,
  onPick,
  onHover,
}: {
  month: Date;
  selStart: Date | null;
  selEnd: Date | null;
  hover: Date | null;
  onPick: (d: Date) => void;
  onHover: (d: Date | null) => void;
}) {
  const first = startOfMonth(month);
  const leading = first.getUTCDay();
  const daysInMonth = new Date(
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const today = todayUtc();

  const a = selStart;
  let b = selEnd;
  if (a && !b && hover) {
    b = hover.getTime() >= a.getTime() ? hover : a;
  }
  const rangeLo = a && b ? (a.getTime() <= b.getTime() ? a : b) : null;
  const rangeHi = a && b ? (a.getTime() <= b.getTime() ? b : a) : null;

  const cells: ({ date: Date } | null)[] = [];
  for (let i = 0; i < leading; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) {
    cells.push({
      date: new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i)),
    });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-center text-sm text-white/80 mb-3">
        {MONTHS[month.getUTCMonth()]} {month.getUTCFullYear()}
      </p>
      <div className="grid grid-cols-7 gap-y-1 text-[10px] uppercase tracking-wider text-white/40 mb-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="h-6 flex items-center justify-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="h-9" />;
          const inRange =
            rangeLo && rangeHi && isBetween(c.date, rangeLo, rangeHi);
          const isStart = rangeLo && sameDay(c.date, rangeLo);
          const isEnd = rangeHi && sameDay(c.date, rangeHi);
          const isSinglePick = a && !selEnd && sameDay(c.date, a);
          const isToday = sameDay(c.date, today);

          const endpoint = isStart || isEnd || isSinglePick;
          const rangeMid = inRange && !endpoint;

          let bg = "";
          if (rangeMid) bg = "bg-white/10";
          if (isStart && rangeHi && !sameDay(rangeLo!, rangeHi))
            bg = "bg-white/10 rounded-l-md";
          if (isEnd && rangeLo && !sameDay(rangeLo, rangeHi!))
            bg = "bg-white/10 rounded-r-md";

          return (
            <div
              key={i}
              className={`h-9 flex items-center justify-center ${bg}`}
              onMouseEnter={() => onHover(c.date)}
              onMouseLeave={() => onHover(null)}
            >
              <button
                type="button"
                onClick={() => onPick(c.date)}
                className={`w-8 h-8 text-xs rounded-md transition flex items-center justify-center ${
                  endpoint
                    ? "bg-white text-black font-medium"
                    : isToday
                      ? "text-white ring-1 ring-white/30 hover:bg-white/10"
                      : "text-white/80 hover:bg-white/10"
                }`}
              >
                {c.date.getUTCDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function useOutsideClose(
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  open: boolean
) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, onClose, open]);
}

type PickerProps = {
  value: DateRange;
  onChange: (r: DateRange) => void;
};

export function DateRangePicker({ value, onChange }: PickerProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false), open);

  const [draftStart, setDraftStart] = useState<Date | null>(
    () => parseIso(value.start)
  );
  const [draftEnd, setDraftEnd] = useState<Date | null>(
    () => parseIso(value.end)
  );
  const [startInput, setStartInput] = useState(() => {
    const d = parseIso(value.start);
    return d ? formatLong(d) : "";
  });
  const [endInput, setEndInput] = useState(() => {
    const d = parseIso(value.end);
    return d ? formatLong(d) : "";
  });
  const [hover, setHover] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState<Date>(
    () => startOfMonth(parseIso(value.start) ?? todayUtc())
  );

  function openPopover() {
    const a = parseIso(value.start);
    const b = parseIso(value.end);
    setDraftStart(a);
    setDraftEnd(b);
    setStartInput(a ? formatLong(a) : "");
    setEndInput(b ? formatLong(b) : "");
    if (a) setLeftMonth(startOfMonth(a));
    setOpen(true);
  }

  const activePreset = useMemo(
    () => matchPrimaryPreset(value),
    [value]
  );

  function applyPreset(id: PresetId) {
    const r = presetRange(id);
    const a = parseIso(r.start);
    const b = parseIso(r.end);
    setDraftStart(a);
    setDraftEnd(b);
    setStartInput(a ? formatLong(a) : "");
    setEndInput(b ? formatLong(b) : "");
    if (a) setLeftMonth(startOfMonth(a));
  }

  function handlePick(d: Date) {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d);
      setDraftEnd(null);
      setStartInput(formatLong(d));
      setEndInput("");
      return;
    }
    if (d.getTime() < draftStart.getTime()) {
      setDraftEnd(draftStart);
      setDraftStart(d);
      setStartInput(formatLong(d));
      setEndInput(formatLong(draftStart));
    } else {
      setDraftEnd(d);
      setEndInput(formatLong(d));
    }
  }

  function commitStartInput() {
    const d = parseLooseDate(startInput);
    if (d) {
      setDraftStart(d);
      setStartInput(formatLong(d));
      setLeftMonth(startOfMonth(d));
      if (draftEnd && d.getTime() > draftEnd.getTime()) {
        setDraftEnd(d);
        setEndInput(formatLong(d));
      }
    } else if (draftStart) {
      setStartInput(formatLong(draftStart));
    }
  }
  function commitEndInput() {
    const d = parseLooseDate(endInput);
    if (d) {
      setDraftEnd(d);
      setEndInput(formatLong(d));
      if (draftStart && d.getTime() < draftStart.getTime()) {
        setDraftStart(d);
        setStartInput(formatLong(d));
        setLeftMonth(startOfMonth(d));
      }
    } else if (draftEnd) {
      setEndInput(formatLong(draftEnd));
    }
  }

  function apply() {
    if (!draftStart) return;
    const end = draftEnd ?? draftStart;
    const a = draftStart.getTime() <= end.getTime() ? draftStart : end;
    const b = draftStart.getTime() <= end.getTime() ? end : draftStart;
    onChange({ start: toIso(a), end: toIso(b) });
    setOpen(false);
  }

  const rightMonth = addMonths(leftMonth, 1);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-[12px] text-white/85 transition"
      >
        <CalIcon size={14} className="text-white/60" />
        <span>{formatRangePill(value.start, value.end)}</span>
        <ChevronDown size={14} className="text-white/50" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[760px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex">
            <aside className="w-48 shrink-0 border-r border-white/10 py-3 max-h-[480px] overflow-y-auto">
              {PRIMARY_GROUPS.map((g, gi) => (
                <div key={gi} className="px-2 pb-2">
                  {g.heading && (
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
                      {g.heading}
                    </p>
                  )}
                  {g.items.map((it) => {
                    const active = activePreset === it.id;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => applyPreset(it.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="px-2 pt-1 border-t border-white/10 mt-1">
                <button
                  type="button"
                  className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition ${
                    activePreset === "custom"
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                  onClick={() => {
                    /* leaves whatever is currently drafted */
                  }}
                >
                  Custom range
                </button>
              </div>
            </aside>

            <div className="flex-1 p-5 flex flex-col gap-4 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={commitStartInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitStartInput();
                    }
                  }}
                  className="flex-1 h-9 px-3 rounded-md border border-white/15 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                  placeholder="Start date"
                />
                <span className="text-white/40 text-sm">→</span>
                <input
                  type="text"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={commitEndInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEndInput();
                    }
                  }}
                  className="flex-1 h-9 px-3 rounded-md border border-white/15 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-white/40"
                  placeholder="End date"
                />
              </div>

              <div className="flex items-start gap-6">
                <button
                  type="button"
                  onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
                  className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <MonthGrid
                  month={leftMonth}
                  selStart={draftStart}
                  selEnd={draftEnd}
                  hover={hover}
                  onPick={handlePick}
                  onHover={setHover}
                />
                <MonthGrid
                  month={rightMonth}
                  selStart={draftStart}
                  selEnd={draftEnd}
                  hover={hover}
                  onPick={handlePick}
                  onHover={setHover}
                />
                <button
                  type="button"
                  onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
                  className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 h-9 rounded-md border border-white/15 text-[12px] text-white/80 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  disabled={!draftStart}
                  className="px-4 h-9 rounded-md bg-white text-black text-[12px] font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CompareProps = {
  primary: DateRange;
  value: DateRange | null;
  onChange: (r: DateRange | null) => void;
};

export function CompareRangePicker({ primary, value, onChange }: CompareProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useOutsideClose(wrapRef, () => setOpen(false), open);

  const [draftStart, setDraftStart] = useState<Date | null>(() =>
    value ? parseIso(value.start) : null
  );
  const [draftEnd, setDraftEnd] = useState<Date | null>(() =>
    value ? parseIso(value.end) : null
  );
  const [startInput, setStartInput] = useState(() => {
    const d = value ? parseIso(value.start) : null;
    return d ? formatLong(d) : "";
  });
  const [endInput, setEndInput] = useState(() => {
    const d = value ? parseIso(value.end) : null;
    return d ? formatLong(d) : "";
  });
  const [hover, setHover] = useState<Date | null>(null);
  const [leftMonth, setLeftMonth] = useState<Date>(() =>
    startOfMonth(parseIso(primary.start) ?? todayUtc())
  );
  const [mode, setMode] = useState<CompareId>(() =>
    value === null ? "none" : (matchComparePreset(value, primary) as CompareId)
  );

  function openPopover() {
    const a = value ? parseIso(value.start) : null;
    const b = value ? parseIso(value.end) : null;
    setDraftStart(a);
    setDraftEnd(b);
    setStartInput(a ? formatLong(a) : "");
    setEndInput(b ? formatLong(b) : "");
    if (a) setLeftMonth(startOfMonth(a));
    setMode(matchComparePreset(value, primary) as CompareId);
    setOpen(true);
  }

  function applyMode(id: CompareId) {
    setMode(id);
    if (id === "none") {
      setDraftStart(null);
      setDraftEnd(null);
      setStartInput("");
      setEndInput("");
      return;
    }
    const r =
      id === "prev_period"
        ? previousPeriod(primary)
        : id === "prev_year"
          ? previousYear(primary)
          : null;
    if (r) {
      const a = parseIso(r.start);
      const b = parseIso(r.end);
      setDraftStart(a);
      setDraftEnd(b);
      setStartInput(a ? formatLong(a) : "");
      setEndInput(b ? formatLong(b) : "");
      if (a) setLeftMonth(startOfMonth(a));
    }
  }

  function handlePick(d: Date) {
    setMode("custom");
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(d);
      setDraftEnd(null);
      setStartInput(formatLong(d));
      setEndInput("");
      return;
    }
    if (d.getTime() < draftStart.getTime()) {
      setDraftEnd(draftStart);
      setDraftStart(d);
      setStartInput(formatLong(d));
      setEndInput(formatLong(draftStart));
    } else {
      setDraftEnd(d);
      setEndInput(formatLong(d));
    }
  }

  function commitStartInput() {
    const d = parseLooseDate(startInput);
    if (d) {
      setMode("custom");
      setDraftStart(d);
      setStartInput(formatLong(d));
      setLeftMonth(startOfMonth(d));
    } else if (draftStart) setStartInput(formatLong(draftStart));
  }
  function commitEndInput() {
    const d = parseLooseDate(endInput);
    if (d) {
      setMode("custom");
      setDraftEnd(d);
      setEndInput(formatLong(d));
    } else if (draftEnd) setEndInput(formatLong(draftEnd));
  }

  function apply() {
    if (mode === "none" || !draftStart) {
      onChange(null);
      setOpen(false);
      return;
    }
    const end = draftEnd ?? draftStart;
    const a = draftStart.getTime() <= end.getTime() ? draftStart : end;
    const b = draftStart.getTime() <= end.getTime() ? end : draftStart;
    onChange({ start: toIso(a), end: toIso(b) });
    setOpen(false);
  }

  const rightMonth = addMonths(leftMonth, 1);
  const pillLabel = value
    ? formatRangePill(value.start, value.end)
    : "No comparison";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPopover())}
        className="inline-flex items-center gap-2 px-3 h-9 rounded-md border border-white/15 bg-white/5 hover:bg-white/10 text-[12px] text-white/85 transition"
      >
        <GitCompareArrows size={14} className="text-white/60" />
        <span>{pillLabel}</span>
        <ChevronDown size={14} className="text-white/50" />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[760px] max-w-[calc(100vw-2rem)] rounded-xl border border-white/10 bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="flex">
            <aside className="w-48 shrink-0 border-r border-white/10 py-3">
              {COMPARE_GROUPS.map((g, gi) => (
                <div key={gi} className="px-2 pb-2">
                  {g.items.map((it) => {
                    const active = mode === it.id;
                    return (
                      <button
                        key={it.id}
                        type="button"
                        onClick={() => applyMode(it.id)}
                        className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/70 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        {it.label}
                      </button>
                    );
                  })}
                </div>
              ))}
              <div className="px-2 pt-1 border-t border-white/10 mt-1">
                <button
                  type="button"
                  onClick={() => setMode("custom")}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-[13px] transition ${
                    mode === "custom"
                      ? "bg-white/10 text-white"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  Custom range
                </button>
              </div>
            </aside>

            <div className="flex-1 p-5 flex flex-col gap-4 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={commitStartInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitStartInput();
                    }
                  }}
                  disabled={mode === "none"}
                  className="flex-1 h-9 px-3 rounded-md border border-white/15 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-white/40 disabled:opacity-40"
                  placeholder="Start date"
                />
                <span className="text-white/40 text-sm">→</span>
                <input
                  type="text"
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={commitEndInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitEndInput();
                    }
                  }}
                  disabled={mode === "none"}
                  className="flex-1 h-9 px-3 rounded-md border border-white/15 bg-transparent text-[13px] text-white placeholder-white/30 focus:outline-none focus:border-white/40 disabled:opacity-40"
                  placeholder="End date"
                />
              </div>

              <div
                className={`flex items-start gap-6 ${mode === "none" ? "opacity-40 pointer-events-none" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setLeftMonth(addMonths(leftMonth, -1))}
                  className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <MonthGrid
                  month={leftMonth}
                  selStart={draftStart}
                  selEnd={draftEnd}
                  hover={hover}
                  onPick={handlePick}
                  onHover={setHover}
                />
                <MonthGrid
                  month={rightMonth}
                  selStart={draftStart}
                  selEnd={draftEnd}
                  hover={hover}
                  onPick={handlePick}
                  onHover={setHover}
                />
                <button
                  type="button"
                  onClick={() => setLeftMonth(addMonths(leftMonth, 1))}
                  className="mt-1 w-7 h-7 flex items-center justify-center rounded-md text-white/60 hover:bg-white/5 hover:text-white"
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="px-4 h-9 rounded-md border border-white/15 text-[12px] text-white/80 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={apply}
                  className="px-4 h-9 rounded-md bg-white text-black text-[12px] font-medium hover:bg-white/90"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
