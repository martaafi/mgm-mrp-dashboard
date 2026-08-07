import React from "react";
import { Wrench, PackageCheck, AlertTriangle } from "lucide-react";
import { MachineRequirementSummary } from "../../types/mrp";

interface KPICardsProps {
  summaryData: MachineRequirementSummary[];
  availabilityDate?: string | null;
}

export const KPICards: React.FC<KPICardsProps> = ({
  summaryData,
  availabilityDate,
}) => {
  const totalRequired = summaryData.reduce(
    (acc, curr) => acc + curr.required,
    0,
  );
  const totalAvailable = summaryData.reduce(
    (acc, curr) => acc + curr.available,
    0,
  );

  // GAP
  const totalGap = totalAvailable - totalRequired;

  const formattedDate = availabilityDate
    ? availabilityDate.split("-").reverse().join("/")
    : "-";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      {/* 1. Total Available Machine */}
      <div className="bg-blue-600 border border-blue-700 rounded-xl p-4 shadow-sm flex flex-col hover:brightness-105 transition-all text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
            Available Machine
          </span>
          <div className="w-8 h-8 rounded-lg bg-blue-500/50 flex items-center justify-center text-white">
            <PackageCheck className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {totalAvailable.toLocaleString()}
        </div>
        <div className="mt-auto pt-2">
          <p className="text-xs text-blue-100">
            Data ketersediaan mesin per tanggal {formattedDate}
          </p>
        </div>
      </div>

      {/* 2. Total Machine Required */}
      <div className="bg-amber-500 border border-amber-600 rounded-xl p-4 shadow-sm flex flex-col hover:brightness-105 transition-all text-white">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-100">
            Requirement Mesin
          </span>
          <div className="w-8 h-8 rounded-lg bg-amber-400/50 flex items-center justify-center text-white">
            <Wrench className="w-4 h-4" />
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {totalRequired.toLocaleString()}
        </div>
        <div className="mt-auto pt-2">
          <p className="text-xs text-amber-100">
            Jumlah mesin yang dibutuhkan berdasarkan planning style PPIC
          </p>
        </div>
      </div>

      {/* 3. GAP */}
      <div
        className={`border rounded-xl p-4 shadow-sm flex flex-col hover:brightness-105 transition-all text-white ${totalGap < 0 ? "bg-red-500 border-red-600" : "bg-emerald-500 border-emerald-600"}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
            GAP
          </span>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/20 text-white">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-none">
            {totalGap > 0
              ? `+${totalGap.toLocaleString()}`
              : totalGap.toLocaleString()}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold mt-1 bg-white/20 text-white">
            {totalGap < 0 ? "Shortage" : totalGap > 0 ? "Surplus" : "Balanced"}
          </span>
        </div>
        <div className="mt-auto pt-2">
          <p className="text-xs text-white/80 flex items-center flex-wrap gap-1">
            Selisih antara ketersediaan mesin dengan kebutuhan mesin
          </p>
        </div>
      </div>
    </div>
  );
};
