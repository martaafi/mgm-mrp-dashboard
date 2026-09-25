import React, { useState, useMemo, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ComposedChart,
  Line,
  Legend,
  LabelList,
} from "recharts";
import {
  Wrench,
  Clock,
  AlertTriangle,
  TrendingUp,
  Factory,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Settings2,
  Copy,
  Check,
  ExternalLink,
  Info,
  Zap,
  BarChart3,
  Timer,
  RefreshCw,
} from "lucide-react";
import { DowntimeRecord } from "../../types/mrp";
import { DateRangePicker } from "../filters/DateRangePicker";
import {
  DowntimeFilterState,
  filterDowntimeRecords,
  getDowntimeByMachineType,
  getDowntimeTrendByWeek,
  getTopErrors,
  getDowntimeKPIs,
  getUniqueLines,
  getUniqueMachineTypes,
  getUniqueBrands,
} from "../../utils/downtimeCalculations";
import {
  DOWNTIME_GOOGLE_SHEET_URL,
  DOWNTIME_HISTORICAL_GOOGLE_SHEET_URL,
  APPS_SCRIPT_CODE_TEMPLATE,
  getDowntimeAppsScriptUrl,
  setDowntimeAppsScriptUrl,
  getEffectiveDowntimeAppsScriptUrl,
  isUsingDefaultDowntimeAppsScriptUrl,
  DEFAULT_DOWNTIME_APPS_SCRIPT_URL,
} from "../../utils/googleSheetsAPI";
import { formatDecimal } from "../../utils/formatters";

// @ts-ignore
import * as XLSX from "xlsx";

interface DowntimeDashboardProps {
  downtimeRecords: DowntimeRecord[];
  downtimeSource?: "apps_script" | "gviz" | "cache";
  onRefreshData?: () => void;
  isDowntimeRetrying?: boolean;
  downtimeRetry?: { attempt: number; maxAttempts: number } | null;
  onCancelDowntimeRetry?: () => void;
}

const SEVERITY_COLORS = {
  high: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  },
  low: {
    bg: "bg-emerald-100 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
};

const getSeverity = (minutes: number) => {
  if (minutes >= 10) return "high";
  return "low";
};

