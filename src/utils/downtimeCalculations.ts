import { DowntimeRecord } from "../types/mrp";

// --- Filter Types ---
export interface DowntimeFilterState {
  startDate: string;
  endDate: string;
  line: string;
  machineType: string;
  brand: string;
}

// --- Aggregated Types ---
export interface DowntimeByMachineType {
  machineType: string;
  totalMinutes: number;
  totalHours: number;
  frequency: number;
  avgDurationMinutes: number; // MTTR
  percentage: number; // contribution %
}

export interface DowntimeByBrand {
  brand: string;
  totalMinutes: number;
  totalHours: number;
  frequency: number;
  avgDurationMinutes: number;
  percentage: number;
}

export interface DowntimeByLine {
  line: string;
  totalMinutes: number;
  totalHours: number;
  frequency: number;
  avgDurationMinutes: number;
  percentage: number;
}

export interface DowntimeTrendPoint {
  date: string;
  totalMinutes: number;
  totalHours: number;
  frequency: number;
}

export interface DowntimeWeeklyTrendPoint {
  weekKey: string; // e.g. "2025-W06" (ISO week, unik & terurut)
  weekLabel: string; // e.g. "W6" (tampil di sumbu X)
  year: number; // ISO week-numbering year
  week: number; // nomor week ISO 1-53
  weekStart: string; // YYYY-MM-DD (Senin)
  weekEnd: string; // YYYY-MM-DD (Minggu)
  totalMinutes: number;
  totalHours: number;
  frequency: number;
}

export interface DowntimeErrorSummary {
  errorMessage: string;
  frequency: number;
  totalMinutes: number;
}

export interface DowntimeKPIs {
  totalDowntimeMinutes: number;
  totalDowntimeHours: number;
  totalIncidents: number;
  avgDurationMinutes: number; // MTTR
  topMachineType: string;
  topMachineTypeMinutes: number;
  topLine: string;
  topLineMinutes: number;
  totalRecords: number;
}

// --- Filter Function ---

// Prefix line yang diizinkan tampil di dashboard downtime.
// Terpusat di sini supaya berlaku untuk semua sumber data
// (Apps Script, GViz current, GViz historical, cache).
export const DOWNTIME_ALLOWED_LINE_PREFIX = "G";

export const filterDowntimeRecords = (
  records: DowntimeRecord[],
  filters: DowntimeFilterState,
): DowntimeRecord[] => {
  return records.filter((r) => {
    // Hanya tampilkan line dengan awalan yang diizinkan (misal: G01, G02, ...)
    const line = (r.line || "").trim().toUpperCase();
    if (!line || !line.startsWith(DOWNTIME_ALLOWED_LINE_PREFIX)) {
      return false;
    }

    // Abaikan data jika tipe mesin kosong atau "unknown"
    const machType = (r.prodMachType || "").trim().toLowerCase();
    if (!machType || machType === "unknown" || machType === "-") {
      return false;
    }

    // Abaikan data dengan downtime aktual 0 (tidak ada downtime nyata)
    if (!r.downtimeAktual || r.downtimeAktual <= 0) {
      return false;
    }

    // Date range filter
    if (filters.startDate && r.tanggal && r.tanggal < filters.startDate)
      return false;
    if (filters.endDate && r.tanggal && r.tanggal > filters.endDate)
      return false;

    // Line filter
    if (filters.line && r.line !== filters.line) return false;

    // Machine type filter
    if (filters.machineType && r.prodMachType !== filters.machineType)
      return false;

    // Brand filter
    if (filters.brand && r.prodMach !== filters.brand) return false;

    return true;
  });
};

// --- Aggregation Functions ---

