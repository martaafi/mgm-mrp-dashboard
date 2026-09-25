import React, { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Bell,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { RentalTrialRecord, RentalTrialAlert } from "../../types/mrp";
import { getRentalTrialAlerts } from "../../utils/mrpCalculations";

interface RentalAlertsDashboardProps {
  rentalTrialRecords: RentalTrialRecord[];
}

export const RentalAlertsDashboard: React.FC<RentalAlertsDashboardProps> = ({
  rentalTrialRecords,
}) => {
  const alerts = useMemo(
    () => getRentalTrialAlerts(rentalTrialRecords, 7),
    [rentalTrialRecords],
  );

  const criticalCount = alerts.filter((a) => a.severity === "critical").length;
  const warningCount = alerts.filter((a) => a.severity === "warning").length;
  const expiredCount = alerts.filter((a) => a.severity === "info").length;

  const [tableMachineFilter, setTableMachineFilter] = useState("ALL");

  const uniqueTableMachines = useMemo(() => {
    const set = new Set<string>();
    alerts.forEach((a) => set.add(a.record.helperJenis));
    return Array.from(set).sort();
  }, [alerts]);

  const filteredTableAlerts = useMemo(() => {
    if (tableMachineFilter === "ALL") return alerts;
    return alerts.filter((a) => a.record.helperJenis === tableMachineFilter);
  }, [alerts, tableMachineFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const totalPages = Math.ceil(filteredTableAlerts.length / itemsPerPage);
  const paginatedAlerts = filteredTableAlerts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  // Group alerts by helperJenis for summary
  const groupedByMachine = useMemo(() => {
    const map = new Map<
      string,
      { count: number; minDays: number; remark: string }
    >();
    alerts.forEach((alert) => {
      const key = `${alert.record.helperJenis.toUpperCase()}|${alert.daysRemaining}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          count: 1,
          minDays: alert.daysRemaining,
          remark: alert.record.remark,
        });
      } else {
        existing.count++;
      }
    });

    const grouped = Array.from(map.entries());

    // Find the absolute minimum days remaining for each machine type to sort the groups
    const machineMinDays = new Map<string, number>();
    grouped.forEach(([key, info]) => {
      const machine = key.split("|")[0];
      const currentMin = machineMinDays.get(machine);
      if (currentMin === undefined || info.minDays < currentMin) {
        machineMinDays.set(machine, info.minDays);
      }
    });

    return grouped.sort((a, b) => {
      const machineA = a[0].split("|")[0];
      const machineB = b[0].split("|")[0];

      if (machineA !== machineB) {
        const minA = machineMinDays.get(machineA)!;
        const minB = machineMinDays.get(machineB)!;
        if (minA !== minB) return minA - minB;
        return machineA.localeCompare(machineB);
      }

      return a[1].minDays - b[1].minDays;
    });
  }, [alerts]);

  const getSeverityStyle = (severity: RentalTrialAlert["severity"]) => {
    switch (severity) {
      case "critical":
        return {
          bg: "bg-red-50 dark:bg-red-900/20",
          border: "border-red-200 dark:border-red-800/50",
          text: "text-red-700 dark:text-red-400",
          badge:
            "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
          icon: <AlertTriangle className="w-4 h-4 text-red-500" />,
        };
      case "warning":
        return {
          bg: "bg-amber-50 dark:bg-amber-900/20",
          border: "border-amber-200 dark:border-amber-800/50",
          text: "text-amber-700 dark:text-amber-400",
          badge:
            "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800",
          icon: <Clock className="w-4 h-4 text-amber-500" />,
        };
      case "info":
      default:
        return {
          bg: "bg-slate-50 dark:bg-slate-800/30",
          border: "border-slate-200 dark:border-slate-700",
          text: "text-slate-600 dark:text-slate-400",
          badge:
            "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700",
          icon: <Info className="w-4 h-4 text-slate-400" />,
        };
    }
  };

  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMM yyyy");
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5 transition-colors">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Rental & Trial Machine Alerts
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Mesin sewa/trial yang masa berlakunya akan berakhir dalam 7 hari
                ke depan
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Critical */}
          <div className="flex items-center space-x-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-3.5">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                {criticalCount}
              </div>
              <div className="text-[10px] font-semibold text-red-600/70 dark:text-red-400/70 uppercase tracking-wider">
                Masa Sewa/Trial ≤3 hari
              </div>
            </div>
          </div>
          {/* Warning */}
          <div className="flex items-center space-x-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-3.5">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
                {warningCount}
              </div>
              <div className="text-[10px] font-semibold text-amber-600/70 dark:text-amber-400/70 uppercase tracking-wider">
                Masa Sewa/Trial Sisa 4-7 hari
              </div>
            </div>
          </div>
          {/* Expired */}
          <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-xl p-3.5">
            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                {expiredCount}
              </div>
              <div className="text-[10px] font-semibold text-slate-500/70 dark:text-slate-400/70 uppercase tracking-wider">
                Masa Sewa/Trial Sudah Selesai (3 hari lalu)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Machine Group Summary */}
      {groupedByMachine.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5 transition-colors">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-3">
            Ringkasan per Jenis Mesin
          </h3>
          <div className="flex flex-wrap gap-2">
            {groupedByMachine.map(([key, info]) => {
              const machine = key.split("|")[0];
              const severity: RentalTrialAlert["severity"] =
                info.minDays <= 0
                  ? "info"
                  : info.minDays <= 3
                    ? "critical"
                    : "warning";
              const style = getSeverityStyle(severity);
              return (
                <div
                  key={key}
                  className={`inline-flex items-center space-x-2 px-3 py-2 rounded-lg border ${style.bg} ${style.border}`}
                >
                  {style.icon}
                  <span className={`text-sm font-bold ${style.text}`}>
                    {machine}
                  </span>
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded-full border ${style.badge}`}
                  >
                    {info.count} unit
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {info.minDays <= 0
                      ? "Expired"
                      : `${info.minDays} hari lagi`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total rental/trial machines info */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5 transition-colors">
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
          Informasi Keseluruhan Mesin Sewa & Trial
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-slate-800 dark:text-slate-200">
              {rentalTrialRecords.length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Total Mesin
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              {
                rentalTrialRecords.filter((r) =>
                  r.remark.toLowerCase().includes("sewa"),
                ).length
              }
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Mesin Sewa
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {
                rentalTrialRecords.filter((r) =>
                  r.remark.toLowerCase().includes("trial"),
                ).length
              }
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Mesin Trial
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/30 rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {rentalTrialRecords.filter((r) => !r.tglSelesai).length}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Belum Ada Batas Waktu
            </div>
          </div>
        </div>
      </div>

      {/* Detail Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden transition-colors">
        <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Detail Mesin
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Daftar lengkap mesin sewa/trial yang akan segera berakhir
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <select
              value={tableMachineFilter}
              onChange={(e) => {
                setTableMachineFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-slate-700 dark:text-slate-300 font-medium min-w-[160px]"
            >
              <option value="ALL">Semua Jenis Mesin</option>
              {uniqueTableMachines.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredTableAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-400" />
            <p className="text-sm font-semibold">Tidak ada alert saat ini</p>
            <p className="text-xs mt-1">
              Semua mesin sewa/trial masih dalam masa aktif lebih dari 7 hari.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Jenis Mesin</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Invoice / SJ</th>
                  <th className="py-3 px-4">Serial Number</th>
                  <th className="py-3 px-4">Inventory 1</th>
                  <th className="py-3 px-4">Inventory 2</th>
                  <th className="py-3 px-4">Remark</th>
                  <th className="py-3 px-4 text-center">Entry Date</th>
                  <th className="py-3 px-4 text-center">End Date</th>
                  <th className="py-3 px-4 text-center">Sisa Hari</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
                {paginatedAlerts.map((alert, idx) => {
                  const style = getSeverityStyle(alert.severity);
                  return (
                    <tr
                      key={`${alert.record.serialNumber || idx}-${idx}`}
                      className={`${style.bg} transition-colors`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-1.5">
                          {style.icon}
                          <span
                            className={`text-[10px] font-bold uppercase ${style.text}`}
                          >
                            {alert.severity === "critical"
                              ? "CRITICAL"
                              : alert.severity === "warning"
                                ? "WARNING"
                                : "EXPIRED"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {alert.record.helperJenis}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {alert.record.tipeMesin || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {alert.record.brand || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-bold">
                        {alert.record.invoice || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {alert.record.serialNumber || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {alert.record.inventory1 || "-"}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                        {alert.record.inventory2 || "-"}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            alert.record.remark.toLowerCase().includes("trial")
                              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800"
                              : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          {alert.record.remark.toLowerCase().includes("trial")
                            ? "TRIAL"
                            : "SEWA"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 dark:text-slate-400">
                        {formatDateDisplay(alert.record.entryDate)}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800 dark:text-slate-200">
                        {formatDateDisplay(alert.record.tglSelesai)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold border ${style.badge}`}
                        >
                          {alert.daysRemaining <= 0
                            ? `${Math.abs(alert.daysRemaining)}d ago`
                            : `${alert.daysRemaining} hari`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan {(currentPage - 1) * itemsPerPage + 1} hingga{" "}
              {Math.min(currentPage * itemsPerPage, filteredTableAlerts.length)}{" "}
              dari {filteredTableAlerts.length} baris
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hal {currentPage} / {totalPages}
              </span>
              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
