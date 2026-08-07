import React, { useState, useMemo } from "react";
import { Calendar, AlertCircle } from "lucide-react";
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
    
    activeLines.forEach((al) => {
      const styleReqs = requirements.filter(
        (r) => r.style === al.style && r.kebutuhanTotal > 0,
      );
      styleReqs.forEach((r) => {
        const mType = r.jenisMesin.trim().toLowerCase();
        machineTypes.add(r.jenisMesin.trim());
        // Populate fast lookup dictionary: style|machine -> required amount
        reqLookup[`${al.style}|${mType}`] = r.kebutuhanTotal;
      });
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
          // Fast O(1) lookup
          const needed = reqLookup[`${al.style}|${machineKey}`] || 0;
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
      {/* Header & Filter */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50">
        <div>
          <h2 className="text-base font-bold text-slate-800 leading-tight">
            Detail Layout Matrix
          </h2>
          <p className="text-[10px] text-slate-500">
            Rincian kebutuhan per mesin dan per line untuk satu hari spesifik.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-slate-600">
            <span className="text-[10px] font-semibold uppercase tracking-wider">
              Tanggal:
            </span>
          </div>
          <div className="flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500 shadow-sm transition-colors">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto relative">
        {activeLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <AlertCircle className="w-8 h-8 mb-2 text-slate-400" />
            <p>Tidak ada data Production Plan untuk tanggal {selectedDate}.</p>
            <p className="text-xs mt-1">
              Silakan pilih tanggal lain yang memiliki rencana produksi.
            </p>
          </div>
        ) : (
          <table className="w-full text-[10px] sm:text-[11px] text-right border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-20 shadow-sm text-slate-700">
              {/* Header Row 1: Styles */}
              <tr className="bg-emerald-50">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 bg-emerald-100 px-3 py-2 border-r border-b border-emerald-200 text-left font-bold min-w-[150px] text-emerald-800 shadow-[1px_0_0_0_#a7f3d0]"
                >
                  JENIS MESIN
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[150px] z-30 bg-emerald-50 px-2 py-2 border-r border-b border-emerald-200 font-semibold w-16 text-center leading-tight text-emerald-800 shadow-[1px_0_0_0_#a7f3d0]"
                >
                  Available
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[214px] z-30 bg-emerald-50 px-2 py-2 border-r border-b border-emerald-200 font-semibold w-20 text-center leading-tight text-emerald-800 shadow-[1px_0_0_0_#a7f3d0]"
                >
                  Total Kebutuhan
                </th>
                <th
                  rowSpan={2}
                  className="sticky left-[294px] z-30 bg-emerald-50 px-2 py-2 border-r border-b border-emerald-200 font-semibold w-14 text-center text-emerald-800 shadow-[1px_0_0_0_#a7f3d0]"
                >
                  Gap
                </th>
                <th className="px-2 py-2 border-r border-b border-emerald-200 font-bold bg-emerald-100 w-12 text-center text-emerald-800">
                  Style
                </th>
                {activeLines.map((al) => (
                  <th
                    key={`style-${al.line}`}
                    className="px-2 py-2 border-r border-b border-emerald-200 bg-white font-semibold text-center whitespace-normal min-w-[80px] align-bottom text-emerald-900 text-[8px] leading-tight"
                  >
                    {al.displayStyle}
                  </th>
                ))}
              </tr>
              {/* Header Row 2: Lines */}
              <tr className="bg-emerald-50/50">
                <th className="px-2 py-1.5 border-r border-b border-emerald-200 font-bold text-center bg-emerald-100 text-emerald-800">
                  Line
                </th>
                {activeLines.map((al) => (
                  <th
                    key={`line-${al.line}`}
                    className="px-2 py-1.5 border-r border-b border-emerald-200 bg-emerald-50/80 font-bold text-center text-[10px] tracking-wider text-emerald-700"
                  >
                    {al.line}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {tableData.rows.map((row) => (
                <tr
                  key={row.machine}
                  className="hover:bg-indigo-50/50 transition-colors group"
                >
                  <td className="sticky left-0 z-10 bg-white group-hover:bg-indigo-50/50 px-2 py-0.5 border-r border-slate-200 text-left font-semibold text-slate-700 shadow-[1px_0_0_0_#e2e8f0]">
                    {row.machine}
                  </td>
                  <td className="sticky left-[150px] z-10 bg-white group-hover:bg-indigo-50/50 px-2 py-0.5 border-r border-slate-200 text-center shadow-[1px_0_0_0_#e2e8f0]">
                    {row.totalMesin > 0 ? row.totalMesin : "-"}
                  </td>
                  <td className="sticky left-[214px] z-10 bg-white group-hover:bg-indigo-50/50 px-2 py-0.5 border-r border-slate-200 text-center shadow-[1px_0_0_0_#e2e8f0]">
                    {row.kebutuhanTotal > 0 ? row.kebutuhanTotal : "-"}
                  </td>
                  <td
                    className={`sticky left-[294px] z-10 px-2 py-0.5 border-r border-slate-200 text-center font-bold shadow-[1px_0_0_0_#e2e8f0] ${row.gap < 0 ? "bg-red-50 text-red-600 group-hover:bg-red-100" : "bg-white group-hover:bg-indigo-50/50 text-emerald-600"}`}
                  >
                    {row.gap !== 0 ? row.gap : "0"}
                  </td>
                  <td className="px-2 py-0.5 border-r border-slate-200 bg-slate-50 text-center">
                    {/* Empty cell under "Style" / "Line" */}
                  </td>
                  {activeLines.map((al) => (
                    <td
                      key={`${row.machine}-${al.line}`}
                      className="px-2 py-0.5 border-r border-slate-200 text-center text-slate-600 font-medium"
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
            <tfoot className="sticky bottom-0 z-20 bg-slate-100 shadow-[0_-1px_0_0_#cbd5e1]">
              <tr className="font-bold text-slate-800">
                <td className="sticky left-0 z-30 bg-slate-200 text-slate-800 px-2 py-1.5 border-r border-slate-300 text-left shadow-[1px_0_0_0_#cbd5e1]">
                  Total
                </td>
                <td className="sticky left-[150px] z-30 bg-slate-200 text-slate-800 px-2 py-1.5 border-r border-slate-300 text-center shadow-[1px_0_0_0_#cbd5e1]">
                  {tableData.totals.totalMesin}
                </td>
                <td className="sticky left-[214px] z-30 bg-slate-200 text-slate-800 px-2 py-1.5 border-r border-slate-300 text-center shadow-[1px_0_0_0_#cbd5e1]">
                  {tableData.totals.kebutuhanTotal}
                </td>
                <td
                  className={`sticky left-[294px] z-30 px-2 py-1.5 border-r border-slate-300 text-center shadow-[1px_0_0_0_#cbd5e1] ${tableData.totals.gap < 0 ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {tableData.totals.gap}
                </td>
                <td className="px-2 py-1.5 border-r border-slate-300 bg-slate-200 text-center"></td>
                {activeLines.map((al) => (
                  <td
                    key={`total-${al.line}`}
                    className="px-2 py-1.5 border-r border-slate-300 bg-slate-100 text-center text-slate-800 font-bold"
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