export const getDowntimeByMachineType = (
  records: DowntimeRecord[],
): DowntimeByMachineType[] => {
  const map: Record<string, { totalMinutes: number; frequency: number }> = {};

  records.forEach((r) => {
    const rawType = (r.prodMachType || "").trim();
    if (!rawType || rawType.toLowerCase() === "unknown" || rawType === "-") return;
    const key = rawType;
    if (!map[key]) map[key] = { totalMinutes: 0, frequency: 0 };
    map[key].totalMinutes += r.downtimeAktual;
    map[key].frequency += 1;
  });

  const grandTotal = Object.values(map).reduce(
    (s, v) => s + v.totalMinutes,
    0,
  );

  return Object.entries(map)
    .map(([machineType, val]) => ({
      machineType,
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
      totalHours: Math.round((val.totalMinutes / 60) * 100) / 100,
      frequency: val.frequency,
      avgDurationMinutes:
        val.frequency > 0
          ? Math.round((val.totalMinutes / val.frequency) * 100) / 100
          : 0,
      percentage:
        grandTotal > 0
          ? Math.round((val.totalMinutes / grandTotal) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
};

export const getDowntimeByBrand = (
  records: DowntimeRecord[],
): DowntimeByBrand[] => {
  const map: Record<string, { totalMinutes: number; frequency: number }> = {};

  records.forEach((r) => {
    const key = r.prodMach || "Unknown";
    if (!map[key]) map[key] = { totalMinutes: 0, frequency: 0 };
    map[key].totalMinutes += r.downtimeAktual;
    map[key].frequency += 1;
  });

  const grandTotal = Object.values(map).reduce(
    (s, v) => s + v.totalMinutes,
    0,
  );

  return Object.entries(map)
    .map(([brand, val]) => ({
      brand,
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
      totalHours: Math.round((val.totalMinutes / 60) * 100) / 100,
      frequency: val.frequency,
      avgDurationMinutes:
        val.frequency > 0
          ? Math.round((val.totalMinutes / val.frequency) * 100) / 100
          : 0,
      percentage:
        grandTotal > 0
          ? Math.round((val.totalMinutes / grandTotal) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
};

export const getDowntimeByLine = (
  records: DowntimeRecord[],
): DowntimeByLine[] => {
  const map: Record<string, { totalMinutes: number; frequency: number }> = {};

  records.forEach((r) => {
    const key = r.line || "Unknown";
    if (!map[key]) map[key] = { totalMinutes: 0, frequency: 0 };
    map[key].totalMinutes += r.downtimeAktual;
    map[key].frequency += 1;
  });

  const grandTotal = Object.values(map).reduce(
    (s, v) => s + v.totalMinutes,
    0,
  );

  return Object.entries(map)
    .map(([line, val]) => ({
      line,
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
      totalHours: Math.round((val.totalMinutes / 60) * 100) / 100,
      frequency: val.frequency,
      avgDurationMinutes:
        val.frequency > 0
          ? Math.round((val.totalMinutes / val.frequency) * 100) / 100
          : 0,
      percentage:
        grandTotal > 0
          ? Math.round((val.totalMinutes / grandTotal) * 10000) / 100
          : 0,
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
};

export const getDowntimeTrendByDate = (
  records: DowntimeRecord[],
): DowntimeTrendPoint[] => {
  const map: Record<string, { totalMinutes: number; frequency: number }> = {};

  records.forEach((r) => {
    if (!r.tanggal) return;
    if (!map[r.tanggal]) map[r.tanggal] = { totalMinutes: 0, frequency: 0 };
    map[r.tanggal].totalMinutes += r.downtimeAktual;
    map[r.tanggal].frequency += 1;
  });

  return Object.entries(map)
    .map(([date, val]) => ({
      date,
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
      totalHours: Math.round((val.totalMinutes / 60) * 100) / 100,
      frequency: val.frequency,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

// --- Week helpers (ISO 8601, Senin = awal minggu) ---

const parseYMD = (ymd: string): Date | null => {
  const parts = ymd.split("-");
  if (parts.length !== 3) return null;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  if (isNaN(dt.getTime())) return null;
  return dt;
};

const toYMD = (dt: Date): string => {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getMonday = (dt: Date): Date => {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  const day = d.getDay(); // 0=Minggu, 1=Senin, ...
  const diff = (day + 6) % 7; // jarak mundur ke Senin
  d.setDate(d.getDate() - diff);
  return d;
};

// ISO week-numbering year & week number (1-53)
const getISOWeek = (dt: Date): { year: number; week: number } => {
  const d = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
  // Geser ke Kamis di minggu yang sama (basis ISO)
  const day = (d.getDay() + 6) % 7; // 0=Senin..6=Minggu
  d.setDate(d.getDate() - day + 3);
  const year = d.getFullYear();
  // Kamis minggu pertama = 4 Januari
  const firstThursday = new Date(year, 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year, week };
};

/**
 * Agregasi tren downtime per minggu (ISO week, Senin–Minggu),
 * diurut dari week pertama data sampai week terakhir data.
 * Week kosong (tanpa kejadian) tetap diisi 0 supaya garis tren kontinu.
 */
export const getDowntimeTrendByWeek = (
  records: DowntimeRecord[],
): DowntimeWeeklyTrendPoint[] => {
  const map: Record<string, { totalMinutes: number; frequency: number }> = {};
  const weekMeta: Record<
    string,
    { year: number; week: number; weekStart: string; weekEnd: string }
  > = {};

  records.forEach((r) => {
    if (!r.tanggal) return;
    const dt = parseYMD(r.tanggal);
    if (!dt) return;
    const monday = getMonday(dt);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const { year, week } = getISOWeek(dt);
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`;
    if (!map[weekKey]) map[weekKey] = { totalMinutes: 0, frequency: 0 };
    map[weekKey].totalMinutes += r.downtimeAktual;
    map[weekKey].frequency += 1;
    if (!weekMeta[weekKey]) {
      weekMeta[weekKey] = {
        year,
        week,
        weekStart: toYMD(monday),
        weekEnd: toYMD(sunday),
      };
    }
  });

  const keys = Object.keys(map).sort();
  if (keys.length === 0) return [];

  // Isi week kosong antara week pertama & terakhir supaya W1..W-sekarang kontinu
  const firstMonday = parseYMD(weekMeta[keys[0]].weekStart);
  const lastMonday = parseYMD(weekMeta[keys[keys.length - 1]].weekStart);
  if (!firstMonday || !lastMonday) return [];

  const result: DowntimeWeeklyTrendPoint[] = [];
  const cursor = new Date(firstMonday);
  while (cursor.getTime() <= lastMonday.getTime()) {
    const { year, week } = getISOWeek(cursor);
    const weekKey = `${year}-W${String(week).padStart(2, "0")}`;
    const sunday = new Date(cursor);
    sunday.setDate(sunday.getDate() + 6);
    const val = map[weekKey] || { totalMinutes: 0, frequency: 0 };
    result.push({
      weekKey,
      weekLabel: `W${week}`,
      year,
      week,
      weekStart: toYMD(cursor),
      weekEnd: toYMD(sunday),
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
      totalHours: Math.round((val.totalMinutes / 60) * 100) / 100,
      frequency: val.frequency,
    });
    cursor.setDate(cursor.getDate() + 7);
  }

  return result;
};

export const getTopErrors = (
  records: DowntimeRecord[],
  limit: number = 10,
): DowntimeErrorSummary[] => {
  const map: Record<string, { frequency: number; totalMinutes: number }> = {};

  records.forEach((r) => {
    const msg = r.errorMessage || "-";
    if (msg === "-" || msg === "" || msg.toLowerCase().includes("isi line"))
      return;
    if (!map[msg]) map[msg] = { frequency: 0, totalMinutes: 0 };
    map[msg].frequency += 1;
    map[msg].totalMinutes += r.downtimeAktual;
  });

  return Object.entries(map)
    .map(([errorMessage, val]) => ({
      errorMessage,
      frequency: val.frequency,
      totalMinutes: Math.round(val.totalMinutes * 100) / 100,
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);
};

export const getDowntimeKPIs = (records: DowntimeRecord[]): DowntimeKPIs => {
  const totalDowntimeMinutes = records.reduce(
    (s, r) => s + r.downtimeAktual,
    0,
  );
  const totalIncidents = records.length;

  // Find top machine type
  const byMachine = getDowntimeByMachineType(records);
  const topMachine = byMachine.length > 0 ? byMachine[0] : null;

  // Find top line
  const byLine = getDowntimeByLine(records);
  const topLine = byLine.length > 0 ? byLine[0] : null;

  return {
    totalDowntimeMinutes: Math.round(totalDowntimeMinutes * 100) / 100,
    totalDowntimeHours:
      Math.round((totalDowntimeMinutes / 60) * 100) / 100,
    totalIncidents,
    avgDurationMinutes:
      totalIncidents > 0
        ? Math.round((totalDowntimeMinutes / totalIncidents) * 100) / 100
        : 0,
    topMachineType: topMachine?.machineType || "-",
    topMachineTypeMinutes: topMachine?.totalMinutes || 0,
    topLine: topLine?.line || "-",
    topLineMinutes: topLine?.totalMinutes || 0,
    totalRecords: records.length,
  };
};

// --- Unique Value Extractors (for filter dropdowns) ---

export const getUniqueLines = (records: DowntimeRecord[]): string[] => {
  return [
    ...new Set(
      records
        .map((r) => (r.line || "").trim())
        .filter(
          (l) => l !== "" && l.toUpperCase().startsWith(DOWNTIME_ALLOWED_LINE_PREFIX),
        ),
    ),
  ].sort();
};

export const getUniqueMachineTypes = (records: DowntimeRecord[]): string[] => {
  return [
    ...new Set(
      records
        .map((r) => (r.prodMachType || "").trim())
        .filter((t) => t !== "" && t.toLowerCase() !== "unknown" && t !== "-"),
    ),
  ].sort();
};

export const getUniqueBrands = (records: DowntimeRecord[]): string[] => {
  return [...new Set(records.map((r) => r.prodMach).filter(Boolean))].sort();
};
