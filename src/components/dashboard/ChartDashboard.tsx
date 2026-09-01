import React, { useMemo, useState } from "react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
  RentalTrialRecord,
  InventoryRecord,
  FilterState,
} from "../../types/mrp";
import {
  getGapTrendData,
  getStyleShortagesData,
  getMachineShortagesData,
  calculateMachineRequirements,
} from "../../utils/mrpCalculations";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  LabelList,
} from "recharts";
import {
  AlertCircle,
  Info,
  PieChart as PieChartIcon,
  Clock,
  Cpu,
  TrendingUp,
  Activity,
  AlertTriangle,
} from "lucide-react";

interface ChartDashboardProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
  rentalTrialRecords: RentalTrialRecord[];
  inventoryRecords: InventoryRecord[];
  filters?: FilterState;
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-red-600 bg-red-100 font-mono text-sm whitespace-pre-wrap">
          <h2>Chart Dashboard Error:</h2>
          {this.state.error && this.state.error.toString()}
          <br />
          {this.state.error && this.state.error.stack}
        </div>
      );
    }
    return this.props.children;
  }
}

const AGE_BRACKETS = [
  { label: "< 1 tahun", min: 0, max: 11, color: "#10b981" },
  { label: "1 - 2 tahun", min: 12, max: 23, color: "#22d3ee" },
  { label: "2 - 5 tahun", min: 24, max: 59, color: "#f59e0b" },
  { label: "5 - 10 tahun", min: 60, max: 119, color: "#f97316" },
  { label: "> 10 tahun", min: 120, max: Infinity, color: "#ef4444" },
];

