import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Minimize2, Moon, Sun } from "lucide-react";
import { fetchAllMRPData, fetchDowntimeData, CACHE_KEYS } from "./utils/googleSheetsAPI";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
  InventoryRecord,
  DowntimeRecord,
  FilterState,
} from "./types/mrp";
import {
  filterProductionPlans,
  excludeNoPlanningOnlyLines,
  isSunday,
  excludeSundays,
  calculateMachineRequirements,
  buildLineMachineMatrix,
  getMachineDrillDown,
  getRentalTrialAlerts,
  getAdjustedAvailabilityForDateRange,
  getCurrentWeekRange,
} from "./utils/mrpCalculations";
import { exportMRPToExcel, exportSummaryToCSV } from "./utils/exportUtils";
import { Header } from "./components/layout/Header";
import { FilterBar } from "./components/filters/FilterBar";
import { OverallRequirementTable } from "./components/dashboard/OverallRequirementTable";
import { DetailLayout } from "./components/dashboard/DetailLayout";
import { HistoryLayout } from "./components/dashboard/HistoryLayout";
import { ChartDashboard } from "./components/dashboard/ChartDashboard";
import { Sidebar, TabValue } from "./components/layout/Sidebar";
import { KPICards } from "./components/dashboard/KPICards";
import { MachineDrillDownModal } from "./components/modals/MachineDrillDownModal";
import { DataManagerModal } from "./components/modals/DataManagerModal";
import { PrintableReportModal } from "./components/modals/PrintableReportModal";
import { IEAssistantModal } from "./components/modals/IEAssistantModal";
import { InitialReminderModal } from "./components/modals/InitialReminderModal";
import { RentalAlertsDashboard } from "./components/dashboard/RentalAlertsDashboard";
import { PreviewDashboard } from "./components/dashboard/PreviewDashboard";
import { DowntimeDashboard } from "./components/dashboard/DowntimeDashboard";

