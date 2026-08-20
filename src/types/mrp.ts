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
}

// Data from the "Snapshot" sheet — weekly snapshot comparison
export interface SnapshotRecord {
  planningDate: string;       // Col A: Planning Date
  line: string;               // Col B: Line (e.g. "G01")
  lastSnapshotDate: string;   // Col C: Last Snapshot Date
  lastVersion: string;        // Col D: Last Version (e.g. "W33-2026")
  lastPlanningStyle: string;  // Col E: Last Planning Style
  lastMachineStyle: string;   // Col F: Last Planning Machine Style
  updateSnapshotDate: string; // Col G: Update Snapshot Date
  updateVersion: string;      // Col H: Update Version
  updatePlanningStyle: string;// Col I: Update Planning Style
  updateMachineStyle: string; // Col J: Update Planning Machine Style
  isPlanningStyleChanged: boolean; // Col K: Perubahan Planning Style ("Ya"/"Tidak")
  isMachineStyleChanged: boolean;  // Col L: Perubahan Style Perhitungan Mesin ("Ya"/"Tidak")
}

export interface MachineRequirementPerStyle {
  style: string;
  jenisMesin: string;
  kebutuhanTotal: number;
  kebutuhanLayout: number;
  kebutuhanSpare: number;
  kebutuhanAccessories: number;
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

export interface TrendDataPoint {
  date: string; // YYYY-MM-DD
  gap: number;
  totalRequired: number;
  totalAvailable: number;
  // Dynamic keys for specific machines (e.g. "SN": -2, "OL4": 5)
  [machineKey: string]: number | string;
}

export interface ShortageStyleData {
  styleName: string;
  displayStyle: string;
  shortageCount: number;
  machinesShort: {
    machine: string;
    gap: number; // Will be negative
    date: string;
  }[];
}

export interface ShortageMachineData {
  machine: string;
  shortageCount: number; // How many times it was in shortage
  totalShortageVolume: number; // Sum of the gaps (absolute value or negative)
  maxShortageVolume: number; // Maximum concurrent shortage
  avgShortageVolume: number; // Average shortage per day when short
  dates: string[];
}
