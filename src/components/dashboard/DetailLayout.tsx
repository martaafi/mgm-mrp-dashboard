import React, { useState, useMemo } from "react";
import { Calendar, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
} from "../../types/mrp";

interface DetailLayoutProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  initialDate?: string;
}

export const DetailLayout: React.FC<DetailLayoutProps> = ({
  plans,
  requirements,
  availabilities,
  initialDate,
}) => {
  // Use initialDate if provided, otherwise default to today's date in YYYY-MM-DD
  const defaultDate = initialDate || new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // 1. Get active lines and their styles for the selected date
  const activeLines = useMemo(() => {
    const linesMap: Record<string, { style: string; displayStyle: string }> =
      {};

    // Filter plans by date and keep the latest entry for each line, ignore 'no plan'
    plans.forEach((p) => {
      if (
        p.date === selectedDate &&
        p.style &&
        !p.style.toLowerCase().includes("no plan")
      ) {
        linesMap[p.line] = {
          style: p.style,
          displayStyle: p.displayStyle || p.style,
        };
      }
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
  }, [plans, selectedDate]);

  // 2. Prepare machine rows
  const tableData = useMemo(() => {
    // Collect all machine types
    const machineTypes = new Set(availabilities.map((a) => a.jenisMesin));

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
        const avail = availabilities.find(
          (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
        );
        const baseCount = avail?.baseCount || 0;
        const pinjamCount = avail?.pinjamCount || 0;
        const sewaCount = avail?.sewaCount || 0;
        const totalMesin = avail?.jumlahMesin || 0; // base + pinjam + sewa

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
  }, [availabilities, requirements, activeLines]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col h-full overflow-hidden transition-colors">
      {/* Header & Filter */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50 transition-colors">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
            Detail Layout Matrix
          </h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400">
            Rincian kebutuhan per mesin dan per line untuk satu hari spesifik.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-300">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Tanggal:
            </span>
          </div>
          <div className="relative flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500 dark:focus-within:border-indigo-400 shadow-sm transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 mr-1.5 shrink-0" />
            <span className="text-xs font-medium text-slate-800 dark:text-slate-200 cursor-pointer pointer-events-none">
              {format(new Date(selectedDate), "dd MMM yyyy")}
            </span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker();
                } catch (err) {
                  // Fallback for older browsers
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto relative">
        {activeLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
            <AlertCircle className="w-8 h-8 mb-2 text-slate-400 dark:text-slate-500" />
            <p>
              Tidak ada data Production Plan untuk tanggal{" "}
              {format(new Date(selectedDate), "dd MMM yyyy")}.
            </p>
            <p className="text-xs mt-1">
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
                  className="sticky left-0 z-30 bg-emerald-700 dark:bg-emerald-900 px-4 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 text-left align-middle min-w-[200px] shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  JENIS MESIN
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[200px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-24 min-w-[96px] text-center align-middle leading-tight shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Available
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[296px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-24 min-w-[96px] text-center align-middle leading-tight shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Pringapus
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[392px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-20 min-w-[80px] text-center align-middle leading-tight shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Pinjam
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[472px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-20 min-w-[80px] text-center align-middle leading-tight shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Sewa
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[552px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-32 min-w-[128px] text-center align-middle leading-tight shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Total Kebutuhan
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[680px] z-30 bg-emerald-600 dark:bg-emerald-800 px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 w-16 min-w-[64px] text-center align-middle shadow-[1px_0_0_0_#10b981] dark:shadow-[1px_0_0_0_#065f46]"
                >
                  Gap
                </th>
                <th className="px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 bg-emerald-700 dark:bg-emerald-900 w-16 text-center align-middle">
                  Style
                </th>
                {activeLines.map((al) => (
                  <th
                    key={`style-${al.line}`}
                    className="px-3 py-3 border-r border-b border-emerald-500/50 dark:border-emerald-700 bg-emerald-600 dark:bg-emerald-800 text-center whitespace-normal min-w-[100px] align-middle text-emerald-50 dark:text-emerald-100 text-[10px] leading-tight normal-case font-semibold tracking-normal"
                  >
                    {al.displayStyle}
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
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-4 py-3 border-r border-slate-200 dark:border-slate-700 text-left font-semibold text-slate-700 dark:text-slate-300 shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">
                    {row.machine}
                  </td>
                  <td className="sticky left-[200px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155] font-bold text-base">
                    {row.totalMesin > 0 ? row.totalMesin : "-"}
                  </td>
                  <td className="sticky left-[296px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">
                    {row.baseCount > 0 ? row.baseCount : "-"}
                  </td>
                  <td className="sticky left-[392px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155] text-red-600 dark:text-red-400 font-semibold">
                    {row.pinjamCount > 0 ? `+${row.pinjamCount}` : "-"}
                  </td>
                  <td className="sticky left-[472px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155] text-amber-600 dark:text-amber-400 font-semibold">
                    {row.sewaCount > 0 ? `+${row.sewaCount}` : "-"}
                  </td>
                  <td className="sticky left-[552px] z-10 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155]">
                    {row.kebutuhanTotal > 0 ? row.kebutuhanTotal : "-"}
                  </td>
                  <td
                    className={`sticky left-[680px] z-10 px-3 py-3 border-r border-slate-200 dark:border-slate-700 text-center font-bold shadow-[1px_0_0_0_#e2e8f0] dark:shadow-[1px_0_0_0_#334155] ${row.gap < 0 ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 group-hover:bg-red-200 dark:group-hover:bg-red-800" : "bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800 text-emerald-600 dark:text-emerald-500"}`}
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
                <td className="sticky left-0 z-30 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-3 border-r border-slate-300 dark:border-slate-600 text-left shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569]">
                  Total
                </td>
                <td className="sticky left-[200px] z-30 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569]">
                  {tableData.totals.totalMesin}
                </td>
                <td className="sticky left-[296px] z-30 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569]">
                  {tableData.totals.baseCount}
                </td>
                <td className="sticky left-[392px] z-30 bg-slate-200 dark:bg-slate-700 text-red-700 dark:text-red-400 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569] font-bold">
                  {tableData.totals.pinjamCount > 0 ? `+${tableData.totals.pinjamCount}` : "0"}
                </td>
                <td className="sticky left-[472px] z-30 bg-slate-200 dark:bg-slate-700 text-amber-700 dark:text-amber-400 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569] font-bold">
                  {tableData.totals.sewaCount > 0 ? `+${tableData.totals.sewaCount}` : "0"}
                </td>
                <td className="sticky left-[552px] z-30 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569]">
                  {tableData.totals.kebutuhanTotal}
                </td>
                <td
                  className={`sticky left-[680px] z-30 px-3 py-3 border-r border-slate-300 dark:border-slate-600 text-center shadow-[1px_0_0_0_#cbd5e1] dark:shadow-[1px_0_0_0_#475569] ${tableData.totals.gap < 0 ? "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-300" : "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-400"}`}
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
