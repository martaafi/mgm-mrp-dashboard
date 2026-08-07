export type MachineCategory = "SEWING" | "NON_SEWING";

export interface ProductionPlan {
  line: string; // e.g. "G01", "G02", "G03"
  style: string; // e.g. "Men Running Hoodie", "Women Yoga Pant"
  date: string; // e.g. "2026-08-03" (YYYY-MM-DD)
  qty?: number; 
  week?: string; 
  day?: string; 
  kodeStyle?: string; 
  spo?: string;
  displayStyle?: string; // Used for UI display (from Planning Style column)
  
  // History Fields
  snapshotDate?: string;
  historyDisplayStyle?: string;
  historyStyle?: string;
  isDisplayStyleChanged?: boolean;
  isStyleChanged?: boolean;
}

export interface MachineRequirementPerStyle {
  style: string;
  jenisMesin: string;
  kebutuhanTotal: number;
  kebutuhanLayout: number;
  kebutuhanSpare: number;
}

export interface MachineAvailability {
  date?: string;
  jenisMesin: string; // e.g. "SN", "OL4", "DN", "Bartack"
  jumlahMesin: number; // Available quantity (Total)
  baseCount?: number; // Pringapus
  pinjamCount?: number; // Pinjam Internal
  sewaCount?: number; // Sewa
}

export type GapStatus = "Available" | "Balanced" | "Shortage";

export interface MachineRequirementSummary {
  machine: string;
  required: number;
  available: number;
  gap: number; // available - required
  status: GapStatus;
  utilization: number; // (required / available) * 100
  utilizationLevel: "low" | "medium" | "high"; // low <80%, medium 80-95%, high >95%
  linesCount: number; // Number of lines using this machine
  baseCount?: number;
  pinjamCount?: number;
  sewaCount?: number;
}

export interface LineMachineMatrixRow {
  line: string;
  style: string;
  kodeStyle: string;
  qty: number;
  date: string;
  machines: Record<string, number>; // e.g. { "SN": 8, "OL4": 2, "DN": 1 }
  totalMachines: number;
}

export interface FilterState {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface DrillDownLineDetail {
  line: string;
  style: string;
  required: number;
  date: string;
}

export interface DrillDownData {
  machine: string;
  totalRequired: number;
  totalAvailable: number;
  gap: number;
  status: GapStatus;
  utilization: number;
  lineDetails: DrillDownLineDetail[];
  recommendation: string;
}

export interface HeatmapCell {
  line: string;
  machine: string;
  required: number;
}
