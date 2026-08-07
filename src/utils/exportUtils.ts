import * as XLSX from 'xlsx';
import { MachineRequirementSummary, LineMachineMatrixRow } from '../types/mrp';

export const exportMRPToExcel = (
  summaryData: MachineRequirementSummary[],
  lineMatrix: LineMachineMatrixRow[]
) => {
  // 1. Prepare Summary Sheet
  const summarySheetData = summaryData.map((item) => ({
    'Machine Code': item.machine,
    'Required Machines': item.required,
    'Available Machines': item.available,
    'Gap (Available - Required)': item.gap,
    'Status': item.status,
    'Utilization (%)': `${item.utilization}%`,
    'Active Lines Count': item.linesCount,
  }));

  const wsSummary = XLSX.utils.json_to_sheet(summarySheetData);

  // Set column widths
  wsSummary['!cols'] = [
    { wch: 16 },
    { wch: 35 },
    { wch: 18 },
    { wch: 18 },
    { wch: 25 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
  ];

  // 2. Prepare Line Detail Sheet
  // Collect all distinct machines present in lineMatrix
  const allMachineKeys = Array.from(
    new Set(lineMatrix.flatMap((row) => Object.keys(row.machines)))
  ).sort();

  const lineSheetData = lineMatrix.map((row) => {
    const obj: Record<string, string | number> = {
      'Line': row.line,
      'Style': row.style,
      'Kode Style': row.kodeStyle,
      'Date': row.date,
      'Plan Qty': row.qty,
    };
    allMachineKeys.forEach((m) => {
      obj[m] = row.machines[m] || 0;
    });
    obj['Total Machines Required'] = row.totalMachines;
    return obj;
  });

  const wsLine = XLSX.utils.json_to_sheet(lineSheetData);

  // Create workbook and append sheets
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Overall Machine Requirement');
  XLSX.utils.book_append_sheet(wb, wsLine, 'Line Detail Matrix');

  const filename = `Sewing_MRP_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, filename);
};

export const exportSummaryToCSV = (summaryData: MachineRequirementSummary[]) => {
  const ws = XLSX.utils.json_to_sheet(
    summaryData.map((item) => ({
      Machine: item.machine,
      Required: item.required,
      Available: item.available,
      Gap: item.gap,
      Status: item.status,
      'Utilization %': item.utilization,
    }))
  );
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Sewing_MRP_Summary_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
