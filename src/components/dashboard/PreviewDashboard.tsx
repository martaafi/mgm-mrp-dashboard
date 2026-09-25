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
  Wrench,
  CalendarDays,
} from "lucide-react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  SnapshotRecord,
  RentalTrialRecord,
  InventoryRecord,
  DowntimeRecord,
} from "../../types/mrp";
import { TabValue } from "../layout/Sidebar";
import {
  calculateMachineRequirements,
  getRentalTrialAlerts,
  excludeNoPlanningOnlyLines,
  isSunday,
  getAdjustedAvailabilityForDateRange,
} from "../../utils/mrpCalculations";
import {
  filterDowntimeRecords,
  getDowntimeKPIs,
} from "../../utils/downtimeCalculations";

/* ------------------------------------------------------------------ */
/*  Helper: Current ISO-week boundaries (Senin – Minggu)              */
/* ------------------------------------------------------------------ */
const getCurrentWeekInfo = () => {
  const today = new Date();
  const dow = today.getDay(); // 0=Sun … 6=Sat

  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dow + 6) % 7));
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };

  // ISO week number
  const tmp = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const isoDay = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - isoDay + 3);
  const isoYear = tmp.getFullYear();
  const firstThu = new Date(isoYear, 0, 4);
  const off = (firstThu.getDay() + 6) % 7;
  firstThu.setDate(firstThu.getDate() - off + 3);
  const weekNum =
    1 + Math.round((tmp.getTime() - firstThu.getTime()) / (7 * 86400000));

  return {
    startDate: fmt(monday),
    endDate: fmt(sunday), // inclusive — Sundays excluded by isSunday()
    todayStr: fmt(today),
    weekNum,
    weekLabel: `W${weekNum}`,
    weekYear: `W${weekNum}-${isoYear}`,
    year: isoYear,
    rangeText: `${monday.getDate()}/${monday.getMonth() + 1} – ${saturday.getDate()}/${saturday.getMonth() + 1}`,
  };
};

/** Human-readable short date, e.g. "Kamis, 25/9" */
const formatDateShort = (dateStr: string) => {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const dayNames = [
      "Minggu",
      "Senin",
      "Selasa",
      "Rabu",
      "Kamis",
      "Jumat",
      "Sabtu",
    ];
    const d = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
    );
    return `${dayNames[d.getDay()]}, ${parseInt(parts[2])}/${parseInt(parts[1])}`;
  }
  return dateStr;
};

/* ------------------------------------------------------------------ */

