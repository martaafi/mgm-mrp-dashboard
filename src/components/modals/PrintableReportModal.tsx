import React from 'react';
import { X, Printer, FileText } from 'lucide-react';
import { MachineRequirementSummary, LineMachineMatrixRow } from '../../types/mrp';

interface PrintableReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  summaryData: MachineRequirementSummary[];
  lineMatrix: LineMachineMatrixRow[];
  allMachineTypes: string[];
  filterSummaryLabel: string;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({
  isOpen,
  onClose,
  summaryData,
  lineMatrix,
  allMachineTypes,
  filterSummaryLabel,
}) => {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalRequired = summaryData.reduce((acc, curr) => acc + curr.required, 0);
  const totalAvailable = summaryData.reduce((acc, curr) => acc + curr.available, 0);
  const totalShortage = summaryData.reduce(
    (acc, curr) => (curr.gap < 0 ? acc + Math.abs(curr.gap) : acc),
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 transition-colors print:bg-white print:text-black print:border-none print:shadow-none print:max-w-none print:w-full">
        {/* Modal Header (hidden on print) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between transition-colors print:hidden">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
                IE Official Printable MRP Report
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ready for PDF Save or Print for daily production planning meeting
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {/* Report Header */}
          <div className="border-b-2 border-slate-200 dark:border-slate-700 pb-4 print:border-black transition-colors">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight print:text-black">
                  GARMENT MANUFACTURING IE &bull; SEWING MRP REPORT
                </h1>
                <p className="text-sm text-slate-600 dark:text-slate-400 print:text-gray-600 mt-1">
                  Machine Requirement Planning (MRP) for Daily Production Schedule
                </p>
              </div>
              <div className="text-right text-xs text-slate-500 dark:text-slate-400 print:text-gray-600 font-mono">
                <div>Date: {new Date().toLocaleDateString()}</div>
                <div>Filter Scope: {filterSummaryLabel}</div>
                <div>Lines Scheduled: {lineMatrix.length} line(s)</div>
              </div>
            </div>
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-3 gap-4 print:grid-cols-3">
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 print:border-gray-400 print:bg-gray-50 transition-colors">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 print:text-gray-600">
                Total Required Sewing Machines
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 print:text-black mt-1">
                {totalRequired} units
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 print:border-gray-400 print:bg-gray-50 transition-colors">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 print:text-gray-600">
                Total Available in Plant
              </span>
              <div className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 print:text-black mt-1">
                {totalAvailable} units
              </div>
            </div>
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 print:border-gray-400 print:bg-gray-50 transition-colors">
              <span className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 print:text-gray-600">
                Total Shortage / Deficit
              </span>
              <div
                className={`text-2xl font-extrabold mt-1 transition-colors ${
                  totalShortage > 0 ? 'text-red-600 dark:text-red-400 print:text-red-600' : 'text-emerald-600 dark:text-emerald-400 print:text-green-600'
                }`}
              >
                {totalShortage > 0 ? `${totalShortage} units deficit` : 'Balanced (0 Shortage)'}
              </div>
            </div>
          </div>

          {/* Section 1: Overall Machine Requirements */}
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-800 dark:text-slate-200 print:text-black mb-2 border-l-4 border-indigo-600 pl-2">
              1. Overall Sewing Machine Requirement &amp; Inventory Balance
            </h3>
            <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 print:border-gray-400 text-xs transition-colors">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 print:bg-gray-200 print:text-black font-bold transition-colors">
                  <th className="p-2 border border-slate-200 dark:border-slate-700 print:border-gray-400">Machine Code</th>
                  <th className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400">Required</th>
                  <th className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400">Available</th>
                  <th className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400">Gap</th>
                  <th className="p-2 text-center border border-slate-200 dark:border-slate-700 print:border-gray-400">Status</th>
                  <th className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400">Utilization</th>
                </tr>
              </thead>
              <tbody>
                {summaryData.map((item) => (
                  <tr key={item.machine} className="print:border-b print:border-gray-300">
                    <td className="p-2 font-bold text-slate-900 dark:text-slate-100 print:text-black border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {item.machine}
                    </td>
                    <td className="p-2 text-right font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {item.required}
                    </td>
                    <td className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {item.available}
                    </td>
                    <td
                      className={`p-2 text-right font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400 transition-colors ${
                        item.gap < 0 ? 'text-red-600 dark:text-red-400 print:text-red-600' : ''
                      }`}
                    >
                      {item.gap > 0 ? `+${item.gap}` : item.gap}
                    </td>
                    <td className="p-2 text-center font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {item.status}
                    </td>
                    <td className="p-2 text-right font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {item.utilization}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: Line by Line Matrix */}
          <div>
            <h3 className="text-sm font-bold uppercase text-slate-800 dark:text-slate-200 print:text-black mb-2 border-l-4 border-indigo-600 pl-2">
              2. Production Line Schedule &amp; Machine Matrix
            </h3>
            <table className="w-full text-left border-collapse border border-slate-200 dark:border-slate-700 print:border-gray-400 text-xs transition-colors">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 print:bg-gray-200 print:text-black font-bold transition-colors">
                  <th className="p-2 border border-slate-200 dark:border-slate-700 print:border-gray-400">Line</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700 print:border-gray-400">Style</th>
                  {allMachineTypes.map((machine) => (
                    <th
                      key={`print-${machine}`}
                      className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400"
                    >
                      {machine}
                    </th>
                  ))}
                  <th className="p-2 text-right border border-slate-200 dark:border-slate-700 print:border-gray-400 font-bold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineMatrix.map((row) => (
                  <tr key={row.line} className="print:border-b print:border-gray-300">
                    <td className="p-2 font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {row.line}
                    </td>
                    <td className="p-2 border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {row.style}
                    </td>
                    {allMachineTypes.map((machine) => (
                      <td
                        key={`print-cell-${machine}`}
                        className="p-2 text-right font-mono border border-slate-200 dark:border-slate-700 print:border-gray-400"
                      >
                        {row.machines[machine] || '-'}
                      </td>
                    ))}
                    <td className="p-2 text-right font-bold border border-slate-200 dark:border-slate-700 print:border-gray-400">
                      {row.totalMachines}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Official Signatures Footer */}
          <div className="pt-8 border-t border-slate-200 dark:border-slate-800 print:border-black flex justify-between text-xs text-slate-500 dark:text-slate-400 print:text-gray-700 transition-colors">
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                Prepared by: Industrial Engineering Dept.
              </div>
              <div className="mt-8 border-t border-slate-400 dark:border-slate-500 print:border-gray-500 w-48 pt-1">
                IE Supervisor / Planner
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-800 dark:text-slate-200 print:text-black">
                Approved by: Production Manager
              </div>
              <div className="mt-8 border-t border-slate-400 dark:border-slate-500 print:border-gray-500 w-48 pt-1 ml-auto">
                Factory Manager
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (hidden on print) */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 flex justify-end print:hidden transition-colors">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
