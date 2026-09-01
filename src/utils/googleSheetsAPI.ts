// @ts-ignore
import Papa from "papaparse";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
  InventoryRecord,
} from "../types/mrp";
import { format } from "date-fns";

const parseDateString = (dateStr: string): string => {
  if (!dateStr) return "";

  // If it's DD/MM/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }

  // Try JS native parse (handles 7-Aug-2026, 7 Aug 2026, etc)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return dateStr;
};

const SHEET_ID = "1KgVosx10jSkGAbPx8CFxWV3koQOb_BuAaaBBDO4wuZU";
export const GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit?usp=sharing`;
const BASE_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=`;

const fetchCSVArray = async (sheetName: string): Promise<any[][]> => {
  const url = `${BASE_URL}${encodeURIComponent(sheetName)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch sheet ${sheetName}: ${response.statusText}`,
    );
  }
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results: any) => resolve(results.data as any[][]),
      error: (error: any) => reject(error),
    });
  });
};

export const fetchPlans = async (): Promise<ProductionPlan[]> => {
  const data = await fetchCSVArray("Plan Dashboard");
  const plans: ProductionPlan[] = [];

  // Col A(0): Date, Col B(1): Line, Col C(2): Planning Style PPIC, Col D(3): Style (perhitungan kebutuhan mesin)
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const rawDate = parseDateString(row[0] || "");
    const line = row[1] || "";
    const displayStyle = row[2] || "";
    const style = row[3] || "";

    if (!line || !style) continue;

    plans.push({
      date: rawDate,
      line: line,
      style: style,
      displayStyle: displayStyle,
    });
  }
  return plans;
};

export const fetchSnapshots = async (): Promise<SnapshotRecord[]> => {
  const data = await fetchCSVArray("Snapshot");
  const snapshots: SnapshotRecord[] = [];

  // Col A(0): Planning Date, Col B(1): Line,
  // Col C(2): Last Snapshot Date, Col D(3): Last Version,
  // Col E(4): Last Planning Style, Col F(5): Last Planning Machine Style,
  // Col G(6): Update Snapshot Date, Col H(7): Update Version,
  // Col I(8): Update Planning Style, Col J(9): Update Planning Machine Style,
  // Col K(10): Perubahan Planning Style, Col L(11): Perubahan Style Perhitungan Mesin
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 12) continue;

    const planningDate = parseDateString(row[0] || "");
    const line = row[1] || "";

    if (!line || !planningDate) continue;

    snapshots.push({
      planningDate,
      line,
      lastSnapshotDate: parseDateString(row[2] || ""),
      lastVersion: row[3] || "",
      lastPlanningStyle: row[4] || "",
      lastMachineStyle: row[5] || "",
      updateSnapshotDate: parseDateString(row[6] || ""),
      updateVersion: row[7] || "",
      updatePlanningStyle: row[8] || "",
      updateMachineStyle: row[9] || "",
      isPlanningStyleChanged:
        (row[10] || "").toString().trim().toLowerCase() === "ya",
      isMachineStyleChanged:
        (row[11] || "").toString().trim().toLowerCase() === "ya",
    });
  }
  return snapshots;
};

export const fetchMachineRequirements = async (): Promise<
  MachineRequirementPerStyle[]
> => {
  const data = await fetchCSVArray("Database mesin per style");
  const requirements: MachineRequirementPerStyle[] = [];

  // Assuming row 0 is header.
  // Col A(0): Style, Col B(1): Jenis Mesin, Col D(3): Total Kebutuhan, Col E(4): Layout, Col F(5): Spare
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const style = row[0] || "";
    const jenisMesin = row[1] || "";
    const kebutuhanTotal = parseFloat(row[3]) || 0;
    const kebutuhanLayout = parseFloat(row[4] || "0") || 0;
    const kebutuhanSpare = parseFloat(row[5] || "0") || 0;
    const kebutuhanAccessories = parseFloat(row[6] || "0") || 0;

    if (!style || !jenisMesin || jenisMesin.toLowerCase() === "total") continue;

    requirements.push({
      style,
      jenisMesin,
      kebutuhanTotal,
      kebutuhanLayout,
      kebutuhanSpare,
      kebutuhanAccessories,
    });
  }

  return requirements;
};

