/**
 * Helper formatting untuk tampilan angka di dashboard.
 * Jika angka bulat (integer), tampilkan bulat (contoh: 30, 476).
 * Jika ada desimal, tampilkan maksimal 2 angka di belakang koma (contoh: 0.89, 12.5, 317.45).
 */

export const formatDecimal = (num: number | null | undefined, maxDecimals: number = 2): string => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
};

export const formatSignedDecimal = (num: number | null | undefined, maxDecimals: number = 2): string => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(num * factor) / factor;
  const formatted = rounded.toLocaleString("en-US", { maximumFractionDigits: maxDecimals });
  return rounded > 0 ? `+${formatted}` : formatted;
};
