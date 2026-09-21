// @ts-ignore
import Papa from "papaparse";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
  InventoryRecord,
  DowntimeRecord,
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

// --- Downtime Sheet Configuration ---
const DOWNTIME_SHEET_ID = "1M_xqeK6rD2qNoRdVrRcPQ55Ak8CS14oE4LRvatGXmZs";
const DOWNTIME_GID = "1487378230";
export const DOWNTIME_GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DOWNTIME_SHEET_ID}/edit?gid=${DOWNTIME_GID}#gid=${DOWNTIME_GID}`;
const DOWNTIME_APPS_SCRIPT_KEY = "mrp_downtime_apps_script_url";

// Historical Downtime Sheet (Januari - Juni)
const DOWNTIME_HISTORICAL_SHEET_ID = "1tceJ8-vGNhNNfQl0TA0PE1-keFzggut6XBIa_htzd7Q";
const DOWNTIME_HISTORICAL_GID = "1487378230";
export const DOWNTIME_HISTORICAL_GOOGLE_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DOWNTIME_HISTORICAL_SHEET_ID}/edit?gid=${DOWNTIME_HISTORICAL_GID}#gid=${DOWNTIME_HISTORICAL_GID}`;

// Google Apps Script code template for anti-filter downtime fetching
export const APPS_SCRIPT_CODE_TEMPLATE = `function doGet(e) {
  var ss = SpreadsheetApp.openById("${DOWNTIME_SHEET_ID}");
  var sheet = ss.getSheetByName("DOWNTIME LOG");
  var data = sheet.getDataRange().getValues();
  var headers = data[0];
  var result = [];
  // Start from row index 2 (skip header rows 0 and 1, keeping row 2 as first data row)
  // Adjust startRow based on your sheet structure
  for (var i = 2; i < data.length; i++) {
    var row = data[i];
    // Skip rows without a Line value
    if (!row[0] || row[0].toString().trim() === "") continue;
    result.push({
      line: row[0] || "",
      downtimeStartNum: row[1] || 0,
      prodMachType: row[2] || "",
      prodMach: row[3] || "",
      downtimeStopNum: row[4] || 0,
      downtimeStart: row[5] ? row[5].toString() : "",
      downtimeStop: row[6] ? row[6].toString() : "",
      jamKerja: row[7] || 0,
      downtimeTotal: row[8] || 0,
      nameDayStart: row[9] || "",
      nameDayStop: row[10] || "",
      sameDay: row[11] === true || row[11] === "TRUE",
      tanggal: row[12] ? Utilities.formatDate(new Date(row[12]), Session.getScriptTimeZone(), "dd/MM/yyyy") : "",
      week: row[13] ? row[13].toString() : "",
      errorMessage: row[34] || "",
      excessTime: row[44] || 0,
      downtimeAktual: row[45] || 0
    });
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}`;

export const getDowntimeAppsScriptUrl = (): string => {
  return localStorage.getItem(DOWNTIME_APPS_SCRIPT_KEY) || "";
};

