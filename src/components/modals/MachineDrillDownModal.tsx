import React from "react";
import {
  X,
  Wrench,
  Layers,
  CheckCircle2,
  TrendingUp,
  ShieldAlert,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { DrillDownData } from "../../types/mrp";
import { formatDecimal, formatSignedDecimal } from "../../utils/formatters";

interface MachineDrillDownModalProps {
  data: DrillDownData | null;
  onClose: () => void;
}

export const MachineDrillDownModal: React.FC<MachineDrillDownModalProps> = ({
  data,
  onClose,
}) => {
  const [sortField, setSortField] = React.useState<"line" | "required" | "date">("line");
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">("asc");

  if (!data) return null;

  const handleSort = (field: "line" | "required" | "date") => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedLineDetails = [...data.lineDetails].sort((a, b) => {
    if (sortField === "line") {
      return sortOrder === "asc"
        ? a.line.localeCompare(b.line, undefined, { numeric: true, sensitivity: 'base' })
        : b.line.localeCompare(a.line, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sortField === "date") {
      return sortOrder === "asc"
        ? (a.date || "").localeCompare(b.date || "")
        : (b.date || "").localeCompare(a.date || "");
    } else {
      return sortOrder === "asc"
        ? a.required - b.required
        : b.required - a.required;
    }
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 transition-colors">
        {/* Modal Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
                  {data.machine} &ndash; Drill Down Analysis
                </h2>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold border transition-colors ${
                    data.status === "Shortage"
                      ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50"
                      : data.status === "Balanced"
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                        : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                  }`}
                >
                  {data.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-3.5 transition-colors">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                Total Required
              </span>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                {formatDecimal(data.totalRequired)}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">units needed</span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-3.5 transition-colors">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                Total Available
              </span>
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">
                {formatDecimal(data.totalAvailable)}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                factory inventory
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-3.5 transition-colors">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                Gap (Available - Req)
              </span>
              <div
                className={`text-2xl font-bold mt-1 ${
                  data.gap < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatSignedDecimal(data.gap)}
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                {data.gap < 0 ? "deficit" : "surplus"}
              </span>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-xl p-3.5 transition-colors">
              <span className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                Utilization
              </span>
              <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {formatDecimal(data.utilization)}%
              </div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">capacity load</span>
            </div>
          </div>

          {/* IE Action Recommendation Box */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3 transition-colors ${
              data.status === "Shortage"
                ? "bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50 text-red-900 dark:text-red-200"
                : data.status === "Balanced"
                  ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50 text-blue-900 dark:text-blue-200"
                  : "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/50 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {data.status === "Shortage" ? (
                <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
              ) : data.status === "Balanced" ? (
                <CheckCircle2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="text-xs sm:text-sm leading-relaxed">
              <div className="font-bold mb-1 uppercase tracking-wider text-[11px]">
                Rekomendasi Tindakan:
              </div>
              {data.recommendation}
            </div>
          </div>

          {/* Line by Line Breakdown */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center space-x-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                Line mana saja yang menggunakan &amp; berapa kebutuhannya:
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {data.lineDetails.length} active line(s)
              </span>
            </h3>

            {data.lineDetails.length > 0 ? (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden transition-colors">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700 transition-colors">
                      <th className="py-2.5 px-4 text-left">
                        <button
                          onClick={() => handleSort("line")}
                          className="flex items-center space-x-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          <span>Line</span>
                          {sortField === "line" ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-4 text-left">
                        <button
                          onClick={() => handleSort("date")}
                          className="flex items-center space-x-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          <span>Date</span>
                          {sortField === "date" ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                      <th className="py-2.5 px-4">Style</th>
                      <th className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => handleSort("required")}
                          className="flex items-center justify-end space-x-1 ml-auto hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                        >
                          <span>Required (MCN REQ)</span>
                          {sortField === "required" ? (
                            sortOrder === "asc" ? (
                              <ArrowUp className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            ) : (
                              <ArrowDown className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3 h-3" />
                          )}
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-xs sm:text-sm">
                    {sortedLineDetails.map((detail) => (
                      <tr key={detail.line} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-800 dark:text-slate-200">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
                            {detail.line}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-medium">
                          {detail.date 
                            ? new Date(detail.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
                            : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {detail.style}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-slate-900 dark:text-slate-100 text-base">
                          {formatDecimal(detail.required)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 text-xs transition-colors">
                No active lines are scheduled to use this sewing machine type
                today.
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end transition-colors">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Tutup (Close)
          </button>
        </div>
      </div>
    </div>
  );
};
