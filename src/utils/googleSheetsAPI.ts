// @ts-ignore
import Papa from "papaparse";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
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

    if (!style || !jenisMesin) continue;

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

    const jenisMesin = row[1] || "";
    const jumlahMesin = parseFloat(row[2]) || 0;

    if (!jenisMesin) continue;

    // Read Pinjam and Sewa from Col D (3) and Col E (4) if they exist
    const pinjamCount = parseFloat(row[3]) || 0;
    const sewaCount = parseFloat(row[4]) || 0;
    const totalCount = jumlahMesin + pinjamCount + sewaCount;

    availabilities.push({
      date: rawDate,
      jenisMesin: jenisMesin,
      jumlahMesin: totalCount,
      baseCount: jumlahMesin,
      pinjamCount: pinjamCount,
      sewaCount: sewaCount,
    });
  }

  return availabilities;
};

const CACHE_KEYS = {
  PLANS: "mrp_cache_plans",
  REQ: "mrp_cache_machine_reqs",
  AVAILABILITIES: "mrp_cache_availabilities",
  SNAPSHOTS: "mrp_cache_snapshots",
  TIMESTAMP: "mrp_cache_timestamp",
};

export interface FetchMRPDataResult {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  snapshots: SnapshotRecord[];
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
      const cachedTime = localStorage.getItem(CACHE_KEYS.TIMESTAMP);

      if (cachedPlans && cachedReqs && cachedAvail && cachedSnapshots && cachedTime) {
        let parsedAvail = JSON.parse(cachedAvail);

        // Ensure backward compatibility with cached data
        parsedAvail = parsedAvail.map((a: any) => ({
          ...a,
          baseCount: a.baseCount ?? a.jumlahMesin ?? 0,
          pinjamCount: a.pinjamCount ?? 0,
          sewaCount: a.sewaCount ?? 0,
          jumlahMesin: a.jumlahMesin ?? 0,
        }));

        return {
          plans: JSON.parse(cachedPlans),
          requirements: JSON.parse(cachedReqs),
          availabilities: parsedAvail,
          snapshots: JSON.parse(cachedSnapshots),
          isCached: true,
          lastUpdated: cachedTime,
        };
      }
    } catch (e) {
      console.warn("Failed to read from localStorage cache:", e);
    }
  }

  const [plans, requirements, availabilities, snapshots] = await Promise.all([
    fetchPlans(),
    fetchMachineRequirements(),
    fetchAvailability(),
    fetchSnapshots(),
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
    localStorage.setItem(CACHE_KEYS.TIMESTAMP, lastUpdated);
  } catch (e) {
    console.warn("Failed to save to localStorage cache:", e);
  }

  return {
    plans,
    requirements,
    availabilities,
    snapshots,
    isCached: false,
    lastUpdated,
  };
};
