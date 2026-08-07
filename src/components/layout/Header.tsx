import React from "react";
import {
  FileSpreadsheet,
  FileText,
  Download,
  Database,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { GOOGLE_SHEET_URL } from "../../utils/googleSheetsAPI";

interface HeaderProps {
  onOpenDataManager: () => void;
  onOpenReportModal: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onRefreshData: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenDataManager,
  onOpenReportModal,
  onExportExcel,
  onExportCSV,
  onRefreshData,
  isRefreshing,
}) => {
  return (
    <header className="bg-white text-slate-800 border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            <div className="w-12 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-sm font-bold text-white text-lg">
              MRP
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-800">
                  Machine Requirement Planning Dashboard
                </h1>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Refresh Data Button */}
            <button
              onClick={onRefreshData}
              disabled={isRefreshing}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              title="Force re-fetch latest data from Google Sheets and update browser cache"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>{isRefreshing ? "Syncing..." : "Refresh Data"}</span>
            </button>

            {/* Google Sheets Link Button */}
            <a
              href={GOOGLE_SHEET_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              title="Open source Google Spreadsheet (Plan, OB IE, Ketersediaan Mesin)"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Google Sheets</span>
              <ExternalLink className="w-3 h-3 text-slate-400" />
            </a>

            {/* Data Source & Sheets Manager */}
            <button
              onClick={onOpenDataManager}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              title="View or edit the underlying Google Sheets Plan, OB IE, and Machine Availability tables"
            >
              <Database className="w-3.5 h-3.5 text-indigo-600" />
              <span>Data Source / Sync</span>
            </button>

            {/* Export Dropdown / Buttons */}
            <div className="inline-flex rounded-lg shadow-sm">
              <button
                onClick={onExportExcel}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-l-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
                title="Export Overall Machine Requirements & Line Matrix to Excel (.xlsx)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={onExportCSV}
                className="inline-flex items-center px-2.5 py-1.5 rounded-r-lg text-xs font-medium bg-indigo-700 hover:bg-indigo-800 text-white border-l border-indigo-500 transition-colors"
                title="Export Summary CSV"
              >
                <span>CSV</span>
              </button>
            </div>

            {/* PDF / Printable Report */}
            <button
              onClick={onOpenReportModal}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              title="Open printable IE report for PDF export or production meetings"
            >
              <FileText className="w-3.5 h-3.5 text-amber-600" />
              <span>Print / PDF Report</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