export const setDowntimeAppsScriptUrl = (url: string): void => {
  if (url) {
    localStorage.setItem(DOWNTIME_APPS_SCRIPT_KEY, url);
  } else {
    localStorage.removeItem(DOWNTIME_APPS_SCRIPT_KEY);
  }
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

const parseDateStringForDowntime = (dateStr: string): string => {
  if (!dateStr) return "";
  // If DD/MM/YYYY or D/M/YYYY
  if (dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
  }
  // Try native parse
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}-${d.getDate().toString().padStart(2, "0")}`;
  }
  return dateStr;
};

export interface DowntimeFetchResult {
  records: DowntimeRecord[];
  source: "apps_script" | "gviz" | "cache";
}

// Helper: Fetch historical downtime data (Januari - Juni) via GViz CSV
export const fetchHistoricalDowntimeData = async (): Promise<DowntimeRecord[]> => {
  try {
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${DOWNTIME_HISTORICAL_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${DOWNTIME_HISTORICAL_GID}`;
    const response = await fetch(gvizUrl);
    if (!response.ok) {
      console.warn(`[Downtime Historical] Failed to fetch historical sheet: ${response.statusText}`);
      return [];
    }
    const csvText = await response.text();

    return new Promise((resolve) => {
      Papa.parse(csvText, {
        header: false,
        skipEmptyLines: true,
        complete: (results: any) => {
          const data = results.data as any[][];
          const records: DowntimeRecord[] = [];

          // Row 0 is header, data starts from row 1
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            const line = (row[0] || "").toString().trim();
            // Hanya ambil baris dengan kolom line yang berawalan 'G' (misal: G01, G02, dst)
            if (!line || !line.toUpperCase().startsWith("G")) continue;

            const downtimeAktual = parseFloat(row[45]) || 0;
            const prodMachType = (row[2] || "").toString().trim();
            const tanggalRaw = (row[12] || "").toString().trim();

            records.push({
              line,
              downtimeStartNum: parseFloat(row[1]) || 0,
              prodMachType,
              prodMach: (row[3] || "").toString().trim(),
              downtimeStopNum: parseFloat(row[4]) || 0,
              downtimeStart: (row[5] || "").toString().trim(),
              downtimeStop: (row[6] || "").toString().trim(),
              jamKerja: parseFloat(row[7]) || 0,
              downtimeTotal: parseFloat(row[8]) || 0,
              nameDayStart: (row[9] || "").toString().trim(),
              nameDayStop: (row[10] || "").toString().trim(),
              sameDay: (row[11] || "").toString().trim().toUpperCase() === "TRUE",
              tanggal: parseDateStringForDowntime(tanggalRaw),
              week: (row[13] || "").toString().trim(),
              errorMessage: (row[34] || "").toString().trim(),
              excessTime: parseFloat(row[44]) || 0,
              downtimeAktual,
            });
          }

          console.log(`[Downtime Historical] ✅ GViz fetch completed — ${records.length} records (line G*)`);
          resolve(records);
        },
        error: (error: any) => {
          console.warn("[Downtime Historical] Parse error:", error);
          resolve([]);
        },
      });
    });
  } catch (err) {
    console.warn("[Downtime Historical] Fetch error:", err);
    return [];
  }
};

export interface DowntimeAppsScriptRetryOptions {
  /** Total percobaan (1 awal + sisanya retry). Default: 4 */
  maxAttempts?: number;
  /** Delay awal backoff antar percobaan, digandakan tiap retry. Default: 2000ms */
  baseDelayMs?: number;
  /** Timeout percobaan pertama (cold start Apps Script bisa lambat). Default: 30000ms */
  firstAttemptTimeoutMs?: number;
  /** Timeout percobaan retry. Default: 20000ms */
  retryAttemptTimeoutMs?: number;
  /** Callback progres tiap percobaan (untuk banner UI) */
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  /** Signal pembatalan (tombol Batal) */
  signal?: AbortSignal;
}

const DEFAULT_DOWNTIME_RETRY = {
  maxAttempts: 4,
  baseDelayMs: 2000,
  firstAttemptTimeoutMs: 30000,
  retryAttemptTimeoutMs: 20000,
};

const sleepWithAbort = (ms: number, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
};

type AppsScriptFetchOutcome =
  | { ok: true; data: any[] }
  // "config": 401/403/404 (fail-fast, retry tidak akan membantu)
  // "exhausted": retry habis masih gagal
  | { ok: false; reason: "config" | "exhausted" };

const fetchAppsScriptJsonWithRetry = async (
  url: string,
  opts: DowntimeAppsScriptRetryOptions = {},
): Promise<AppsScriptFetchOutcome> => {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? DEFAULT_DOWNTIME_RETRY.maxAttempts);
  const baseDelayMs = opts.baseDelayMs ?? DEFAULT_DOWNTIME_RETRY.baseDelayMs;
  const firstTimeout = opts.firstAttemptTimeoutMs ?? DEFAULT_DOWNTIME_RETRY.firstAttemptTimeoutMs;
  const retryTimeout = opts.retryAttemptTimeoutMs ?? DEFAULT_DOWNTIME_RETRY.retryAttemptTimeoutMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (opts.signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    opts.onAttempt?.(attempt, maxAttempts);
    const timeoutMs = attempt === 1 ? firstTimeout : retryTimeout;
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", forwardAbort, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      console.log(`[Downtime] Apps Script attempt ${attempt}/${maxAttempts} (timeout ${timeoutMs}ms)...`);
      const response = await fetch(url, { signal: controller.signal });
      if (response.ok) {
        const jsonData: any[] = await response.json();
        console.log(`[Downtime] ✅ Apps Script fetch SUCCESS on attempt ${attempt} — ${jsonData.length} raw rows received`);
        return { ok: true, data: jsonData };
      }
      if (response.status === 401 || response.status === 403 || response.status === 404) {
        console.warn(`[Downtime] ❌ Apps Script HTTP ${response.status} — config issue, fail fast to GViz (no retry).`);
        return { ok: false, reason: "config" };
      }
      console.warn(`[Downtime] ⚠️ Apps Script HTTP ${response.status} on attempt ${attempt}/${maxAttempts}.`);
    } catch (e: any) {
      if (e?.name === "AbortError" && opts.signal?.aborted) {
        throw e; // user cancel — jangan fallback diam-diam
      }
      if (e?.name === "AbortError" && timedOut) {
        console.warn(`[Downtime] ⏱️ Apps Script attempt ${attempt}/${maxAttempts} timed out after ${timeoutMs}ms.`);
      } else {
        console.warn(`[Downtime] ⚠️ Apps Script attempt ${attempt}/${maxAttempts} network error:`, e);
      }
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", forwardAbort);
    }
    if (attempt < maxAttempts) {
      const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.log(`[Downtime] Retrying in ${Math.round(delay)}ms...`);
      await sleepWithAbort(delay, opts.signal);
    }
  }
  console.warn(`[Downtime] ❌ Apps Script failed after ${maxAttempts} attempts, falling back to GViz.`);
  return { ok: false, reason: "exhausted" };
};

