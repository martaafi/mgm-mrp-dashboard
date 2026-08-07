import React, { useState } from "react";
import {
  X,
  Database,
  FileSpreadsheet,
  RotateCcw,
  ExternalLink,
  Table,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
} from "../../types/mrp";
import { GOOGLE_SHEET_URL } from "../../utils/googleSheetsAPI";

interface DataManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  onUpdatePlans: (plans: ProductionPlan[]) => void;
  onUpdateRequirements: (req: MachineRequirementPerStyle[]) => void;
  onUpdateAvailabilities: (avail: MachineAvailability[]) => void;
  onResetData: () => void;
}

type ActiveSheet = "plan" | "ob" | "avail";

export const DataManagerModal: React.FC<DataManagerModalProps> = ({
  isOpen,
  onClose,
  plans,
  requirements,
  availabilities,
  // onUpdatePlans,
  // onUpdateRequirements,
  onUpdateAvailabilities,
  onResetData,
}) => {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>("plan");
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  // Quick adder for machine availability
  // const [newJenisMesin, setNewJenisMesin] = useState("");
  // const [newJumlahMesin, setNewJumlahMesin] = useState<number>(10);

  // Column filters for Plan Sheet
  const [planStartDate, setPlanStartDate] = useState("");
  const [planEndDate, setPlanEndDate] = useState("");
  const [planLineFilter, setPlanLineFilter] = useState("");
  const [obStyleFilter, setObStyleFilter] = useState("");

  // Sorting states for Plan Sheet
  const [planSortKey, setPlanSortKey] = useState<"date" | "line" | "style">("date");
  const [planSortDir, setPlanSortDir] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPagePlan, setCurrentPagePlan] = useState(1);
  const [currentPageOB, setCurrentPageOB] = useState(1);
  const [currentPageAvail, setCurrentPageAvail] = useState(1);
  const ITEMS_PER_PAGE = 50;

  const handleObStyleFilter = (v: string) => {
    setObStyleFilter(v);
    setCurrentPageOB(1);
  };

  const handlePlanSort = (key: "date" | "line" | "style") => {
    if (planSortKey === key) {
      setPlanSortDir(planSortDir === "asc" ? "desc" : "asc");
    } else {
      setPlanSortKey(key);
      setPlanSortDir("asc");
    }
    setCurrentPagePlan(1);
  };

  if (!isOpen) return null;

  const renderPagination = (
    currentPage: number,
    totalItems: number,
    setPage: (p: number) => void,
  ) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-slate-200 sm:px-6">
        <div className="flex justify-between sm:hidden w-full">
          <button
            onClick={() => setPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-slate-700">
              Showing{" "}
              <span className="font-bold">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>{" "}
              to{" "}
              <span className="font-bold">
                {Math.min(currentPage * ITEMS_PER_PAGE, totalItems)}
              </span>{" "}
              of <span className="font-bold">{totalItems}</span> results
            </p>
          </div>
          <div>
            <nav
              className="isolate inline-flex -space-x-px rounded-md shadow-sm"
              aria-label="Pagination"
            >
              <button
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
                className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0 transition-colors"
              >
                <span className="sr-only">Previous</span>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <span className="relative inline-flex items-center px-4 py-2 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-300 focus:outline-offset-0 bg-slate-50">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-50 focus:z-20 focus:outline-offset-0 transition-colors"
              >
                <span className="sr-only">Next</span>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // const handleAddMachineAvail = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   if (!newJenisMesin.trim()) return;
  //   const newItem: MachineAvailability = {
  //     jenisMesin: newJenisMesin.trim(),
  //     jumlahMesin: newJumlahMesin,
  //   };
  //   onUpdateAvailabilities([...availabilities, newItem]);
  //   setNewJenisMesin("");
  //   setNewJumlahMesin(10);
  // };

  const handleAvailChange = (
    jenisMesin: string,
    type: "pinjam" | "sewa",
    newCount: number,
  ) => {
    onUpdateAvailabilities(
      availabilities.map((item) => {
        if (item.jenisMesin === jenisMesin) {
          const updatedItem = { ...item };
          if (type === "pinjam")
            updatedItem.pinjamCount = Math.max(0, newCount);
          if (type === "sewa") updatedItem.sewaCount = Math.max(0, newCount);

          updatedItem.jumlahMesin =
            (updatedItem.baseCount ?? 0) +
            (updatedItem.pinjamCount ?? 0) +
            (updatedItem.sewaCount ?? 0);
          return updatedItem;
        }
        return item;
      }),
    );
  };

  const filteredPlans = plans.filter((p) => {
    let isValid = true;
    if (planLineFilter && p.line !== planLineFilter) isValid = false;
    if (planStartDate && p.date < planStartDate) isValid = false;
    if (planEndDate && p.date > planEndDate) isValid = false;
    return isValid;
  });

  const uniqueLines = Array.from(new Set(plans.map((p) => p.line).filter(Boolean))).sort();

  const uniqueStyles = Array.from(
    new Set(requirements.map((r) => r.style).filter(Boolean)),
  ).sort();

  const filteredRequirements = requirements.filter((req) => {
    if (!obStyleFilter) return true;
    return req.style === obStyleFilter;
  });

  const sortedPlans = [...filteredPlans].sort((a, b) => {
    let aVal = "";
    let bVal = "";
    if (planSortKey === "style") {
      aVal = String(a.displayStyle || a.style || "");
      bVal = String(b.displayStyle || b.style || "");
    } else {
      aVal = String(a[planSortKey] || "");
      bVal = String(b[planSortKey] || "");
    }
    const comparison = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: 'base' });
    return planSortDir === "asc" ? comparison : -comparison;
  });

  const paginatedPlans = sortedPlans.slice(
    (currentPagePlan - 1) * ITEMS_PER_PAGE,
    currentPagePlan * ITEMS_PER_PAGE,
  );
  const paginatedRequirements = filteredRequirements.slice(
    (currentPageOB - 1) * ITEMS_PER_PAGE,
    currentPageOB * ITEMS_PER_PAGE,
  );
  const paginatedAvailabilities = availabilities.slice(
    (currentPageAvail - 1) * ITEMS_PER_PAGE,
    currentPageAvail * ITEMS_PER_PAGE,
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800">
                Data Source &amp; Google Spreadsheet Sync
              </h2>
              <p className="text-xs text-slate-500"></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Google Sheet Banner */}
        <div className="bg-slate-50 px-6 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-700">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Connected Google Spreadsheet:{" "}
              <a
                href={GOOGLE_SHEET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline font-mono ml-1 break-all"
              >
                Planning Kebutuhan Mesin
              </a>
            </span>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </div>

          <div className="flex items-center space-x-2">
            {!showConfirmReset ? (
              <button
                onClick={() => setShowConfirmReset(true)}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Default</span>
              </button>
            ) : (
              <div className="inline-flex items-center space-x-2">
                <span className="text-xs text-red-600 font-semibold">
                  Reset all data?
                </span>
                <button
                  onClick={() => {
                    onResetData();
                    setShowConfirmReset(false);
                  }}
                  className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-semibold hover:bg-red-500"
                >
                  Yes, Reset
                </button>
                <button
                  onClick={() => setShowConfirmReset(false)}
                  className="px-2.5 py-1 rounded bg-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sheet Tabs Navigation */}
        <div className="bg-slate-50 px-6 border-b border-slate-200 flex space-x-2">
          <button
            onClick={() => setActiveSheet("plan")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeSheet === "plan"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Sheet 1: Plan ({plans.length} rows)</span>
          </button>
          <button
            onClick={() => setActiveSheet("ob")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeSheet === "ob"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>
              Sheet 2: Database Mesin per Style ({requirements.length} rows)
            </span>
          </button>
          <button
            onClick={() => setActiveSheet("avail")}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeSheet === "avail"
                ? "border-indigo-600 text-indigo-600 bg-white shadow-sm"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>
              Sheet 3: Ketersediaan Mesin ({availabilities.length} machines)
            </span>
          </button>
        </div>

        {/* Sheet Contents */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* SHEET 1: PLAN */}
          {activeSheet === "plan" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <span className="text-xs font-semibold text-slate-800">
                  Production Planning Style by PPIC
                </span>
                
                <div className="flex items-center space-x-2">
                  <div className="flex items-center bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus-within:border-indigo-500 shadow-sm">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
                    <input
                      type="date"
                      value={planStartDate}
                      onChange={(e) => { setPlanStartDate(e.target.value); setCurrentPagePlan(1); }}
                      className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                    />
                    <span className="text-slate-400 text-xs font-semibold px-1">to</span>
                    <input
                      type="date"
                      value={planEndDate}
                      onChange={(e) => { setPlanEndDate(e.target.value); setCurrentPagePlan(1); }}
                      className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
                    />
                  </div>
                  
                  <select
                    value={planLineFilter}
                    onChange={(e) => { setPlanLineFilter(e.target.value); setCurrentPagePlan(1); }}
                    className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-600 shadow-sm font-semibold"
                  >
                    <option value="">All Lines</option>
                    {uniqueLines.map(line => (
                      <option key={line} value={line}>{line}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto flex flex-col">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase text-[10px]">
                      <th
                        className="p-2 border-b border-slate-200 font-semibold cursor-pointer hover:bg-slate-200 transition-colors select-none"
                        onClick={() => handlePlanSort("date")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Date</span>
                          {planSortKey === "date" ? (
                            planSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-2 border-b border-slate-200 font-semibold cursor-pointer hover:bg-slate-200 transition-colors select-none"
                        onClick={() => handlePlanSort("line")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Line</span>
                          {planSortKey === "line" ? (
                            planSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />
                          )}
                        </div>
                      </th>
                      <th
                        className="p-2 border-b border-slate-200 font-semibold cursor-pointer hover:bg-slate-200 transition-colors select-none"
                        onClick={() => handlePlanSort("style")}
                      >
                        <div className="flex items-center space-x-1">
                          <span>Style</span>
                          {planSortKey === "style" ? (
                            planSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-50" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedPlans.map((p, index) => (
                      <tr key={`plan-${index}`} className="hover:bg-slate-50">
                        <td className="p-2.5 text-indigo-700 font-medium">
                          {p.date}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800">
                          {p.line}
                        </td>
                        <td className="p-2.5 text-slate-800 font-semibold truncate max-w-xs" title={p.displayStyle || p.style}>
                          {p.displayStyle || p.style}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(
                  currentPagePlan,
                  filteredPlans.length,
                  setCurrentPagePlan,
                )}
              </div>
            </div>
          )}

          {/* SHEET 2: Database Mesin per Style */}
          {activeSheet === "ob" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 gap-3">
                <div>
                  <span className="text-sm font-bold text-slate-800 block">
                    {obStyleFilter
                      ? `Kebutuhan Mesin Style ${obStyleFilter}`
                      : "Kebutuhan Mesin Berdasarkan Style"}
                  </span>
                </div>
                <select
                  value={obStyleFilter}
                  onChange={(e) => handleObStyleFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-indigo-600 w-full sm:w-64 shadow-sm font-semibold"
                >
                  <option value="">Semua Style</option>
                  {uniqueStyles.map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto flex flex-col">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase">
                      <th className="p-2.5">Style</th>
                      <th className="p-2.5">Jenis Mesin</th>
                      <th className="p-2.5 text-right">Total Kebutuhan</th>
                      <th className="p-2.5 text-right">Layout</th>
                      <th className="p-2.5 text-right">Spare</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedRequirements.map((req, index) => (
                      <tr key={`req-${index}`} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">
                            {req.style}
                          </div>
                        </td>
                        <td className="p-2.5 font-bold text-indigo-700">
                          {req.jenisMesin}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900 text-sm">
                          {req.kebutuhanTotal}
                        </td>
                        <td className="p-2.5 text-right text-slate-700">
                          {req.kebutuhanLayout}
                        </td>
                        <td className="p-2.5 text-right text-slate-700">
                          {req.kebutuhanSpare}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(
                  currentPageOB,
                  filteredRequirements.length,
                  setCurrentPageOB,
                )}
              </div>
            </div>
          )}

          {/* SHEET 3: KETERSEDIAAN MESIN (Editable!) */}
          {activeSheet === "avail" && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <span className="text-xs font-semibold text-slate-800 block">
                    Available Machine Inventory
                  </span>
                  <span className="text-xs text-slate-500"></span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden overflow-x-auto flex flex-col">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 uppercase">
                      <th className="p-3">Jenis Mesin</th>
                      <th className="p-3 text-right">
                        Jumlah Mesin (Pringapus)
                      </th>
                      <th className="p-3 text-right">Pinjam (Internal)</th>
                      <th className="p-3 text-right">Sewa</th>
                      <th className="p-3 text-right text-indigo-700">
                        Total Mesin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {paginatedAvailabilities.map((item) => (
                      <tr key={item.jenisMesin} className="hover:bg-slate-50">
                        <td className="p-3 font-bold text-slate-800 text-sm">
                          {item.jenisMesin}
                        </td>
                        <td className="p-3 text-right font-medium text-slate-600">
                          {item.baseCount ?? 0}
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.pinjamCount ?? 0}
                            onChange={(e) =>
                              handleAvailChange(
                                item.jenisMesin,
                                "pinjam",
                                Number(e.target.value) || 0,
                              )
                            }
                            className="w-16 text-right bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={item.sewaCount ?? 0}
                            onChange={(e) =>
                              handleAvailChange(
                                item.jenisMesin,
                                "sewa",
                                Number(e.target.value) || 0,
                              )
                            }
                            className="w-16 text-right bg-white border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 shadow-sm"
                          />
                        </td>
                        <td className="p-3 text-right font-bold text-indigo-700 text-base">
                          {item.jumlahMesin}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {renderPagination(
                  currentPageAvail,
                  availabilities.length,
                  setCurrentPageAvail,
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Tutup (Done)
          </button>
        </div>
      </div>
    </div>
  );
};
