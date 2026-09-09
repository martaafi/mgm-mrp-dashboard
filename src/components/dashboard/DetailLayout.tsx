import React, { useState, useMemo, useRef, useEffect } from "react";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
} from "../../types/mrp";
import { getAdjustedAvailabilityForDateRange, isSunday } from "../../utils/mrpCalculations";
import { DateRangePicker } from "../filters/DateRangePicker";

interface DetailLayoutProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  rentalTrialRecords?: RentalTrialRecord[];
  initialDate?: string;
  initialEndDate?: string;
}

export const DetailLayout: React.FC<DetailLayoutProps> = ({
  plans,
  requirements,
  availabilities,
  rentalTrialRecords = [],
  initialDate,
  initialEndDate,
}) => {
  // Compute initial date range, ensuring we never default to a Sunday
  const defaultRange = useMemo(() => {
    let start = initialDate || "";
    let end = initialEndDate || initialDate || "";

    if (start && isSunday(start)) {
      const d = new Date(start + "T00:00:00");
      d.setDate(d.getDate() + 1);
      start = format(d, "yyyy-MM-dd");
    }

    if (!start) {
      const today = new Date();
      if (today.getDay() === 0) {
        today.setDate(today.getDate() + 1);
      }
      start = format(today, "yyyy-MM-dd");
    }

    if (!end || end < start) {
      end = start;
    }

    return { startDate: start, endDate: end };
  }, [initialDate, initialEndDate]);

  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(defaultRange);

  useEffect(() => {
    if (initialDate) {
      let start = initialDate;
      let end = initialEndDate || initialDate;
      if (isSunday(start)) {
        const d = new Date(start + "T00:00:00");
        d.setDate(d.getDate() + 1);
        start = format(d, "yyyy-MM-dd");
      }
      if (end < start) end = start;
      setDateRange({ startDate: start, endDate: end });
    }
  }, [initialDate, initialEndDate]);

  const { startDate, endDate } = dateRange;

  const tableRef = useRef<HTMLDivElement>(null);

  const handleScrollLeft = () => {
    if (tableRef.current) {
      tableRef.current.scrollBy({ left: -600, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (tableRef.current) {
      tableRef.current.scrollBy({ left: 600, behavior: "smooth" });
    }
  };

  // 1. Get active lines and their styles for the selected date range.
  // If a line runs more than 1 style in the selected range, use the LATEST style for that line!
  const activeLines = useMemo(() => {
    const linePlansMap: Record<string, ProductionPlan[]> = {};

    plans.forEach((p) => {
      if (!p.date || !p.line) return;
      if (isSunday(p.date)) return;
      if (!p.style || p.style.toLowerCase().includes("no plan")) return;

      const inRange =
        (!startDate || p.date >= startDate) &&
        (!endDate || p.date <= endDate);

      if (inRange) {
        if (!linePlansMap[p.line]) {
          linePlansMap[p.line] = [];
        }
        linePlansMap[p.line].push(p);
      }
    });

    // For each line, sort plans chronologically by date and pick the LATEST plan for machine calculation,
    // while collecting all unique styles for display
    const linesMap: Record<
      string,
      {
        style: string;
        displayStyles: string[];
        latestDate: string;
      }
    > = {};

    Object.entries(linePlansMap).forEach(([line, linePlans]) => {
      // Sort chronologically ascending
      linePlans.sort((a, b) => a.date.localeCompare(b.date));
      const latestPlan = linePlans[linePlans.length - 1];

      // Collect all unique styles from all plans in this range for display
      // Parse from Planning Style PPIC (Col C) and deduplicate
      const displayStyles: string[] = [];
      const seen = new Set<string>();

      linePlans.forEach((p) => {
        const raw = (p.displayStyle || p.style || "").trim();
        // Split by comma or newline so individual styles inside combined cells are cleanly separated
        const parts = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
        parts.forEach((part) => {
          const key = part.toUpperCase();
          if (key === "NO PLANNING" || key.includes("NO PLAN")) return;
          if (!seen.has(key)) {
            seen.add(key);
            displayStyles.push(part);
          }
        });
      });

      if (displayStyles.length === 0 && latestPlan.style) {
        displayStyles.push(latestPlan.style);
      }

      linesMap[line] = {
        style: latestPlan.style, // used for machine requirement calculation (STYLE TERAKHIR)
        displayStyles,
        latestDate: latestPlan.date,
      };
    });

    // Convert to sorted array
    return Object.keys(linesMap)
      .sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      )
      .map((line) => ({
        line,
        ...linesMap[line],
      }));
  }, [plans, startDate, endDate]);

  // 2. Prepare machine rows
  const tableData = useMemo(() => {
    // Adjust availability for the selected date range
    const adjustedAvail = getAdjustedAvailabilityForDateRange(
      startDate,
      endDate,
      availabilities,
      rentalTrialRecords,
    );

    // Collect all machine types
    const machineTypes = new Set(adjustedAvail.map((a) => a.jenisMesin));

    // Also include any machines required by active styles just in case they aren't in availabilities
    const reqLookup: Record<string, number> = {};
    const accReqLookup: Record<string, number> = {};

    activeLines.forEach((al) => {
      const isACC = al.line.toUpperCase() === 'ACC';
      if (!isACC) {
        const styleReqs = requirements.filter(
          (r) => r.style === al.style && (r.kebutuhanTotal > 0 || (r.kebutuhanAccessories && r.kebutuhanAccessories > 0)),
        );
        styleReqs.forEach((r) => {
          const mType = r.jenisMesin.trim().toLowerCase();
          if (r.kebutuhanTotal > 0) {
            machineTypes.add(r.jenisMesin.trim());
            // Populate fast lookup dictionary: style|machine -> required amount
            reqLookup[`${al.style}|${mType}`] = r.kebutuhanTotal;
          }
          if (r.kebutuhanAccessories && r.kebutuhanAccessories > 0) {
            machineTypes.add(r.jenisMesin.trim());
            accReqLookup[mType] = (accReqLookup[mType] || 0) + r.kebutuhanAccessories;
          }
        });
      }
    });

    const rows = Array.from(machineTypes)
      .sort((a, b) => a.localeCompare(b))
      .map((machine) => {
        const avail = adjustedAvail.find(
          (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
        );
        const baseCount = avail?.baseCount || 0;
        const pinjamCount = avail?.pinjamCount || 0;
        const sewaCount = avail?.sewaCount || 0;
        const trialCount = avail?.trialCount || 0;
        const totalMesin = avail?.jumlahMesin || 0; // base + pinjam + sewa + trial

        let kebutuhanTotal = 0;
        const lineRequirements: Record<string, number> = {};
        const machineKey = machine.toLowerCase();

        activeLines.forEach((al) => {
          const isACC = al.line.toUpperCase() === 'ACC';
          // Fast O(1) lookup
          const needed = isACC 
              ? (accReqLookup[machineKey] || 0) 
              : (reqLookup[`${al.style}|${machineKey}`] || 0);
              
          lineRequirements[al.line] = needed;
          kebutuhanTotal += needed;
        });

        const gap = totalMesin - kebutuhanTotal;

        return {
          machine,
          baseCount,
          pinjamCount,
          sewaCount,
          trialCount,
          totalMesin,
          kebutuhanTotal,
          gap,
          lineRequirements,
        };
      });

    // Sort by gap ascending (most negative first), then by machine name
    rows.sort((a, b) => {
      if (a.gap !== b.gap) {
        return a.gap - b.gap;
      }
      return a.machine.localeCompare(b.machine);
    });

    // Calculate totals for bottom row
    const totals = {
      baseCount: rows.reduce((sum, r) => sum + r.baseCount, 0),
      pinjamCount: rows.reduce((sum, r) => sum + r.pinjamCount, 0),
      sewaCount: rows.reduce((sum, r) => sum + r.sewaCount, 0),
      trialCount: rows.reduce((sum, r) => sum + r.trialCount, 0),
      totalMesin: rows.reduce((sum, r) => sum + r.totalMesin, 0),
      kebutuhanTotal: rows.reduce((sum, r) => sum + r.kebutuhanTotal, 0),
      gap: rows.reduce((sum, r) => sum + r.gap, 0),
      lineRequirements: {} as Record<string, number>,
    };

    activeLines.forEach((al) => {
      totals.lineRequirements[al.line] = rows.reduce(
        (sum, r) => sum + (r.lineRequirements[al.line] || 0),
        0,
      );
    });

    return { rows, totals };
  }, [availabilities, requirements, activeLines, startDate, endDate, rentalTrialRecords]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden transition-colors">
      {/* Header & Filter */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 transition-colors">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Detail Layout Matrix
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Rincian kebutuhan per mesin dan per line berdasarkan style terakhir pada tanggal/week terpilih.
          </p>
        </div>

        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {/* Quick scroll controls */}
          {activeLines.length > 0 && (
            <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5 shadow-sm">
              <button
                type="button"
                onClick={handleScrollLeft}
                title="Geser ke Kiri (Ringkasan / Line sebelumnya)"
                aria-label="Geser ke Kiri"
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-600 dark:text-slate-300 px-2 select-none whitespace-nowrap">
                Line Style
              </span>
              <button
                type="button"
                onClick={handleScrollRight}
                title="Geser ke Kanan (Line berikutnya)"
                aria-label="Geser ke Kanan"
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 active:bg-slate-200 dark:active:bg-slate-600 text-slate-700 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Tanggal / Week:
            </span>
          </div>

          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={(date) =>
              setDateRange((prev) => ({ ...prev, startDate: date }))
            }
            onEndDateChange={(date) =>
              setDateRange((prev) => ({ ...prev, endDate: date }))
            }
            align="right"
          />
        </div>
      </div>

      {/* Matrix Table */}
      <div ref={tableRef} className="flex-1 overflow-auto relative scroll-smooth">
          {activeLines.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
              <AlertCircle className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" />
              <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">
                Tidak ada Plan Produksi  untuk tanggal terpilih
              </p>
              <p className="text-xs mt-1 text-slate-400 dark:text-slate-500">
                Silakan pilih tanggal lain yang memiliki rencana produksi.
              </p>
            </div>
          ) : (
            <table className="w-full text-[11px] sm:text-xs text-right border-separate border-spacing-0 whitespace-nowrap">
              <thead className="sticky top-0 z-20 shadow-sm text-slate-700 dark:text-slate-300">
                {/* Header Row 1: Styles */}
                <tr className="bg-emerald-600 dark:bg-emerald-800 text-[10px] uppercase font-bold tracking-widest text-emerald-50 dark:text-emerald-100">
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-30 bg-emerald-700 dark:bg-emerald-900 px-4 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 text-left align-middle min-w-[200px] shadow-[2px_0_5px_rgba(0,0,0,0.15)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.35)]"
                  >
                    JENIS MESIN
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-28 min-w-[112px] text-center align-middle leading-tight whitespace-normal"
                  >
                    Available Pringapus
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-20 min-w-[80px] text-center align-middle leading-tight"
                  >
                    Pinjam
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-20 min-w-[80px] text-center align-middle leading-tight"
                  >
                    Sewa
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-20 min-w-[80px] text-center align-middle leading-tight"
                  >
                    Trial
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-32 min-w-[128px] text-center align-middle leading-tight whitespace-normal"
                  >
                    Total Available Mesin
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-32 min-w-[128px] text-center align-middle leading-tight whitespace-normal"
                  >
                    Total Kebutuhan
                  </th>
                  <th
                    rowSpan={2}
                    className="bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-16 min-w-[64px] text-center align-middle"
                  >
                    Gap
                  </th>
                <th className="px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 bg-emerald-700 dark:bg-emerald-900 w-16 text-center align-middle">
                  Style
                </th>
                {activeLines.map((al) => (
                  <th
                    key={`style-${al.line}`}
                    className="px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 bg-emerald-600 dark:bg-emerald-800 text-center whitespace-normal min-w-[110px] align-middle text-emerald-50 dark:text-emerald-100 text-[10px] leading-tight normal-case font-semibold tracking-normal"
                    title={
                      al.displayStyles.length > 1
                        ? `Menampilkan ${al.displayStyles.length} style pada rentang ini: ${al.displayStyles.join(", ")}. Perhitungan mesin menggunakan style terakhir (${al.style}).`
                        : al.style
                    }
                  >
                    <div className="flex flex-col items-center justify-center gap-1 py-0.5">
                      {al.displayStyles.map((s, idx) => (
                        <span
                          key={idx}
                          className={`block leading-tight text-center ${
                            al.displayStyles.length > 1
                              ? "bg-emerald-700/60 dark:bg-emerald-950/60 px-1.5 py-1 rounded border border-emerald-400/20 w-full"
                              : ""
                          }`}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </th>
                ))}
              </tr>
              {/* Header Row 2: Lines */}
              <tr className="bg-emerald-600 dark:bg-emerald-800 text-[10px] uppercase font-bold tracking-widest text-emerald-100 dark:text-emerald-200">
                <th className="px-3 py-2 border-r border-b border-emerald-500/50 dark:border-emerald-700 text-center align-middle bg-emerald-700 dark:bg-emerald-900">
                  Line
                </th>
                {activeLines.map((al) => (
                  <th
                    key={`line-${al.line}`}
                    className="px-3 py-2 border-r border-b border-emerald-500/50 dark:border-emerald-700 bg-emerald-600 dark:bg-emerald-800 text-center align-middle text-[11px] tracking-widest text-emerald-50 dark:text-emerald-100"
                  >
                    {al.line}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-900">
              {tableData.rows.map((row) => (
                <tr
                  key={row.machine}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group"
                >
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-3 border-r border-slate-200 dark:border-slate-700 text-left font-semibold text-slate-700 dark:text-slate-300 shadow-[2px_0_5px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.25)]">
                    {row.machine}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center">
                    {row.baseCount > 0 ? row.baseCount : "-"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center text-red-600 dark:text-red-400 font-semibold">
                    {row.pinjamCount > 0 ? `+${row.pinjamCount}` : "-"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center text-amber-600 dark:text-amber-400 font-semibold">
                    {row.sewaCount > 0 ? `+${row.sewaCount}` : "-"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center text-indigo-600 dark:text-indigo-400 font-semibold">
                    {row.trialCount > 0 ? `+${row.trialCount}` : "-"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold text-base">
                    {row.totalMesin > 0 ? row.totalMesin : "-"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center">
                    {row.kebutuhanTotal > 0 ? row.kebutuhanTotal : "-"}
                  </td>
                  <td
                    className={`px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold ${row.gap < 0 ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-800" : "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-emerald-600 dark:text-emerald-500"}`}
                  >
                    {row.gap !== 0 ? row.gap : "0"}
                  </td>
                  <td className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 text-center">
                    {/* Empty cell under "Style" / "Line" */}
                  </td>
                  {activeLines.map((al) => (
                    <td
                      key={`${row.machine}-${al.line}`}
                      className="px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center text-slate-600 dark:text-slate-400 font-medium"
                    >
                      {row.lineRequirements[al.line] > 0
                        ? row.lineRequirements[al.line]
                        : ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {/* Footer Row (Totals) */}
            <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 shadow-[0_-1px_0_0_#cbd5e1] dark:shadow-[0_-1px_0_0_#475569]">
              <tr className="font-bold text-slate-800 dark:text-slate-200">
                <td className="sticky left-0 z-30 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-3 border-r border-slate-300 dark:border-slate-600 text-left shadow-[2px_0_5px_rgba(0,0,0,0.15)] dark:shadow-[2px_0_5px_rgba(0,0,0,0.35)]">
                  Total
                </td>
                <td className="px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center">
                  {tableData.totals.baseCount}
                </td>
                <td className="text-red-700 dark:text-red-400 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center font-bold">
                  {tableData.totals.pinjamCount > 0 ? `+${tableData.totals.pinjamCount}` : "0"}
                </td>
                <td className="text-amber-700 dark:text-amber-400 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center font-bold">
                  {tableData.totals.sewaCount > 0 ? `+${tableData.totals.sewaCount}` : "0"}
                </td>
                <td className="text-indigo-700 dark:text-indigo-400 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center font-bold">
                  {tableData.totals.trialCount > 0 ? `+${tableData.totals.trialCount}` : "0"}
                </td>
                <td className="text-slate-800 dark:text-slate-200 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center">
                  {tableData.totals.totalMesin}
                </td>
                <td className="text-slate-800 dark:text-slate-200 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center">
                  {tableData.totals.kebutuhanTotal}
                </td>
                <td
                  className={`px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center ${tableData.totals.gap < 0 ? "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400"}`}
                >
                  {tableData.totals.gap}
                </td>
                <td className="px-3 py-3 border-r border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700 text-center"></td>
                {activeLines.map((al) => (
                  <td
                    key={`total-${al.line}`}
                    className="px-3 py-3 border-r border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-center text-slate-800 dark:text-slate-200 font-bold"
                  >
                    {tableData.totals.lineRequirements[al.line] > 0
                      ? tableData.totals.lineRequirements[al.line]
                      : ""}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
};
