import { ProductionPlan } from "../types/mrp";
import { isSunday } from "./mrpCalculations";

/**
 * Palet warna blok style. Dipakai bersama oleh tab Planning Style dan
 * header Detail Layout supaya warna style konsisten antar tab.
 * Ditulis literal agar tidak ter-purge oleh Tailwind.
 */
export const STYLE_PALETTE: string[] = [
  "bg-indigo-100/80 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200",
  "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200",
  "bg-amber-100/80 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200",
  "bg-rose-100/80 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
  "bg-sky-100/80 text-sky-800 dark:bg-sky-500/20 dark:text-sky-200",
  "bg-violet-100/80 text-violet-800 dark:bg-violet-500/20 dark:text-violet-200",
  "bg-orange-100/80 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200",
  "bg-teal-100/80 text-teal-800 dark:bg-teal-500/20 dark:text-teal-200",
  "bg-fuchsia-100/80 text-fuchsia-800 dark:bg-fuchsia-500/20 dark:text-fuchsia-200",
  "bg-lime-100/80 text-lime-800 dark:bg-lime-500/20 dark:text-lime-200",
  "bg-cyan-100/80 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200",
  "bg-pink-100/80 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200",
  "bg-blue-100/80 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200",
  "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200",
  "bg-purple-100/80 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200",
  "bg-green-100/80 text-green-800 dark:bg-green-500/20 dark:text-green-200",
  "bg-red-100/80 text-red-800 dark:bg-red-500/20 dark:text-red-200",
  "bg-stone-100/80 text-stone-800 dark:bg-stone-500/20 dark:text-stone-200",
];

// Line non-produksi tidak ikut menentukan warna (sama seperti tab Planning Style).
const EXCLUDED_LINE_PATTERN = /ACC|SKILL|TES/i;
const NO_PLANNING_PATTERN = /^NO PLANNING$/i;

/**
 * Membangun peta warna dari sekumpulan label style. Urutan alfabetis
 * dipakai agar hasil deterministik: style yang sama selalu mendapat
 * warna yang sama pada satu dataset.
 */
export const buildStyleColorMapFromLabels = (
  labels: Iterable<string>,
): Map<string, string> => {
  const sorted = Array.from(new Set(labels))
    .map((label) => label.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const map = new Map<string, string>();
  sorted.forEach((label, index) => {
    map.set(label, STYLE_PALETTE[index % STYLE_PALETTE.length]);
  });
  return map;
};

/**
 * Peta warna style global (dari seluruh plan, bukan hanya rentang filter)
 * supaya warna antar tab tetap konsisten meskipun rentang tanggal berbeda.
 */
export const buildStyleColorMap = (
  plans: ProductionPlan[],
): Map<string, string> => {
  const labels = new Set<string>();

  plans.forEach((plan) => {
    if (!plan.date || isSunday(plan.date)) return;
    if (EXCLUDED_LINE_PATTERN.test(plan.line || "")) return;

    const raw = (plan.displayStyle || "").trim() || (plan.style || "").trim();
    if (!raw) return;

    raw
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .forEach((label) => {
        if (NO_PLANNING_PATTERN.test(label)) return;
        labels.add(label);
      });
  });

  return buildStyleColorMapFromLabels(labels);
};

/** Warna untuk satu label style, dengan fallback ke warna pertama palet. */
export const getStyleColor = (
  style: string,
  colorMap: Map<string, string>,
): string => colorMap.get((style || "").trim()) || STYLE_PALETTE[0];