export const fetchAvailability = async (): Promise<MachineAvailability[]> => {
  const data = await fetchCSVArray("Data Ketersediaan Mesin");
  const availabilities: MachineAvailability[] = [];

  // Assuming row 0 is header.
  // Col A(0): Tanggal, Col B(1): Jenis Mesin, Col C(2): Total Tersedia
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    let rawDate = parseDateString(row[0] || "");

    const jenisMesin = row[3] || "";
    const jumlahMesin = parseFloat(row[4]) || 0;

    if (!jenisMesin || jenisMesin.toLowerCase() === "total") continue;

    // Read Pinjam and Sewa from Col D (3) and Col E (4) if they exist
    const pinjamCount = parseFloat(row[5]) || 0;
    const sewaCount = parseFloat(row[6]) || 0;
    const trialCount = parseFloat(row[7]) || 0;
    const totalCount = jumlahMesin + pinjamCount + sewaCount + trialCount;

    availabilities.push({
      date: rawDate,
      jenisMesin: jenisMesin,
      jumlahMesin: totalCount,
      baseCount: jumlahMesin,
      pinjamCount: pinjamCount,
      sewaCount: sewaCount,
      trialCount: trialCount,
    });
  }

  return availabilities;
};

export const fetchRentalTrialData = async (): Promise<RentalTrialRecord[]> => {
  const data = await fetchCSVArray("Mesin Sewa & Trial");
  const records: RentalTrialRecord[] = [];

  // Row 0 is header.
  // Col A(0): Helper Jenis, Col B(1): NO, Col C(2): JENIS,
  // Col D(3): ENTRY DATE, Col E(4): TGL SELESAI, Col F(5): TGL KELUAR,
  // Col G(6): INVOICE/SJ, Col H(7): BRAND, Col I(8): NAMA MESIN,
  // Col J(9): TIPE MESIN, Col K(10): SERIAL NUMBER, Col L(11): REMARK
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    const helperJenis = (row[0] || "").toString().trim();
    if (!helperJenis) continue;

    const no = parseInt(row[1]) || 0;
    const jenis = (row[2] || "").toString().trim();
    const entryDate = parseDateString(row[3] || "");
    const tglSelesai = parseDateString(row[4] || "");
    const invoice = (row[6] || "").toString().trim();
    const brand = (row[7] || "").toString().trim();
    const namaMesin = (row[8] || "").toString().trim();
    const tipeMesin = (row[9] || "").toString().trim();
    const serialNumber = (row[10] || "").toString().trim();
    const remark = (row[11] || "").toString().trim();
    const inventory1 = (row[12] || "").toString().trim();
    const inventory2 = (row[13] || "").toString().trim();

    records.push({
      helperJenis,
      no,
      jenis,
      entryDate,
      tglSelesai,
      invoice,
      brand,
      namaMesin,
      tipeMesin,
      serialNumber,
      inventory1,
      inventory2,
      remark,
    });
  }

  return records;
};

/**
 * Parse UMUR string like "0 thn 9 bln" or "2 thn 3 bln" into total months.
 */
const parseUmur = (umurStr: string): number => {
  if (!umurStr) return 0;
  let totalMonths = 0;
  const thnMatch = umurStr.match(/(\d+)\s*thn/i);
  const blnMatch = umurStr.match(/(\d+)\s*bln/i);
  if (thnMatch) totalMonths += parseInt(thnMatch[1]) * 12;
  if (blnMatch) totalMonths += parseInt(blnMatch[1]);
  return totalMonths;
};

export const fetchInventoryData = async (): Promise<InventoryRecord[]> => {
  const data = await fetchCSVArray("Inventory");
  const records: InventoryRecord[] = [];

  // Row 0 is header.
  // Col A(0): Helper Jenis, Col B(1): JENIS, Col C(2): ENTRY DATE PA,
  // Col D(3): INVOICE, Col E(4): BRAND, Col F(5): NAMA MESIN,
  // Col G(6): TIPE MESIN, Col H(7): SERIAL NUMBER, Col I(8): REMARK,
  // Col J(9): INVENTORY 1, Col K(10): INVENTORY 2, Col L(11): ALOKASI, Col M(12): UMUR
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    const helperJenis = (row[0] || "").toString().trim();
    if (!helperJenis) continue;

    const umurRaw = (row[12] || "").toString().trim();

    records.push({
      helperJenis,
      jenis: (row[1] || "").toString().trim(),
      entryDatePA: parseDateString(row[2] || ""),
      invoice: (row[3] || "").toString().trim(),
      brand: (row[4] || "").toString().trim(),
      namaMesin: (row[5] || "").toString().trim(),
      tipeMesin: (row[6] || "").toString().trim(),
      serialNumber: (row[7] || "").toString().trim(),
      remark: (row[8] || "").toString().trim(),
      inventory1: (row[9] || "").toString().trim(),
      inventory2: (row[10] || "").toString().trim(),
      alokasi: (row[11] || "").toString().trim(),
      umur: umurRaw,
      umurBulan: parseUmur(umurRaw),
    });
  }

  return records;
};

