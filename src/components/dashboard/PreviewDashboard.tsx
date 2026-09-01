import React, { useMemo } from "react";
import {
  LayoutDashboard,
  TableProperties,
  Clock,
  BarChart2,
  Bell,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  SnapshotRecord,
  RentalTrialRecord,
  InventoryRecord,
} from "../../types/mrp";
import { TabValue } from "../layout/Sidebar";
import {
  calculateMachineRequirements,
  getRentalTrialAlerts,
} from "../../utils/mrpCalculations";

interface PreviewDashboardProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  snapshots: SnapshotRecord[];
  rentalTrialRecords: RentalTrialRecord[];
  inventoryRecords: InventoryRecord[];
  onNavigateTab: (tab: TabValue) => void;
  lastUpdated?: string | null;
}

export const PreviewDashboard: React.FC<PreviewDashboardProps> = ({
  plans,
  requirements,
  availabilities,
  snapshots,
  rentalTrialRecords,
  inventoryRecords,
  onNavigateTab,
  lastUpdated,
}) => {
  // 1. Overall Machine Requirements (Summary & Capacity)
  const machineRequirements = useMemo(
    () => calculateMachineRequirements(plans, requirements, availabilities),
    [plans, requirements, availabilities]
  );

  const capacityStats = useMemo(() => {
    let totalAvail = 0;
    let totalReq = 0;
    let shortageCount = 0;
    let availableCount = 0;

    availabilities.forEach((a) => {
      totalAvail += a.jumlahMesin;
    });

    machineRequirements.forEach((r) => {
      totalReq += r.required;
      if (r.status === "Shortage") {
        shortageCount++;
      } else {
        availableCount++;
      }
    });

    const avgUtil =
      totalAvail > 0 ? ((totalReq / totalAvail) * 100).toFixed(1) : "0";

    const topShortages = [...machineRequirements]
      .filter((m) => m.gap < 0)
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 3);

    return {
      totalCapacity: totalAvail,
      totalRequired: totalReq,
      overallUtilization: avgUtil,
      shortageCount,
      availableCount,
      topShortages,
      totalTypes: availabilities.length,
    };
  }, [availabilities, machineRequirements]);

  // 2. Production Details (Detail Tab)
  const detailStats = useMemo(() => {
    const uniqueLines = new Set(plans.map((p) => p.line));
    const uniqueStyles = new Set(plans.map((p) => p.style));

    // Get latest active lines sample
    const lineMap = new Map<string, { line: string; style: string; date: string }>();
    plans.forEach((p) => {
      if (!lineMap.has(p.line)) {
        lineMap.set(p.line, { line: p.line, style: p.style, date: p.date });
      }
    });

    const sampleLines = Array.from(lineMap.values()).slice(0, 3);

    return {
      totalLines: uniqueLines.size,
      totalStyles: uniqueStyles.size,
      totalPlans: plans.length,
      sampleLines,
    };
  }, [plans]);

  // 3. Snapshot History (History Tab)
  const historyStats = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        hasData: false,
        latestVersion: "-",
        lastVersion: "-",
        styleChanges: 0,
        machineChanges: 0,
        totalRows: 0,
      };
    }

    const latest = snapshots[0];
    const styleChanges = snapshots.filter((s) => s.isPlanningStyleChanged).length;
    const machineChanges = snapshots.filter((s) => s.isMachineStyleChanged).length;

    return {
      hasData: true,
      latestVersion: latest.updateVersion || "Update",
      lastVersion: latest.lastVersion || "Previous",
      snapshotDate: latest.updateSnapshotDate || latest.planningDate,
      styleChanges,
      machineChanges,
      totalRows: snapshots.length,
    };
  }, [snapshots]);

  // 4. Fleet Age & Analytics (Analytics Tab)
  const analyticsStats = useMemo(() => {
    const totalFleet = inventoryRecords.length;
    let avgMonths = 0;
    let over5Years = 0;

    if (totalFleet > 0) {
      const allMonths = inventoryRecords.map((r) => r.umurBulan);
      avgMonths = Math.round(allMonths.reduce((a, b) => a + b, 0) / totalFleet);
      over5Years = inventoryRecords.filter((r) => r.umurBulan >= 60).length;
    }

    const avgYears = Math.floor(avgMonths / 12);
    const remainingMonths = avgMonths % 12;
    const avgAgeText =
      avgYears === 0
        ? `${remainingMonths} bln`
        : remainingMonths === 0
        ? `${avgYears} thn`
        : `${avgYears} thn ${remainingMonths} bln`;

    return {
      totalFleet,
      avgAgeText,
      over5Years,
    };
  }, [inventoryRecords]);

  // 5. Rental & Trial Alerts (Alerts Tab)
  const alertStats = useMemo(() => {
    const alerts = getRentalTrialAlerts(rentalTrialRecords, 7);
    const critical = alerts.filter((a) => a.severity === "critical");
    const warning = alerts.filter((a) => a.severity === "warning");

    const topUrgent = alerts
      .filter((a) => a.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3);

    return {
      totalAlerts: alerts.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      totalRentals: rentalTrialRecords.length,
      topUrgent,
    };
  }, [rentalTrialRecords]);

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Executive Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 p-6 sm:p-8 text-white shadow-lg">
        {/* Background glow circle */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Executive Overview & Quick Navigation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Dashboard Preview Hub
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-300 max-w-2xl">
              Rangkuman status kesiapan mesin jahit, lini produksi, perbandingan snapshot, utilisasi pabrik, dan peringatan sewa. Klik kartu untuk masuk ke detail masing-masing tab.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {lastUpdated && (
              <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Update: <strong>{lastUpdated}</strong></span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Preview Cards (Interactive) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* CARD 1: Summary (Kebutuhan & Ketersediaan Mesin) */}
        <div
          onClick={() => onNavigateTab("summary")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 group-hover:scale-105 transition-transform">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    Summary Kebutuhan
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Summary (Tabel Utama)
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {capacityStats.totalTypes} Jenis Mesin
              </span>
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Tersedia</span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {capacityStats.totalCapacity} <span className="text-xs font-normal text-slate-400">unit</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Kebutuhan (Peak)</span>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {capacityStats.totalRequired} <span className="text-xs font-normal text-slate-400">unit</span>
                </div>
              </div>
            </div>

            {/* Status Highlight */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Status Kesiapan:</span>
                <span
                  className={`font-bold flex items-center ${
                    capacityStats.shortageCount > 0
                      ? "text-red-500 dark:text-red-400"
                      : "text-emerald-500 dark:text-emerald-400"
                  }`}
                >
                  {capacityStats.shortageCount > 0 ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                      {capacityStats.shortageCount} Mesin Shortage
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Semua Mesin Aman
                    </>
                  )}
                </span>
              </div>

              {capacityStats.topShortages.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {capacityStats.topShortages.map((m) => (
                    <span
                      key={m.machine}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                    >
                      {m.machine} ({m.gap})
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Tabel Summary</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* CARD 2: Detail (Lini Produksi x Mesin) */}
        <div
          onClick={() => onNavigateTab("detail")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-400 dark:hover:border-emerald-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800/50 group-hover:scale-105 transition-transform">
                  <TableProperties className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    Detail Matriks Line
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Detail (Line x Mesin)
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {detailStats.totalLines} Active Lines
              </span>
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Total Jadwal</span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {detailStats.totalPlans} <span className="text-xs font-normal text-slate-400">rencana</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Variasi Style</span>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {detailStats.totalStyles} <span className="text-xs font-normal text-slate-400">style</span>
                </div>
              </div>
            </div>

            {/* Sample Running Lines */}
            <div className="space-y-1.5 mb-4">
              <span className="text-xs text-slate-400 font-medium block">Contoh Alokasi Line:</span>
              <div className="space-y-1">
                {detailStats.sampleLines.map((l) => (
                  <div
                    key={l.line}
                    className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                  >
                    <span className="font-bold text-slate-700 dark:text-slate-300">{l.line}</span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[140px]" title={l.style}>
                      {l.style}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Detail Matriks</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* CARD 3: Analytics (Utilisasi Pabrik & Usia Mesin) */}
        <div
          onClick={() => onNavigateTab("chart")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-amber-400 dark:hover:border-amber-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 group-hover:scale-105 transition-transform">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                    Analytics & Usia
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Analytics
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
                Utilisasi {capacityStats.overallUtilization}%
              </span>
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Usia Rata-rata</span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {analyticsStats.avgAgeText}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Mesin &gt; 5 Tahun</span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {analyticsStats.over5Years} <span className="text-xs font-normal text-slate-400">unit</span>
                </div>
              </div>
            </div>

            {/* Overview Highlights */}
            <div className="space-y-1.5 mb-4 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Total Armada Fisik:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{analyticsStats.totalFleet} unit</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Top Shortage:</span>
                <span className="font-semibold text-red-500">
                  {capacityStats.topShortages[0]
                    ? `${capacityStats.topShortages[0].machine} (${capacityStats.topShortages[0].gap})`
                    : "Tidak ada"}
                </span>
              </div>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Analytics & Chart</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* CARD 4: History PPIC (Snapshot Tracking) */}
        <div
          onClick={() => onNavigateTab("history")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 border border-cyan-100 dark:border-cyan-800/50 group-hover:scale-105 transition-transform">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                    History Snapshot
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab History PPIC
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {historyStats.latestVersion}
              </span>
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Perubahan Style</span>
                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {historyStats.styleChanges} <span className="text-xs font-normal text-slate-400">line</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">Perubahan Mesin</span>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {historyStats.machineChanges} <span className="text-xs font-normal text-slate-400">line</span>
                </div>
              </div>
            </div>

            {/* Comparison info */}
            <div className="space-y-1 mb-4 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-between">
                <span>Versi Dibandingkan:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {historyStats.lastVersion} ➔ {historyStats.latestVersion}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Total Snapshot Terdata:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{historyStats.totalRows} baris</span>
              </div>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-cyan-600 dark:text-cyan-400 group-hover:translate-x-1 transition-transform">
            <span>Buka History Snapshot</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* CARD 5: Rental & Trial Alerts */}
        <div
          onClick={() => onNavigateTab("alerts")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-400 dark:hover:border-red-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800/50 group-hover:scale-105 transition-transform">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Rental & Trial Alerts
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Rental Alerts
                  </span>
                </div>
              </div>
              {alertStats.criticalCount > 0 ? (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500 text-white animate-pulse">
                  {alertStats.criticalCount} Kritis
                </span>
              ) : (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {alertStats.totalAlerts} Alert
                </span>
              )}
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-red-50/60 dark:bg-red-900/20 border border-red-100 dark:border-red-800/40">
                <span className="text-[11px] text-red-500 font-medium">Kritis (≤ 3 Hari)</span>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {alertStats.criticalCount} <span className="text-xs font-normal text-red-400">unit</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                <span className="text-[11px] text-amber-500 font-medium">Perhatian (4-7 Hari)</span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {alertStats.warningCount} <span className="text-xs font-normal text-amber-400">unit</span>
                </div>
              </div>
            </div>

            {/* Urgent Expiring List */}
            <div className="space-y-1.5 mb-4">
              <span className="text-xs text-slate-400 font-medium block">Masa Sewa Terdekat:</span>
              {alertStats.topUrgent.length > 0 ? (
                <div className="space-y-1">
                  {alertStats.topUrgent.map((a, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {a.record.helperJenis}
                      </span>
                      <span
                        className={`text-[11px] font-bold ${
                          a.daysRemaining <= 3 ? "text-red-500" : "text-amber-500"
                        }`}
                      >
                        Sisa {a.daysRemaining} hari ({a.record.remark.toLowerCase().includes("trial") ? "Trial" : "Sewa"})
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">Tidak ada sewa mendekati jatuh tempo.</div>
              )}
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Rental Alerts</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
