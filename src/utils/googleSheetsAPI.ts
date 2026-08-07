// @ts-ignore
import Papa from "papaparse";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
} from "../types/mrp";

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
  // Col E(4): Snapshot_Date, Col F(5): Planning Style History, Col G(6): Style History, Col H(7): Perubahan Planning Style, Col I(8): Perubahan Style Mesin
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    let rawDate = row[0] || "";
    // Format date from DD/MM/YYYY or MM/DD/YYYY to YYYY-MM-DD
    if (rawDate && rawDate.includes("/")) {
      const parts = rawDate.split("/");
      if (parts.length === 3) {
        // Assuming DD/MM/YYYY based on previous logic
        const [day, month, year] = parts; 
        rawDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }

    const line = row[1] || "";
    const displayStyle = row[2] || "";
    const style = row[3] || "";

    // History columns
    const snapshotDate = row[4] || "";
    const historyDisplayStyle = row[5] || "";
    const historyStyle = row[6] || "";
    const isDisplayStyleChanged = (row[7] || "").toString().trim().toLowerCase() === "ya";
    const isStyleChanged = (row[8] || "").toString().trim().toLowerCase() === "ya";

    if (!line || !style) continue;

    plans.push({
      date: rawDate,
      line: line,
      style: style,
      displayStyle: displayStyle,
      snapshotDate: snapshotDate,
      historyDisplayStyle: historyDisplayStyle,
      historyStyle: historyStyle,
      isDisplayStyleChanged: isDisplayStyleChanged,
      isStyleChanged: isStyleChanged,
    });
  }
  return plans;
};

export const fetchMachineRequirements = async (): Promise<MachineRequirementPerStyle[]> => {
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

    if (!style || !jenisMesin) continue;

    requirements.push({
      style,
      jenisMesin,
      kebutuhanTotal,
      kebutuhanLayout,
      kebutuhanSpare
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

    let rawDate = row[0] || "";
    if (rawDate && rawDate.includes("/")) {
      const parts = rawDate.split("/");
      if (parts.length === 3) {
        const [month, day, year] = parts;
        rawDate = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }

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
  TIMESTAMP: "mrp_cache_timestamp",
};

export interface FetchMRPDataResult {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
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
      const cachedTime = localStorage.getItem(CACHE_KEYS.TIMESTAMP);

      if (cachedPlans && cachedReqs && cachedAvail && cachedTime) {
        let parsedAvail = JSON.parse(cachedAvail);
        
        // Ensure backward compatibility with cached data
        parsedAvail = parsedAvail.map((a: any) => ({
          ...a,
          baseCount: a.baseCount ?? a.jumlahMesin ?? 0,
          pinjamCount: a.pinjamCount ?? 0,
          sewaCount: a.sewaCount ?? 0,
          jumlahMesin: a.jumlahMesin ?? 0
        }));

        const parsedPlans = JSON.parse(cachedPlans);
        
        // Cek apakah struktur data plan memiliki kolom history baru (isStyleChanged)
        // Jika tidak ada (cache versi lama), maka abaikan cache dan paksa fetch baru
        if (parsedPlans.length > 0 && parsedPlans[0].isStyleChanged === undefined) {
          console.log("Old cache structure detected. Forcing fresh fetch...");
        } else {
          return {
            plans: parsedPlans,
            requirements: JSON.parse(cachedReqs),
            availabilities: parsedAvail,
            isCached: true,
            lastUpdated: cachedTime,
          };
        }
      }
    } catch (e) {
      console.warn("Failed to read from localStorage cache:", e);
    }
  }

  const [plans, requirements, availabilities] = await Promise.all([
    fetchPlans(),
    fetchMachineRequirements(),
    fetchAvailability(),
  ]);

  const now = new Date();
  const day = now.getDate().toString().padStart(2, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const year = now.getFullYear();
  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");
  const lastUpdated = `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;

  try {
    localStorage.setItem(CACHE_KEYS.PLANS, JSON.stringify(plans));
    localStorage.setItem(CACHE_KEYS.REQ, JSON.stringify(requirements));
    localStorage.setItem(
      CACHE_KEYS.AVAILABILITIES,
      JSON.stringify(availabilities),
    );
    localStorage.setItem(CACHE_KEYS.TIMESTAMP, lastUpdated);
  } catch (e) {
    console.warn("Failed to save to localStorage cache:", e);
  }

  return {
    plans,
    requirements,
    availabilities,
    isCached: false,
    lastUpdated,
  };
};