const CACHE_KEYS = {
  PLANS: "mrp_cache_plans",
  REQ: "mrp_cache_machine_reqs",
  AVAILABILITIES: "mrp_cache_availabilities",
  SNAPSHOTS: "mrp_cache_snapshots",
  RENTAL_TRIAL: "mrp_cache_rental_trial",
  INVENTORY: "mrp_cache_inventory",
  TIMESTAMP: "mrp_cache_timestamp",
};

export interface FetchMRPDataResult {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  snapshots: SnapshotRecord[];
  rentalTrialRecords: RentalTrialRecord[];
  inventoryRecords: InventoryRecord[];
  isCached: boolean;
  lastUpdated: string;
}

export const fetchAllMRPData = async (
  forceRefresh = false,
): Promise<FetchMRPDataResult> => {
  if (!forceRefresh) {
    try {
      const cachedPlans = localStorage.getItem(CACHE_KEYS.PLANS);
      const cachedReqs = localStorage.getItem(CACHE_KEYS.REQ);
      const cachedAvail = localStorage.getItem(CACHE_KEYS.AVAILABILITIES);
      const cachedSnapshots = localStorage.getItem(CACHE_KEYS.SNAPSHOTS);
      const cachedRentalTrial = localStorage.getItem(CACHE_KEYS.RENTAL_TRIAL);
      const cachedInventory = localStorage.getItem(CACHE_KEYS.INVENTORY);
      const cachedTime = localStorage.getItem(CACHE_KEYS.TIMESTAMP);

      if (
        cachedPlans &&
        cachedReqs &&
        cachedAvail &&
        cachedSnapshots &&
        cachedRentalTrial &&
        cachedInventory &&
        cachedTime
      ) {
        let parsedAvail = JSON.parse(cachedAvail);

        // Ensure backward compatibility with cached data
        parsedAvail = parsedAvail.map((a: any) => ({
          ...a,
          baseCount: a.baseCount ?? a.jumlahMesin ?? 0,
          pinjamCount: a.pinjamCount ?? 0,
          sewaCount: a.sewaCount ?? 0,
          trialCount: a.trialCount ?? 0,
          jumlahMesin: a.jumlahMesin ?? 0,
        }));

        return {
          plans: JSON.parse(cachedPlans),
          requirements: JSON.parse(cachedReqs),
          availabilities: parsedAvail,
          snapshots: JSON.parse(cachedSnapshots),
          rentalTrialRecords: JSON.parse(cachedRentalTrial),
          inventoryRecords: JSON.parse(cachedInventory),
          isCached: true,
          lastUpdated: cachedTime,
        };
      }
    } catch (e) {
      console.warn("Failed to read from localStorage cache:", e);
    }
  }

  const [plans, requirements, availabilities, snapshots, rentalTrialRecords, inventoryRecords] = await Promise.all([
    fetchPlans(),
    fetchMachineRequirements(),
    fetchAvailability(),
    fetchSnapshots(),
    fetchRentalTrialData(),
    fetchInventoryData(),
  ]);

  const lastUpdated = format(new Date(), "dd MMM yyyy HH:mm:ss");

  try {
    localStorage.setItem(CACHE_KEYS.PLANS, JSON.stringify(plans));
    localStorage.setItem(CACHE_KEYS.REQ, JSON.stringify(requirements));
    localStorage.setItem(
      CACHE_KEYS.AVAILABILITIES,
      JSON.stringify(availabilities),
    );
    localStorage.setItem(CACHE_KEYS.SNAPSHOTS, JSON.stringify(snapshots));
    localStorage.setItem(CACHE_KEYS.RENTAL_TRIAL, JSON.stringify(rentalTrialRecords));
    localStorage.setItem(CACHE_KEYS.INVENTORY, JSON.stringify(inventoryRecords));
    localStorage.setItem(CACHE_KEYS.TIMESTAMP, lastUpdated);
  } catch (e) {
    console.warn("Failed to save to localStorage cache:", e);
  }

  return {
    plans,
    requirements,
    availabilities,
    snapshots,
    rentalTrialRecords,
    inventoryRecords,
    isCached: false,
    lastUpdated,
  };
};