interface PreviewDashboardProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  snapshots: SnapshotRecord[];
  rentalTrialRecords: RentalTrialRecord[];
  inventoryRecords: InventoryRecord[];
  downtimeRecords: DowntimeRecord[];
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
  downtimeRecords,
  onNavigateTab,
  lastUpdated,
}) => {
  /* ---- Current Week Context ---- */
  const currentWeek = useMemo(() => getCurrentWeekInfo(), []);

  /* Plans filtered to current week (Mon–Sat, Sundays excluded) */
  const currentWeekPlans = useMemo(
    () =>
      plans.filter((p) => {
        if (isSunday(p.date)) return false;
        return p.date >= currentWeek.startDate && p.date <= currentWeek.endDate;
      }),
    [plans, currentWeek],
  );

  /* Exclude lines whose ALL plans = "NO PLANNING" in current week */
  const cleanPlans = useMemo(
    () => excludeNoPlanningOnlyLines(currentWeekPlans),
    [currentWeekPlans],
  );

  // Adjusted availability: accounts for expired sewa/trial within the week
  const adjustedAvailabilities = useMemo(
    () =>
      getAdjustedAvailabilityForDateRange(
        currentWeek.startDate,
        currentWeek.endDate,
        availabilities,
        rentalTrialRecords,
      ),
    [currentWeek, availabilities, rentalTrialRecords],
  );

  // 1. Machine Requirements (current week only, adjusted availability)
  const machineRequirements = useMemo(
    () =>
      calculateMachineRequirements(
        cleanPlans,
        requirements,
        adjustedAvailabilities,
      ),
    [cleanPlans, requirements, adjustedAvailabilities],
  );

  const capacityStats = useMemo(() => {
    let totalAvail = 0;
    let totalReq = 0;
    let shortageCount = 0;
    let availableCount = 0;

    // Compute totals from machineRequirements (consistent with Summary/KPICards)
    machineRequirements.forEach((r) => {
      totalAvail += r.available;
      totalReq += r.required;
      if (r.status === "Shortage") {
        shortageCount++;
      } else {
        availableCount++;
      }
    });

    // Round to 2 decimal places to avoid floating-point artifacts
    totalAvail = Math.round(totalAvail * 100) / 100;
    totalReq = Math.round(totalReq * 100) / 100;

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
      totalTypes: adjustedAvailabilities.length,
    };
  }, [adjustedAvailabilities, machineRequirements]);

  // 2. Detail Stats (current week, NO PLANNING excluded)
  const detailStats = useMemo(() => {
    // Filter keluar plan yang memiliki style atau displayStyle "NO PLANNING"
    const activePlans = cleanPlans.filter(
      (p) =>
        (p.style || "").trim().toUpperCase() !== "NO PLANNING" &&
        (p.displayStyle || "").trim().toUpperCase() !== "NO PLANNING",
    );

    // Lines aktif = line unik yang punya planning aktif
    const uniqueLines = new Set(activePlans.map((p) => p.line));

    // Variasi style unik
    const uniqueStyles = new Set(activePlans.map((p) => p.style));

    // Total planning efektif = slot unik (tanggal × line) yang memiliki jadwal aktif
    const effectiveKeys = new Set(
      activePlans.map((p) => `${p.date}|${p.line}`),
    );

    // Sample: alokasi HARI INI dari plan aktif (fallback ke tanggal terakhir jika kosong)
    let sampleDate = currentWeek.todayStr;
    let datePlans = activePlans.filter((p) => p.date === sampleDate);
    if (datePlans.length === 0) {
      const sorted = [...new Set(activePlans.map((p) => p.date))].sort();
      if (sorted.length > 0) {
        sampleDate = sorted[sorted.length - 1];
        datePlans = activePlans.filter((p) => p.date === sampleDate);
      }
    }

    // Style terakhir per line menang (konsisten dengan logika kalkulasi mesin)
    const lineMap = new Map<
      string,
      { line: string; style: string; date: string }
    >();
    datePlans.forEach((p) =>
      lineMap.set(p.line, { line: p.line, style: p.style, date: p.date }),
    );
    const sampleLines = Array.from(lineMap.values())
      .sort((a, b) =>
        a.line.localeCompare(b.line, undefined, {
          numeric: true,
          sensitivity: "base",
        }),
      )
      .slice(0, 3);

    return {
      totalLines: uniqueLines.size,
      totalStyles: uniqueStyles.size,
      totalPlans: effectiveKeys.size,
      sampleLines,
      sampleDate,
    };
  }, [cleanPlans, currentWeek.todayStr]);

  // 3. Snapshot History — ringkasan per LINE (bukan per hari)
  const historyStats = useMemo(() => {
    if (snapshots.length === 0) {
      return {
        hasData: false,
        latestVersion: "-",
        lastVersion: "-",
        styleChangedLines: 0,
        machineChangedLines: 0,
        totalRows: 0,
      };
    }

    const latest = snapshots[0];

    // Hitung LINE UNIK yang berubah, bukan baris per hari.
    // Misal G01 berubah di 6 hari → tetap dihitung 1 line berubah.
    const linesWithStyleChange = new Set(
      snapshots.filter((s) => s.isPlanningStyleChanged).map((s) => s.line),
    );
    const linesWithMachineChange = new Set(
      snapshots.filter((s) => s.isMachineStyleChanged).map((s) => s.line),
    );

    return {
      hasData: true,
      latestVersion: latest.updateVersion || "Update",
      lastVersion: latest.lastVersion || "Previous",
      snapshotDate: latest.updateSnapshotDate || latest.planningDate,
      styleChangedLines: linesWithStyleChange.size,
      machineChangedLines: linesWithMachineChange.size,
      totalRows: snapshots.length,
    };
  }, [snapshots]);

  // 4. Fleet Age & Analytics (usia mesin = data inventory statis; utilisasi = current week)
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
    const rem = avgMonths % 12;
    const avgAgeText =
      avgYears === 0
        ? `${rem} bln`
        : rem === 0
          ? `${avgYears} thn`
          : `${avgYears} thn ${rem} bln`;

    return { totalFleet, avgAgeText, over5Years };
  }, [inventoryRecords]);

  // 5. Rental & Trial Alerts — hanya jatuh tempo di week berjalan
  const alertStats = useMemo(() => {
    // Window lebar supaya tangkap semua yg jatuh tempo minggu ini
    const allAlerts = getRentalTrialAlerts(rentalTrialRecords, 30);

    // Filter: tglSelesai jatuh di dalam minggu berjalan
    const weekAlerts = allAlerts.filter((a) => {
      const end = a.record.tglSelesai;
      return end >= currentWeek.startDate && end <= currentWeek.endDate;
    });

    const critical = weekAlerts.filter((a) => a.severity === "critical");
    const warning = weekAlerts.filter((a) => a.severity === "warning");

    const topUrgent = weekAlerts
      .filter((a) => a.daysRemaining >= 0)
      .sort((a, b) => a.daysRemaining - b.daysRemaining)
      .slice(0, 3);

    return {
      totalAlerts: weekAlerts.length,
      criticalCount: critical.length,
      warningCount: warning.length,
      totalRentals: rentalTrialRecords.length,
      topUrgent,
    };
  }, [rentalTrialRecords, currentWeek]);

  // 6. Downtime — current week only
  const downtimeStats = useMemo(() => {
    const base = filterDowntimeRecords(downtimeRecords, {
      startDate: currentWeek.startDate,
      endDate: currentWeek.endDate,
      line: "",
      machineType: "",
      brand: "",
    });
    return getDowntimeKPIs(base);
  }, [downtimeRecords, currentWeek]);

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
              <span>Executive Overview &amp; Quick Navigation</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Dashboard Preview Hub
            </h1>
            <p className="mt-1.5 text-sm sm:text-base text-slate-300 max-w-2xl">
              Rangkuman status kesiapan mesin jahit, lini produksi, perbandingan
              snapshot, utilisasi pabrik, downtime mesin, dan peringatan sewa
              untuk <strong>minggu berjalan</strong>. Klik kartu untuk masuk ke
              detail masing-masing tab.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            {/* Current Week Badge */}
            <div className="px-3.5 py-2 rounded-xl bg-indigo-500/20 border border-indigo-400/30 text-xs text-indigo-200 flex items-center space-x-2">
              <CalendarDays className="w-4 h-4 text-indigo-400" />
              <span>
                Periode:{" "}
                <strong>
                  {currentWeek.weekLabel} ({currentWeek.rangeText})
                </strong>
              </span>
            </div>
            {lastUpdated && (
              <div className="px-3.5 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>
                  Update: <strong>{lastUpdated}</strong>
                </span>
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
                    Summary
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Kebutuhan mesin pada {currentWeek.weekLabel}
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
                <span className="text-[11px] text-slate-400 font-medium">
                  Jumlah Mesin Tersedia
                </span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {capacityStats.totalCapacity}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    unit
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Total Kebutuhan Mesin
                </span>
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {capacityStats.totalRequired}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    unit
                  </span>
                </div>
              </div>
            </div>

            {/* Status Highlight */}
            <div className="space-y-1.5 mb-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Status Shortage:
                </span>
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
                    Kebutuhan Mesin per Line
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium block leading-tight">
                    Detail kebutuhan mesin per line
                    <br />
                    pada {currentWeek.weekLabel}
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
                <span className="text-[11px] text-slate-400 font-medium">
                  Total Planning
                </span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {detailStats.totalPlans}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    plan
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Total Planning Style
                </span>
                <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {detailStats.totalStyles}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    style
                  </span>
                </div>
              </div>
            </div>

            {/* Sample Running Lines — hari ini atau terakhir tersedia */}
            <div className="space-y-1.5 mb-4">
              <span className="text-xs text-slate-400 font-medium block">
                {detailStats.sampleDate === currentWeek.todayStr
                  ? `Planning Hari Ini (${formatDateShort(detailStats.sampleDate)}):`
                  : detailStats.sampleLines.length > 0
                    ? `Alokasi Terbaru (${formatDateShort(detailStats.sampleDate)}):`
                    : "Alokasi Line:"}
              </span>
              {detailStats.sampleLines.length > 0 ? (
                <div className="space-y-1">
                  {detailStats.sampleLines.map((l) => (
                    <div
                      key={l.line}
                      className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/40"
                    >
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {l.line}
                      </span>
                      <span
                        className="text-slate-500 dark:text-slate-400 text-[11px] truncate max-w-[140px]"
                        title={l.style}
                      >
                        {l.style}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Tidak ada jadwal aktif untuk minggu ini.
                </div>
              )}
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
                    Analytics
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Dashboard ringkasan ketersediaan,
                    <br></br>status kepemilikan, utilitas, distribusi
                    <br></br>usia, serta analisis mesin shortage
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
                <span className="text-[11px] text-slate-400 font-medium">
                  Rata-rata usia mesin
                </span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {analyticsStats.avgAgeText}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Mesin dengan usia &gt; 5 Tahun
                </span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {analyticsStats.over5Years}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    unit
                  </span>
                </div>
              </div>
            </div>

            {/* Overview Highlights */}
            <div className="space-y-1.5 mb-4 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Total Ketersediaan Mesin ({currentWeek.weekLabel}):</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {capacityStats.totalCapacity} unit
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>
                  Mesin dengan jumlah shortage terbanyak pada (
                  {currentWeek.weekLabel}):
                </span>
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
            <span>Buka Analytics &amp; Chart</span>
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
                <span className="text-[11px] text-slate-400 font-medium">
                  Line Ubah Planning
                </span>
                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {historyStats.styleChangedLines}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    line
                  </span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Line Ubah Style Mesin
                </span>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  {historyStats.machineChangedLines}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    line
                  </span>
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
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {historyStats.totalRows} baris
                </span>
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
                    Rental &amp; Trial Alerts
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Rental · {currentWeek.weekLabel}
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
                <span className="text-[11px] text-red-500 font-medium">
                  Kritis (≤ 3 Hari)
                </span>
                <div className="text-lg font-bold text-red-600 dark:text-red-400">
                  {alertStats.criticalCount}{" "}
                  <span className="text-xs font-normal text-red-400">unit</span>
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/40">
                <span className="text-[11px] text-amber-500 font-medium">
                  Perhatian (4-7 Hari)
                </span>
                <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                  {alertStats.warningCount}{" "}
                  <span className="text-xs font-normal text-amber-400">
                    unit
                  </span>
                </div>
              </div>
            </div>

            {/* Urgent Expiring List */}
            <div className="space-y-1.5 mb-4">
              <span className="text-xs text-slate-400 font-medium block">
                Jatuh Tempo Minggu Ini:
              </span>
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
                          a.daysRemaining <= 3
                            ? "text-red-500"
                            : "text-amber-500"
                        }`}
                      >
                        Sisa {a.daysRemaining} hari (
                        {a.record.remark.toLowerCase().includes("trial")
                          ? "Trial"
                          : "Sewa"}
                        )
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Tidak ada sewa jatuh tempo minggu ini.
                </div>
              )}
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Rental Alerts</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>

        {/* CARD 6: Downtime Mesin */}
        <div
          onClick={() => onNavigateTab("downtime")}
          className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-600 rounded-2xl p-5 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />

          <div>
            {/* Card Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-100 dark:border-orange-800/50 group-hover:scale-105 transition-transform">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    Downtime Mesin
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    Tab Downtime · {currentWeek.weekLabel}
                  </span>
                </div>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {downtimeStats.totalIncidents.toLocaleString("id-ID")} Kejadian
              </span>
            </div>

            {/* Metrics Snippet */}
            <div className="grid grid-cols-2 gap-2.5 mb-4">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Total Downtime
                </span>
                <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {Math.round(downtimeStats.totalDowntimeHours).toLocaleString(
                    "id-ID",
                  )}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    jam
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {Math.round(
                    downtimeStats.totalDowntimeMinutes,
                  ).toLocaleString("id-ID")}{" "}
                  menit
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-medium">
                  Rata-rata / Kejadian
                </span>
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {Math.round(downtimeStats.avgDurationMinutes).toLocaleString(
                    "id-ID",
                  )}{" "}
                  <span className="text-xs font-normal text-slate-400">
                    menit
                  </span>
                </div>
              </div>
            </div>

            {/* Top Downtime Highlight */}
            <div className="space-y-1.5 mb-4 text-xs">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Downtime Terlama:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {downtimeStats.topMachineType} (
                  {Math.round(
                    downtimeStats.topMachineTypeMinutes,
                  ).toLocaleString("id-ID")}{" "}
                  mnt)
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span>Line Tertinggi:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {downtimeStats.topLine} (
                  {Math.round(downtimeStats.topLineMinutes).toLocaleString(
                    "id-ID",
                  )}{" "}
                  mnt)
                </span>
              </div>
            </div>
          </div>

          {/* Action Link */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-orange-600 dark:text-orange-400 group-hover:translate-x-1 transition-transform">
            <span>Buka Downtime Mesin</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </div>
        </div>
      </div>
    </div>
  );
};
