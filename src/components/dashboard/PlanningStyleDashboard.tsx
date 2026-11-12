import React, { useMemo, useState } from "react";
import { format, addDays, getISOWeek, parseISO } from "date-fns";
import { CalendarRange, Rows3, Palette, X } from "lucide-react";
import { ProductionPlan, FilterState } from "../../types/mrp";
import { isSunday } from "../../utils/mrpCalculations";
import {
  buildStyleColorMap,
  getStyleColor,
} from "../../utils/styleColors";

interface PlanningStyleDashboardProps {
  plans: ProductionPlan[]; // cleaned plans (tanpa hari Minggu & line NO PLANNING-only)
  filters: FilterState;
}

const NO_PLAN = "__NO_PLANNING__";
const EMPTY = "";

// Jumlah sub-kolom per hari. 6 bisa dibagi rata untuk 1, 2, 3, atau 6 style dalam sehari.
const SUB = 6;
const DAY_WIDTH = 120; // px
const LINE_COL_WIDTH = 72; // px

export const isNoPlanning = (s: string) =>
  s.trim().toUpperCase() === "NO PLANNING";

// Line non-produksi (ACC, Skill Up, Tes/Test) tidak ditampilkan & tidak dihitung
const EXCLUDED_LINE_PATTERN = /ACC|SKILL|TES/i;
export const isExcludedLine = (line: string) =>
  EXCLUDED_LINE_PATTERN.test(line || "");

/**
 * Planning Style PPIC bisa berisi beberapa style dalam 1 hari, dipisah koma
 * (mis. "305836 SHORT CT 120 M, 302706 SHORT 100"). Pecah menjadi style individual.
 */