export default function App() {
  // 1. Core Data States
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [requirements, setRequirements] = useState<
    MachineRequirementPerStyle[]
  >([]);
  const [availabilities, setAvailabilities] = useState<MachineAvailability[]>(
    [],
  );
  const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
  const [rentalTrialRecords, setRentalTrialRecords] = useState<RentalTrialRecord[]>([]);
  const [inventoryRecords, setInventoryRecords] = useState<InventoryRecord[]>([]);
  const [downtimeRecords, setDowntimeRecords] = useState<DowntimeRecord[]>([]);
  const [downtimeSource, setDowntimeSource] = useState<"apps_script" | "gviz" | "cache">("gviz");
  const [isDowntimeRetrying, setIsDowntimeRetrying] = useState(false);
  const [downtimeRetry, setDowntimeRetry] = useState<{ attempt: number; maxAttempts: number } | null>(null);
  const downtimeRetryAbortRef = useRef<AbortController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const data = await fetchAllMRPData(forceRefresh);
      setPlans(data.plans);
      setRequirements(data.requirements);
      setAvailabilities(data.availabilities);
      setSnapshots(data.snapshots);
      setRentalTrialRecords(data.rentalTrialRecords || []);
      setInventoryRecords(data.inventoryRecords || []);
      setDowntimeRecords(data.downtimeRecords || []);
      setDowntimeSource(data.downtimeSource || "gviz");
      setLastUpdated(data.lastUpdated);
    } catch (err: any) {
      setError(err.message || "Failed to load data from Google Sheets");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(false);
  }, []);

  // Batalkan retry downtime yang sedang berjalan saat App unmount
  useEffect(() => {
    return () => {
      downtimeRetryAbortRef.current?.abort();
    };
  }, []);

  const handleRefreshData = () => {
    loadData(true);
  };

  // Refresh KHUSUS downtime (dipakai tab Downtime): hanya fetch ulang data
  // downtime via Apps Script dengan bounded auto-retry (maks 4x), tanpa
  // me-refetch sheet lain. Batal via cancelDowntimeRetry.
  const refreshDowntimeOnly = async () => {
    if (isDowntimeRetrying) return;
    const controller = new AbortController();
    downtimeRetryAbortRef.current = controller;
    setIsDowntimeRetrying(true);
    setDowntimeRetry({ attempt: 1, maxAttempts: 4 });
    try {
      const result = await fetchDowntimeData({
        maxAttempts: 4,
        signal: controller.signal,
        onAttempt: (attempt, maxAttempts) =>
          setDowntimeRetry({ attempt, maxAttempts }),
      });
      setDowntimeRecords(result.records || []);
      setDowntimeSource(result.source || "gviz");
      try {
        localStorage.setItem(CACHE_KEYS.DOWNTIME, JSON.stringify(result.records));
        localStorage.setItem(CACHE_KEYS.DOWNTIME_SOURCE, result.source);
      } catch (e) {
        console.warn("Failed to write downtime cache:", e);
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.log("[Downtime] Retry dibatalkan user, data lama dipertahankan.");
      } else {
        console.warn("[Downtime] refreshDowntimeOnly error:", err);
      }
    } finally {
      setIsDowntimeRetrying(false);
      setDowntimeRetry(null);
      downtimeRetryAbortRef.current = null;
    }
  };

  const cancelDowntimeRetry = () => {
    downtimeRetryAbortRef.current?.abort();
  };

  const getTodayStr = () => {
    const today = new Date();
    if (today.getDay() === 0) {
      today.setDate(today.getDate() + 1); // Default to Monday if today is Sunday
    }
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Summary filters (Default: Current Running Week)
  const [filters, setFilters] = useState<FilterState>(() => {
    const week = getCurrentWeekRange();
    return {
      startDate: week.startDate,
      endDate: week.endDate,
    };
  });

  // Chart / Analytics filters (Default: Today)
  const [chartFilters, setChartFilters] = useState<FilterState>(() => {
    const today = getTodayStr();
    return { startDate: today, endDate: today };
  });

  // 3. Modal / Navigation States
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [isDataManagerOpen, setIsDataManagerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);
  const [isInitialReminderOpen, setIsInitialReminderOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("mrp_suppress_initial_refresh_modal") !== "true";
    }
    return true;
  });

  // 4. Tab State (Default: Preview)
  const [activeTab, setActiveTab] = useState<TabValue>("preview");

  // 5. Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check local storage or system preference
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("darkMode");
      if (saved !== null) {
        return saved === "true";
      }
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return false;
  });

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("darkMode", "true");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("darkMode", "false");
    }
  }, [isDarkMode]);

  // 6. Fullscreen Mode
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    const week = getCurrentWeekRange();
    setFilters({
      startDate: week.startDate,
      endDate: week.endDate,
    });
  };

  const handleChartFilterChange = (key: keyof FilterState, value: string) => {
    setChartFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetChartFilters = () => {
    setChartFilters({
      startDate: "",
      endDate: "",
    });
  };

  // 4. Filter out Sundays and lines that only have "NO PLANNING" globally
  const cleanedPlans = useMemo(
    () => excludeNoPlanningOnlyLines(excludeSundays(plans)),
    [plans],
  );

  // Identify lines that only have "NO PLANNING" (for filtering snapshots etc.)
  const noPlanningLines = useMemo(() => {
    const nonSundayPlans = excludeSundays(plans);
    const plansByLine: Record<string, ProductionPlan[]> = {};
    nonSundayPlans.forEach(plan => {
      if (!plansByLine[plan.line]) plansByLine[plan.line] = [];
      plansByLine[plan.line].push(plan);
    });
    const excluded = new Set<string>();
    Object.entries(plansByLine).forEach(([line, linePlans]) => {
      const allNoPlanning = linePlans.every(p => {
        const style = (p.style || "").trim().toUpperCase();
        const displayStyle = (p.displayStyle || "").trim().toUpperCase();
        return style === "NO PLANNING" || displayStyle === "NO PLANNING";
      });
      if (allNoPlanning) excluded.add(line);
    });
    return excluded;
  }, [plans]);

  // Filter snapshots to exclude NO PLANNING-only lines and Sundays
  const cleanedSnapshots = useMemo(
    () => snapshots.filter(s => {
      if (noPlanningLines.has(s.line)) return false;
      if (isSunday(s.planningDate)) return false;
      return true;
    }),
    [snapshots, noPlanningLines],
  );

  // Derived Calculations for Summary Tab
  const filteredPlans = useMemo(
    () => filterProductionPlans(cleanedPlans, filters),
    [cleanedPlans, filters],
  );

  const adjustedAvailabilities = useMemo(() => {
    return getAdjustedAvailabilityForDateRange(filters.startDate, filters.endDate, availabilities, rentalTrialRecords);
  }, [filters.startDate, filters.endDate, availabilities, rentalTrialRecords]);

  // Derived Calculations for Chart/Analytics Tab (Unfiltered by default)
  const chartFilteredPlans = useMemo(
    () => filterProductionPlans(cleanedPlans, chartFilters),
    [cleanedPlans, chartFilters],
  );

  const chartAdjustedAvailabilities = useMemo(() => {
    return getAdjustedAvailabilityForDateRange(
      chartFilters.startDate,
      chartFilters.endDate,
      availabilities,
      rentalTrialRecords,
    );
  }, [chartFilters.startDate, chartFilters.endDate, availabilities, rentalTrialRecords]);

  const summaryData = useMemo(
    () =>
      calculateMachineRequirements(filteredPlans, requirements, adjustedAvailabilities),
    [filteredPlans, requirements, adjustedAvailabilities],
  );

  const lineMatrix = useMemo(
    () => buildLineMachineMatrix(filteredPlans, requirements),
    [filteredPlans, requirements],
  );

  const allMachineTypes = useMemo(
    () => summaryData.map((s) => s.machine),
    [summaryData],
  );

  const drillDownData = useMemo(() => {
    if (!selectedMachine) return null;
    return getMachineDrillDown(
      selectedMachine,
      filteredPlans,
      requirements,
      availabilities,
    );
  }, [selectedMachine, filteredPlans, requirements, availabilities]);

  const filterSummaryLabel = useMemo(() => {
    const parts: string[] = [];
    if (filters.startDate) parts.push(`Start: ${filters.startDate}`);
    if (filters.endDate) parts.push(`End: ${filters.endDate}`);
    return parts.length > 0 ? parts.join(", ") : "Semua Tanggal";
  }, [filters]);

  // Calculate alert count for sidebar badge
  const rentalTrialAlertCount = useMemo(
    () => getRentalTrialAlerts(rentalTrialRecords, 7).length,
    [rentalTrialRecords]
  );

  // Sidebar Collapsed State (persisted in localStorage)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem("mrp_sidebar_collapsed");
      return saved !== null ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const handleToggleSidebar = () => {
    if (window.innerWidth < 1024) {
      setIsMobileSidebarOpen((prev) => !prev);
    } else {
      setIsSidebarCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("mrp_sidebar_collapsed", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  };

  // Reset to default benchmark data handler
  const handleResetData = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans transition-colors">
        {/* Header Skeleton */}
        <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 h-[68px] w-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-3 animate-pulse">
            <div className="w-12 h-8 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
            <div className="w-48 h-5 rounded bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
          </div>
          <div className="hidden sm:flex items-center space-x-2 animate-pulse">
            <div className="w-24 h-8 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
            <div className="w-24 h-8 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700"></div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-4 animate-pulse">
          {/* Tabs Skeleton */}
          <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex space-x-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg">
              <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700/50 rounded-md"></div>
              <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700/50 rounded-md"></div>
              <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700/50 rounded-md"></div>
              <div className="flex-1 h-10 bg-slate-200 dark:bg-slate-700/50 rounded-md"></div>
            </div>
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Filter Bar Skeleton */}
            <div className="h-[76px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 flex items-center gap-4">
              <div className="w-32 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="flex-1 flex gap-2">
                <div className="w-32 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                <div className="w-32 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
              </div>
            </div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-center">
                    <div className="w-24 h-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
                    <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
                  </div>
                  <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
              ))}
            </div>

            {/* Table Skeleton */}
            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className="w-48 h-5 bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
                  <div className="w-32 h-3 bg-slate-200 dark:bg-slate-700 rounded"></div>
                </div>
                <div className="w-64 h-8 bg-slate-200 dark:bg-slate-700 rounded-lg hidden sm:block"></div>
              </div>

              <div className="space-y-3">
                <div className="w-full h-8 bg-slate-100 dark:bg-slate-800/80 rounded"></div>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="w-full h-12 bg-slate-50 dark:bg-slate-800/40 rounded"
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center font-sans transition-colors">
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-6 rounded-xl border border-red-200 dark:border-red-800/50 max-w-lg shadow-sm">
          <h2 className="text-lg font-bold mb-2">Error Loading Data</h2>
          <p className="text-sm opacity-90">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            Retry Fetching
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors overflow-hidden">
      {/* Top Application Header - Hidden in fullscreen */}
      {!isFullscreen && (
        <Header
          onOpenDataManager={() => setIsDataManagerOpen(true)}
          onOpenReportModal={() => setIsReportModalOpen(true)}
          onExportExcel={() => exportMRPToExcel(summaryData, lineMatrix)}
          onExportCSV={() => exportSummaryToCSV(summaryData)}
          onRefreshData={handleRefreshData}
          isRefreshing={isRefreshing}
          isDarkMode={isDarkMode}
          toggleDarkMode={toggleDarkMode}
          onToggleSidebar={handleToggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />
      )}

      {/* Floating Mini Toolbar in Fullscreen */}
      {isFullscreen && (
        <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 rounded-xl px-2.5 py-1.5 shadow-lg transition-all">
          <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
            {activeTab === 'preview' ? 'Preview' : activeTab === 'summary' ? 'Summary' : activeTab === 'history' ? 'Plan History' : activeTab === 'chart' ? 'Analytics' : activeTab === 'downtime' ? 'Downtime' : activeTab === 'detail' ? 'Detail' : 'Alerts'}
          </span>
          <button
            onClick={toggleDarkMode}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Toggle Dark Mode"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={toggleFullscreen}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-500 dark:text-slate-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Keluar Full Screen (Esc)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 w-full flex overflow-hidden min-h-0">
        {/* Sidebar - Always visible, also in fullscreen */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          alertCount={rentalTrialAlertCount}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
        />

        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-slate-950 min-w-0 min-h-0">
          <main className={`w-full max-w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 min-w-0 overflow-x-hidden ${activeTab === 'history' ? 'flex-1 min-h-0' : 'shrink-0'}`}>
          {/* Filter Bar for Summary Tab */}
          {activeTab === "summary" && (
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              lastUpdated={lastUpdated}
            />
          )}

          {/* Filter Bar for Analytics / Chart Tab (Defaults to Overall) */}
          {activeTab === "chart" && (
            <FilterBar
              filters={chartFilters}
              onFilterChange={handleChartFilterChange}
              onResetFilters={handleResetChartFilters}
              lastUpdated={lastUpdated}
            />
          )}

          {activeTab === "preview" && (
            <PreviewDashboard
              plans={cleanedPlans}
              requirements={requirements}
              availabilities={availabilities}
              snapshots={cleanedSnapshots}
              rentalTrialRecords={rentalTrialRecords}
              inventoryRecords={inventoryRecords}
              downtimeRecords={downtimeRecords}
              onNavigateTab={setActiveTab}
              lastUpdated={lastUpdated}
            />
          )}

          {activeTab === "summary" && (
            <>
              {/* KPI Cards */}
              <KPICards
                summaryData={summaryData}
                availabilityDate={
                  availabilities.length > 0 ? availabilities[0].date : null
                }
              />

              {/* Overall Machine Requirement Table */}
              <OverallRequirementTable
                data={summaryData}
                lineMatrix={lineMatrix}
                onSelectMachine={(machine) => setSelectedMachine(machine)}
              />
            </>
          )}

          {activeTab === "detail" && (
            <DetailLayout
              plans={cleanedPlans}
              requirements={requirements}
              availabilities={availabilities}
              rentalTrialRecords={rentalTrialRecords}
              initialDate={filters.startDate}
              initialEndDate={filters.endDate}
            />
          )}

          {activeTab === "history" && (
            <HistoryLayout
              snapshots={cleanedSnapshots}
              plans={cleanedPlans}
              requirements={requirements}
              availabilities={availabilities}
              rentalTrialRecords={rentalTrialRecords}
            />
          )}

          {activeTab === "chart" && (
            <ChartDashboard
              plans={chartFilteredPlans}
              requirements={requirements}
              availabilities={chartAdjustedAvailabilities}
              rentalTrialRecords={rentalTrialRecords}
              inventoryRecords={inventoryRecords}
              filters={chartFilters}
            />
          )}

          {activeTab === "alerts" && (
            <RentalAlertsDashboard
              rentalTrialRecords={rentalTrialRecords}
            />
          )}

          {activeTab === "downtime" && (
            <DowntimeDashboard
              downtimeRecords={downtimeRecords}
              downtimeSource={downtimeSource}
              onRefreshData={refreshDowntimeOnly}
              isDowntimeRetrying={isDowntimeRetrying}
              downtimeRetry={downtimeRetry}
              onCancelDowntimeRetry={cancelDowntimeRetry}
            />
          )}
          </main>

          {/* Footer attached at bottom of scrollable content area */}
          <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-3.5 px-4 sm:px-6 lg:px-8 mt-auto shrink-0 transition-colors">
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  Garment Sewing Machine Requirement Planning (MRP) Dashboard
                </span>{" "}
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setIsDataManagerOpen(true)}
                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium hover:underline cursor-pointer"
                >
                  Google Sheets Source Sync
                </button>
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* MODALS / DRAWERS */}
      {/* 1. Detail Drill Down Modal */}
      <MachineDrillDownModal
        data={drillDownData}
        onClose={() => setSelectedMachine(null)}
      />

      {/* 2. Data Manager / Spreadsheet Sync Modal */}
      <DataManagerModal
        isOpen={isDataManagerOpen}
        onClose={() => setIsDataManagerOpen(false)}
        plans={cleanedPlans}
        requirements={requirements}
        availabilities={availabilities}
        onUpdatePlans={setPlans}
        onUpdateRequirements={setRequirements}
        onUpdateAvailabilities={setAvailabilities}
        onResetData={handleResetData}
      />

      {/* 3. Printable Report Modal */}
      <PrintableReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        summaryData={summaryData}
        lineMatrix={lineMatrix}
        allMachineTypes={allMachineTypes}
        filterSummaryLabel={filterSummaryLabel}
      />

      {/* 4. AI Industrial Engineering Adviser Modal */}
      <IEAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        summaryData={summaryData}
        lineMatrix={lineMatrix}
      />

      {/* 5. Initial Data Refresh Reminder Pop-Up */}
      <InitialReminderModal
        isOpen={isInitialReminderOpen}
        onClose={() => setIsInitialReminderOpen(false)}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
      />
    </div>
  );
}
