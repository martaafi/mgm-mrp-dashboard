import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Clock,
  ArrowRight,
  Calendar,
  AlertCircle,
  Info,
  ChevronRight,
  ChevronLeft,
  Activity,
} from "lucide-react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
} from "../../types/mrp";
import { calculateMachineRequirements } from "../../utils/mrpCalculations";

interface HistoryLayoutProps {
  filteredPlans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
}

export const HistoryLayout: React.FC<HistoryLayoutProps> = ({
  filteredPlans,
  requirements,
  availabilities,
}) => {
  // Format date helper: YYYY-MM-DD -> DD-MM-YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const parts = dateString.split("-");
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
  };

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Ambil semua plan yang ada perubahan (belum di-sort)
  const rawChangedPlans = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return filteredPlans
      .filter((p) => {
        if (!p.isStyleChanged && !p.isDisplayStyleChanged) return false;

        // Filter: Tampilkan mulai dari hari ini dan masa depan
        const planDate = new Date(p.date);
        planDate.setHours(0, 0, 0, 0);
        return planDate >= today;
      });
  }, [filteredPlans]);

  // Pre-calculate macro impact warning for ALL raw changed plans
  const planMacroImpactMap = useMemo(() => {
    const map = new Map<ProductionPlan, boolean>();
    const todayStr = getTodayStr();
    
    rawChangedPlans.forEach(plan => {
      if (!plan.isStyleChanged) {
        map.set(plan, false);
        return;
      }
      
      const impactPlans = filteredPlans.filter(
        (p) => p.date >= todayStr && p.date <= plan.date,
      );

      if (impactPlans.length === 0) {
        map.set(plan, false);
        return;
      }

      const currentFactoryReqs = calculateMachineRequirements(impactPlans, requirements, availabilities);

      const hypotheticalPlans = impactPlans.map((p) => {
        if (p.isStyleChanged && p.historyStyle) {
          return { ...p, style: p.historyStyle };
        }
        return p;
      });

      const hypotheticalFactoryReqs = calculateMachineRequirements(hypotheticalPlans, requirements, availabilities);

      let hasNewShortage = false;
      const allMachineTypes = new Set([
        ...currentFactoryReqs.map((r) => r.machine),
        ...hypotheticalFactoryReqs.map((r) => r.machine),
      ]);

      for (const machine of Array.from(allMachineTypes)) {
        const current = currentFactoryReqs.find((r) => r.machine === machine);
        const hypothetical = hypotheticalFactoryReqs.find((r) => r.machine === machine);

        const available = availabilities.find((a) => a.jenisMesin.toLowerCase() === machine.toLowerCase())?.jumlahMesin || 0;
        const oldGap = hypothetical ? hypothetical.gap : available;
        const newGap = current ? current.gap : available;

        if (newGap < 0 && oldGap >= 0) hasNewShortage = true;
        if (newGap < 0 && oldGap < 0 && newGap < oldGap) hasNewShortage = true;
        
        if (hasNewShortage) break;
      }

      map.set(plan, hasNewShortage);
    });
    
    return map;
  }, [rawChangedPlans, filteredPlans, requirements, availabilities]);

  // Sort plan berdasarkan prioritas Merah > Kuning > Biru, lalu tanggal terdekat
  const changedPlans = useMemo(() => {
    return [...rawChangedPlans].sort((a, b) => {
      const aRed = planMacroImpactMap.get(a) || false;
      const bRed = planMacroImpactMap.get(b) || false;
      const aYellow = a.isStyleChanged;
      const bYellow = b.isStyleChanged;

      const getPriority = (isRed: boolean, isYellow: boolean) => {
        if (isRed) return 1;
        if (isYellow) return 2;
        return 3;
      };

      const pA = getPriority(aRed, aYellow);
      const pB = getPriority(bRed, bYellow);

      if (pA !== pB) {
        return pA - pB;
      }

      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [rawChangedPlans, planMacroImpactMap]);

  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  // Set initial selected plan after changedPlans is ready
  React.useEffect(() => {
    if (changedPlans.length > 0 && !selectedPlan) {
      setSelectedPlan(changedPlans[0]);
    }
  }, [changedPlans, selectedPlan]);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const totalPages = Math.ceil(changedPlans.length / itemsPerPage);

  const paginatedPlans = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return changedPlans.slice(startIndex, startIndex + itemsPerPage);
  }, [changedPlans, currentPage]);

  // Hitung dampak perubahan mesin untuk plan yang dipilih
  const impactAnalysis = useMemo(() => {
    if (!selectedPlan) return null;

    // Jika style perhitungannya tidak berubah, maka mesinnya pasti sama
    if (!selectedPlan.isStyleChanged || !selectedPlan.historyStyle) {
      return { comparison: [], hasCriticalImpact: false };
    }

    const oldReqs = requirements.filter(
      (r) => r.style === selectedPlan.historyStyle && r.kebutuhanTotal > 0,
    );
    const newReqs = requirements.filter(
      (r) => r.style === selectedPlan.style && r.kebutuhanTotal > 0,
    );

    const machineTypes = new Set([
      ...oldReqs.map((r) => r.jenisMesin.trim().toLowerCase()),
      ...newReqs.map((r) => r.jenisMesin.trim().toLowerCase()),
    ]);

    const comparison = Array.from(machineTypes)
      .map((machineKey) => {
        // Find original casing
        const originalName =
          oldReqs.find((r) => r.jenisMesin.trim().toLowerCase() === machineKey)
            ?.jenisMesin ||
          newReqs.find((r) => r.jenisMesin.trim().toLowerCase() === machineKey)
            ?.jenisMesin ||
          machineKey;

        const oldReq =
          oldReqs.find((r) => r.jenisMesin.trim().toLowerCase() === machineKey)
            ?.kebutuhanTotal || 0;
        const newReq =
          newReqs.find((r) => r.jenisMesin.trim().toLowerCase() === machineKey)
            ?.kebutuhanTotal || 0;
        const diff = newReq - oldReq;

        return {
          machine: originalName,
          oldReq,
          newReq,
          diff,
          isNew: oldReq === 0 && newReq > 0,
          isIncreased: diff > 0 && oldReq > 0,
          isDecreased: diff < 0,
        };
      })
      .sort((a, b) => b.diff - a.diff);

    const hasCriticalImpact = comparison.some((c) => c.isNew || c.isIncreased);

    return { comparison, hasCriticalImpact };
  }, [selectedPlan, requirements]);

  // Hitung dampak Makro (Keseluruhan Rentang Waktu) terhadap pabrik
  const factoryImpact = useMemo(() => {
    if (!filteredPlans || filteredPlans.length === 0 || !selectedPlan)
      return null;

    const todayStr = getTodayStr();

    // Saring data HANYA dari Hari Ini sampai Tanggal History yang diklik
    const impactPlans = filteredPlans.filter(
      (plan) => plan.date >= todayStr && plan.date <= selectedPlan.date,
    );

    if (impactPlans.length === 0) return null;

    // Skenario Sesudah (Real/Current): Kondisi pada seluruh rentang waktu menggunakan data yang ada
    const currentFactoryReqs = calculateMachineRequirements(
      impactPlans,
      requirements,
      availabilities,
    );

    // Skenario Sebelum (Hypothetical): Kondisi pada seluruh rentang waktu jika TIDAK ADA perubahan PPIC (revert ke historyStyle)
    let totalStyleChanges = 0;
    const hypotheticalPlans = impactPlans.map((p) => {
      if (p.isStyleChanged || p.isDisplayStyleChanged) {
        totalStyleChanges++;
      }

      if (p.isStyleChanged && p.historyStyle) {
        return { ...p, style: p.historyStyle };
      }
      return p;
    });

    const hypotheticalFactoryReqs = calculateMachineRequirements(
      hypotheticalPlans,
      requirements,
      availabilities,
    );

    // Bandingkan mesin-mesin yang terdampak (ada perbedaan)
    const factoryComparison: any[] = [];
    let hasNewShortage = false;

    // Kumpulkan semua tipe mesin dari kedua skenario
    const allMachineTypes = new Set([
      ...currentFactoryReqs.map((r) => r.machine),
      ...hypotheticalFactoryReqs.map((r) => r.machine),
    ]);

    Array.from(allMachineTypes).forEach((machine) => {
      const current = currentFactoryReqs.find((r) => r.machine === machine);
      const hypothetical = hypotheticalFactoryReqs.find(
        (r) => r.machine === machine,
      );

      const oldGap = hypothetical
        ? hypothetical.gap
        : availabilities.find(
            (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
          )?.jumlahMesin || 0;
      const newGap = current
        ? current.gap
        : availabilities.find(
            (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
          )?.jumlahMesin || 0;
      const oldReq = hypothetical ? hypothetical.required : 0;
      const newReq = current ? current.required : 0;
      const available = current
        ? current.available
        : hypothetical
          ? hypothetical.available
          : 0;

      const isNowShortage = newGap < 0 && oldGap >= 0;
      const isWorseShortage = newGap < 0 && oldGap < 0 && newGap < oldGap;
      if (isNowShortage || isWorseShortage) {
        hasNewShortage = true;
      }

      factoryComparison.push({
        machine,
        available,
        oldReq,
        newReq,
        oldGap,
        newGap,
        isNowShortage,
        isWorseShortage,
      });
    });

    return {
      comparison: factoryComparison.sort((a, b) => {
        // Tentukan prioritas berdasarkan status
        // 1: Makin Shortage / Jadi Shortage
        // 2: Shortage (Tetap)
        // 3: Aman
        const getPriority = (row: any) => {
          if (row.isNowShortage || row.isWorseShortage) return 1;
          if (row.newGap < 0) return 2;
          return 3;
        };

        const priorityA = getPriority(a);
        const priorityB = getPriority(b);

        // Sort berdasarkan prioritas (1 -> 2 -> 3)
        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        // Jika prioritasnya sama, urutkan berdasarkan gap terburuk (paling negatif di atas)
        return a.newGap - b.newGap;
      }),
      hasNewShortage,
      totalStyleChanges,
      startDate: todayStr,
      endDate: selectedPlan.date,
    };
  }, [filteredPlans, selectedPlan, requirements, availabilities]);

  return (
    <div className="flex flex-col md:flex-row gap-6 pb-8 h-full min-h-[500px] items-start">
      {/* Left Column: List of Changes */}
      <div className="w-full md:w-1/3 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden sticky top-6 max-h-[calc(100vh-2rem)]">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h2 className="font-bold text-slate-800 flex items-center">
            <Clock className="w-5 h-5 mr-2 text-indigo-500" />
            History Perubahan PPIC
          </h2>
          <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
            {changedPlans.length}
          </span>
        </div>

        <div className="flex-1 overflow-auto bg-slate-50/50 p-3 space-y-3">
          {changedPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-sm text-center px-4">
              <Info className="w-8 h-8 mb-2 text-slate-300" />
              <p>Belum ada rekaman perubahan Planning Style.</p>
            </div>
          ) : (
            paginatedPlans.map((plan, idx) => {
              const isSelected = selectedPlan === plan;
              const isWarning = planMacroImpactMap.get(plan) || false;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPlan(plan)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? isWarning 
                        ? "bg-red-500 border-2 border-white text-white shadow-lg shadow-red-500/40 ring-2 ring-red-500 animate-pulse"
                        : "bg-indigo-50 border border-indigo-300 shadow-sm ring-1 ring-indigo-300"
                      : isWarning
                        ? "bg-red-500 border-2 border-red-500 text-white hover:bg-red-600 shadow-md animate-pulse"
                        : "bg-white border border-slate-200 hover:border-indigo-300 hover:shadow-sm text-slate-800"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${isWarning ? 'bg-white/20 text-white' : 'bg-slate-800 text-white'}`}>
                        {plan.line}
                      </span>
                      <span className={`text-xs font-medium flex items-center ${isWarning ? 'text-red-100' : 'text-slate-500'}`}>
                        <Calendar className="w-3 h-3 mr-1" />
                        {formatDate(plan.date)}
                      </span>
                    </div>
                    {isWarning ? (
                      <AlertTriangle
                        className={`w-4 h-4 animate-pulse ${isSelected ? "text-white" : "text-white/80"}`}
                      />
                    ) : plan.isStyleChanged ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className={`text-xs line-through ${isWarning ? 'text-red-200' : 'text-slate-500'}`}>
                      {plan.historyDisplayStyle ||
                        plan.historyStyle ||
                        "Kosong"}
                    </div>
                    <div className={`flex items-center text-sm font-bold ${isWarning ? 'text-white' : 'text-slate-800'}`}>
                      <ArrowRight className={`w-3 h-3 mr-1.5 ${isWarning ? 'text-red-200' : 'text-emerald-500'}`} />
                      {plan.displayStyle || plan.style || "Kosong"}
                    </div>
                  </div>

                  <div className={`mt-3 text-[10px] flex items-center justify-between ${isWarning ? 'text-red-100' : 'text-slate-400'}`}>
                    <span>
                      Terjadi perubahan planning setelah tanggal:{" "}
                      {plan.snapshotDate || "Unknown"}
                    </span>
                    <ChevronRight
                      className={`w-4 h-4 ${isSelected ? (isWarning ? "text-white" : "text-indigo-500") : (isWarning ? "text-red-200" : "text-slate-300")}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        {changedPlans.length > itemsPerPage && (
          <div className="px-4 py-3 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-medium text-slate-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Right Column */}
      <div className="w-full md:w-2/3 flex flex-col gap-6 overflow-x-hidden min-w-0">
        {/* 1. Macro Factory Impact Table */}
        {factoryImpact && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 md:p-6 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <Activity className="w-5 h-5 mr-2 text-indigo-500" />
                  Dampak Makro Terhadap Kapasitas Pabrik
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Agregasi dampak dari{" "}
                  <strong>
                    {factoryImpact.totalStyleChanges} perubahan planning
                  </strong>{" "}
                  selama rentang waktu:
                  <span className="font-semibold text-slate-700 ml-1">
                    {factoryImpact.startDate} s/d {factoryImpact.endDate}
                  </span>
                </p>
              </div>

              {factoryImpact.hasNewShortage && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 flex items-center shadow-sm">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 shrink-0" />
                  <div>
                    <h4 className="text-xs font-bold text-red-800">
                      Peringatan Kritis: Terjadi Shortage Pabrik!
                    </h4>
                    <p className="text-[11px] text-red-600">
                      Perubahan style pada rentang waktu ini menyebabkan
                      shortage mesin.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Jenis Mesin</th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Tersedia
                    </th>
                    <th className="px-4 py-3 font-semibold text-center text-slate-500">
                      Kebutuhan Sebelum Perubahan Planning
                    </th>
                    <th className="px-4 py-3 font-semibold text-center text-indigo-600">
                      Kebutuhan Setelah Perubahan Planning
                    </th>
                    <th className="px-4 py-3 font-semibold text-center text-slate-500">
                      Gap Sebelum Perubahan
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Gap Setelah Perubahan
                    </th>
                    <th className="px-4 py-3 font-semibold text-center">
                      Status Akhir
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {factoryImpact.comparison.map((row, i) => {
                    let rowClass = "bg-white";
                    let statusText = "Aman";
                    let statusClass = "text-emerald-600 bg-emerald-50";

                    if (row.isNowShortage) {
                      rowClass = "bg-white";
                      statusText = "Jadi Shortage!";
                      statusClass = "text-red-600 font-bold";
                    } else if (row.isWorseShortage) {
                      rowClass = "bg-white";
                      statusText = "Makin Shortage";
                      statusClass = "text-red-600 font-bold";
                    } else if (row.newGap < 0) {
                      statusText = "Shortage (Tetap)";
                      statusClass = "text-orange-600 font-medium";
                    }

                    return (
                      <tr
                        key={i}
                        className={`${rowClass} transition-colors hover:bg-slate-50/50`}
                      >
                        <td className="px-4 py-4 font-medium text-slate-800">
                          {row.machine}
                        </td>
                        <td className="px-4 py-4 text-center font-medium text-slate-600 bg-slate-50/50 border-r border-slate-100">
                          {row.available}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-400">
                          {row.oldReq}
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-indigo-700 text-base">
                          {row.newReq}
                        </td>
                        <td className="px-4 py-4 text-center text-slate-500 border-l border-slate-100">
                          {row.oldGap}
                        </td>
                        <td
                          className={`px-4 py-4 text-center font-bold text-base ${row.newGap < 0 ? "text-red-600" : "text-emerald-600"}`}
                        >
                          {row.newGap}
                        </td>
                        <td className="px-4 py-4 text-center border-l border-slate-100 align-middle">
                          <div className={`text-xs text-center leading-tight mx-auto ${statusClass}`}>
                            {statusText}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 2. Detail Analysis per History Item */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h2 className="font-bold text-slate-800 flex items-center">
              <Activity className="w-5 h-5 mr-2 text-emerald-500" />
              Analisis Dampak Perubahan
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Menganalisis apakah perubahan style menyebabkan lonjakan kebutuhan
              mesin yang tidak terduga.
            </p>
          </div>

          <div className="flex-1 overflow-auto p-6">
            {!selectedPlan ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Activity className="w-12 h-12 mb-3 text-slate-200" />
                <p>
                  Pilih riwayat perubahan di sebelah kiri untuk melihat
                  dampaknya.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Context Header */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">
                      Perubahan Plan Perhitungan Kebutuhan Mesin{" "}
                      {selectedPlan.line} ({formatDate(selectedPlan.date)})
                    </h3>
                    <div className="flex items-center mt-2 text-xs text-slate-600 gap-2 flex-wrap">
                      <span className="bg-slate-200 px-2 py-1 rounded">
                        Lama:{" "}
                        <strong className="text-slate-700">
                          {selectedPlan.historyStyle || "Kosong"}
                        </strong>
                      </span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded">
                        Baru: <strong>{selectedPlan.style || "Kosong"}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                {!selectedPlan.isStyleChanged ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 flex items-start">
                    <Info className="w-6 h-6 text-blue-500 mr-3 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-blue-800 mb-1">
                        Aman, Hanya Penambahan/Pengurangan Style Planning
                      </h4>
                      <p className="text-xs text-blue-600 leading-relaxed">
                        Perubahan yang dilakukan oleh PPIC hanya sekadar
                        menambah atau mengurangi <strong>Planning Style</strong>
                        , tetapi tidak mengubah acuan{" "}
                        <strong>
                          Style yang digunakan dalam Perhitungan Kebutuhan Mesin
                        </strong>
                        . Oleh karena itu, kebutuhan mesin di pabrik sama sekali
                        tidak terdampak.
                      </p>
                    </div>
                  </div>
                ) : !impactAnalysis ||
                  impactAnalysis.comparison.length === 0 ? (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 flex items-start">
                    <AlertCircle className="w-6 h-6 text-slate-400 mr-3 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-700 mb-1">
                        Tidak Ada Data Kebutuhan
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Sistem tidak dapat membandingkan kebutuhan karena data
                        mesin untuk style ini belum terdaftar di database.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {impactAnalysis.hasCriticalImpact && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start shadow-sm">
                        <AlertTriangle className="w-6 h-6 text-amber-500 mr-3 shrink-0 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-bold text-amber-800 mb-1">
                            Peringatan: Kebutuhan Mesin Melonjak!
                          </h4>
                          <p className="text-xs text-amber-700 leading-relaxed">
                            Perubahan style ini menuntut{" "}
                            <strong>
                              mesin baru yang sebelumnya tidak disiapkan
                            </strong>{" "}
                            atau <strong>jumlah mesin tambahan</strong>. Periksa
                            tabel di bawah pada baris yang ditandai merah/kuning
                            untuk mengantisipasi <em>shortage</em>.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="px-4 py-3 font-semibold">
                              Jenis Mesin
                            </th>
                            <th className="px-4 py-3 font-semibold text-center">
                              Kebutuhan Lama
                            </th>
                            <th className="px-4 py-3 font-semibold text-center">
                              Kebutuhan Baru
                            </th>
                            <th className="px-4 py-3 font-semibold text-center">
                              Selisih
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {impactAnalysis.comparison.map((row, i) => {
                            let rowClass = "bg-white";
                            let diffClass = "text-slate-500";
                            let diffText = "Tetap";

                            if (row.isNew) {
                              rowClass = "bg-red-50";
                              diffClass = "text-red-600 font-bold";
                              diffText = `+${row.diff} (Mesin Baru)`;
                            } else if (row.isIncreased) {
                              rowClass = "bg-amber-50";
                              diffClass = "text-amber-600 font-bold";
                              diffText = `+${row.diff} (Nambah)`;
                            } else if (row.isDecreased) {
                              rowClass = "bg-emerald-50";
                              diffClass = "text-emerald-600 font-medium";
                              diffText = `${row.diff} (Berkurang)`;
                            }

                            return (
                              <tr
                                key={i}
                                className={`${rowClass} transition-colors hover:brightness-95`}
                              >
                                <td className="px-4 py-3 font-medium text-slate-800">
                                  {row.machine}
                                </td>
                                <td className="px-4 py-3 text-center text-slate-500">
                                  {row.oldReq || "-"}
                                </td>
                                <td className="px-4 py-3 text-center font-bold text-slate-800">
                                  {row.newReq || "-"}
                                </td>
                                <td
                                  className={`px-4 py-3 text-center text-xs ${diffClass}`}
                                >
                                  {diffText}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
