import React from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Database,
  ExternalLink,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { GOOGLE_SHEET_URL } from "../../utils/googleSheetsAPI";
import { Moon, Sun } from "lucide-react";

interface HeaderProps {
  onOpenDataManager: () => void;
  onOpenReportModal: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDataManager,
  onOpenReportModal,
  onExportExcel,
  onExportCSV,
  onRefreshData,
  isRefreshing,
  isDarkMode,
  toggleDarkMode,
  onToggleSidebar,
  isSidebarCollapsed = false,
}) => {
  return (
    <header className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-sm transition-colors">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Logo, Sidebar Toggle, and Title */}
          <div className="flex items-center space-x-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-1.5 -ml-1 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title={
                  isSidebarCollapsed
                    ? "Perlebar Menu Sidebar"
                    : "Perkecil Menu Sidebar (Mini Rail)"
                }
                aria-label="Toggle sidebar"
              >
                {isSidebarCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                ) : (
                  <PanelLeftClose className="w-5 h-5" />
                )}
              </button>
            )}
            <div className="w-12 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm font-bold text-white text-lg shrink-0">
              MRP
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                  Machine Requirement Planning Dashboard
                </h1>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Refresh Data Button */}
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              title="Force re-fetch latest data from Google Sheets and update browser cache"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">
                {isRefreshing ? "Syncing..." : "Refresh Data"}
              </span>
            </button>

            {/* Google Sheets Link Button */}
            <a
              href={GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
              title="Open source Google Spreadsheet (Plan, OB IE, Ketersediaan Mesin)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Sheets</span>
              <ExternalLink className="w-3 h-3 text-slate-400 hidden sm:inline" />
            </a>

            {/* Data Source & Sheets Manager */}
            <button
              onClick={onOpenDataManager}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
              title="View or edit the underlying Google Sheets Plan, OB IE, and Machine Availability tables"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Data Source</span>
            </button>

            {/* Export Dropdown / Buttons */}
            <div className="inline-flex rounded-lg shadow-sm shrink-0">
              <button
                onClick={onExportExcel}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-l-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                title="Export Overall Machine Requirements & Line Matrix to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Excel</span>
              </button>
              <button
                onClick={onExportCSV}
                className="inline-flex items-center px-2 py-1.5 rounded-r-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-800 text-white border-l border-indigo-500 transition-colors"
                title="Export Summary CSV"
              >
                <span>CSV</span>
              </button>
            </div>

            {/* PDF / Printable Report */}
            <button
              onClick={onOpenReportModal}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors shrink-0"
              title="Open printable IE report for PDF export or production meetings"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Report</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? (
                <Sun className="w-3.5 h-3.5" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
