import { useState, useMemo, useEffect } from "react";
import { fetchAllMRPData } from "./utils/googleSheetsAPI";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  FilterState,
} from "./types/mrp";
import {
  filterProductionPlans,
  calculateMachineRequirements,
  buildLineMachineMatrix,
  getMachineDrillDown,
} from "./utils/mrpCalculations";
import { exportMRPToExcel, exportSummaryToCSV } from "./utils/exportUtils";
import { Header } from "./components/layout/Header";
import { FilterBar } from "./components/filters/FilterBar";
import { OverallRequirementTable } from "./components/dashboard/OverallRequirementTable";
import { DetailLayout } from "./components/dashboard/DetailLayout";
import { HistoryLayout } from "./components/dashboard/HistoryLayout";

import { KPICards } from "./components/dashboard/KPICards";
import { MachineDrillDownModal } from "./components/modals/MachineDrillDownModal";
import { DataManagerModal } from "./components/modals/DataManagerModal";
import { PrintableReportModal } from "./components/modals/PrintableReportModal";
import { IEAssistantModal } from "./components/modals/IEAssistantModal";

export default function App() {
  // 1. Core Data States
  const [plans, setPlans] = useState<ProductionPlan[]>([]);
  const [requirements, setRequirements] = useState<
    MachineRequirementPerStyle[]
  >([]);
  const [availabilities, setAvailabilities] = useState<MachineAvailability[]>(
    [],
  );
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

  const [filters, setFilters] = useState<FilterState>({
    startDate: getTodayStr(),
    endDate: getTodayStr(),
  });

  // 3. Modal / Navigation States
  const [selectedMachine, setSelectedMachine] = useState<string | null>(null);
  const [isDataManagerOpen, setIsDataManagerOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState(false);

  // 4. Tab State
  const [activeTab, setActiveTab] = useState<"summary" | "detail" | "history">(
    "summary",
  );

  // Filter handlers
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      startDate: getTodayStr(),
      endDate: getTodayStr(),
    });
  };

  // 4. Derived Calculations
  const filteredPlans = useMemo(
    () => filterProductionPlans(plans, filters),
    [plans, filters],
  );

  const summaryData = useMemo(
    () =>
      calculateMachineRequirements(filteredPlans, requirements, availabilities),
    [filteredPlans, requirements, availabilities],
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

  // Reset to default benchmark data handler
  const handleResetData = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-indigo-900 font-medium">
            Fetching live data from Google Sheets...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-sans">
        <div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200 max-w-lg shadow-sm">
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        onOpenDataManager={() => setIsDataManagerOpen(true)}
        onOpenReportModal={() => setIsReportModalOpen(true)}
        onExportExcel={() =>
          exportMRPToExcel(summaryData, lineMatrix, filterSummaryLabel)
        }
        onExportCSV={() => exportSummaryToCSV(summaryData)}
        onRefreshData={handleRefreshData}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col gap-4">
        {/* Horizontal Tabs Navigation */}
        <div className="border-b border-slate-200 pb-2">
          <nav className="flex space-x-1 p-1 bg-slate-100/50 rounded-lg backdrop-blur-sm w-full">
            <button
              onClick={() => setActiveTab("summary")}
              className={`flex-1 px-4 sm:px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "summary"
                  ? "bg-emerald-500 text-white shadow-md ring-1 ring-emerald-600/50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Summary
            </button>
            <button
              onClick={() => setActiveTab("detail")}
              className={`flex-1 px-4 sm:px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "detail"
                  ? "bg-emerald-500 text-white shadow-md ring-1 ring-emerald-600/50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              Detail Layout
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 px-4 sm:px-6 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
                activeTab === "history"
                  ? "bg-emerald-500 text-white shadow-md ring-1 ring-emerald-600/50"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              History
            </button>
          </nav>
        </div>

        {/* Content Area */}
        <main className="flex-1 min-w-0 flex flex-col gap-0.5">
          {/* Global Filter Bar (Visible only on summary tab) */}
          {activeTab === "summary" && (
            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
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
              initialDate={filters.startDate}
            />
          )}

          {activeTab === "history" && (
            <HistoryLayout
              filteredPlans={plans}
              requirements={requirements}
              availabilities={availabilities}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-5 mt-12 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            <span className="font-bold text-slate-800">
              Garment Sewing Machine Requirement Planning (MRP) Dashboard
            </span>{" "}
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDataManagerOpen(true)}
              className="text-indigo-600 hover:text-indigo-700 font-medium hover:underline"
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
    </div>
  );
}