export const DowntimeDashboard: React.FC<DowntimeDashboardProps> = ({
  downtimeRecords,
  downtimeSource = "gviz",
  onRefreshData,
  isDowntimeRetrying = false,
  downtimeRetry = null,
  onCancelDowntimeRetry,
}) => {
  // --- Filters ---
  const [filters, setFilters] = useState<DowntimeFilterState>({
    startDate: "",
    endDate: "",
    line: "",
    machineType: "",
    brand: "",
  });

  // --- UI State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<string>("tanggal");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showAppsScriptModal, setShowAppsScriptModal] = useState(false);
  const [appsScriptUrl, setAppsScriptUrl] = useState(() =>
    getEffectiveDowntimeAppsScriptUrl(),
  );
  const [codeCopied, setCodeCopied] = useState(false);
  const rowsPerPage = 15;

  // --- Unique values for filters ---
  const uniqueLines = useMemo(
    () => getUniqueLines(downtimeRecords),
    [downtimeRecords],
  );
  const uniqueMachineTypes = useMemo(
    () => getUniqueMachineTypes(downtimeRecords),
    [downtimeRecords],
  );
  const uniqueBrands = useMemo(
    () => getUniqueBrands(downtimeRecords),
    [downtimeRecords],
  );

  // --- Filtered data ---
  const filteredRecords = useMemo(
    () => filterDowntimeRecords(downtimeRecords, filters),
    [downtimeRecords, filters],
  );

  // --- Aggregated data ---
  const kpis = useMemo(
    () => getDowntimeKPIs(filteredRecords),
    [filteredRecords],
  );
  const byMachineType = useMemo(
    () => getDowntimeByMachineType(filteredRecords),
    [filteredRecords],
  );
  const byMachineTypeFrequency = useMemo(
    () => [...byMachineType].sort((a, b) => b.frequency - a.frequency),
    [byMachineType],
  );
  const byMachineTypeAvgDuration = useMemo(
    () =>
      [...byMachineType].sort(
        (a, b) => b.avgDurationMinutes - a.avgDurationMinutes,
      ),
    [byMachineType],
  );
  const trendData = useMemo(
    () => getDowntimeTrendByWeek(filteredRecords),
    [filteredRecords],
  );
  const topErrors = useMemo(
    () => getTopErrors(filteredRecords, 8),
    [filteredRecords],
  );

  // --- Table search + sort + pagination ---
  const tableData = useMemo(() => {
    let data = [...filteredRecords];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.line.toLowerCase().includes(q) ||
          r.prodMachType.toLowerCase().includes(q) ||
          r.prodMach.toLowerCase().includes(q) ||
          r.tanggal.includes(q) ||
          r.errorMessage.toLowerCase().includes(q),
      );
    }

    // Sort
    data.sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortColumn) {
        case "line":
          aVal = a.line;
          bVal = b.line;
          break;
        case "tanggal":
          aVal = a.tanggal;
          bVal = b.tanggal;
          break;
        case "prodMachType":
          aVal = a.prodMachType;
          bVal = b.prodMachType;
          break;
        case "prodMach":
          aVal = a.prodMach;
          bVal = b.prodMach;
          break;
        case "jamKerja":
          aVal = a.jamKerja;
          bVal = b.jamKerja;
          break;
        case "downtimeAktual":
          aVal = a.downtimeAktual;
          bVal = b.downtimeAktual;
          break;
        default:
          aVal = a.downtimeAktual;
          bVal = b.downtimeAktual;
      }
      if (typeof aVal === "string") {
        return sortDir === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });

    return data;
  }, [filteredRecords, searchQuery, sortColumn, sortDir]);

  const totalPages = Math.ceil(tableData.length / rowsPerPage);
  const pagedData = tableData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage,
  );

  // --- Handlers ---
  const handleFilterChange = useCallback(
    (key: keyof DowntimeFilterState, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setCurrentPage(1);
    },
    [],
  );

  const handleResetFilters = useCallback(() => {
    setFilters({
      startDate: "",
      endDate: "",
      line: "",
      machineType: "",
      brand: "",
    });
    setCurrentPage(1);
  }, []);

  const handleSort = useCallback(
    (col: string) => {
      if (sortColumn === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortColumn(col);
        setSortDir("desc");
      }
    },
    [sortColumn],
  );

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE_TEMPLATE);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }, []);

  const handleOpenAppsScriptModal = useCallback(() => {
    // Prefill dengan URL efektif (kustom user, else default bersama)
    setAppsScriptUrl(getEffectiveDowntimeAppsScriptUrl());
    setShowAppsScriptModal(true);
  }, []);

  const handleSaveAppsScriptUrl = useCallback(() => {
    const trimmed = appsScriptUrl.trim();
    // Sama dengan default bersama = tidak perlu simpanan kustom
    setDowntimeAppsScriptUrl(
      trimmed && trimmed !== DEFAULT_DOWNTIME_APPS_SCRIPT_URL ? trimmed : "",
    );
    setShowAppsScriptModal(false);
    // Trigger a data re-fetch so downtime data is loaded via the effective Apps Script URL
    if (onRefreshData) {
      onRefreshData();
    }
  }, [appsScriptUrl, onRefreshData]);

  const handleClearCustomAppsScriptUrl = useCallback(() => {
    // Hapus simpanan kustom → kembali ke default bersama
    setDowntimeAppsScriptUrl("");
    setAppsScriptUrl(DEFAULT_DOWNTIME_APPS_SCRIPT_URL);
    setShowAppsScriptModal(false);
    if (onRefreshData) onRefreshData();
  }, [onRefreshData]);

  const handleExportExcel = useCallback(() => {
    const exportData = tableData.map((r) => ({
      Line: r.line,
      Tanggal: r.tanggal,
      "Downtime Start": r.downtimeStart,
      "Downtime Stop": r.downtimeStop,
      "Tipe Mesin": r.prodMachType,
      "Merk Mesin": r.prodMach,
      "Jam Kerja": r.jamKerja,
      "Downtime Aktual (menit)": r.downtimeAktual,
      "Error Message": r.errorMessage,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Downtime Log");
    XLSX.writeFile(wb, "downtime_mesin_export.xlsx");
  }, [tableData]);

  const SortIcon: React.FC<{ col: string }> = ({ col }) => {
    if (sortColumn !== col)
      return <ChevronDown className="w-3 h-3 opacity-30" />;
    return sortDir === "asc" ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const isAppsScriptConfigured = !!getEffectiveDowntimeAppsScriptUrl();
  const isUsingDefaultUrl = isUsingDefaultDowntimeAppsScriptUrl();
  const hasCustomUrl = !!getDowntimeAppsScriptUrl();
  const isDataFromAppsScript = downtimeSource === "apps_script";

  // --- Custom Recharts Tooltip ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const weekPayload = payload[0]?.payload;
    const fmtDayMonth = (ymd: string) => {
      const parts = String(ymd).split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : String(ymd);
    };
    const weekRange =
      weekPayload?.weekStart && weekPayload?.weekEnd
        ? `${fmtDayMonth(weekPayload.weekStart)}–${fmtDayMonth(weekPayload.weekEnd)}`
        : null;
    return (
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl p-3 text-xs">
        <p className="font-semibold text-slate-700 dark:text-slate-200">
          {label}
          {weekRange && (
            <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
              ({weekRange})
            </span>
          )}
        </p>
        {payload.map((p: any, i: number) => (
          <p
            key={i}
            style={{ color: p.color }}
            className="flex justify-between gap-4 mt-1"
          >
            <span>{p.name}:</span>
            <span className="font-bold">
              {typeof p.value === "number"
                ? formatDecimal(p.value, 0)
                : p.value}
            </span>
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Data Source Status Banner */}
      {isDowntimeRetrying && downtimeRetry ? (
        <div className="rounded-xl border px-4 py-3 flex items-center justify-between text-xs font-medium transition-colors bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-400">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 shrink-0 animate-spin" />
            <span>
              Menghubungkan ke Apps Script… percobaan {downtimeRetry.attempt}/
              {downtimeRetry.maxAttempts}. Data GViz tetap ditampilkan.
            </span>
          </div>
          <button
            onClick={() => onCancelDowntimeRetry?.()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
          >
            Batal
          </button>
        </div>
      ) : (
      <div
        className={`rounded-xl border px-4 py-3 flex items-center justify-between text-xs font-medium transition-colors ${
          isDataFromAppsScript
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400"
            : isAppsScriptConfigured
              ? "bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300"
              : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-400"
        }`}
      >
        <div className="flex items-center gap-2">
          {isDataFromAppsScript ? (
            <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : isAppsScriptConfigured ? (
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
          ) : (
            <Info className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
          )}
          <span>
            {isDataFromAppsScript
              ? `Data diambil via Google Apps Script Web App (${downtimeRecords.length} baris terambil — Anti-Filter Mode)`
              : isAppsScriptConfigured
                ? `Apps Script URL terpasang, namun fetch gagal/fallback ke GViz (${downtimeRecords.length} baris terambil). Pastikan deployment diset "Who has access: Anyone" dan URL berakhiran /exec.`
                : `Data diambil via GViz (${downtimeRecords.length} baris terambil). Jika sheet difilter, data bisa tidak lengkap.`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={DOWNTIME_GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka Google Sheet Downtime (Juli s/d Sekarang)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
          >
            <ExternalLink className="w-3 h-3" /> Sheet Juli+
          </a>
          <a
            href={DOWNTIME_HISTORICAL_GOOGLE_SHEET_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka Google Sheet Downtime (Januari s/d Juni)"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 dark:bg-slate-800 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors text-xs"
          >
            <ExternalLink className="w-3 h-3" /> Sheet Jan-Jun (Line G)
          </a>
          <button
            onClick={handleOpenAppsScriptModal}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            <Settings2 className="w-3 h-3" /> Apps Script Setup
          </button>
          {isAppsScriptConfigured && !isDataFromAppsScript && (
            <button
              onClick={() => onRefreshData?.()}
              title="Coba ambil ulang via Apps Script (maks 4x percobaan)"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            >
              <RefreshCw className="w-3 h-3" /> Coba Lagi
            </button>
          )}
        </div>
      </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px]">
            <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Periode Tanggal
            </label>
            <DateRangePicker
              startDate={filters.startDate}
              endDate={filters.endDate}
              onStartDateChange={(date) =>
                handleFilterChange("startDate", date)
              }
              onEndDateChange={(date) => handleFilterChange("endDate", date)}
            />
          </div>
          <div className="flex-1 min-w-[110px]">
            <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Line
            </label>
            <select
              value={filters.line}
              onChange={(e) => handleFilterChange("line", e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value="">Semua Line</option>
              {uniqueLines.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Tipe Mesin
            </label>
            <select
              value={filters.machineType}
              onChange={(e) =>
                handleFilterChange("machineType", e.target.value)
              }
              className="w-full h-9 px-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value="">Semua Tipe</option>
              {uniqueMachineTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
              Merk Mesin
            </label>
            <select
              value={filters.brand}
              onChange={(e) => handleFilterChange("brand", e.target.value)}
              className="w-full h-9 px-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value="">Semua Merk</option>
              {uniqueBrands.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleResetFilters}
            className="h-9 px-4 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Total Downtime */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col justify-between group hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Akumulasi Total Lama Downtime
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            {formatDecimal(kpis.totalDowntimeHours, 0)}
            <span className="text-sm font-normal text-slate-400 ml-1">jam</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDecimal(kpis.totalDowntimeMinutes, 0)}{" "}
            menit
          </div>
        </div>

        {/* Total Incidents */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col justify-between group hover:shadow-md hover:border-red-300 dark:hover:border-red-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Total Kejadian
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            {formatDecimal(kpis.totalIncidents, 0)}
            <span className="text-sm font-normal text-slate-400 ml-1">
              kejadian
            </span>
          </div>
        </div>

        {/* MTTR */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col justify-between group hover:shadow-md hover:border-amber-300 dark:hover:border-amber-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Rata-Rata Lama Downtime setiap Kejadian
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
            {formatDecimal(kpis.avgDurationMinutes, 0)}
            <span className="text-sm font-normal text-slate-400 ml-1">
              menit
            </span>
          </div>
        </div>

        {/* Top Machine Type */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col justify-between group hover:shadow-md hover:border-purple-300 dark:hover:border-purple-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Mesin dengan akumulasi downtime terlama
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
              <Wrench className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
            {kpis.topMachineType}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDecimal(kpis.topMachineTypeMinutes, 0)}{" "}
            menit
          </div>
        </div>

        {/* Top Line */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex flex-col justify-between group hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700 transition-all">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Line dengan akumulasi downtime tertinggi
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Factory className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
          <div className="text-lg font-bold text-slate-800 dark:text-white tracking-tight">
            {kpis.topLine}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDecimal(kpis.topLineMinutes, 0)} menit
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {/* Chart 1: Total Downtime by Machine Type (Bar) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-3 pb-1">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 shrink-0 text-indigo-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Akumulasi Lama Downtime berdasarkan Tipe Mesin
            </h3>
            <span className="text-[10px] whitespace-nowrap text-slate-400 dark:text-slate-500">
              (menit)
            </span>
          </div>
          {byMachineType.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={byMachineType}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => formatDecimal(v, 0)}
                  className="text-slate-500"
                />
                <YAxis
                  dataKey="machineType"
                  type="category"
                  width={64}
                  tick={{ fontSize: 8 }}
                  interval={0}
                  tickLine={false}
                  className="text-slate-600 dark:text-slate-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="totalMinutes"
                  name="Downtime (menit)"
                  fill="#3b82f6"
                  radius={0}
                  maxBarSize={20}
                >
                  <LabelList
                    dataKey="totalMinutes"
                    position="right"
                    offset={4}
                    fontSize={9}
                    fill="#94a3b8"
                    formatter={(v) =>
                      !v || Number(v) === 0
                        ? ""
                        : formatDecimal(Number(v), 0)
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 2: Rata-Rata Waktu Downtime berdasarkan Tipe Mesin (Bar) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-3 pb-1">
          <div className="flex items-center gap-2 mb-2">
            <Timer className="w-4 h-4 shrink-0 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Rata-Rata Waktu Downtime berdasarkan Tipe Mesin
            </h3>
            <span className="text-[10px] whitespace-nowrap text-slate-400 dark:text-slate-500">
              (menit)
            </span>
          </div>
          {byMachineTypeAvgDuration.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={byMachineTypeAvgDuration}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => formatDecimal(v, 0)}
                  className="text-slate-500"
                />
                <YAxis
                  dataKey="machineType"
                  type="category"
                  width={64}
                  tick={{ fontSize: 8 }}
                  interval={0}
                  tickLine={false}
                  className="text-slate-600 dark:text-slate-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="avgDurationMinutes"
                  name="Rata-rata (menit)"
                  fill="#3b82f6"
                  radius={0}
                  maxBarSize={20}
                >
                  <LabelList
                    dataKey="avgDurationMinutes"
                    position="right"
                    offset={4}
                    fontSize={9}
                    fill="#94a3b8"
                    formatter={(v) =>
                      !v || Number(v) === 0
                        ? ""
                        : formatDecimal(Number(v), 0)
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Chart 3: Frequency by Machine Type (Bar) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-3 pb-1">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 shrink-0 text-red-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Frekuensi Terjadinya Downtime berdasarkan Tipe Mesin
            </h3>
            <span className="text-[10px] whitespace-nowrap text-slate-400 dark:text-slate-500">
              (kejadian)
            </span>
          </div>
          {byMachineTypeFrequency.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-sm text-slate-400">
              Tidak ada data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={byMachineTypeFrequency}
                layout="vertical"
                margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="currentColor"
                  className="text-slate-200 dark:text-slate-700"
                />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v) => formatDecimal(v, 0)}
                  className="text-slate-500"
                />
                <YAxis
                  dataKey="machineType"
                  type="category"
                  width={64}
                  tick={{ fontSize: 8 }}
                  interval={0}
                  tickLine={false}
                  className="text-slate-600 dark:text-slate-400"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="frequency"
                  name="Frekuensi"
                  fill="#3b82f6"
                  radius={0}
                  maxBarSize={20}
                >
                  <LabelList
                    dataKey="frequency"
                    position="right"
                    offset={4}
                    fontSize={9}
                    fill="#94a3b8"
                    formatter={(v) =>
                      !v || Number(v) === 0
                        ? ""
                        : formatDecimal(Number(v), 0)
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Chart 5: Trend Timeline (Full Width) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 shrink-0 text-cyan-500" />
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
            Tren Downtime per Minggu
          </h3>
          {trendData.length > 0 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              ({trendData[0].weekLabel} –{" "}
              {trendData[trendData.length - 1].weekLabel}
              {trendData[0].year !== trendData[trendData.length - 1].year
                ? ` • ${trendData[0].year}/${trendData[trendData.length - 1].year}`
                : ` • ${trendData[0].year}`}
              , {trendData.length} minggu)
            </span>
          )}
        </div>
        {trendData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-slate-400">
            Tidak ada data tren
          </div>
        ) : (
          <div className="flex items-stretch gap-1">
            <div className="flex items-center pb-10">
              <span className="[writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[10px] font-medium text-slate-400">
                Total Downtime (menit)
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={trendData} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="currentColor"
                    className="text-slate-200 dark:text-slate-700"
                  />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 9 }}
                    angle={-90}
                    textAnchor="end"
                    interval={0}
                    height={48}
                    dy={2}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    tickFormatter={(v) => formatDecimal(v, 0)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "#94a3b8" }}
                    allowDecimals={false}
                    tickFormatter={(v) => formatDecimal(v, 0)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: 11 }}
                    formatter={(value) => (
                      <span style={{ color: "#94a3b8" }}>{value}</span>
                    )}
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="frequency"
                    name="Frekuensi Kejadian"
                    fill="#3b82f6"
                    fillOpacity={0.55}
                    radius={0}
                    maxBarSize={14}
                  />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="totalMinutes"
                    name="Total Downtime"
                    stroke="#ef4444"
                    strokeWidth={3}
                    dot={{ r: 2.5, fill: "#ef4444", strokeWidth: 0 }}
                    activeDot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center pb-10">
              <span className="[writing-mode:vertical-rl] whitespace-nowrap text-[10px] font-medium text-slate-400">
                Frekuensi Kejadian
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Top Errors Section */}
      {topErrors.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Error Message Terbanyak
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {topErrors.map((err, i) => (
              <div
                key={i}
                className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-800/50"
              >
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-1 line-clamp-2">
                  {err.errorMessage}
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatDecimal(err.frequency, 0)}
                    </span>{" "}
                    kejadian
                  </span>
                  <span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">
                      {formatDecimal(err.totalMinutes, 0)}
                    </span>{" "}
                    menit
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Log Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">
              Downtime Log
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              {formatDecimal(tableData.length, 0)} baris data
              {searchQuery && ` (filtered)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari line, mesin..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-8 pl-8 pr-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 w-56 focus:ring-2 focus:ring-indigo-500 transition-colors"
              />
            </div>
            <button
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80">
                {[
                  { key: "line", label: "Line" },
                  { key: "tanggal", label: "Date" },
                  { key: "downtimeStart", label: "Start" },
                  { key: "downtimeStop", label: "End" },
                  { key: "prodMachType", label: "Prod Mach Type" },
                  { key: "prodMach", label: "Prod Mach" },
                  { key: "jamKerja", label: "Work Hours" },
                  { key: "downtimeAktual", label: "Actual Downtime" },
                ].map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none whitespace-nowrap"
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      <SortIcon col={col.key} />
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {pagedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-3 py-12 text-center text-slate-400 dark:text-slate-500"
                  >
                    Tidak ada data downtime yang cocok.
                  </td>
                </tr>
              ) : (
                pagedData.map((r, i) => {
                  const severity = getSeverity(r.downtimeAktual);
                  const sev = SEVERITY_COLORS[severity];
                  return (
                    <tr
                      key={i}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {r.line}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.tanggal
                          ? r.tanggal.split("-").reverse().join("/")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {r.downtimeStart
                          ? r.downtimeStart.replace(/^\d+\/\d+\/\d+\s/, "")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {r.downtimeStop
                          ? r.downtimeStop.replace(/^\d+\/\d+\/\d+\s/, "")
                          : "-"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="inline-flex px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold text-[11px]">
                          {r.prodMachType || "-"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                        {r.prodMach || "-"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400 whitespace-nowrap text-center">
                        {typeof r.jamKerja === "number" ? formatDecimal(r.jamKerja, 0) : r.jamKerja}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-md font-bold text-[11px] border ${sev.bg} ${sev.text} ${sev.border}`}
                        >
                          {formatDecimal(r.downtimeAktual, 0)} menit
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 dark:text-slate-500 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus:z-20 focus:outline-offset-0 transition-colors"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:outline-offset-0 bg-slate-50 dark:bg-slate-800/50">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 dark:text-slate-500 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 focus:z-20 focus:outline-offset-0 transition-colors"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Apps Script Setup Modal */}
      {showAppsScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">
                  Setup Google Apps Script (Anti-Filter)
                </h2>
                <button
                  onClick={() => setShowAppsScriptModal(false)}
                  className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Instructions */}
              <div className="space-y-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
                  <h4 className="font-bold text-indigo-700 dark:text-indigo-400 mb-2">
                    Mengapa perlu Apps Script?
                  </h4>
                  <p className="text-xs leading-relaxed">
                    Jika ada orang yang memfilter sheet DOWNTIME LOG di Google
                    Sheets, endpoint GViz hanya mengembalikan baris yang
                    terlihat. Dengan Google Apps Script Web App,{" "}
                    <strong>seluruh data akan selalu terambil lengkap</strong>{" "}
                    tanpa terpengaruh filter apa pun.
                  </p>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200">
                    Langkah-langkah:
                  </h4>
                  <ol className="list-decimal list-inside space-y-1.5 text-xs leading-relaxed">
                    <li>Buka spreadsheet DOWNTIME LOG di Google Sheets</li>
                    <li>
                      Klik menu <strong>Extensions → Apps Script</strong>
                    </li>
                    <li>
                      Hapus kode default, lalu{" "}
                      <strong>paste kode di bawah</strong>
                    </li>
                    <li>
                      Klik <strong>Deploy → New Deployment</strong>
                    </li>
                    <li>
                      Pilih type <strong>"Web App"</strong>
                    </li>
                    <li>
                      Set "Execute as" = <strong>Me</strong>, "Who has access" ={" "}
                      <strong>Anyone</strong>
                    </li>
                    <li>
                      Klik <strong>Deploy</strong> dan copy URL Web App-nya
                    </li>
                    <li>Paste URL tersebut di input di bawah</li>
                  </ol>
                </div>

                {/* Code Block */}
                <div className="relative">
                  <div className="flex items-center justify-between bg-slate-800 dark:bg-slate-950 rounded-t-lg px-4 py-2">
                    <span className="text-xs font-mono text-slate-400">
                      Code.gs
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      {codeCopied ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copy Code
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="bg-slate-900 dark:bg-slate-950 text-slate-300 text-[10px] leading-relaxed p-4 rounded-b-lg overflow-x-auto max-h-48">
                    {APPS_SCRIPT_CODE_TEMPLATE}
                  </pre>
                </div>

                {/* URL Input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Web App URL
                  </label>
                  <input
                    type="url"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/.../exec"
                    className="w-full h-10 px-3 text-xs rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500 transition-colors"
                  />
                  {isUsingDefaultUrl ? (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                      Menggunakan URL default bersama — berlaku otomatis untuk
                      semua user tanpa perlu setup.
                    </p>
                  ) : (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                      ✓ URL kustom tersimpan di browser ini. Data akan diambil
                      via Apps Script pada refresh berikutnya.
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleSaveAppsScriptUrl}
                    className="flex-1 h-10 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                  >
                    Simpan URL
                  </button>
                  {hasCustomUrl && (
                    <button
                      onClick={handleClearCustomAppsScriptUrl}
                      title="Hapus URL kustom dan kembali ke default bersama"
                      className="h-10 px-4 text-sm font-medium rounded-xl bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 text-red-700 dark:text-red-400 transition-colors"
                    >
                      Hapus URL
                    </button>
                  )}
                  <button
                    onClick={() => setShowAppsScriptModal(false)}
                    className="h-10 px-4 text-sm font-medium rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
