import React, { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import {
  Search,
  ArrowUpDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Info,
  Cpu,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { MachineRequirementSummary, LineMachineMatrixRow } from "../../types/mrp";

interface OverallRequirementTableProps {
  data: MachineRequirementSummary[];
  lineMatrix: LineMachineMatrixRow[];
  onSelectMachine: (machineType: string) => void;
}

type SortField = "machine" | "required" | "available" | "gap" | "utilization";
type TabType = "mesin" | "style";

const formatNumber = (num: number | null | undefined): string => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  const rounded = Math.round(num * 100) / 100;
  return rounded.toString();
};

export const OverallRequirementTable: React.FC<
  OverallRequirementTableProps
> = ({ data, lineMatrix, onSelectMachine }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("gap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<TabType>("mesin");
  const [styleSearchTerm, setStyleSearchTerm] = useState("");
  const [expandedStyles, setExpandedStyles] = useState<Set<string>>(new Set());

  const toggleStyleExpand = (styleKey: string) => {
    setExpandedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(styleKey)) {
        next.delete(styleKey);
      } else {
        next.add(styleKey);
      }
      return next;
    });
  };

  const [tooltipState, setTooltipState] = useState<{
    details: NonNullable<MachineRequirementSummary["variationDetails"]>;
    x: number;
    y: number;
  } | null>(null);

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
        const valA = a[sortField];
        const valB = b[sortField];
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

  // Shortage machine lookup for fast matching
  const shortageMachineMap = useMemo(() => {
    const map = new Map<string, MachineRequirementSummary>();
    data.forEach((item) => {
      const available =
        (item.baseCount ?? 0) +
        (item.pinjamCount || 0) +
        (item.sewaCount || 0) +
        (item.trialCount || 0);
      const gap = item.gap !== undefined ? item.gap : available - item.required;
      if (item.status === "Shortage" || gap < 0) {
        map.set(item.machine.trim().toUpperCase(), item);
      }
    });
    return map;
  }, [data]);

  // Build style detail data: group by line, show style name, total machines, and machine breakdown
  const styleDetailData = useMemo(() => {
    // Group lineMatrix rows by line
    const lineMap = new Map<string, LineMachineMatrixRow[]>();
    lineMatrix.forEach((row) => {
      const existing = lineMap.get(row.line) || [];
      existing.push(row);
      lineMap.set(row.line, existing);
    });

    const getShortageInfo = (machines: Record<string, number>) => {
      const shortageMachines: string[] = [];
      Object.entries(machines).forEach(([machine, count]) => {
        if (count > 0 && shortageMachineMap.has(machine.trim().toUpperCase())) {
          shortageMachines.push(machine);
        }
      });
      return {
        hasShortage: shortageMachines.length > 0,
        shortageMachines,
      };
    };

    // Build summary per line
    const result = Array.from(lineMap.entries()).map(([line, rows]) => {
      // Merge all machine requirements across styles in the same line
      const machineReqMap: Record<string, number> = {};
      let totalMachines = 0;
      rows.forEach((row) => {
        Object.entries(row.machines).forEach(([machine, count]) => {
          machineReqMap[machine] = (machineReqMap[machine] || 0) + count;
          totalMachines += count;
        });
      });

      // Sort rows chronologically by date
      const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));

      // Group consecutive rows with the same style into distinct periods
      interface StylePeriod {
        style: string;
        kodeStyle: string;
        startDate: string;
        endDate: string;
        machines: Record<string, number>;
        totalMachines: number;
        hasShortage: boolean;
        shortageMachines: string[];
      }

      const styles: StylePeriod[] = [];

      sortedRows.forEach((r) => {
        const lastPeriod = styles[styles.length - 1];
        if (
          lastPeriod &&
          lastPeriod.style === r.style &&
          lastPeriod.kodeStyle === (r.kodeStyle || "")
        ) {
          lastPeriod.endDate = r.date;
          if (r.totalMachines > 0 && lastPeriod.totalMachines === 0) {
            lastPeriod.totalMachines = r.totalMachines;
            lastPeriod.machines = { ...r.machines };
            const info = getShortageInfo(lastPeriod.machines);
            lastPeriod.hasShortage = info.hasShortage;
            lastPeriod.shortageMachines = info.shortageMachines;
          }
        } else {
          const info = getShortageInfo(r.machines);
          styles.push({
            style: r.style,
            kodeStyle: r.kodeStyle || "",
            startDate: r.date,
            endDate: r.date,
            machines: { ...r.machines },
            totalMachines: r.totalMachines,
            hasShortage: info.hasShortage,
            shortageMachines: info.shortageMachines,
          });
        }
      });

      // Sort styles within this line: strictly chronological by date
      styles.sort((a, b) => a.startDate.localeCompare(b.startDate));

      const lineHasShortage = styles.some((s) => s.hasShortage);

      return {
        line,
        styles,
        machineReqMap,
        totalMachines,
        hasShortage: lineHasShortage,
      };
    });

    // Helper to score lines based on how many shortages their styles have
    const getLineShortageScore = (item: (typeof result)[0]) => {
      // Total shortage machine occurrences across all styles in this line
      const totalShortageMachines = item.styles.reduce(
        (sum, s) => sum + s.shortageMachines.length,
        0
      );
      // Total units of shortage machines required by styles in this line
      const totalShortageUnits = item.styles.reduce((sum, s) => {
        let units = 0;
        s.shortageMachines.forEach((m) => {
          units += s.machines[m] || 0;
        });
        return sum + units;
      }, 0);
      // Number of styles with shortage in this line
      const stylesWithShortage = item.styles.filter((s) => s.hasShortage).length;
      // Number of unique shortage machine types in this line
      const uniqueShortageMachines = new Set(
        item.styles.flatMap((s) => s.shortageMachines)
      ).size;

      return {
        totalShortageMachines,
        totalShortageUnits,
        stylesWithShortage,
        uniqueShortageMachines,
      };
    };

    // Sort lines: prioritize lines based on the amount of shortage in styles of that line
    result.sort((a, b) => {
      const aScore = getLineShortageScore(a);
      const bScore = getLineShortageScore(b);

      const aHasShortage = aScore.totalShortageMachines > 0;
      const bHasShortage = bScore.totalShortageMachines > 0;

      // Lines with shortage come before lines without shortage
      if (aHasShortage && !bHasShortage) return -1;
      if (!aHasShortage && bHasShortage) return 1;

      // 1. Prioritize by total shortage machine occurrences in styles (descending)
      if (aScore.totalShortageMachines !== bScore.totalShortageMachines) {
        return bScore.totalShortageMachines - aScore.totalShortageMachines;
      }

      // 2. If tied, prioritize by total units of shortage machines required (descending)
      if (aScore.totalShortageUnits !== bScore.totalShortageUnits) {
        return bScore.totalShortageUnits - aScore.totalShortageUnits;
      }

      // 3. If tied, prioritize by number of styles with shortage (descending)
      if (aScore.stylesWithShortage !== bScore.stylesWithShortage) {
        return bScore.stylesWithShortage - aScore.stylesWithShortage;
      }

      // 4. If tied, prioritize by unique shortage machine types (descending)
      if (aScore.uniqueShortageMachines !== bScore.uniqueShortageMachines) {
        return bScore.uniqueShortageMachines - aScore.uniqueShortageMachines;
      }

      // 5. Natural line sort (G01, G02, ...)
      return a.line.localeCompare(b.line, undefined, { numeric: true });
    });

    return result;
  }, [lineMatrix, shortageMachineMap]);

  const filteredStyleData = useMemo(() => {
    if (!styleSearchTerm) return styleDetailData;
    const term = styleSearchTerm.toLowerCase();
    return styleDetailData.filter(
      (item) =>
        item.line.toLowerCase().includes(term) ||
        item.styles.some(
          (s) =>
            s.style.toLowerCase().includes(term) ||
            s.kodeStyle.toLowerCase().includes(term) ||
            s.shortageMachines.some((m) => m.toLowerCase().includes(term)),
        ),
    );
  }, [styleDetailData, styleSearchTerm]);

  const totalShortageStylesCount = useMemo(() => {
    return filteredStyleData.reduce((acc, line) => {
      return acc + line.styles.filter((s) => s.hasShortage).length;
    }, 0);
  }, [filteredStyleData]);

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
          <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center space-x-2 flex-wrap gap-y-1">
            <span>Overall Machine Requirement</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-normal">
              {activeTab === "mesin"
                ? `${filteredAndSortedData.length} Type(s)`
                : `${filteredStyleData.length} Line(s)`}
            </span>
            {activeTab === "style" && totalShortageStylesCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 font-bold border border-red-200 dark:border-red-800 flex items-center gap-1 shadow-sm animate-pulse">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>{totalShortageStylesCount} Style Shortage</span>
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {activeTab === "mesin"
              ? "Kebutuhan mesin maksimum pada rentang waktu dipilih"
              : "Detail style per line dan kebutuhan mesin masing-masing"}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Tabs - matching History PPIC style */}
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden shadow-sm">
            <button
              onClick={() => {
                setActiveTab("mesin");
                setExpandedStyles(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer border-r border-slate-300 dark:border-slate-600 ${
                activeTab === "mesin"
                  ? "bg-indigo-500 text-white shadow-inner"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              Ketersediaan Mesin
            </button>
            <button
              onClick={() => {
                setActiveTab("style");
                setExpandedStyles(new Set());
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                activeTab === "style"
                  ? "bg-indigo-500 text-white shadow-inner"
                  : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Detail Style
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder={
                activeTab === "mesin"
                  ? "Search machine code/name..."
                  : "Search line/style..."
              }
              value={activeTab === "mesin" ? searchTerm : styleSearchTerm}
              onChange={(e) =>
                activeTab === "mesin"
                  ? setSearchTerm(e.target.value)
                  : setStyleSearchTerm(e.target.value)
              }
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-white dark:focus:bg-slate-800 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Tab Content: Ketersediaan Mesin */}
      {activeTab === "mesin" && (
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
                <th className="py-3 px-4 text-center text-slate-500 dark:text-slate-400 font-bold tracking-widest uppercase">
                  Detail Ketersediaan
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
                      <div className="flex items-center space-x-1.5">
                        <div className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {item.machine}
                        </div>
                        {item.variationDetails && item.variationDetails.length > 0 && (
                          <div 
                            className="flex items-center"
                            onMouseEnter={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              setTooltipState({
                                details: item.variationDetails!,
                                x: rect.left + rect.width / 2,
                                y: rect.top,
                              });
                            }}
                            onMouseLeave={() => setTooltipState(null)}
                          >
                            <Info className="w-4 h-4 text-blue-500 cursor-help" />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200 text-base">
                      {(item.baseCount ?? 0) + (item.pinjamCount || 0) + (item.sewaCount || 0) + (item.trialCount || 0)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-slate-500 rounded-full shadow-sm leading-none w-max">
                          {item.baseCount ?? 0} pringapus
                        </span>
                        {(item.pinjamCount || 0) > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-red-500 rounded-full shadow-sm leading-none w-max">
                            +{item.pinjamCount} pinjam
                          </span>
                        )}
                        {(item.sewaCount || 0) > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-amber-500 rounded-full shadow-sm leading-none w-max">
                            +{item.sewaCount} sewa
                          </span>
                        )}
                        {(item.trialCount || 0) > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-bold text-white bg-indigo-500 rounded-full shadow-sm leading-none w-max">
                            +{item.trialCount} trial
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-bold text-slate-800 dark:text-slate-200">
                      {formatNumber(item.required)}
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
                        {item.gap > 0 ? `+${formatNumber(item.gap)}` : formatNumber(item.gap)}
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
                    colSpan={9}
                    className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm"
                  >
                    No machines matching current filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab Content: Detail Style */}
      {activeTab === "style" && (
        <div className="overflow-x-auto">
          {filteredStyleData.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400 transition-colors">
                  <th className="py-3 px-4 sm:px-6 min-w-[80px]">Line</th>
                  <th className="py-3 px-4 min-w-[200px]">Style</th>
                  <th className="py-3 px-4 text-center min-w-[80px]">Tanggal</th>
                  <th className="py-3 px-4 text-center min-w-[100px]">Total Mesin</th>
                  <th className="py-3 px-4 text-center min-w-[80px]">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
                {filteredStyleData.map((lineData) => {
                  const totalLineRows = lineData.styles.reduce(
                    (sum, s) =>
                      sum +
                      1 +
                      (expandedStyles.has(`${lineData.line}_${s.style}_${s.startDate}`) ? 1 : 0),
                    0
                  );

                  return (
                    <React.Fragment key={lineData.line}>
                      {lineData.styles.map((style, idx) => {
                        const styleKey = `${lineData.line}_${style.style}_${style.startDate}`;
                        const isStyleExpanded = expandedStyles.has(styleKey);

                        return (
                          <React.Fragment key={styleKey}>
                            {/* Main style row */}
                            <tr
                              className={`cursor-pointer transition-colors group ${
                                style.hasShortage
                                  ? "bg-red-50/50 dark:bg-red-950/25 hover:bg-red-100/60 dark:hover:bg-red-900/40 border-l-4 border-l-red-500"
                                  : "hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-4 border-l-transparent"
                              }`}
                              onClick={() => toggleStyleExpand(styleKey)}
                            >
                              {idx === 0 && (
                                <td
                                  className="py-3.5 px-4 sm:px-6 font-bold text-slate-800 dark:text-slate-200 align-top"
                                  rowSpan={totalLineRows}
                                >
                                  <div className="flex items-center gap-1.5 sticky top-2">
                                    <span
                                      className={`px-2 py-0.5 rounded text-xs font-bold border ${
                                        lineData.hasShortage
                                          ? "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800 shadow-sm"
                                          : "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                                      }`}
                                    >
                                      {lineData.line}
                                    </span>
                                    {lineData.hasShortage && (
                                      <span
                                        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800"
                                        title="Line ini memiliki style dengan kekurangan (shortage) mesin"
                                      >
                                        <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400" />
                                      </span>
                                    )}
                                  </div>
                                </td>
                              )}
                              <td className="py-3.5 px-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`font-semibold transition-colors ${
                                        style.hasShortage
                                          ? "text-red-700 dark:text-red-400 group-hover:text-red-800 dark:group-hover:text-red-300 font-bold"
                                          : "text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                                      }`}
                                    >
                                      {style.style}
                                    </span>
                                    {style.hasShortage && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-800/70 shadow-sm animate-pulse">
                                        <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
                                        <span>Shortage ({style.shortageMachines.join(", ")})</span>
                                      </span>
                                    )}
                                  </div>
                                  {style.kodeStyle && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                      {style.kodeStyle}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td
                                className={`py-3.5 px-4 text-center whitespace-nowrap ${
                                  style.hasShortage
                                    ? "text-red-800 dark:text-red-300 font-medium"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}
                              >
                                {style.startDate ? (
                                  style.startDate === style.endDate ? (
                                    format(new Date(style.startDate + "T00:00:00"), "dd MMM yyyy")
                                  ) : (
                                    <span>
                                      {format(new Date(style.startDate + "T00:00:00"), "dd MMM yyyy")}
                                      <span className="text-slate-400 dark:text-slate-500 mx-1.5 font-normal">s/d</span>
                                      {format(new Date(style.endDate + "T00:00:00"), "dd MMM yyyy")}
                                    </span>
                                  )
                                ) : (
                                  "-"
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span
                                  className={`inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold rounded-md border ${
                                    style.hasShortage
                                      ? "text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/50 border-red-300 dark:border-red-800/60 shadow-sm"
                                      : "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/50"
                                  }`}
                                >
                                  {formatNumber(style.totalMachines)}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStyleExpand(styleKey);
                                  }}
                                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                    isStyleExpanded
                                      ? style.hasShortage
                                        ? "bg-red-600 text-white shadow-sm"
                                        : "bg-indigo-600 text-white shadow-sm"
                                      : style.hasShortage
                                        ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 border border-red-300 dark:border-red-800/60"
                                        : "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/50"
                                  }`}
                                  title={isStyleExpanded ? "Tutup detail mesin" : "Lihat detail kebutuhan mesin"}
                                >
                                  <span>{isStyleExpanded ? "Tutup" : "Mesin"}</span>
                                  {isStyleExpanded ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </td>
                            </tr>

                            {/* Expanded machine breakdown for THIS style only, placed directly below this style row */}
                            {isStyleExpanded && (
                              <tr
                                key={`${styleKey}-breakdown`}
                                className={style.hasShortage ? "bg-red-50/40 dark:bg-red-950/20" : "bg-slate-50/70 dark:bg-slate-800/50"}
                              >
                                <td colSpan={4} className="p-0 border-b border-slate-200 dark:border-slate-800">
                                  <div className="border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                                    <div
                                      className={`px-6 py-2 border-b flex items-center justify-between ${
                                        style.hasShortage
                                          ? "bg-red-100/80 dark:bg-red-950/60 border-red-200 dark:border-red-800/60"
                                          : "bg-slate-100/90 dark:bg-slate-700/50 border-slate-200/60 dark:border-slate-700/60"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2 flex-wrap">
                                        {style.hasShortage && (
                                          <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
                                        )}
                                        <span
                                          className={`text-[11px] font-semibold ${
                                            style.hasShortage
                                              ? "text-red-800 dark:text-red-200 font-bold"
                                              : "text-slate-700 dark:text-slate-200"
                                          }`}
                                        >
                                          Breakdown Mesin: {style.style}
                                        </span>
                                        {style.kodeStyle && (
                                          <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                            ({style.kodeStyle})
                                          </span>
                                        )}
                                        {style.hasShortage && (
                                          <span className="text-[10px] px-2 py-0.5 rounded bg-red-200/80 dark:bg-red-900/60 text-red-800 dark:text-red-200 font-bold border border-red-300 dark:border-red-800">
                                            Shortage: {style.shortageMachines.join(", ")}
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                        Total {formatNumber(style.totalMachines)} unit mesin
                                      </span>
                                    </div>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="bg-slate-100/50 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400 border-b border-slate-200/60 dark:border-slate-700/60">
                                          <th className="px-6 py-2 font-semibold text-left min-w-[160px]">
                                            Jenis Mesin
                                          </th>
                                          <th className="px-4 py-2 font-semibold text-center min-w-[100px]">
                                            Kebutuhan
                                          </th>
                                          <th className="px-4 py-2 font-semibold text-center text-emerald-600 dark:text-emerald-400 min-w-[100px]">
                                            Tersedia
                                          </th>
                                          <th className="px-4 py-2 font-semibold text-center min-w-[80px]">
                                            Gap
                                          </th>
                                          <th className="px-4 py-2 font-semibold text-center min-w-[100px]">
                                            Status
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-200/40 dark:divide-slate-700/40">
                                        {Object.entries(style.machines)
                                          .sort(([mA, a], [mB, b]) => {
                                            const isShortageA = shortageMachineMap.has(mA.trim().toUpperCase());
                                            const isShortageB = shortageMachineMap.has(mB.trim().toUpperCase());
                                            if (isShortageA && !isShortageB) return -1;
                                            if (!isShortageA && isShortageB) return 1;
                                            return b - a;
                                          })
                                          .map(([machine, count]) => {
                                            const machineData = data.find(
                                              (d) => d.machine.trim().toUpperCase() === machine.trim().toUpperCase(),
                                            );
                                            const available = machineData
                                              ? (machineData.baseCount ?? 0) +
                                                (machineData.pinjamCount || 0) +
                                                (machineData.sewaCount || 0) +
                                                (machineData.trialCount || 0)
                                              : 0;
                                            const gap = available - (machineData?.required || count);
                                            const isShortage = gap < 0 || machineData?.status === "Shortage";

                                            let mRowBg =
                                              "hover:bg-slate-100/60 dark:hover:bg-slate-700/40 transition-colors";
                                            if (isShortage) {
                                              mRowBg += " bg-red-50/60 dark:bg-red-950/25";
                                            }

                                            return (
                                              <tr key={machine} className={mRowBg}>
                                                <td className="px-6 py-2.5 font-medium text-slate-700 dark:text-slate-200">
                                                  <div className="flex items-center gap-1.5">
                                                    {isShortage && (
                                                      <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                                    )}
                                                    <span className={isShortage ? "text-red-700 dark:text-red-300 font-bold" : ""}>
                                                      {machine}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-center font-bold text-indigo-600 dark:text-indigo-400">
                                                  {formatNumber(count)}
                                                </td>
                                                <td className="px-4 py-2.5 text-center font-medium text-slate-600 dark:text-slate-300">
                                                  {formatNumber(available)}
                                                </td>
                                                <td
                                                  className={`px-4 py-2.5 text-center font-bold ${
                                                    isShortage
                                                      ? "text-red-600 dark:text-red-400"
                                                      : "text-emerald-600 dark:text-emerald-400"
                                                  }`}
                                                >
                                                  {gap > 0 ? `+${formatNumber(gap)}` : formatNumber(gap)}
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                  {machineData
                                                    ? getStatusBadge(machineData.status)
                                                    : (
                                                      <span className="text-xs text-slate-400">-</span>
                                                    )}
                                                </td>
                                              </tr>
                                            );
                                          })}
                                      </tbody>
                                    </table>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}

                {filteredStyleData.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm"
                    >
                      Tidak ada Plan Produksi  untuk tanggal terpilih
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
              Tidak ada Plan Produksi  untuk tanggal terpilih
            </div>
          )}
        </div>
      )}
      
      {/* Portal for Tooltip to escape overflow: hidden */}
      {tooltipState && createPortal(
        <div 
          className="fixed z-[100] w-64 p-3 bg-slate-800 text-xs text-white rounded shadow-lg text-left font-normal space-y-2 pointer-events-none"
          style={{
            top: tooltipState.y - 8,
            left: tooltipState.x,
            transform: "translate(-50%, -100%)"
          }}
        >
          <div className="font-bold border-b border-slate-600 pb-1 mb-1">
            Rincian Ketersediaan:
          </div>
          {tooltipState.details.map((detail, idx) => (
            <div key={idx} className="flex flex-col gap-0.5">
              <div className="flex justify-between items-start">
                <span className="text-slate-300">
                  {detail.startDate === detail.endDate
                    ? format(new Date(detail.startDate), "dd MMM yyyy")
                    : `${format(new Date(detail.startDate), "dd MMM yyyy")} s/d ${format(new Date(detail.endDate), "dd MMM yyyy")}`}
                </span>
                <span className="font-bold">{detail.jumlahMesin} msn</span>
              </div>
              {detail.expiredRecords && detail.expiredRecords.map((rec, rIdx) => (
                <span key={rIdx} className="text-[10px] text-amber-300 ml-2">
                  ↳ {rec.count} {rec.type} hbs tgl {format(new Date(rec.date), "dd MMM yyyy")}
                </span>
              ))}
            </div>
          ))}
          <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-800"></div>
        </div>,
        document.body
      )}
    </div>
  );
};
