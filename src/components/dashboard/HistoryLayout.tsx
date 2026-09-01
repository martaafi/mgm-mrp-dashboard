import React, { useMemo, useState } from "react";
import { format, getISOWeek, getYear } from "date-fns";
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
  BarChart2,
  Filter,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  ProductionPlan,
  SnapshotRecord,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
} from "../../types/mrp";
import {
  calculateMachineRequirements,
  getAdjustedAvailabilityForDateRange,
} from "../../utils/mrpCalculations";

interface HistoryLayoutProps {
  snapshots: SnapshotRecord[];
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  rentalTrialRecords: RentalTrialRecord[];
}

export const HistoryLayout: React.FC<HistoryLayoutProps> = ({
  snapshots,
  plans,
  requirements,
  availabilities,
  rentalTrialRecords,
}) => {
  // Format date helper: YYYY-MM-DD -> DD MMM YYYY
  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return format(d, "dd MMM yyyy");
    } catch {
      return dateString;
    }
  };

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Filter snapshots: only those with changes, and planningDate >= today
  const rawChangedSnapshots = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return snapshots.filter((s) => {
      if (!s.isMachineStyleChanged && !s.isPlanningStyleChanged) return false;

      const planDate = new Date(s.planningDate);
      planDate.setHours(0, 0, 0, 0);
      return planDate >= today;
    });
  }, [snapshots]);

  // Sort snapshots by priority: Amber (machine style changed) > Blue (planning only), then by nearest date
  const changedSnapshots = useMemo(() => {
    return [...rawChangedSnapshots].sort((a, b) => {
      const aAmber = a.isMachineStyleChanged ? 1 : 2;
      const bAmber = b.isMachineStyleChanged ? 1 : 2;

      if (aAmber !== bAmber) return aAmber - bAmber;

      return (
        new Date(a.planningDate).getTime() - new Date(b.planningDate).getTime()
      );
    });
  }, [rawChangedSnapshots]);

  const [selectedSnapshot, setSelectedSnapshot] =
    useState<SnapshotRecord | null>(null);

  // Set initial selected snapshot after changedSnapshots is ready
  React.useEffect(() => {
    if (changedSnapshots.length > 0 && !selectedSnapshot) {
      setSelectedSnapshot(changedSnapshots[0]);
    }
  }, [changedSnapshots, selectedSnapshot]);

  const [currentPage, setCurrentPage] = useState(1);
  const [activeSubTab, setActiveSubTab] = useState<"makro" | "detail">("makro");
  const itemsPerPage = 50;

  const totalPages = Math.ceil(changedSnapshots.length / itemsPerPage);

  const paginatedSnapshots = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return changedSnapshots.slice(startIndex, startIndex + itemsPerPage);
  }, [changedSnapshots, currentPage]);

  // Calculate machine impact for selected snapshot item
  const impactAnalysis = useMemo(() => {
    if (!selectedSnapshot) return null;

    // If machine style didn't change, no machine impact
    if (
      !selectedSnapshot.isMachineStyleChanged ||
      !selectedSnapshot.lastMachineStyle
    ) {
      return { comparison: [], hasCriticalImpact: false };
    }

    const oldReqs = requirements.filter(
      (r) =>
        r.style === selectedSnapshot.lastMachineStyle && r.kebutuhanTotal > 0,
    );
    const newReqs = requirements.filter(
      (r) =>
        r.style === selectedSnapshot.updateMachineStyle && r.kebutuhanTotal > 0,
    );

    const machineTypes = new Set([
      ...oldReqs.map((r) => r.jenisMesin.trim().toLowerCase()),
      ...newReqs.map((r) => r.jenisMesin.trim().toLowerCase()),
    ]);

    const comparison = Array.from(machineTypes)
      .map((machineKey) => {
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
  }, [selectedSnapshot, requirements]);

  // Calculate Macro (Factory-wide) Impact
  const factoryImpact = useMemo(() => {
    if (!plans || plans.length === 0 || !selectedSnapshot) return null;

    const todayStr = getTodayStr();

    // Filter plans from today to the selected snapshot's planning date
    const impactPlans = plans.filter(
      (plan) =>
        plan.date >= todayStr && plan.date <= selectedSnapshot.planningDate,
    );

    if (impactPlans.length === 0) return null;

    // After scenario (Real/Current): Use current plan data
    const currentFactoryReqs = calculateMachineRequirements(
      impactPlans,
      requirements,
      availabilities,
    );

    // Before scenario (Hypothetical): Revert changed machine styles
    let totalStyleChanges = 0;
    const changedSnapshotsInRange = rawChangedSnapshots.filter(
      (s) =>
        s.planningDate >= todayStr &&
        s.planningDate <= selectedSnapshot.planningDate,
    );

    const hypotheticalPlans = impactPlans.map((p) => {
      const matchingSnapshot = changedSnapshotsInRange.find(
        (s) => s.planningDate === p.date && s.line === p.line,
      );

      if (matchingSnapshot) {
        if (
          matchingSnapshot.isMachineStyleChanged ||
          matchingSnapshot.isPlanningStyleChanged
        ) {
          totalStyleChanges++;
        }

        if (
          matchingSnapshot.isMachineStyleChanged &&
          matchingSnapshot.lastMachineStyle
        ) {
          return { ...p, style: matchingSnapshot.lastMachineStyle };
        }
      }
      return p;
    });

    const hypotheticalFactoryReqs = calculateMachineRequirements(
      hypotheticalPlans,
      requirements,
      availabilities,
    );

    // Compare machines across both scenarios
    const factoryComparison: any[] = [];
    let hasNewShortage = false;

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
        const getPriority = (row: any) => {
          if (row.isNowShortage || row.isWorseShortage) return 1;
          if (row.newGap < 0) return 2;
          return 3;
        };

        const priorityA = getPriority(a);
        const priorityB = getPriority(b);

        if (priorityA !== priorityB) {
          return priorityA - priorityB;
        }

        return a.newGap - b.newGap;
      }),
      hasNewShortage,
      totalStyleChanges,
      startDate: todayStr,
      endDate: selectedSnapshot.planningDate,
    };
  }, [
    plans,
    rawChangedSnapshots,
    selectedSnapshot,
    requirements,
    availabilities,
  ]);

  // === CHART: Weekly Comparison Data ===
  const [chartMachineFilter, setChartMachineFilter] = useState<string>("ALL");
  const [selectedChartWeek, setSelectedChartWeek] = useState<string | null>(
    null,
  );

  // Get all unique machine types from snapshots that have machine style changes
  const allChartMachineTypes = useMemo(() => {
    const machineSet = new Set<string>();
    snapshots.forEach((s) => {
      // Collect machines from both last and update styles
      const lastReqs = requirements.filter(
        (r) => r.style === s.lastMachineStyle,
      );
      const updateReqs = requirements.filter(
        (r) => r.style === s.updateMachineStyle,
      );
      lastReqs.forEach((r) => machineSet.add(r.jenisMesin));
      updateReqs.forEach((r) => machineSet.add(r.jenisMesin));
    });
    return Array.from(machineSet).sort();
  }, [snapshots, requirements]);

  // Helper: get ISO week label from a date string
  const getWeekLabel = (dateStr: string): string => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const week = getISOWeek(d);
      const year = getYear(d);
      return `W${week}-${year}`;
    } catch {
      return dateStr;
    }
  };

  // Build weekly comparison chart data
  // Logic: For each day, SUM machine requirements across all lines (simultaneous).
  //        For each week, take the MAX daily total (peak demand).
  const weeklyComparisonData = useMemo(() => {
    const todayStr = getTodayStr();

    // Only use snapshots from today onwards
    const futureSnapshots = snapshots.filter((s) => s.planningDate >= todayStr);
    if (futureSnapshots.length === 0) {
      return {
        chartData: [],
        alerts: [],
        lastVersionLabel: "Plan PPIC (Sebelum)",
        updateVersionLabel: "Plan PPIC (Sesudah)",
        lastWeekCode: "Sebelum",
        updateWeekCode: "Sesudah",
        lastSnapshotDateStr: "",
        updateSnapshotDateStr: "",
      };
    }

    const filterMachine = (r: MachineRequirementPerStyle) =>
      chartMachineFilter === "ALL" ||
      r.jenisMesin.toLowerCase() === chartMachineFilter.toLowerCase();

    // Step 1: Group snapshots by date, then sum requirements per day across all lines
    // Structure: { date -> { lastReq: number, updateReq: number } }
    const dailyMap: Record<string, { lastReq: number; updateReq: number }> = {};

    futureSnapshots.forEach((s) => {
      const date = s.planningDate;
      if (!dailyMap[date]) {
        dailyMap[date] = { lastReq: 0, updateReq: 0 };
      }

      const lastReqs = requirements.filter(
        (r) => r.style === s.lastMachineStyle,
      );
      const updateReqs = requirements.filter(
        (r) => r.style === s.updateMachineStyle,
      );

      const lastTotal = lastReqs
        .filter(filterMachine)
        .reduce((sum, r) => sum + r.kebutuhanTotal, 0);
      const updateTotal = updateReqs
        .filter(filterMachine)
        .reduce((sum, r) => sum + r.kebutuhanTotal, 0);

      dailyMap[date].lastReq += lastTotal;
      dailyMap[date].updateReq += updateTotal;
    });

    // Step 2: Group daily totals by week, take MAX per week
    const weekMap: Record<
      string,
      {
        lastReq: number;
        updateReq: number;
        available: number;
        shortageAlerts: {
          machine: string;
          type: "RED" | "ORANGE" | "SLATE";
          lastReq?: number;
          updateReq?: number;
          availCount?: number;
        }[];
      }
    > = {};

    Object.entries(dailyMap).forEach(([date, daily]) => {
      const weekLabel = getWeekLabel(date);
      if (!weekLabel) return;

      if (!weekMap[weekLabel]) {
        weekMap[weekLabel] = {
          lastReq: 0,
          updateReq: 0,
          available: 0,
          shortageAlerts: [],
        };
      }

      // Take the MAX daily value across all days in this week
      weekMap[weekLabel].lastReq = Math.max(
        weekMap[weekLabel].lastReq,
        daily.lastReq,
      );
      weekMap[weekLabel].updateReq = Math.max(
        weekMap[weekLabel].updateReq,
        daily.updateReq,
      );
    });

    // Step 3: Detect shortage alerts per week
    // For each week, check if update > last AND update > available for any machine
    const weekDates: Record<string, string[]> = {};
    Object.keys(dailyMap).forEach((date) => {
      const weekLabel = getWeekLabel(date);
      if (!weekLabel) return;
      if (!weekDates[weekLabel]) weekDates[weekLabel] = [];
      weekDates[weekLabel].push(date);
    });

    Object.entries(weekDates).forEach(([weekLabel, dates]) => {
      if (!weekMap[weekLabel]) return;

      // Find snapshots in this week that have machine style changes
      const weekSnapshots = futureSnapshots.filter(
        (s) => dates.includes(s.planningDate) && s.isMachineStyleChanged,
      );

      // Per-machine daily analysis for shortage detection
      const machineMaxUpdate: Record<string, number> = {};
      const machineMaxLast: Record<string, number> = {};

      dates.forEach((date) => {
        const daySnapshots = futureSnapshots.filter(
          (s) => s.planningDate === date,
        );
        const machineDayUpdate: Record<string, number> = {};
        const machineDayLast: Record<string, number> = {};

        daySnapshots.forEach((s) => {
          const updateReqs = requirements.filter(
            (r) => r.style === s.updateMachineStyle,
          );
          const lastReqs = requirements.filter(
            (r) => r.style === s.lastMachineStyle,
          );

          updateReqs.forEach((r) => {
            machineDayUpdate[r.jenisMesin] =
              (machineDayUpdate[r.jenisMesin] || 0) + r.kebutuhanTotal;
          });
          lastReqs.forEach((r) => {
            machineDayLast[r.jenisMesin] =
              (machineDayLast[r.jenisMesin] || 0) + r.kebutuhanTotal;
          });
        });

        // Take max across days for each machine
        Object.entries(machineDayUpdate).forEach(([machine, count]) => {
          machineMaxUpdate[machine] = Math.max(
            machineMaxUpdate[machine] || 0,
            count,
          );
        });
        Object.entries(machineDayLast).forEach(([machine, count]) => {
          machineMaxLast[machine] = Math.max(
            machineMaxLast[machine] || 0,
            count,
          );
        });
      });

      // Check if any machine is in shortage or became a shortage
      const minDate =
        dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : "";
      const maxDate =
        dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : "";

      const weeklyAvailabilities =
        minDate && maxDate
          ? getAdjustedAvailabilityForDateRange(
              minDate,
              maxDate,
              availabilities,
              rentalTrialRecords,
            )
          : availabilities;

      if (weekSnapshots.length > 0) {
        Object.entries(machineMaxUpdate).forEach(([machine, updateCount]) => {
          const lastCount = machineMaxLast[machine] || 0;
          const avail = weeklyAvailabilities.find(
            (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
          );
          const availCount = avail ? avail.jumlahMesin : 0;

          if (avail && updateCount > availCount) {
            let alertType = "";
            if (lastCount <= availCount) {
              alertType = "RED"; // Awalnya ga shortage, jadi shortage
            } else if (updateCount > lastCount) {
              alertType = "ORANGE"; // Shortage bertambah
            } else if (updateCount === lastCount) {
              alertType = "SLATE"; // Shortage tetap
            }

            if (alertType) {
              if (
                !weekMap[weekLabel].shortageAlerts.some(
                  (a) => a.machine === machine,
                )
              ) {
                weekMap[weekLabel].shortageAlerts.push({
                  machine,
                  type: alertType as "RED" | "ORANGE" | "SLATE",
                  lastReq: lastCount,
                  updateReq: updateCount,
                  availCount: availCount,
                });
              }
            }
          }
        });
      }
    });

    // Step 4: Available line for filtered machine or all machines
    const allRequiredMachinesForChart = new Set<string>();
    futureSnapshots.forEach((s) => {
      requirements
        .filter((r) => r.style === s.lastMachineStyle)
        .forEach((r) => allRequiredMachinesForChart.add(r.jenisMesin));
      requirements
        .filter((r) => r.style === s.updateMachineStyle)
        .forEach((r) => allRequiredMachinesForChart.add(r.jenisMesin));
    });

    Object.keys(weekMap).forEach((w) => {
      const dates = weekDates[w] || [];
      const minDate =
        dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : "";
      const maxDate =
        dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : "";

      const weeklyAvailabilities =
        minDate && maxDate
          ? getAdjustedAvailabilityForDateRange(
              minDate,
              maxDate,
              availabilities,
              rentalTrialRecords,
            )
          : availabilities;

      let availCount = 0;
      if (chartMachineFilter !== "ALL") {
        const avail = weeklyAvailabilities.find(
          (a) =>
            a.jenisMesin.toLowerCase() === chartMachineFilter.toLowerCase(),
        );
        availCount = avail ? avail.jumlahMesin : 0;
      } else {
        availCount = weeklyAvailabilities
          .filter((a) => allRequiredMachinesForChart.has(a.jenisMesin))
          .reduce((sum, a) => sum + (a.jumlahMesin || 0), 0);
      }
      weekMap[w].available = availCount;
    });

    // Step 5: Sort weeks and build output
    const sortedWeeks = Object.keys(weekMap).sort((a, b) => {
      const parseWeek = (w: string) => {
        const match = w.match(/W(\d+)-(\d+)/);
        if (!match) return 0;
        return parseInt(match[2]) * 100 + parseInt(match[1]);
      };
      return parseWeek(a) - parseWeek(b);
    });

    const chartData = sortedWeeks.map((w) => {
      // Do not filter shortage alerts by selected machine, always show all shortages
      const filteredAlerts = weekMap[w].shortageAlerts;

      return {
        week: w,
        lastPlan: weekMap[w].lastReq,
        updatePlan: weekMap[w].updateReq,
        available: weekMap[w].available,
        shortageAlerts: filteredAlerts,
      };
    });

    const alerts = chartData.filter((d) => d.shortageAlerts.length > 0);

    const targetSnap =
      selectedSnapshot ||
      futureSnapshots.find((s) => s.lastSnapshotDate || s.updateSnapshotDate) ||
      futureSnapshots.find((s) => s.lastVersion || s.updateVersion) ||
      futureSnapshots[0] ||
      snapshots.find((s) => s.lastSnapshotDate || s.updateSnapshotDate) ||
      snapshots[0];

    let lastVersionLabel = "Plan PPIC (Sebelum)";
    let updateVersionLabel = "Plan PPIC (Sesudah)";
    let lastWeekCode = "";
    let updateWeekCode = "";
    let lastSnapshotDateStr = "";
    let updateSnapshotDateStr = "";

    if (targetSnap) {
      const rawLast = (targetSnap.lastVersion || "").trim();
      const rawUpdate = (targetSnap.updateVersion || "").trim();

      const cleanLast = rawLast.split("-")[0].trim();
      const cleanUpdate = rawUpdate.split("-")[0].trim();

      const lastW = cleanLast
        ? cleanLast.toUpperCase().startsWith("W")
          ? cleanLast
          : `W${cleanLast}`
        : "";
      const updateW = cleanUpdate
        ? cleanUpdate.toUpperCase().startsWith("W")
          ? cleanUpdate
          : `W${cleanUpdate}`
        : "";

      if (lastW) lastVersionLabel = `by Plan PPIC ${lastW}`;
      if (updateW) updateVersionLabel = `by Plan PPIC ${updateW}`;
      lastWeekCode = lastW;
      updateWeekCode = updateW;

      const snapWithLastDate = snapshots.find((s) => s.lastSnapshotDate);
      const snapWithUpdateDate = snapshots.find((s) => s.updateSnapshotDate);

      const rawLastDate =
        targetSnap.lastSnapshotDate || snapWithLastDate?.lastSnapshotDate || "";
      const rawUpdateDate =
        targetSnap.updateSnapshotDate ||
        snapWithUpdateDate?.updateSnapshotDate ||
        "";

      if (rawLastDate) lastSnapshotDateStr = formatDate(rawLastDate);
      if (rawUpdateDate) updateSnapshotDateStr = formatDate(rawUpdateDate);
    }

    return {
      chartData,
      alerts,
      lastVersionLabel,
      updateVersionLabel,
      lastWeekCode: lastWeekCode || "Sebelum",
      updateWeekCode: updateWeekCode || "Sesudah",
      lastSnapshotDateStr,
      updateSnapshotDateStr,
    };
  }, [
    snapshots,
    requirements,
    availabilities,
    chartMachineFilter,
    selectedSnapshot,
    rentalTrialRecords,
  ]);

  // Auto-select first week when chart data is available
  React.useEffect(() => {
    if (weeklyComparisonData.chartData.length > 0 && !selectedChartWeek) {
      setSelectedChartWeek(weeklyComparisonData.chartData[0].week);
    }
  }, [weeklyComparisonData.chartData, selectedChartWeek]);

  // Compute per-machine breakdown for the selected week
  const selectedWeekMachineData = useMemo(() => {
    if (!selectedChartWeek) return [];

    const todayStr = getTodayStr();
    const futureSnapshots = snapshots.filter((s) => s.planningDate >= todayStr);

    // Get unique dates in the selected week
    const weekDates = [
      ...new Set(
        futureSnapshots
          .map((s) => s.planningDate)
          .filter((date) => getWeekLabel(date) === selectedChartWeek),
      ),
    ];

    if (weekDates.length === 0) return [];

    // For each date, compute per-machine requirements (sum across all lines)
    // Then take MAX across days in the week
    const machineMaxLast: Record<string, number> = {};
    const machineMaxUpdate: Record<string, number> = {};

    weekDates.forEach((date) => {
      const daySnapshots = futureSnapshots.filter(
        (s) => s.planningDate === date,
      );
      const machineDayLast: Record<string, number> = {};
      const machineDayUpdate: Record<string, number> = {};

      daySnapshots.forEach((s) => {
        const lastReqs = requirements.filter(
          (r) => r.style === s.lastMachineStyle,
        );
        const updateReqs = requirements.filter(
          (r) => r.style === s.updateMachineStyle,
        );

        lastReqs.forEach((r) => {
          machineDayLast[r.jenisMesin] =
            (machineDayLast[r.jenisMesin] || 0) + r.kebutuhanTotal;
        });
        updateReqs.forEach((r) => {
          machineDayUpdate[r.jenisMesin] =
            (machineDayUpdate[r.jenisMesin] || 0) + r.kebutuhanTotal;
        });
      });

      Object.entries(machineDayLast).forEach(([machine, count]) => {
        machineMaxLast[machine] = Math.max(machineMaxLast[machine] || 0, count);
      });
      Object.entries(machineDayUpdate).forEach(([machine, count]) => {
        machineMaxUpdate[machine] = Math.max(
          machineMaxUpdate[machine] || 0,
          count,
        );
      });
    });

    const minDate =
      weekDates.length > 0 ? weekDates.reduce((a, b) => (a < b ? a : b)) : "";
    const maxDate =
      weekDates.length > 0 ? weekDates.reduce((a, b) => (a > b ? a : b)) : "";

    const weeklyAvailabilities =
      minDate && maxDate
        ? getAdjustedAvailabilityForDateRange(
            minDate,
            maxDate,
            availabilities,
            rentalTrialRecords,
          )
        : availabilities;

    // Build per-machine comparison
    const allMachines = new Set([
      ...Object.keys(machineMaxLast),
      ...Object.keys(machineMaxUpdate),
    ]);

    return Array.from(allMachines)
      .map((machine) => {
        const lastReq = machineMaxLast[machine] || 0;
        const updateReq = machineMaxUpdate[machine] || 0;
        const available =
          weeklyAvailabilities.find(
            (a) => a.jenisMesin.toLowerCase() === machine.toLowerCase(),
          )?.jumlahMesin || 0;

        const oldGap = available - lastReq;
        const newGap = available - updateReq;

        const isNowShortage = newGap < 0 && oldGap >= 0;
        const isWorseShortage = newGap < 0 && oldGap < 0 && newGap < oldGap;

        return {
          machine,
          available,
          lastReq,
          updateReq,
          oldGap,
          newGap,
          isNowShortage,
          isWorseShortage,
        };
      })
      .sort((a, b) => {
        const getPriority = (row: any) => {
          if (row.isNowShortage || row.isWorseShortage) return 1;
          if (row.newGap < 0) return 2;
          return 3;
        };
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pA - pB;
        return a.newGap - b.newGap;
      });
  }, [
    selectedChartWeek,
    snapshots,
    requirements,
    availabilities,
    rentalTrialRecords,
  ]);

  // Custom dot renderer for shortage alerts
  const renderAlertDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (
      !payload ||
      !payload.shortageAlerts ||
      payload.shortageAlerts.length === 0
    ) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={4}
          fill="#3b82f6"
          stroke="#fff"
          strokeWidth={2}
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            if (payload?.week) setSelectedChartWeek(payload.week);
          }}
        />
      );
    }

    const hasRed = payload.shortageAlerts.some((a: any) => a.type === "RED");
    const hasOrange = payload.shortageAlerts.some((a: any) => a.type === "ORANGE");
    
    let color = "#94a3b8"; // Default slate (Shortage Tetap)
    if (hasRed) color = "#ef4444";
    else if (hasOrange) color = "#eab308";

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={color}
        stroke="#fff"
        strokeWidth={2}
        style={{ cursor: "pointer" }}
        onClick={(e) => {
          e.stopPropagation();
          if (payload?.week) setSelectedChartWeek(payload.week);
        }}
      />
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-8 h-full min-h-[500px]">
      {/* Sub-tabs Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-2 transition-colors">
        <nav className="flex space-x-1 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg backdrop-blur-sm w-fit transition-colors">
          <button
            onClick={() => setActiveSubTab("makro")}
            className={`px-4 sm:px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeSubTab === "makro"
                ? "bg-emerald-500 text-white shadow-md ring-1 ring-emerald-600/50"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            Dampak Perubahan Planning
          </button>
          <button
            onClick={() => setActiveSubTab("detail")}
            className={`px-4 sm:px-6 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
              activeSubTab === "detail"
                ? "bg-emerald-500 text-white shadow-md ring-1 ring-emerald-600/50"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-800/50"
            }`}
          >
            Detail Perubahan Planning
          </button>
        </nav>
      </div>

      <div className="flex flex-col md:flex-row gap-6 items-start h-full w-full">
        {activeSubTab === "detail" && (
          <>
            {/* Left Column: List of Changes */}
            <div className="w-full md:w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden sticky top-6 max-h-[calc(100vh-2rem)] transition-colors">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between transition-colors">
                <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                  History Perubahan PPIC
                </h2>
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  {changedSnapshots.length}
                </span>
              </div>

              <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50 p-3 space-y-3 transition-colors [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                {changedSnapshots.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 dark:text-slate-400 text-sm text-center px-4">
                    <Info className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                    <p>Belum ada rekaman perubahan Planning Style.</p>
                  </div>
                ) : (
                  paginatedSnapshots.map((snapshot, idx) => {
                    const isSelected = selectedSnapshot === snapshot;
                    const isMachineChange = !!snapshot.isMachineStyleChanged;

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedSnapshot(snapshot)}
                        className={`p-4 rounded-xl cursor-pointer transition-all ${
                          isSelected
                            ? isMachineChange
                              ? "bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-400 dark:border-amber-500 shadow-sm ring-1 ring-amber-300 dark:ring-amber-600"
                              : "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700 shadow-sm ring-1 ring-indigo-300 dark:ring-indigo-700"
                            : isMachineChange
                              ? "bg-amber-50/50 dark:bg-amber-900/10 border border-amber-300 dark:border-amber-700 hover:border-amber-400 dark:hover:border-amber-500 hover:shadow-sm"
                              : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-sm text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-slate-800 dark:bg-slate-700 text-white">
                              {snapshot.line}
                            </span>
                            <span className="text-xs font-medium flex items-center text-slate-500 dark:text-slate-400">
                              <Calendar className="w-3 h-3 mr-1" />
                              {formatDate(snapshot.planningDate)}
                            </span>
                          </div>
                          {isMachineChange ? (
                            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                          ) : (
                            <Info className="w-4 h-4 text-blue-400" />
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="text-xs line-through text-slate-500 dark:text-slate-400">
                            {snapshot.lastPlanningStyle || "Kosong"}
                          </div>
                          <div className="flex items-center text-sm font-bold text-slate-800 dark:text-slate-200">
                            <ArrowRight className="w-3 h-3 mr-1.5 text-emerald-500" />
                            {snapshot.updatePlanningStyle || "Kosong"}
                          </div>
                        </div>

                        <div className="mt-3 text-[10px] flex items-center justify-between text-slate-400 dark:text-slate-500">
                          <span>
                            Snapshot: {snapshot.lastVersion || "?"} →{" "}
                            {snapshot.updateVersion || "?"}
                          </span>
                          <ChevronRight
                            className={`w-4 h-4 ${isSelected ? "text-indigo-500 dark:text-indigo-400" : "text-slate-300 dark:text-slate-600"}`}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Pagination Footer */}
              {changedSnapshots.length > itemsPerPage && (
                <div className="px-4 py-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 transition-colors">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="p-1 rounded text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* --- DETAIL CONTENT (RIGHT COLUMN) --- */}

            <div className="w-full md:w-2/3 flex flex-col gap-6 overflow-x-hidden min-w-0">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col overflow-hidden shrink-0 transition-colors">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 transition-colors">
                  <h2 className="font-bold text-slate-800 dark:text-slate-100 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-emerald-500 dark:text-emerald-400" />
                    Detail Perubahan Kebutuhan Mesin
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Menganalisis apakah perubahan planning style menyebabkan
                    lonjakan kebutuhan mesin yang signifikan
                  </p>
                </div>

                <div className="flex-1 overflow-auto p-6">
                  {!selectedSnapshot ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500">
                      <Activity className="w-12 h-12 mb-3 text-slate-200 dark:text-slate-700" />
                      <p>
                        Pilih riwayat perubahan di sebelah kiri untuk melihat
                        dampaknya.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Context Header */}
                      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between transition-colors">
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                            Perubahan Plan Perhitungan Kebutuhan Mesin{" "}
                            {selectedSnapshot.line} (
                            {formatDate(selectedSnapshot.planningDate)})
                          </h3>
                          <div className="flex items-center mt-2 text-xs text-slate-600 dark:text-slate-400 gap-2 flex-wrap">
                            <span className="bg-slate-200 dark:bg-slate-700 px-2 py-1 rounded">
                              Lama:{" "}
                              <strong className="text-slate-700 dark:text-slate-300">
                                {selectedSnapshot.lastMachineStyle || "Kosong"}
                              </strong>
                            </span>
                            <ArrowRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                            <span className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-400 px-2 py-1 rounded">
                              Baru:{" "}
                              <strong>
                                {selectedSnapshot.updateMachineStyle ||
                                  "Kosong"}
                              </strong>
                            </span>
                          </div>
                        </div>
                      </div>

                      {!selectedSnapshot.isMachineStyleChanged ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-5 flex items-start">
                          <Info className="w-6 h-6 text-blue-500 dark:text-blue-400 mr-3 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                              Aman, Hanya Penambahan/Pengurangan Style Planning
                            </h4>
                            <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                              Perubahan yang dilakukan oleh PPIC hanya sekadar
                              menambah atau mengurangi{" "}
                              <strong>Planning Style</strong>, tetapi tidak
                              mengubah acuan{" "}
                              <strong>
                                Style yang digunakan dalam Perhitungan Kebutuhan
                                Mesin
                              </strong>
                              . Oleh karena itu, kebutuhan mesin di pabrik sama
                              sekali tidak terdampak.
                            </p>
                          </div>
                        </div>
                      ) : !impactAnalysis ||
                        impactAnalysis.comparison.length === 0 ? (
                        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-5 flex items-start">
                          <AlertCircle className="w-6 h-6 text-slate-400 dark:text-slate-500 mr-3 shrink-0 mt-0.5" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">
                              Tidak Ada Data Kebutuhan
                            </h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                              Sistem tidak dapat membandingkan kebutuhan karena
                              data mesin untuk style ini belum terdaftar di
                              database.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {impactAnalysis.hasCriticalImpact && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 flex items-center shadow-sm">
                              <AlertTriangle className="w-6 h-6 text-amber-500 dark:text-amber-400 mr-4 shrink-0" />
                              <div>
                                <h4 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-1">
                                  Peringatan: Kebutuhan Mesin Melonjak!
                                </h4>
                                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                  Perubahan style ini membutuhkan{" "}
                                  <strong>
                                    mesin baru yang sebelumnya tidak disiapkan
                                  </strong>{" "}
                                  atau <strong>jumlah mesin tambahan</strong>.
                                  Periksa tabel di bawah pada baris yang
                                  ditandai merah/kuning untuk mengantisipasi{" "}
                                  <em>shortage</em>.
                                </p>
                              </div>
                            </div>
                          )}

                          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm transition-colors">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 transition-colors">
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
                              <tbody className="divide-y divide-slate-200 dark:divide-slate-700 transition-colors">
                                {impactAnalysis.comparison.map((row, i) => {
                                  let rowClass = "bg-white dark:bg-slate-900";
                                  let diffClass =
                                    "text-slate-500 dark:text-slate-400";
                                  let diffText = "Tetap";

                                  if (row.isNew) {
                                    rowClass = "bg-red-50 dark:bg-red-900/30";
                                    diffClass =
                                      "text-red-600 dark:text-red-400 font-bold";
                                    diffText = `+${row.diff} (Mesin Baru)`;
                                  } else if (row.isIncreased) {
                                    rowClass =
                                      "bg-amber-50 dark:bg-amber-900/30";
                                    diffClass =
                                      "text-amber-600 dark:text-amber-400 font-bold";
                                    diffText = `+${row.diff} (Bertambah)`;
                                  } else if (row.isDecreased) {
                                    rowClass =
                                      "bg-emerald-50 dark:bg-emerald-900/30";
                                    diffClass =
                                      "text-emerald-600 dark:text-emerald-400 font-medium";
                                    diffText = `${row.diff} (Berkurang)`;
                                  }

                                  return (
                                    <tr
                                      key={i}
                                      className={`${rowClass} transition-colors hover:brightness-95`}
                                    >
                                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                                        {row.machine}
                                      </td>
                                      <td className="px-4 py-3 text-center text-slate-500 dark:text-slate-400">
                                        {row.oldReq || "-"}
                                      </td>
                                      <td className="px-4 py-3 text-center font-bold text-slate-800 dark:text-slate-200">
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
          </>
        )}
        {/* --- MAKRO CONTENT --- */}
        {activeSubTab === "makro" && (
          <div className="w-full flex flex-col gap-6 overflow-x-hidden min-w-0">
            {/* 1. Macro Factory Impact Table */}
            {factoryImpact && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-5 md:p-6 shrink-0 transition-colors">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
                      <Activity className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                      Dampak Perubahan Plan PPIC Terhadap Kebutuhan Mesin
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                      Menampilkan perubahan kebutuhan mesin berdasarkan
                      perubahan planning PPIC dari
                      <span className="font-semibold text-slate-700 dark:text-slate-300 mx-1">
                        {weeklyComparisonData.lastWeekCode}
                        {weeklyComparisonData.lastSnapshotDateStr && (
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                            ({weeklyComparisonData.lastSnapshotDateStr})
                          </span>
                        )}
                      </span>
                      ke
                      <span className="font-semibold text-slate-700 dark:text-slate-300 mx-1">
                        {weeklyComparisonData.updateWeekCode}
                        {weeklyComparisonData.updateSnapshotDateStr && (
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                            ({weeklyComparisonData.updateSnapshotDateStr})
                          </span>
                        )}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Weekly Comparison Chart */}
                {weeklyComparisonData.chartData.length > 0 && (
                  <div className="mb-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center">
                        <BarChart2 className="w-5 h-5 mr-2 text-indigo-500 dark:text-indigo-400" />
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Perbandingan Kebutuhan Mesin per Minggu
                        </h4>
                      </div>
                      <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-slate-400" />
                        <select
                          value={chartMachineFilter}
                          onChange={(e) =>
                            setChartMachineFilter(e.target.value)
                          }
                          className="text-xs border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors"
                        >
                          <option value="ALL">Semua Jenis Mesin</option>
                          {allChartMachineTypes.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {weeklyComparisonData.alerts.length > 0 && (
                      <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 mb-4 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                        <div className="text-xs text-slate-700 dark:text-slate-300 w-full">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <span className="font-bold">Shortage Alerts:</span>
                            <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-400"></span>{" "}
                                Tidak Shortage → Menjadi Shortage
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-orange-400"></span>{" "}
                                Shortage Bertambah
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-slate-400"></span>{" "}
                                Shortage Tetap
                              </span>
                            </div>
                          </div>
                          <div className="grid grid-rows-5 grid-flow-col gap-x-3 gap-y-1.5 overflow-x-auto pb-1 justify-start items-start">
                            {weeklyComparisonData.alerts.map((a, i) => (
                              <div key={i}>
                                <strong>{a.week.split("-")[0]}</strong>:{" "}
                                {a.shortageAlerts.map(
                                  (alert: any, j: number) => (
                                    <span
                                      key={j}
                                      title={`Before: ${alert.lastReq}, After: ${alert.updateReq} (Kapasitas: ${alert.availCount})`}
                                      className={`inline-block mr-1.5 mb-1.5 px-2 py-1 rounded text-[10px] font-semibold border cursor-help ${
                                        alert.type === "RED"
                                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800/50"
                                          : alert.type === "ORANGE"
                                            ? "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/50"
                                            : "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                                      }`}
                                    >
                                      {alert.machine}
                                    </span>
                                  ),
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4 transition-colors">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart
                          data={weeklyComparisonData.chartData}
                          margin={{ top: 35, right: 30, left: 10, bottom: 5 }}
                          onClick={(e: any) => {
                            if (!e) return;
                            if (e.activePayload && e.activePayload.length > 0) {
                              setSelectedChartWeek(
                                e.activePayload[0].payload.week,
                              );
                            } else if (e.activeLabel) {
                              setSelectedChartWeek(e.activeLabel);
                            } else if (
                              typeof e.activeTooltipIndex === "number" &&
                              weeklyComparisonData.chartData[
                                e.activeTooltipIndex
                              ]
                            ) {
                              setSelectedChartWeek(
                                weeklyComparisonData.chartData[
                                  e.activeTooltipIndex
                                ].week,
                              );
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        >
                          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                          <XAxis
                            dataKey="week"
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            tickFormatter={(val) => String(val).split("-")[0]}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: "#94a3b8" }}
                            axisLine={{ stroke: "#e2e8f0" }}
                            label={{
                              value: "Jumlah Mesin",
                              angle: -90,
                              position: "insideLeft",
                              style: { fontSize: 11, fill: "#94a3b8" },
                            }}
                          />
                          <Tooltip
                            content={({ active, payload, label }: any) => {
                              if (active && payload && payload.length) {
                                const weekLabel = String(label).split("-")[0];

                                return (
                                  <div className="bg-slate-900/95 border border-indigo-500/30 rounded-lg p-3 text-xs text-slate-200 shadow-xl backdrop-blur-sm">
                                    <p className="font-bold mb-2 text-white">
                                      {weekLabel}
                                    </p>
                                    {payload.map((p: any, index: number) => {
                                      const labels: Record<string, string> = {
                                        lastPlan:
                                          weeklyComparisonData.lastVersionLabel,
                                        updatePlan:
                                          weeklyComparisonData.updateVersionLabel,
                                        available: "Tersedia",
                                      };
                                      return (
                                        <p
                                          key={index}
                                          className="my-1 font-medium"
                                          style={{ color: p.color }}
                                        >
                                          {labels[p.dataKey] || p.dataKey} :{" "}
                                          {p.value}
                                        </p>
                                      );
                                    })}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="lastPlan"
                            stroke="#ec4899"
                            strokeWidth={2.5}
                            dot={(dotProps: any) => {
                              const { cx, cy, payload } = dotProps;
                              return (
                                <circle
                                  key={`last-dot-${dotProps.key || cx}-${cy}`}
                                  cx={cx}
                                  cy={cy}
                                  r={3.5}
                                  fill="#ec4899"
                                  stroke="#fff"
                                  strokeWidth={1}
                                  style={{ cursor: "pointer" }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (payload?.week)
                                      setSelectedChartWeek(payload.week);
                                  }}
                                />
                              );
                            }}
                            activeDot={{
                              r: 6,
                              stroke: "#ec4899",
                              strokeWidth: 2,
                              onClick: (_: any, event: any) => {
                                const data = event?.payload;
                                if (data?.week) setSelectedChartWeek(data.week);
                              },
                            }}
                            name="lastPlan"
                          />
                          <Line
                            type="monotone"
                            dataKey="updatePlan"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            dot={renderAlertDot}
                            activeDot={{
                              r: 6,
                              stroke: "#3b82f6",
                              strokeWidth: 2,
                              onClick: (_: any, event: any) => {
                                const data = event?.payload;
                                if (data?.week) setSelectedChartWeek(data.week);
                              },
                            }}
                            name="updatePlan"
                          />
                          <Line
                            type="monotone"
                            dataKey="available"
                            stroke="#ef4444"
                            strokeWidth={2}
                            strokeDasharray="4 4"
                            dot={false}
                            name="available"
                          />
                        </LineChart>
                      </ResponsiveContainer>

                      <div className="flex items-center justify-center gap-4 mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-0.5 bg-pink-500 inline-block" />
                          {weeklyComparisonData.lastVersionLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-4 h-0.5 bg-blue-500 inline-block" />
                          {weeklyComparisonData.updateVersionLabel}
                        </span>
                        <span className="flex items-center gap-1">
                          <span
                            className="w-4 h-0.5 inline-block"
                            style={{ borderTop: "2px dashed #ef4444" }}
                          />
                          Ketersediaan Mesin
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
                          Tidak Shortage → Menjadi Shortage
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-orange-500 rounded-full inline-block" />
                          Shortage Bertambah
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 bg-slate-400 rounded-full inline-block" />
                          Shortage Tetap
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Week selector dropdown */}
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Detail Minggu:
                  </span>
                  <select
                    value={selectedChartWeek || ""}
                    onChange={(e) => setSelectedChartWeek(e.target.value)}
                    className="text-xs font-semibold border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-colors cursor-pointer shadow-sm"
                  >
                    {weeklyComparisonData.chartData.map((d) => {
                      const weekShort = String(d.week).split("-")[0];
                      const hasAlert =
                        d.shortageAlerts && d.shortageAlerts.length > 0;
                      return (
                        <option key={d.week} value={d.week}>
                          {weekShort} {hasAlert ? "⚠️ (Ada Shortage)" : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {selectedChartWeek && selectedWeekMachineData.length > 0 ? (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden shadow-sm overflow-x-auto transition-colors">
                    <table className="w-full min-w-[760px] text-sm text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 transition-colors">
                        <tr>
                          <th className="px-4 py-3 font-semibold whitespace-nowrap min-w-[160px]">
                            Jenis Mesin
                          </th>
                          <th className="px-4 py-3 font-semibold text-center text-red-600 dark:text-red-400 whitespace-nowrap min-w-[80px]">
                            Tersedia
                          </th>
                          <th className="px-4 py-3 font-semibold text-center text-pink-600 dark:text-pink-400 min-w-[150px]">
                            <div>Kebutuhan</div>
                            <div className="text-[10px] font-normal whitespace-nowrap opacity-85 mt-0.5">
                              ({weeklyComparisonData.lastVersionLabel})
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center text-blue-600 dark:text-blue-400 min-w-[150px]">
                            <div>Kebutuhan</div>
                            <div className="text-[10px] font-normal whitespace-nowrap opacity-85 mt-0.5">
                              ({weeklyComparisonData.updateVersionLabel})
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center text-slate-500 dark:text-slate-400 min-w-[150px]">
                            <div>Gap</div>
                            <div className="text-[10px] font-normal whitespace-nowrap opacity-85 mt-0.5">
                              ({weeklyComparisonData.lastVersionLabel})
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center min-w-[150px]">
                            <div>Gap</div>
                            <div className="text-[10px] font-normal whitespace-nowrap opacity-85 mt-0.5">
                              ({weeklyComparisonData.updateVersionLabel})
                            </div>
                          </th>
                          <th className="px-4 py-3 font-semibold text-center whitespace-nowrap min-w-[110px]">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-700 transition-colors">
                        {selectedWeekMachineData.map((row, i) => {
                          let statusText = "OK";
                          let statusClass =
                            "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30";

                          if (row.isNowShortage) {
                            statusText = "Menjadi Shortage!";
                            statusClass =
                              "text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/30";
                          } else if (row.isWorseShortage) {
                            statusText = "Shortage Bertambah";
                            statusClass =
                              "text-red-600 dark:text-red-400 font-bold bg-red-50 dark:bg-red-900/30";
                          } else if (row.newGap < 0 && row.oldGap < 0) {
                            statusText = "Shortage Tetap";
                            statusClass =
                              "text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/30";
                          } else if (row.newGap < 0) {
                            statusText = "Shortage";
                            statusClass =
                              "text-orange-600 dark:text-orange-400 font-medium bg-orange-50 dark:bg-orange-900/30";
                          }

                          return (
                            <tr
                              key={i}
                              className="bg-white dark:bg-slate-900 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/50"
                            >
                              <td className="px-4 py-4 font-medium text-slate-800 dark:text-slate-200 whitespace-nowrap">
                                {row.machine}
                              </td>
                              <td className="px-4 py-4 text-center font-medium text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-800/30 border-r border-slate-100 dark:border-slate-800 transition-colors whitespace-nowrap">
                                {row.available}
                              </td>
                              <td className="px-4 py-4 text-center text-pink-600 dark:text-pink-400 whitespace-nowrap">
                                {row.lastReq}
                              </td>
                              <td className="px-4 py-4 text-center font-bold text-indigo-700 dark:text-indigo-400 text-base whitespace-nowrap">
                                {row.updateReq}
                              </td>
                              <td className="px-4 py-4 text-center text-slate-500 dark:text-slate-400 border-l border-slate-100 dark:border-slate-800 transition-colors whitespace-nowrap">
                                {row.oldGap}
                              </td>
                              <td
                                className={`px-4 py-4 text-center font-bold text-base whitespace-nowrap ${row.newGap < 0 ? "text-red-600 dark:text-red-500" : "text-emerald-600 dark:text-emerald-500"}`}
                              >
                                {row.newGap}
                              </td>
                              <td className="px-4 py-4 text-center border-l border-slate-100 dark:border-slate-800 transition-colors align-middle whitespace-nowrap">
                                <div
                                  className={`text-xs text-center leading-tight mx-auto px-2 py-1 rounded-md whitespace-nowrap ${statusClass}`}
                                >
                                  {statusText}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 dark:bg-slate-800/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                        <tr>
                          <td className="px-4 py-4 text-slate-800 dark:text-slate-200 whitespace-nowrap text-left uppercase tracking-wider text-xs">
                            Total
                          </td>
                          <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {selectedWeekMachineData.reduce(
                              (acc, r) => acc + r.available,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-4 text-center text-pink-700 dark:text-pink-400 whitespace-nowrap">
                            {selectedWeekMachineData.reduce(
                              (acc, r) => acc + r.lastReq,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-4 text-center text-indigo-700 dark:text-indigo-400 whitespace-nowrap text-base">
                            {selectedWeekMachineData.reduce(
                              (acc, r) => acc + r.updateReq,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-400 whitespace-nowrap border-l border-slate-100 dark:border-slate-800">
                            {selectedWeekMachineData.reduce(
                              (acc, r) => acc + r.oldGap,
                              0,
                            )}
                          </td>
                          <td
                            className={`px-4 py-4 text-center whitespace-nowrap text-base ${
                              selectedWeekMachineData.reduce(
                                (acc, r) => acc + r.newGap,
                                0,
                              ) < 0
                                ? "text-red-600 dark:text-red-500"
                                : "text-emerald-600 dark:text-emerald-500"
                            }`}
                          >
                            {selectedWeekMachineData.reduce(
                              (acc, r) => acc + r.newGap,
                              0,
                            )}
                          </td>
                          <td className="px-4 py-4 border-l border-slate-100 dark:border-slate-800"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : selectedChartWeek ? (
                  <div className="text-center py-8 text-sm text-slate-400 dark:text-slate-500">
                    Tidak ada data mesin pada{" "}
                    {String(selectedChartWeek).split("-")[0]}.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default HistoryLayout;
