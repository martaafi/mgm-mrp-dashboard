import React, { useState, useMemo } from "react";
import { format, differenceInDays } from "date-fns";
import {
  X,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { RentalTrialRecord } from "../../types/mrp";

export type RentalKPIModalCategory = "all" | "sewa" | "trial" | "no_deadline";

interface RentalMachinesModalProps {
  isOpen: boolean;
  onClose: () => void;
  category: RentalKPIModalCategory;
  records: RentalTrialRecord[];
}

export const RentalMachinesModal: React.FC<RentalMachinesModalProps> = ({
  isOpen,
  onClose,
  category,
  records,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<
    keyof RentalTrialRecord | "daysRemaining"
  >("helperJenis");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter records based on category
  const categoryRecords = useMemo(() => {
    switch (category) {
      case "sewa":
        return records.filter((r) => r.remark.toLowerCase().includes("sewa"));
      case "trial":
        return records.filter((r) => r.remark.toLowerCase().includes("trial"));
      case "no_deadline":
        return records.filter((r) => !r.tglSelesai);
      case "all":
      default:
        return records;
    }
  }, [category, records]);

  // Category Title & Metadata
  const categoryInfo = useMemo(() => {
    switch (category) {
      case "sewa":
        return {
          title: "Daftar Mesin Sewa",
          subtitle: "Daftar semua mesin dengan status Mesin Sewa",
          badgeColor:
            "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
        };
      case "trial":
        return {
          title: "Daftar Mesin Trial",
          subtitle: "Daftar semua mesin dengan status Mesin Trial",
          badgeColor:
            "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800",
        };
      case "no_deadline":
        return {
          title: "Mesin Belum Ada Batas Waktu",
          subtitle:
            "Daftar mesin sewa & trial yang belum ditentukan tanggal selesainya",
          badgeColor:
            "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
        };
      case "all":
      default:
        return {
          title: "Daftar Keseluruhan Mesin Sewa & Trial",
          subtitle: "Rincian seluruh mesin sewa dan trial yang terdaftar",
          badgeColor:
            "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
        };
    }
  }, [category]);

  const getDaysRemaining = (tglSelesai?: string): number | null => {
    if (!tglSelesai) return null;
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(tglSelesai);
      end.setHours(0, 0, 0, 0);
      return differenceInDays(end, today);
    } catch {
      return null;
    }
  };

  const getDurationDays = (
    entryDate?: string,
    tglSelesai?: string,
  ): number | null => {
    if (!entryDate || !tglSelesai) return null;
    try {
      const start = new Date(entryDate);
      const end = new Date(tglSelesai);
      const diff = differenceInDays(end, start);
      return diff >= 0 ? diff : null;
    } catch {
      return null;
    }
  };

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  // Filtered by Search Query
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return categoryRecords;
    const q = searchQuery.toLowerCase().trim();
    return categoryRecords.filter(
      (r) =>
        (r.helperJenis || "").toLowerCase().includes(q) ||
        (r.namaMesin || "").toLowerCase().includes(q) ||
        (r.tipeMesin || "").toLowerCase().includes(q) ||
        (r.brand || "").toLowerCase().includes(q) ||
        (r.serialNumber || "").toLowerCase().includes(q) ||
        (r.invoice || "").toLowerCase().includes(q) ||
        (r.remark || "").toLowerCase().includes(q) ||
        (r.inventory1 || "").toLowerCase().includes(q) ||
        (r.inventory2 || "").toLowerCase().includes(q),
    );
  }, [categoryRecords, searchQuery]);

  // Sorted Data
  const sortedData = useMemo(() => {
    const list = [...filteredData];
    list.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      if (sortField === "daysRemaining") {
        aVal = getDaysRemaining(a.tglSelesai) ?? 999999;
        bVal = getDaysRemaining(b.tglSelesai) ?? 999999;
      } else {
        aVal = a[sortField] ?? "";
        bVal = b[sortField] ?? "";
      }

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDir === "asc" ? aVal - bVal : bVal - aVal;
      }
      return sortDir === "asc"
        ? String(aVal).localeCompare(String(bVal), undefined, { numeric: true })
        : String(bVal).localeCompare(String(aVal), undefined, {
            numeric: true,
          });
    });
    return list;
  }, [filteredData, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedData.length / itemsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(start, start + itemsPerPage);
  }, [sortedData, currentPage]);

  const handleSort = (field: keyof RentalTrialRecord | "daysRemaining") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-5xl w-full flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">
                  {categoryInfo.title}
                </h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${categoryInfo.badgeColor}`}
                >
                  {categoryRecords.length} unit
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {categoryInfo.subtitle}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar: Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari mesin, brand, serial number, invoice..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {filteredData.length}
            </span>{" "}
            dari {categoryRecords.length} mesin
          </div>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-auto">
          {sortedData.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <AlertCircle className="w-10 h-10 mb-2 opacity-50" />
              <p className="text-sm font-semibold">
                Tidak ada data mesin ditemukan
              </p>
              {searchQuery && (
                <p className="text-xs mt-1 text-slate-500">
                  Coba ubah kata kunci pencarian Anda
                </p>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 z-10 backdrop-blur-xs">
                  <th
                    onClick={() => handleSort("helperJenis")}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Jenis Mesin</span>
                      {sortField === "helperJenis" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("brand")}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Brand / Tipe</span>
                      {sortField === "brand" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th className="py-3 px-3.5">Invoice / SJ</th>
                  <th className="py-3 px-3.5">Serial Number</th>
                  <th
                    onClick={() => handleSort("remark")}
                    className="py-3 px-3.5 cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center gap-1">
                      <span>Status</span>
                      {sortField === "remark" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("entryDate")}
                    className="py-3 px-3.5 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tanggal Mulai Sewa/Trial</span>
                      {sortField === "entryDate" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tglSelesai")}
                    className="py-3 px-3.5 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tanggal Selesai Sewa/Trial</span>
                      {sortField === "tglSelesai" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("tglKeluar")}
                    className="py-3 px-3.5 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Tanggal Aktual Dikembalikan</span>
                      {sortField === "tglKeluar" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                  <th className="py-3 px-3.5 text-center">Durasi Masa Sewa</th>
                  <th
                    onClick={() => handleSort("daysRemaining")}
                    className="py-3 px-3.5 text-center cursor-pointer hover:text-slate-800 dark:hover:text-slate-200 select-none"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Sisa Waktu</span>
                      {sortField === "daysRemaining" &&
                        (sortDir === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedData.map((record, idx) => {
                  const daysLeft = getDaysRemaining(record.tglSelesai);
                  const duration = getDurationDays(
                    record.entryDate,
                    record.tglSelesai,
                  );
                  const isTrial = record.remark.toLowerCase().includes("trial");

                  return (
                    <tr
                      key={`${record.serialNumber || record.invoice || idx}-${idx}`}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-800 dark:text-slate-100">
                          {record.helperJenis}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          {record.jenis}
                        </div>
                      </td>
                      <td className="py-3 px-3.5">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {record.brand || "-"}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {record.namaMesin || record.tipeMesin || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 font-medium text-slate-600 dark:text-slate-300">
                        {record.invoice || "-"}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-slate-600 dark:text-slate-400">
                        {record.serialNumber || "-"}
                      </td>
                      <td className="py-3 px-3.5">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            isTrial
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                              : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {isTrial ? "TRIAL" : "SEWA"}
                        </span>
                      </td>
                      <td className="py-3 px-3.5 text-center text-slate-600 dark:text-slate-300">
                        <div className="font-medium">
                          {formatDateDisplay(record.entryDate)}
                        </div>
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {record.tglSelesai ? (
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatDateDisplay(record.tglSelesai)}
                          </div>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/40">
                            Belum Ditentukan
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center text-slate-600 dark:text-slate-300">
                        {record.tglKeluar ? (
                          <div className="font-semibold text-slate-700 dark:text-slate-200">
                            {formatDateDisplay(record.tglKeluar)}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center text-slate-600 dark:text-slate-300">
                        {duration !== null ? (
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {duration} hari
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        {daysLeft === null ? (
                          <span className="text-[10px] font-medium text-slate-400">
                            -
                          </span>
                        ) : daysLeft < 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Expired ({Math.abs(daysLeft)}d lalu)
                          </span>
                        ) : daysLeft <= 3 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                            {daysLeft} hari lagi
                          </span>
                        ) : daysLeft <= 7 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            {daysLeft} hari lagi
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                            {daysLeft} hari lagi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer & Pagination */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">
            Hal{" "}
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {currentPage}
            </span>{" "}
            dari {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
