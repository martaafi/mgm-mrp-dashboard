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

export interface AvailabilityVariation {
  startDate: string;
  endDate: string;
  jumlahMesin: number;
  expiredRecords?: {
    type: "sewa" | "trial";
    count: number;
    date: string;
  }[];
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
  trialCount?: number; // Trial
  maxJumlahMesin?: number; // Maximum available quantity across a date range
  variationDetails?: AvailabilityVariation[];
}

export type GapStatus = "Available" | "Balanced" | "Shortage";

export interface MachineRequirementSummary {
  machine: string;
  required: number;
  available: number;
  maxAvailable?: number; // Maximum available if there is variation in a range
  variationDetails?: AvailabilityVariation[];
  gap: number; // available - required
  status: GapStatus;
  utilization: number; // (required / available) * 100
  utilizationLevel: "low" | "medium" | "high"; // low <80%, medium 80-95%, high >95%
  linesCount: number; // Number of lines using this machine
  baseCount?: number;
  pinjamCount?: number;
  sewaCount?: number;
  trialCount?: number;
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

// Data from the "Mesin Sewa & Trial" sheet — individual rental/trial machine records
export interface RentalTrialRecord {
  helperJenis: string;     // Col A: Helper Jenis (machine type code for matching, e.g. "SN", "BARTACK")
  no: number;              // Col B: NO
  jenis: string;           // Col C: JENIS (internal code, e.g. "SN/M", "BTC/M")
  entryDate: string;       // Col D: ENTRY DATE (YYYY-MM-DD) — start of rental/trial
  tglSelesai: string;      // Col E: TGL SELESAI (YYYY-MM-DD) — end of rental/trial, empty = still active
  brand: string;           // Col H: BRAND
  namaMesin: string;       // Col I: NAMA MESIN
  tipeMesin: string;       // Col J: TIPE MESIN
  serialNumber: string;    // Col K: SERIAL NUMBER
  invoice: string;         // Col G: INVOICE/SJ
  remark: string;          // Col L: REMARK ("MESIN TRIAL" / "MESIN SEWA")
  inventory1: string;      // Col M: INVENTORY 1
  inventory2: string;      // Col N: INVENTORY 2
}

// Alert for machines whose rental/trial is expiring soon
export interface RentalTrialAlert {
  record: RentalTrialRecord;
  daysRemaining: number;   // Days until expiry (0 = today, negative = already expired)
  severity: "critical" | "warning" | "info"; // critical ≤3 days, warning 4-7 days, info = expired
}

// Data from the "Inventory" sheet — full machine inventory
export interface InventoryRecord {
  helperJenis: string;    // Col A: Helper Jenis (e.g. "OL5", "SN", "OVD2")
  jenis: string;          // Col B: JENIS (e.g. "OB5/M", "SN/M")
  entryDatePA: string;    // Col C: ENTRY DATE PA (YYYY-MM-DD)
  invoice: string;        // Col D: INVOICE
  brand: string;          // Col E: BRAND
  namaMesin: string;      // Col F: NAMA MESIN
  tipeMesin: string;      // Col G: TIPE MESIN
  serialNumber: string;   // Col H: SERIAL NUMBER
  remark: string;         // Col I: REMARK
  inventory1: string;     // Col J: INVENTORY 1
  inventory2: string;     // Col K: INVENTORY 2
  alokasi: string;        // Col L: ALOKASI
  umur: string;           // Col M: UMUR (format: "X thn Y bln")
  umurBulan: number;      // Parsed total months from UMUR column
}

// Data from the "DOWNTIME LOG" sheet — machine downtime records
export interface DowntimeRecord {
  line: string;              // Col A: Line (e.g. "A01", "A02")
  downtimeStartNum: number;  // Col B: # Downtime Start (serial number)
  prodMachType: string;      // Col C: Prod Mach Type (e.g. "SN", "WF", "DN") — tipe mesin jahit
  prodMach: string;          // Col D: Prod Mach (e.g. "JUKI", "MITSUBISHI") — merk mesin
  downtimeStopNum: number;   // Col E: # Downtime Stop (serial number)
  downtimeStart: string;     // Col F: Downtime Start (datetime string)
  downtimeStop: string;      // Col G: Downtime Stop (datetime string)
  jamKerja: number;          // Col H: Jam Kerja (total work hours for the line that day)
  downtimeTotal: number;     // Col I: Downtime Total (minutes, raw calculation)
  nameDayStart: string;      // Col J: Name Day Start (e.g. "Thursday")
  nameDayStop: string;       // Col K: Name Day Stop
  sameDay: boolean;          // Col L: Same Day?
  tanggal: string;           // Col M: Tanggal (date YYYY-MM-DD)
  week: string;              // Col N: Week
  errorMessage: string;      // Col AI: Error Message
  excessTime: number;        // Col AS: Excess Time
  downtimeAktual: number;    // Col AT: Downtime Aktual (minutes) — KOLOM UTAMA YANG DIGUNAKAN
}