export const getStyleLabels = (p: ProductionPlan): string[] => {
  const raw = (p.displayStyle || "").trim() || (p.style || "").trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

interface Segment {
  key: string; // style label / NO_PLAN / EMPTY
  span: number; // jumlah sub-kolom
  startDate: string;
  endDate: string;
}

export const PlanningStyleDashboard: React.FC<PlanningStyleDashboardProps> = ({
  plans,
  filters,
}) => {
  const [highlightStyle, setHighlightStyle] = useState<string | null>(null);

  // 1. Plans dalam rentang filter
  const rangePlans = useMemo(
    () =>
      plans.filter((p) => {
        if (!p.date || isSunday(p.date)) return false;
        if (isExcludedLine(p.line)) return false;
        if (filters.startDate && p.date < filters.startDate) return false;
        if (filters.endDate && p.date > filters.endDate) return false;
        return true;
      }),
    [plans, filters.startDate, filters.endDate],
  );

  // 2. Kolom tanggal (semua hari kecuali Minggu dalam rentang)
  const dates = useMemo(() => {
    let start = filters.startDate;
    let end = filters.endDate;
    if (!start || !end) {
      const sorted = rangePlans.map((p) => p.date).sort();
      if (!start) start = sorted[0];
      if (!end) end = sorted[sorted.length - 1];
    }
    if (!start || !end || start > end) return [] as string[];
    const result: string[] = [];
    let cur = parseISO(start);
    const last = parseISO(end);
    let guard = 0;
    while (cur <= last && guard < 1000) {
      const ds = format(cur, "yyyy-MM-dd");
      if (!isSunday(ds)) result.push(ds);
      cur = addDays(cur, 1);
      guard++;
    }
    return result;
  }, [filters.startDate, filters.endDate, rangePlans]);

  // 3. Grouping header minggu
  const weekGroups = useMemo(() => {
    const groups: { week: number; span: number }[] = [];
    dates.forEach((d) => {
      const w = getISOWeek(parseISO(d));
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.week === w) lastGroup.span++;
      else groups.push({ week: w, span: 1 });
    });
    return groups;
  }, [dates]);

  // 4. Per line: daftar style per tanggal (urut sesuai kolom tanggal)
  const { lines, cellsByLine } = useMemo(() => {
    const raw = new Map<string, Map<string, string[]>>();
    rangePlans.forEach((p) => {
      const line = (p.line || "").trim();
      if (!line) return;
      const labels = getStyleLabels(p);
      if (labels.length === 0) return;
      if (!raw.has(line)) raw.set(line, new Map());
      const byDate = raw.get(line)!;
      if (!byDate.has(p.date)) byDate.set(p.date, []);
      const arr = byDate.get(p.date)!;
      labels.forEach((l) => {
        if (!arr.includes(l)) arr.push(l);
      });
    });

    const result = new Map<string, string[][]>();
    raw.forEach((byDate, line) => {
      // cells[i] = daftar key untuk dates[i]
      const cells: string[][] = dates.map((d) => {
        const arr = byDate.get(d) || [];
        const real = arr.filter((s) => !isNoPlanning(s));
        if (real.length > 0) return real;
        if (arr.length > 0) return [NO_PLAN];
        return [EMPTY];
      });

      // Line yang isinya hanya NO PLANNING / kosong di rentang ini -> sembunyikan
      const hasReal = cells.some((c) => c[0] !== NO_PLAN && c[0] !== EMPTY);
      if (!hasReal) return;

      // Urutkan hari peralihan: style hari sebelumnya di depan, style hari sesudahnya di belakang
      const ordered = cells.map((c) => [...c]);
      for (let i = 0; i < ordered.length; i++) {
        const arr = ordered[i];
        if (arr.length < 2) continue;
        const prev =
          i > 0 ? ordered[i - 1][ordered[i - 1].length - 1] : undefined;
        const next = i < cells.length - 1 ? cells[i + 1][0] : undefined;
        if (next && arr.includes(next) && next !== prev) {
          arr.splice(arr.indexOf(next), 1);
          arr.push(next);
        }
        if (prev && arr.includes(prev)) {
          arr.splice(arr.indexOf(prev), 1);
          arr.unshift(prev);
        }
      }
      result.set(line, ordered);
    });

    const sortedLines = Array.from(result.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    );
    return { lines: sortedLines, cellsByLine: result };
  }, [rangePlans, dates]);

  // 5. Segmen yang di-merge per line
  const segmentsByLine = useMemo(() => {
    const out = new Map<string, Segment[]>();
    cellsByLine.forEach((cells, line) => {
      const segs: Segment[] = [];
      cells.forEach((arr, i) => {
        const date = dates[i];
        const items = arr.slice(0, SUB);
        const n = items.length;
        const base = Math.floor(SUB / n);
        let rem = SUB - base * n;
        items.forEach((key) => {
          const span = base + (rem > 0 ? 1 : 0);
          if (rem > 0) rem--;
          // Tidak di-merge antar hari: setiap hari = 1 kotak tersendiri
          segs.push({ key, span, startDate: date, endDate: date });
        });
      });
      out.set(line, segs);
    });
    return out;
  }, [cellsByLine, dates]);

  // 6. Statistik style + assignment warna
  const styleList = useMemo(() => {
    const set = new Set<string>();
    cellsByLine.forEach((cells) =>
      cells.forEach((arr) =>
        arr.forEach((k) => {
          if (k !== NO_PLAN && k !== EMPTY) set.add(k);
        }),
      ),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cellsByLine]);

  const colorMap = useMemo(
    () => buildStyleColorMap(plans),
    [plans],
  );

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const fmtShort = (d: string) => format(parseISO(d), "dd MMM");

  const renderSegment = (line: string, seg: Segment, idx: number) => {
    const cellKey = `${line}-${idx}`;
    const baseCls =
      "border-b border-r border-white dark:border-slate-950 p-0 align-middle text-center";

    if (seg.key === EMPTY) {
      return (
        <td
          key={cellKey}
          colSpan={seg.span}
          className={`${baseCls} bg-slate-50/60 dark:bg-slate-900/40`}
        />
      );
    }

    if (seg.key === NO_PLAN) {
      return (
        <td
          key={cellKey}
          colSpan={seg.span}
          className={`${baseCls} bg-slate-100 dark:bg-slate-800/40 ${highlightStyle ? "opacity-40" : ""}`}
          title={`NO PLANNING\n${fmtShort(seg.startDate)}${seg.startDate !== seg.endDate ? ` – ${fmtShort(seg.endDate)}` : ""}`}
        >
          <span className="text-[9px] font-medium uppercase tracking-tight text-slate-400 dark:text-slate-500">
            No Planning
          </span>
        </td>
      );
    }

    const color = getStyleColor(seg.key, colorMap);
    const dimmed = highlightStyle !== null && highlightStyle !== seg.key;
    const active = highlightStyle === seg.key;
    const dayCount = Math.round((seg.span / SUB) * 10) / 10;
    return (
      <td
        key={cellKey}
        colSpan={seg.span}
        onClick={() =>
          setHighlightStyle((prev) => (prev === seg.key ? null : seg.key))
        }
        title={`${seg.key}\n${fmtShort(seg.startDate)}${seg.startDate !== seg.endDate ? ` – ${fmtShort(seg.endDate)}` : ""} (${dayCount} hari)`}
        className={`${baseCls} ${color} cursor-pointer transition-opacity ${dimmed ? "opacity-20" : ""} ${
          active
            ? "outline outline-2 -outline-offset-2 outline-slate-800 dark:outline-white"
            : ""
        }`}
      >
        <div className="px-1.5 text-[10px] font-semibold leading-tight break-words line-clamp-3">
          {seg.key}
        </div>
      </td>
    );
  };

  const tableWidth = LINE_COL_WIDTH + dates.length * DAY_WIDTH;
  const subWidth = DAY_WIDTH / SUB;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI ringkas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            label: "Rentang Tanggal",
            value:
              dates.length > 0
                ? `${format(parseISO(dates[0]), "dd MMM")} – ${format(parseISO(dates[dates.length - 1]), "dd MMM yyyy")}`
                : "-",
            sub: `${dates.length} hari kerja`,
            icon: <CalendarRange className="w-4 h-4" />,
            tone: "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30",
          },
          {
            label: "Line Aktif",
            value: String(lines.length),
            sub: "line dengan planning",
            icon: <Rows3 className="w-4 h-4" />,
            tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30",
          },
          {
            label: "Jumlah Style",
            value: String(styleList.length),
            sub: "style unik berjalan",
            icon: <Palette className="w-4 h-4" />,
            tone: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30",
          },
        ].map((k) => (
          <div
            key={k.label}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm flex items-start justify-between"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {k.label}
              </p>
              <p className="text-lg font-bold text-slate-800 dark:text-slate-100 mt-1 truncate">
                {k.value}
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {k.sub}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${k.tone}`}>{k.icon}</div>
          </div>
        ))}
      </div>

      {/* Matriks Planning */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Planning Style per Line
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Sumber: Plan Dashboard (Planning Style PPIC). Hari dengan 2 style
              dibagi dua dalam satu kotak. Klik kotak untuk menyorot style.
            </p>
          </div>
          {highlightStyle && (
            <button
              onClick={() => setHighlightStyle(null)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              <X className="w-3.5 h-3.5" />
              <span className="max-w-[240px] truncate">
                Sorot: {highlightStyle}
              </span>
            </button>
          )}
        </div>

        {dates.length === 0 || lines.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Tidak ada data planning pada rentang tanggal ini.
          </div>
        ) : (
          <div className="overflow-auto max-h-[70vh]">
            <table
              className="border-separate border-spacing-0 text-xs table-fixed"
              style={{ width: tableWidth, minWidth: tableWidth }}
            >
              <colgroup>
                <col style={{ width: LINE_COL_WIDTH }} />
                {dates.map((d) =>
                  Array.from({ length: SUB }).map((_, i) => (
                    <col key={`${d}-${i}`} style={{ width: subWidth }} />
                  )),
                )}
              </colgroup>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 top-0 z-30 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300"
                  >
                    Line
                  </th>
                  {weekGroups.map((g, i) => (
                    <th
                      key={`${g.week}-${i}`}
                      colSpan={g.span * SUB}
                      className="sticky top-0 z-20 h-7 bg-slate-100 dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 px-2 text-center text-[11px] font-bold text-indigo-700 dark:text-indigo-300"
                    >
                      Week {g.week}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dates.map((d) => {
                    const isToday = d === todayStr;
                    const dt = parseISO(d);
                    return (
                      <th
                        key={d}
                        colSpan={SUB}
                        className={`sticky top-7 z-20 border-b border-r border-slate-200 dark:border-slate-700 px-1 py-1.5 text-center ${
                          isToday
                            ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200"
                            : "bg-slate-50 dark:bg-slate-800/95 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        <div className="text-[10px] font-medium uppercase">
                          {format(dt, "EEE")}
                        </div>
                        <div className="text-[11px] font-bold">
                          {format(dt, "dd MMM")}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line} className="h-12">
                    <td className="sticky left-0 z-10 border-b border-r border-slate-200 dark:border-slate-700 px-3 font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900">
                      {line}
                    </td>
                    {(segmentsByLine.get(line) || []).map((seg, idx) =>
                      renderSegment(line, seg, idx),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
