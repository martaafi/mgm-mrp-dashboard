import React, { useState } from "react";
import {
  RefreshCw,
  X,
  Sparkles,
  ArrowRight,
  Database,
} from "lucide-react";

interface InitialReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => void;
  isRefreshing?: boolean;
}

export const InitialReminderModal: React.FC<InitialReminderModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  isRefreshing = false,
}) => {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (dontShowAgain) {
      sessionStorage.setItem("mrp_suppress_initial_refresh_modal", "true");
    }
    onClose();
  };

  const handleRefreshClick = () => {
    if (dontShowAgain) {
      sessionStorage.setItem("mrp_suppress_initial_refresh_modal", "true");
    }
    onRefreshData();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-auto animate-in zoom-in-95 duration-200 transition-colors">
        {/* Header Strip with Accent */}
        <div className="relative bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 text-white">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner text-white border border-white/20">
              <RefreshCw className="w-6 h-6 animate-[spin_4s_linear_infinite]" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/40 text-emerald-100 border border-white/20">
                  Sinkronisasi Data
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold mt-1 text-white leading-tight">
                Peringatan Refresh Data
              </h2>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Selamat datang di <strong>MRP Sewing Machine Dashboard</strong>. Untuk
            memastikan kalkulasi kebutuhan mesin, perencanaan PPIC, dan status ketersediaan selalu menggunakan{" "}
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              data terbaru dari Google Sheets
            </span>
            , silakan lakukan penyegaran data.
          </p>

          {/* Simulated Top Bar Button Helper Card */}
          <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/70 rounded-xl p-4 transition-colors">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
              <span>Lokasi Tombol pada Header:</span>
              <span className="flex items-center text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Baris Atas Dashboard
              </span>
            </div>
            
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300">
                <Database className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">Google Sheets Live Data</span>
              </div>
              
              <div className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white shadow ring-2 ring-emerald-500/40 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Data</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2.5 leading-normal">
              💡 Anda juga dapat mengklik tombol <strong>Refresh Data</strong> di baris atas kapan saja untuk memperbarui cache browser.
            </p>
          </div>

          {/* Do not show again checkbox */}
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="checkbox"
              id="dontShowAgain"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 dark:border-slate-600 focus:ring-emerald-500 bg-slate-50 dark:bg-slate-800 cursor-pointer"
            />
            <label
              htmlFor="dontShowAgain"
              className="text-xs text-slate-600 dark:text-slate-400 select-none cursor-pointer"
            >
              Jangan tampilkan pengingat ini lagi selama sesi ini
            </label>
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 transition-colors">
          <button
            onClick={handleClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
          >
            Lanjutkan ke Dashboard
          </button>
          <button
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`}
            />
            <span>{isRefreshing ? "Menyinkronkan..." : "Refresh Data Sekarang"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