const fetchCurrentDowntimeData = async (
  retryOpts: DowntimeAppsScriptRetryOptions = {},
): Promise<DowntimeFetchResult> => {
  // Mode 1: Try Google Apps Script Web App URL if configured (anti-filter)
  // Bounded auto-retry: percobaan ulang otomatis maks maxAttempts kali,
  // lalu menyerah dan fallback ke GViz. Fail-fast (tanpa retry) untuk
  // error konfigurasi deployment (401/403/404).
  const appsScriptUrl = getDowntimeAppsScriptUrl();
  if (appsScriptUrl) {
    console.log("[Downtime] Apps Script URL configured, attempting fetch...", appsScriptUrl);
    const outcome = await fetchAppsScriptJsonWithRetry(appsScriptUrl, retryOpts);
    if (outcome.ok) {
      const jsonData = outcome.data;
      console.log(`[Downtime] ✅ ${jsonData.length} raw rows received via Apps Script`);
      const records = jsonData
          .filter((row: any) => row.line && row.line.toString().trim() !== "")
          .map((row: any) => ({
            line: (row.line || "").toString().trim(),
            downtimeStartNum: parseFloat(row.downtimeStartNum) || 0,
            prodMachType: (row.prodMachType || "").toString().trim(),
            prodMach: (row.prodMach || "").toString().trim(),
            downtimeStopNum: parseFloat(row.downtimeStopNum) || 0,
            downtimeStart: (row.downtimeStart || "").toString().trim(),
            downtimeStop: (row.downtimeStop || "").toString().trim(),
            jamKerja: parseFloat(row.jamKerja) || 0,
            downtimeTotal: parseFloat(row.downtimeTotal) || 0,
            nameDayStart: (row.nameDayStart || "").toString().trim(),
            nameDayStop: (row.nameDayStop || "").toString().trim(),
            sameDay: row.sameDay === true || row.sameDay === "TRUE" || row.sameDay === "true",
            tanggal: parseDateStringForDowntime((row.tanggal || "").toString().trim()),
            week: (row.week || "").toString().trim(),
            errorMessage: (row.errorMessage || "").toString().trim(),
            excessTime: parseFloat(row.excessTime) || 0,
            downtimeAktual: parseFloat(row.downtimeAktual) || 0,
          }));
        console.log(`[Downtime] ✅ ${records.length} valid records after filtering`);
        return { records, source: "apps_script" };
      }
      // outcome.reason === "config" (401/403/404) atau "exhausted" (retry habis):
      // fallback ke GViz. Abort (user cancel) dilempar sebagai error oleh helper.
    } else {
      console.log("[Downtime] No Apps Script URL configured, using GViz.");
    }

  // Mode 2: Fallback to GViz CSV
  console.log("[Downtime] Fetching current sheet via GViz...");
  const gvizUrl = `https://docs.google.com/spreadsheets/d/${DOWNTIME_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${DOWNTIME_GID}`;
  const response = await fetch(gvizUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch downtime sheet: ${response.statusText}`);
  }
  const csvText = await response.text();

  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: false,
      skipEmptyLines: true,
      complete: (results: any) => {
        const data = results.data as any[][];
        const records: DowntimeRecord[] = [];

        // Row 0 is header, data starts from row 1
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row) continue;

          const line = (row[0] || "").toString().trim();
          // Skip rows without a line (empty template rows)
          if (!line) continue;

          const downtimeAktual = parseFloat(row[45]) || 0;
          const prodMachType = (row[2] || "").toString().trim();
          const tanggalRaw = (row[12] || "").toString().trim();

          records.push({
            line,
            downtimeStartNum: parseFloat(row[1]) || 0,
            prodMachType,
            prodMach: (row[3] || "").toString().trim(),
            downtimeStopNum: parseFloat(row[4]) || 0,
            downtimeStart: (row[5] || "").toString().trim(),
            downtimeStop: (row[6] || "").toString().trim(),
            jamKerja: parseFloat(row[7]) || 0,
            downtimeTotal: parseFloat(row[8]) || 0,
            nameDayStart: (row[9] || "").toString().trim(),
            nameDayStop: (row[10] || "").toString().trim(),
            sameDay: (row[11] || "").toString().trim().toUpperCase() === "TRUE",
            tanggal: parseDateStringForDowntime(tanggalRaw),
            week: (row[13] || "").toString().trim(),
            errorMessage: (row[34] || "").toString().trim(),
            excessTime: parseFloat(row[44]) || 0,
            downtimeAktual,
          });
        }

        console.log(`[Downtime] Current GViz fetch completed — ${records.length} records`);
        resolve({ records, source: "gviz" });
      },
      error: (error: any) => reject(error),
    });
  });
};

export const fetchDowntimeData = async (
  retryOpts: DowntimeAppsScriptRetryOptions = {},
): Promise<DowntimeFetchResult> => {
  const [currentResult, historicalRecords] = await Promise.all([
    fetchCurrentDowntimeData(retryOpts),
    fetchHistoricalDowntimeData(),
  ]);

  const allRecords = [...currentResult.records, ...historicalRecords];

  // Sort descending by date so most recent appears first
  allRecords.sort((a, b) => {
    if (!a.tanggal) return 1;
    if (!b.tanggal) return -1;
    return b.tanggal.localeCompare(a.tanggal);
  });

  console.log(
    `[Downtime] Total combined records: ${currentResult.records.length} (current) + ${historicalRecords.length} (Jan-Jun G*) = ${allRecords.length}`
  );

  return {
    records: allRecords,
    source: currentResult.source,
  };
};

export const CACHE_KEYS = {
  PLANS: "mrp_cache_plans",
  REQ: "mrp_cache_machine_reqs",
  AVAILABILITIES: "mrp_cache_availabilities",
  SNAPSHOTS: "mrp_cache_snapshots",
  RENTAL_TRIAL: "mrp_cache_rental_trial",
  INVENTORY: "mrp_cache_inventory",
  DOWNTIME: "mrp_cache_downtime_v2",
  DOWNTIME_SOURCE: "mrp_cache_downtime_source",
  TIMESTAMP: "mrp_cache_timestamp_v2",
};

export interface FetchMRPDataResult {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  snapshots: SnapshotRecord[];
  rentalTrialRecords: RentalTrialRecord[];
  inventoryRecords: InventoryRecord[];
  downtimeRecords: DowntimeRecord[];
  downtimeSource: "apps_script" | "gviz" | "cache";
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
      const cachedDowntime = localStorage.getItem(CACHE_KEYS.DOWNTIME);
      const cachedDowntimeSource = (localStorage.getItem(CACHE_KEYS.DOWNTIME_SOURCE) as "apps_script" | "gviz") || "gviz";
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
          downtimeRecords: cachedDowntime ? JSON.parse(cachedDowntime) : [],
          downtimeSource: cachedDowntimeSource,
          isCached: true,
          lastUpdated: cachedTime,
        };
      }
    } catch (e) {
      console.warn("Failed to read from localStorage cache:", e);
    }
  }

  const [plans, requirements, availabilities, snapshots, rentalTrialRecords, inventoryRecords, downtimeResult] = await Promise.all([
    fetchPlans(),
    fetchMachineRequirements(),
    fetchAvailability(),
    fetchSnapshots(),
    fetchRentalTrialData(),
    fetchInventoryData(),
    fetchDowntimeData(),
  ]);

  const downtimeRecords = downtimeResult.records;
  const downtimeSource = downtimeResult.source;
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
    localStorage.setItem(CACHE_KEYS.DOWNTIME, JSON.stringify(downtimeRecords));
    localStorage.setItem(CACHE_KEYS.DOWNTIME_SOURCE, downtimeSource);
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
    downtimeRecords,
    downtimeSource,
    isCached: false,
    lastUpdated,
  };
};
