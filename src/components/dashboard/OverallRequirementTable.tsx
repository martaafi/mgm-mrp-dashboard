import React, { useState, useMemo } from "react";
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { MachineRequirementSummary } from "../../types/mrp";

interface OverallRequirementTableProps {
  data: MachineRequirementSummary[];
  onSelectMachine: (machineType: string) => void;
}

type SortField = "machine" | "required" | "available" | "gap" | "utilization";

export const OverallRequirementTable: React.FC<
  OverallRequirementTableProps
> = ({ data, onSelectMachine }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("gap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    return data
      .filter((item) =>
        item.machine.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortOrder === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        return sortOrder === "asc"
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [data, searchTerm, sortField, sortOrder]);

  // Status badge style helper
  const getStatusBadge = (status: "Available" | "Balanced" | "Shortage") => {
    switch (status) {
      case "Shortage":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-500 mr-1" />
            <span>Shortage</span>
          </span>
        );
      case "Balanced":
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-500 mr-1" />
            <span>Balanced</span>
          </span>
        );
      case "Available":
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-500 mr-1" />
            <span>Available</span>
          </span>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors">
      {/* Table Header / Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2">
            <span>Overall Machine Requirement</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal">
              {filteredAndSortedData.length} Type(s)
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Kebutuhan mesin maksimum pada rentang waktu dipilih</p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search machine code/name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-colors"
          />
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 transition-colors">
              <th className="py-3 px-4 sm:px-6">
                <button
                  onClick={() => handleSort("machine")}
                  className="flex items-center space-x-1 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
                >
                  <span>Machine</span>
                  {sortField === "machine" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 text-center">
                <button
                  onClick={() => handleSort("required")}
                  className="flex items-center justify-center space-x-1 mx-auto hover:text-slate-900 transition-colors"
                >
                  <span>Required</span>
                  {sortField === "required" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 text-center">
                <button
                  onClick={() => handleSort("available")}
                  className="flex items-center justify-center space-x-1 mx-auto hover:text-slate-900 transition-colors"
                >
                  <span>Available</span>
                  {sortField === "available" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 text-right">
                <button
                  onClick={() => handleSort("gap")}
                  className="flex items-center justify-end space-x-1 ml-auto hover:text-slate-900 transition-colors"
                >
                  <span>Gap</span>
                  {sortField === "gap" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 sm:px-6">
                <button
                  onClick={() => handleSort("utilization")}
                  className="flex items-center space-x-1 hover:text-slate-900 transition-colors"
                >
                  <span>Utilization (%)</span>
                  {sortField === "utilization" ? (
                    sortOrder === "asc" ? (
                      <ArrowUp className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowDown className="w-3 h-3 text-indigo-600" />
                    )
                  ) : (
                    <ArrowUpDown className="w-3 h-3" />
                  )}
                </button>
              </th>
              <th className="py-3 px-4 text-center">Lines</th>
              <th className="py-3 px-4 text-right">Drill Down</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            {filteredAndSortedData.map((item) => {
              // Utilization color rules:
              // Hijau = <80%, Kuning = 80–95%, Merah = >95%
              let barColor = "bg-emerald-500";
              let textColor = "text-emerald-600";
              if (item.utilization >= 80 && item.utilization <= 95) {
                barColor = "bg-amber-400";
                textColor = "text-amber-600";
              } else if (item.utilization > 95) {
                barColor = "bg-red-500";
                textColor = "text-red-600";
              }

              return (
                <tr
                  key={item.machine}
                  onClick={() => onSelectMachine(item.machine)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                >
                  <td className="py-3.5 px-4 sm:px-6">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {item.machine}
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                    {item.required}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex flex-col items-center justify-center">
                      {((item.pinjamCount || 0) > 0 || (item.sewaCount || 0) > 0) && (
                        <div className="flex space-x-1 mb-1 z-10">
                          {(item.pinjamCount || 0) > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-red-500 rounded-full shadow-sm leading-none">
                              +{item.pinjamCount} pinjam
                            </span>
                          )}
                          {(item.sewaCount || 0) > 0 && (
                            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-bold text-white bg-amber-500 rounded-full shadow-sm leading-none">
                              +{item.sewaCount} sewa
                            </span>
                          )}
                        </div>
                      )}
                      <span className="text-slate-700 dark:text-slate-300 font-medium text-base">
                        {item.baseCount ?? 0}
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold">
                    <span
                      className={`px-2 py-0.5 rounded-md ${
                        item.gap < 0
                          ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                          : item.gap === 0
                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            : "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                      }`}
                    >
                      {item.gap > 0 ? `+${item.gap}` : item.gap}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    {getStatusBadge(item.status)}
                  </td>
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center space-x-3">
                      <div className="w-24 bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-200 dark:border-slate-700">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{
                            width: `${Math.min(item.utilization, 100)}%`,
                          }}
                        />
                      </div>
                      <span className={`font-bold text-xs ${textColor}`}>
                        {item.utilization}%
                      </span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-center text-slate-700 dark:text-slate-300 font-semibold">
                    {item.linesCount}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectMachine(item.machine);
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50 transition-colors"
                      title="Drill down line usage details"
                    >
                      <span>Detail</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {filteredAndSortedData.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm"
                >
                  No machines matching current filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