const formatMonthsToLabel = (months: number): string => {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} bln`;
  if (remainingMonths === 0) return `${years} thn`;
  return `${years} thn ${remainingMonths} bln`;
};

const MachineAgeSection: React.FC<{ inventoryRecords: InventoryRecord[] }> = ({
  inventoryRecords,
}) => {
  const stats = useMemo(() => {
    const total = inventoryRecords.length;
    if (total === 0) return null;

    const allMonths = inventoryRecords.map((r) => r.umurBulan);
    const avgMonths = Math.round(allMonths.reduce((a, b) => a + b, 0) / total);
    const maxMonths = Math.max(...allMonths);
    const oldest = inventoryRecords.find((r) => r.umurBulan === maxMonths);
    const oldCount = inventoryRecords.filter((r) => r.umurBulan >= 60).length;

    return { total, avgMonths, maxMonths, oldest, oldCount };
  }, [inventoryRecords]);

  const ageDistribution = useMemo(() => {
    return AGE_BRACKETS.map((bracket) => ({
      ...bracket,
      count: inventoryRecords.filter(
        (r) => r.umurBulan >= bracket.min && r.umurBulan <= bracket.max,
      ).length,
    }));
  }, [inventoryRecords]);

  const avgAgePerType = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    inventoryRecords.forEach((r) => {
      const key = r.helperJenis.toUpperCase();
      const existing = map.get(key);
      if (existing) {
        existing.total += r.umurBulan;
        existing.count++;
      } else {
        map.set(key, { total: r.umurBulan, count: 1 });
      }
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        avgMonths: Math.round(data.total / data.count),
        count: data.count,
      }))
      .sort((a, b) => b.avgMonths - a.avgMonths);
  }, [inventoryRecords]);

  if (!stats) return null;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-amber-500" />
        Usia Mesin MGM Pringapus
      </h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total Unit
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
            {formatMonthsToLabel(stats.avgMonths)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Usia Rata-rata
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatMonthsToLabel(stats.maxMonths)}
          </div>
          <div
            className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate"
            title={stats.oldest?.namaMesin}
          >
            Tertua{stats.oldest ? ` (${stats.oldest.helperJenis})` : ""}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats.oldCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Unit &gt; 5 Tahun
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Age Distribution Bar Chart */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
            Distribusi Usia Mesin
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ageDistribution}
                margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                  formatter={(value: any) => [`${value} unit`, "Jumlah"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  <LabelList
                    dataKey="count"
                    position="top"
                    style={{
                      fontSize: "11px",
                      fill: "#64748b",
                      fontWeight: "600",
                    }}
                    formatter={(val: any) => (val > 0 ? val : "")}
                  />
                  {ageDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Average Age per Machine Type */}
        <div>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
            Usia Rata-rata per Jenis Mesin
          </h3>
          <div className="h-64 w-full overflow-y-auto overflow-x-hidden pr-1">
            <ResponsiveContainer
              width="100%"
              height={Math.max(264, avgAgePerType.length * 28)}
            >
              <BarChart
                data={avgAgePerType}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  horizontal={false}
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis type="number" tick={{ fontSize: 11 }} unit=" bln" />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10 }}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                  formatter={(value: any, _name: any, props: any) => [
                    `${formatMonthsToLabel(value)} (${props.payload.count} unit)`,
                    "Rata-rata Usia",
                  ]}
                />
                <Bar dataKey="avgMonths" radius={[0, 4, 4, 0]}>
                  <LabelList
                    dataKey="avgMonths"
                    position="right"
                    style={{
                      fontSize: "10px",
                      fill: "#94a3b8",
                      fontWeight: "500",
                    }}
                    formatter={(val: any) => formatMonthsToLabel(val)}
                  />
                  {avgAgePerType.map((entry, index) => {
                    const bracket = AGE_BRACKETS.find(
                      (b) =>
                        entry.avgMonths >= b.min && entry.avgMonths <= b.max,
                    );
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={bracket?.color || "#64748b"}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChartDashboard: React.FC<ChartDashboardProps> = ({
  plans,
  requirements,
  availabilities,
  rentalTrialRecords,
  inventoryRecords,
  filters,
}) => {
  const [selectedMachine, setSelectedMachine] = useState<string>("ALL");

  const trendData = useMemo(
    () =>
      getGapTrendData(plans, requirements, availabilities, rentalTrialRecords),
    [plans, requirements, availabilities, rentalTrialRecords],
  );

  const [selectedStyleMachineFilter, setSelectedStyleMachineFilter] =
    useState<string>("ALL");

  const styleShortages = useMemo(
    () =>
      getStyleShortagesData(
        plans,
        requirements,
        availabilities,
        rentalTrialRecords,
        selectedStyleMachineFilter,
      ),
    [
      plans,
      requirements,
      availabilities,
      rentalTrialRecords,
      selectedStyleMachineFilter,
    ],
  );

  const machineShortages = useMemo(
    () =>
      getMachineShortagesData(
        plans,
        requirements,
        availabilities,
        rentalTrialRecords,
      ),
    [plans, requirements, availabilities, rentalTrialRecords],
  );

  const machineOptions = useMemo(() => {
    const types = new Set<string>();
    availabilities.forEach((a) => types.add(a.jenisMesin.toUpperCase()));
    return ["ALL", ...Array.from(types).sort()];
  }, [availabilities]);

  const ownershipComposition = useMemo(() => {
    let base = 0,
      pinjam = 0,
      sewa = 0,
      trial = 0;
    availabilities.forEach((a) => {
      base += a.baseCount !== undefined ? a.baseCount : a.jumlahMesin;
      pinjam += a.pinjamCount || 0;
      sewa += a.sewaCount || 0;
      trial += a.trialCount || 0;
    });
    const total = base + pinjam + sewa + trial;
    return [
      {
        name: "Milik Pabrik (Base)",
        value: base,
        percent: total > 0 ? base / total : 0,
        color: "#10b981",
      },
      {
        name: "Pinjam Internal",
        value: pinjam,
        percent: total > 0 ? pinjam / total : 0,
        color: "#ef4444",
      },
      {
        name: "Sewa",
        value: sewa,
        percent: total > 0 ? sewa / total : 0,
        color: "#f97316",
      },
      {
        name: "Trial",
        value: trial,
        percent: total > 0 ? trial / total : 0,
        color: "#a855f7",
      },
    ]
      .filter((x) => x.value > 0)
      .sort((a, b) => a.value - b.value);
  }, [availabilities]);

  // Overall machine requirements summary for capacity analysis
  const machineRequirements = useMemo(
    () => calculateMachineRequirements(plans, requirements, availabilities),
    [plans, requirements, availabilities],
  );

  // Capacity Overview KPI Stats
  const capacityStats = useMemo(() => {
    let totalAvail = 0;
    let totalReq = 0;
    let shortageCount = 0;
    let availableCount = 0;

    availabilities.forEach((a) => {
      totalAvail += a.jumlahMesin;
    });

    machineRequirements.forEach((r) => {
      totalReq += r.required;
      if (r.status === "Shortage") {
        shortageCount++;
      } else {
        availableCount++;
      }
    });

    const totalTypes = availabilities.length;
    const avgUtil =
      totalAvail > 0 ? ((totalReq / totalAvail) * 100).toFixed(1) : "0";

    return {
      totalCapacity: totalAvail,
      totalRequired: totalReq,
      overallUtilization: avgUtil,
      shortageMachineCount: shortageCount,
      availableMachineCount: availableCount,
      totalTypes,
    };
  }, [availabilities, machineRequirements]);

  // Top 5 Most Critical Machines (sorted by shortage gap ascending, then highest utilization)
  const topCriticalMachines = useMemo(() => {
    return [...machineRequirements]
      .sort((a, b) => {
        if (a.gap !== b.gap) {
          return a.gap - b.gap;
        }
        return b.utilization - a.utilization;
      })
      .slice(0, 5);
  }, [machineRequirements]);


  const formattedTrendData = useMemo(() => {
    return trendData.map((d) => {
      const point: any = { date: d.date };
      if (selectedMachine === "ALL") {
        point.gap = d.gap;
      } else {
        const mKey = selectedMachine.toLowerCase();
        point.gap = d[mKey] !== undefined ? d[mKey] : 0;
      }
      return point;
    });
  }, [trendData, selectedMachine]);

  // Calculate split offset for coloring (green above 0, red below 0)
  const gradientOffset = useMemo(() => {
    if (formattedTrendData.length === 0) return 0;

    const dataMax = Math.max(...formattedTrendData.map((d) => d.gap));
    const dataMin = Math.min(...formattedTrendData.map((d) => d.gap));

    if (dataMax <= 0) {
      return 0;
    }
    if (dataMin >= 0) {
      return 1;
    }

    return dataMax / (dataMax - dataMin);
  }, [formattedTrendData]);

  const renderCustomDot = (props: any) => {
    const { cx, cy, payload, key } = props;
    if (cx == null || cy == null) return null;
    const isNegative = payload.gap < 0;
    return (
      <circle
        key={key}
        cx={cx}
        cy={cy}
        r={4}
        stroke={isNegative ? "#ef4444" : "#10b981"}
        strokeWidth={2}
        fill="#ffffff"
      />
    );
  };

  const renderActiveDot = (props: any) => {
    const { cx, cy, payload, key } = props;
    if (cx == null || cy == null) return null;
    const isNegative = payload.gap < 0;
    return (
      <circle
        key={`active-${key}`}
        cx={cx}
        cy={cy}
        r={6}
        stroke={isNegative ? "#ef4444" : "#10b981"}
        strokeWidth={2}
        fill={isNegative ? "#ef4444" : "#10b981"}
      />
    );
  };

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-6">
        {/* Overview: Machine Availability */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center">
              <PieChartIcon className="w-5 h-5 mr-2 text-indigo-500" />
              Overview: Ketersediaan Mesin & Utilisasi Pabrik
            </h2>
            {filters && (filters.startDate || filters.endDate) ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 w-fit">
                Periode: {filters.startDate === filters.endDate ? filters.startDate : `${filters.startDate} s/d ${filters.endDate}`}
              </span>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 w-fit">
                Periode: Semua Jadwal (Overall)
              </span>
            )}
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Total Ketersediaan</span>
                <Cpu className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {capacityStats.totalCapacity}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    unit
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {capacityStats.totalTypes} jenis mesin master
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Total Kebutuhan (Peak)</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {capacityStats.totalRequired}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    unit
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kebutuhan puncak seluruh line
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Rata-rata Utilisasi</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {capacityStats.overallUtilization}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kapasitas terpakai
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Status Shortage</span>
                <AlertTriangle className="w-4 h-4 text-red-500" />
              </div>
              <div className="mt-2">
                <div
                  className={`text-2xl font-bold ${
                    capacityStats.shortageMachineCount > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {capacityStats.shortageMachineCount}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    jenis mesin
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {capacityStats.availableMachineCount} jenis mesin aman
                </div>
              </div>
            </div>
          </div>

          {/* 2-Column Section: Status Kepemilikan & Top 5 Mesin Kritis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Ownership Pie Chart */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status Kepemilikan Mesin
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {capacityStats.totalCapacity} unit total
                </span>
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={ownershipComposition}
                      cx="50%"
                      cy="50%"
                      outerRadius={75}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} (${((percent || 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={true}
                      style={{ fontSize: "11px", fontWeight: "500" }}
                    >
                      {ownershipComposition.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#f8fafc",
                      }}
                      formatter={(value: any, name: any, props: any) => [
                        `${value} unit (${(props.payload.percent * 100).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Top 5 Mesin Paling Kritis / Shortage Terbesar */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Top 5 Mesin Kritis / Utilisasi Tertinggi
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Kebutuhan vs Ketersediaan
                </span>
              </div>

              <div className="space-y-3 my-auto">
                {topCriticalMachines.map((m, idx) => {
                  const isShortage = m.gap < 0;
                  const utilPercent = Math.min(m.utilization, 150);
                  const barColor = isShortage
                    ? "bg-red-500 dark:bg-red-500"
                    : m.utilization >= 80
                      ? "bg-amber-500 dark:bg-amber-500"
                      : "bg-emerald-500 dark:bg-emerald-500";

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {m.machine}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              isShortage
                                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                            }`}
                          >
                            {isShortage ? `Shortage ${m.gap}` : "Aman"}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {m.required}
                          </span>{" "}
                          / {m.available} unit ({m.utilization}%)
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-slate-200 dark:bg-slate-700/60 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(utilPercent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Machine Age Analysis Section */}
        {inventoryRecords.length > 0 && (
          <MachineAgeSection inventoryRecords={inventoryRecords} />
        )}

        {/* Shortages Analysis Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center relative group w-max">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
              Analysis: Machine & Style Shortages
              <Info className="w-4 h-4 ml-2 text-slate-400 cursor-help" />
              <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-80 p-3 bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg shadow-xl z-50 font-normal">
                <strong>Klik pada baris mesin</strong> di tabel kiri untuk
                memfilter tabel style di sebelah kanan.
                <br />
                <br />
                <strong>Impact Score</strong> dihitung berdasarkan porsi
                kebutuhan mesin oleh suatu style pada saat terjadi shortage.
              </div>
            </h2>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Filter Machine:
              </label>
              <select
                value={selectedStyleMachineFilter}
                onChange={(e) => setSelectedStyleMachineFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg focus:ring-indigo-500 focus:border-indigo-500 block p-2 transition-colors cursor-pointer"
              >
                {machineOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "ALL" ? "All Machines" : opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel: Machine Shortages Table */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                1. Machines Frequently in Shortage
              </h3>
              {machineShortages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                  No machine shortages detected.
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px] border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Machine
                        </th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Shortage Days
                        </th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Max Daily Shortage
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {machineShortages.map((m, idx) => {
                        const isSelected =
                          selectedStyleMachineFilter === m.machine;
                        return (
                          <tr
                            key={idx}
                            onClick={() =>
                              setSelectedStyleMachineFilter(
                                isSelected ? "ALL" : m.machine,
                              )
                            }
                            className={`cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-orange-50 dark:bg-orange-900/20"
                                : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                            }`}
                          >
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-200">
                              {m.machine}
                            </td>
                            <td className="px-4 py-3 text-orange-500 font-medium">
                              {m.shortageCount} days
                            </td>
                            <td className="px-4 py-3 text-red-500 font-medium">
                              {m.maxShortageVolume} units/day
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Right Panel: Style Shortages Table */}
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                2. Styles Causing{" "}
                {selectedStyleMachineFilter !== "ALL"
                  ? `[${selectedStyleMachineFilter}]`
                  : ""}{" "}
                Shortages
              </h3>
              {styleShortages.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-800/30">
                  No styles causing shortages detected.
                </div>
              ) : (
                <div className="overflow-auto max-h-[400px] border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Style
                        </th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                          Machines Short
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {styleShortages.map((s, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                            {s.displayStyle}
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              Impact Score:{" "}
                              <strong className="text-red-500 dark:text-red-400">
                                {s.shortageCount} pts
                              </strong>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              {Array.from(
                                new Set(
                                  s.machinesShort.map((m) =>
                                    m.machine.toUpperCase(),
                                  ),
                                ),
                              ).map((mType) => (
                                <span
                                  key={mType}
                                  className="px-2 py-1 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 text-xs rounded-md font-medium border border-red-200 dark:border-red-800/50"
                                >
                                  {mType}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trend Chart Section - Hidden temporarily per user request */}
        {false && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Machine Gap Trend (Working Days)
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Filter Machine:
                </label>
                <select
                  value={selectedMachine}
                  onChange={(e) => setSelectedMachine(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {machineOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="h-80 w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={formattedTrendData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset={gradientOffset}
                        stopColor="#10b981"
                        stopOpacity={1}
                      />
                      <stop
                        offset={gradientOffset}
                        stopColor="#ef4444"
                        stopOpacity={1}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#334155"
                    opacity={0.2}
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(val) => {
                      const d = new Date(val);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                    labelStyle={{ fontWeight: "bold", marginBottom: "4px" }}
                    formatter={(value: any) => [value, "Gap"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="gap"
                    name={
                      selectedMachine === "ALL"
                        ? "Total Gap"
                        : `Gap (${selectedMachine})`
                    }
                    stroke="url(#splitColor)"
                    strokeWidth={3}
                    dot={renderCustomDot}
                    activeDot={renderActiveDot}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};
