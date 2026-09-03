import { useState, useMemo, useEffect } from "react";
import { fetchAllMRPData } from "./utils/googleSheetsAPI";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
  InventoryRecord,
  FilterState,
} from "./types/mrp";
import {
  filterProductionPlans,
  calculateMachineRequirements,
  buildLineMachineMatrix,
  getMachineDrillDown,
  getRentalTrialAlerts,
  getAdjustedAvailabilityForDateRange,
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

  const handleRefreshData = () => {
    loadData(true);
  };

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Summary filters (Default: Today)
  const [filters, setFilters] = useState<FilterState>({
    startDate: getTodayStr(),
    endDate: getTodayStr(),
  });

  // Chart / Analytics filters (Default: Empty = Overall/Semua Tanggal)
  const [chartFilters, setChartFilters] = useState<FilterState>({
    startDate: "",
    endDate: "",
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

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: getTodayStr(),
      endDate: getTodayStr(),
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

  // 4. Derived Calculations for Summary Tab
  const filteredPlans = useMemo(
    () => filterProductionPlans(plans, filters),
    [plans, filters],
  );

  const adjustedAvailabilities = useMemo(() => {
    return getAdjustedAvailabilityForDateRange(filters.startDate, filters.endDate, availabilities, rentalTrialRecords);
  }, [filters.startDate, filters.endDate, availabilities, rentalTrialRecords]);

  // Derived Calculations for Chart/Analytics Tab (Unfiltered by default)
  const chartFilteredPlans = useMemo(
    () => filterProductionPlans(plans, chartFilters),
    [plans, chartFilters],
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
        <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-4 animate-pulse">
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Application Header */}
      <Header
        onOpenDataManager={() => setIsDataManagerOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onExportExcel={() => exportMRPToExcel(summaryData, lineMatrix)}
        onExportCSV={() => exportSummaryToCSV(summaryData)}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />

      {/* Main Container */}
      <div className="flex-1 w-full flex overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} alertCount={rentalTrialAlertCount} />

        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
          <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 min-h-full">
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
              plans={plans}
              requirements={requirements}
              availabilities={availabilities}
              snapshots={snapshots}
              rentalTrialRecords={rentalTrialRecords}
              inventoryRecords={inventoryRecords}
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
                onSelectMachine={(machine) => setSelectedMachine(machine)}
              />
            </>
          )}

          {activeTab === "detail" && (
            <DetailLayout
              plans={plans}
              requirements={requirements}
              availabilities={availabilities}
              rentalTrialRecords={rentalTrialRecords}
              initialDate={filters.startDate}
            />
          )}

          {activeTab === "history" && (
            <HistoryLayout
              snapshots={snapshots}
              plans={plans}
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
          </main>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-5 mt-12 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <div>
            <span className="font-bold text-slate-800 dark:text-slate-200">
              Garment Sewing Machine Requirement Planning (MRP) Dashboard
            </span>{" "}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDataManagerOpen(true)}
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium hover:underline"
            >
              Google Sheets Source Sync
            </button>
          </div>
        </div>
      </footer>

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
        plans={plans}
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
