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
import { formatDecimal, formatSignedDecimal } from "../../utils/formatters";
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

// Custom Bar shape: tidak menggambar apa pun untuk segmen bernilai 0,
// tapi rect-nya tetap didaftarkan sehingga LabelList total tampil di
// SEMUA kolom. (Recharts membuang rect berukuran 0 dari data label,
// sehingga tanpa ini label hanya muncul di kolom yang segmen teratasnya > 0.)
const renderVisibleShapeOnly = (props: any) => {
  const { x, y, width, height, fill, value } = props;
  if (value === 0 || !width || !height) return null;
  return <rect x={x} y={y} width={width} height={height} fill={fill} />;
};

// Custom tick sumbu X: teks miring dengan wrap maksimal 2 baris
// (kata dibagi seimbang supaya tidak terpotong).
const renderAngledWrappedXTick = (props: any) => {
  const { x, y, payload } = props;
  const words = String(payload?.value ?? "")
    .split(" ")
    .filter(Boolean);
  let lines: string[] = words;
  if (words.length > 1) {
    let best = 1;
    let bestDiff = Infinity;
    for (let i = 1; i < words.length; i++) {
      const a = words.slice(0, i).join(" ").length;
      const b = words.slice(i).join(" ").length;
      const diff = Math.abs(a - b);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = i;
      }
    }
    lines = [words.slice(0, best).join(" "), words.slice(best).join(" ")];
  }
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      transform={`rotate(-35 ${x} ${y})`}
      fontSize={9}
      fill="#94a3b8"
    >
      {lines.map((line, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 5 : 11}>
          {line}
        </tspan>
      ))}
    </text>
  );
};

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
  { label: "< 1 tahun", min: 0, max: 11, color: "#3b82f6" },
  { label: "1 - 2 tahun", min: 12, max: 23, color: "#3b82f6" },
  { label: "2 - 5 tahun", min: 24, max: 59, color: "#3b82f6" },
  { label: "5 - 10 tahun", min: 60, max: 119, color: "#3b82f6" },
  { label: "> 10 tahun", min: 120, max: Infinity, color: "#3b82f6" },
];

const formatMonthsToLabel = (months: number): string => {
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years === 0) return `${remainingMonths} bln`;
  if (remainingMonths === 0) return `${years} thn`;
  return `${years} thn ${remainingMonths} bln`;
};

// Tick Y eksplisit yang selaras antar chart: selalu `lineCount` garis di
// posisi relatif sama (0%, 25%, 50%, 75%, 100% plot) dengan step angka cantik.
const getAlignedTicks = (maxValue: number, lineCount = 5): number[] => {
  const safeMax = Math.max(1, maxValue || 0);
  const rawStep = safeMax / Math.max(1, lineCount - 1);
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = ([1, 2, 2.5, 5, 10].find((c) => c * mag >= rawStep) ?? 10) * mag;
  return Array.from(
    { length: lineCount },
    (_, i) => Math.round(i * step * 100) / 100,
  );
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

  // Tick Y selaras (5 garis sejajar) untuk kedua chart usia
  const countTicks = useMemo(
    () => getAlignedTicks(Math.max(0, ...ageDistribution.map((d) => d.count))),
    [ageDistribution],
  );

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

  const monthTicks = useMemo(
    () =>
      getAlignedTicks(
        avgAgePerType.reduce((m, d) => Math.max(m, d.avgMonths), 0),
      ),
    [avgAgePerType],
  );

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
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {stats.total}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Total Unit
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {formatMonthsToLabel(stats.avgMonths)}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Usia Rata-rata
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {formatMonthsToLabel(stats.maxMonths)}
          </div>
          <div
            className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate"
            title={stats.oldest?.namaMesin}
          >
            Usia Mesin Tertua
            {stats.oldest ? ` (${stats.oldest.helperJenis})` : ""}
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {stats.oldCount}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Usia Mesin &gt; 5 Tahun
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
        {/* Age Distribution Bar Chart (30%) */}
        <div className="lg:col-span-3">
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
                <XAxis dataKey="label" tick={{ fontSize: 10 }} height={64} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={40}
                  ticks={countTicks}
                  domain={[0, countTicks[countTicks.length - 1]]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#f8fafc",
                  }}
                  formatter={(value: any) => [`${value} unit`, "Jumlah"]}
                />
                <Bar dataKey="count" radius={0}>
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

        {/* Average Age per Machine Type (70%) */}
        <div className="lg:col-span-7">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 text-center">
            Rata-Rata Usia per Jenis Mesin
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={avgAgePerType}
                margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#334155"
                  opacity={0.2}
                />
                <XAxis
                  dataKey="name"
                  tick={renderAngledWrappedXTick}
                  interval={0}
                  height={64}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={48}
                  unit=" bln"
                  ticks={monthTicks}
                  domain={[0, monthTicks[monthTicks.length - 1]]}
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
                <Bar dataKey="avgMonths" radius={0} maxBarSize={24}>
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
        name: "Mesin Pringapus",
        value: base,
        percent: total > 0 ? base / total : 0,
        color: "#3b82f6",
      },
      {
        name: "Pinjam",
        value: pinjam,
        percent: total > 0 ? pinjam / total : 0,
        color: "#db2777",
      },
      {
        name: "Sewa",
        value: sewa,
        percent: total > 0 ? sewa / total : 0,
        color: "#6d28d9",
      },
      {
        name: "Trial",
        value: trial,
        percent: total > 0 ? trial / total : 0,
        color: "#f97316",
      },
    ]
      .filter((x) => x.value > 0)
      .sort((a, b) => a.value - b.value);
  }, [availabilities]);

  // Breakdown kepemilikan per jenis mesin untuk stacked bar chart
  // (urut total terbanyak). Rumus per mesin sama dengan pie di atas.
  const ownershipByMachine = useMemo(() => {
    return availabilities
      .map((a) => {
        const base = a.baseCount !== undefined ? a.baseCount : a.jumlahMesin;
        const pinjam = a.pinjamCount || 0;
        const sewa = a.sewaCount || 0;
        const trial = a.trialCount || 0;
        return {
          machine: a.jenisMesin,
          base,
          pinjam,
          sewa,
          trial,
          total: base + pinjam + sewa + trial,
        };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.total - a.total);
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
              Overview: Ketersediaan & Utilisasi Mesin
            </h2>
            {filters && (filters.startDate || filters.endDate) ? (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 w-fit">
                Periode:{" "}
                {filters.startDate === filters.endDate
                  ? filters.startDate
                  : `${filters.startDate} s/d ${filters.endDate}`}
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
                  {formatDecimal(capacityStats.totalCapacity)}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    unit
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {capacityStats.totalTypes} jenis mesin
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium">
                <span>Total Kebutuhan Mesin Tertinggi</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatDecimal(capacityStats.totalRequired)}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    unit
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Kebutuhan mesin tertinggi pada periode tanggal yang dipilih
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

          {/* 1-Row Section: Pie + Stacked Bar + Top 5 Mesin Kritis */}
          <div className="grid grid-cols-1 lg:grid-cols-10 gap-6">
            {/* Left: Ownership Pie Chart */}
            <div className="lg:col-span-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Status Kepemilikan Mesin
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDecimal(capacityStats.totalCapacity)} unit total
                </span>
              </div>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={ownershipComposition}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      stroke="none"
                      strokeWidth={0}
                      label={(props: any) => {
                        const { cx, cy, midAngle, outerRadius, name, percent } =
                          props;
                        // Geser vertikal per kategori supaya label slice kecil
                        // yang berdekatan (Pinjam vs Trial) tidak tumpang tindih
                        const LABEL_DY: Record<string, number> = {
                          Pinjam: -24,
                        };
                        const RADIAN = Math.PI / 180;
                        const cos = Math.cos(-midAngle * RADIAN);
                        const sin = Math.sin(-midAngle * RADIAN);
                        const outer = outerRadius || 0;
                        const sx = cx + outer * cos;
                        const sy = cy + outer * sin;
                        const lx = cx + (outer + 8) * cos;
                        const ly =
                          cy + (outer + 8) * sin + (LABEL_DY[name] ?? 0);
                        const anchor = lx > cx ? "start" : "end";
                        const lineEndX = lx + (anchor === "start" ? -3 : 3);
                        return (
                          <g>
                            <line
                              x1={sx}
                              y1={sy}
                              x2={lineEndX}
                              y2={ly}
                              stroke="#94a3b8"
                              strokeWidth={1}
                            />
                            <text
                              x={lx}
                              y={ly}
                              fill="#94a3b8"
                              textAnchor={anchor}
                              dominantBaseline="central"
                              fontSize={11}
                              fontWeight={500}
                            >
                              {`${((percent || 0) * 100).toFixed(2)}%`}
                            </text>
                          </g>
                        );
                      }}
                      labelLine={false}
                    >
                      {ownershipComposition.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.color}
                          stroke="none"
                          strokeWidth={0}
                        />
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
                        `${formatDecimal(value)} unit (${((props.payload.percent || 0) * 100).toFixed(1)}%)`,
                        name,
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend Status Kepemilikan (nama kategori saja) */}
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3">
                {ownershipComposition.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-tight whitespace-nowrap">
                      {entry.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Middle: Stacked Bar Kepemilikan per Jenis Mesin */}
            <div className="lg:col-span-5 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Komposisi Kepemilikan per Jenis Mesin
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {ownershipByMachine.length} jenis mesin
                </span>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={ownershipByMachine}
                    margin={{ top: 15, right: 12, bottom: 8, left: -12 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="currentColor"
                      className="text-slate-200 dark:text-slate-700"
                    />
                    <XAxis
                      dataKey="machine"
                      tick={{ fontSize: 9 }}
                      angle={-90}
                      textAnchor="end"
                      interval={0}
                      height={84}
                      dy={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      width={36}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        border: "none",
                        borderRadius: "8px",
                        color: "#f8fafc",
                      }}
                      formatter={(value: any, name: any) => [
                        `${formatDecimal(value)} unit`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="top"
                      align="center"
                      wrapperStyle={{ fontSize: 11, top: 0 }}
                      formatter={(value: any) => (
                        <span style={{ color: "#94a3b8" }}>{value}</span>
                      )}
                    />
                    <Bar
                      dataKey="base"
                      name="Mesin Pringapus"
                      stackId="ownership"
                      fill="#3b82f6"
                      radius={0}
                      maxBarSize={18}
                    />
                    <Bar
                      dataKey="pinjam"
                      name="Pinjam"
                      stackId="ownership"
                      fill="#db2777"
                      radius={0}
                      maxBarSize={18}
                    />
                    <Bar
                      dataKey="sewa"
                      name="Sewa"
                      stackId="ownership"
                      fill="#6d28d9"
                      radius={0}
                      maxBarSize={18}
                    />
                    <Bar
                      dataKey="trial"
                      name="Trial"
                      stackId="ownership"
                      fill="#f97316"
                      radius={0}
                      maxBarSize={18}
                      shape={renderVisibleShapeOnly}
                    >
                      <LabelList
                        dataKey="total"
                        position="top"
                        offset={3}
                        fontSize={9}
                        fill="#94a3b8"
                        formatter={(v: any) =>
                          !v || Number(v) === 0
                            ? ""
                            : formatDecimal(Number(v))
                        }
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Right: Top 5 Mesin Kritis / Utilisasi Tertinggi (vertical list) */}
            <div className="lg:col-span-2 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 rounded-xl p-4 flex flex-col">
              <div className="mb-2">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Top 5 Mesin dengan Utilisasi Tertinggi
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Kebutuhan vs Ketersediaan
                </span>
              </div>

              <div className="space-y-2 my-auto">
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
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span
                          className="font-bold text-slate-800 dark:text-slate-200 truncate"
                          title={m.machine}
                        >
                          {m.machine}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold rounded whitespace-nowrap shrink-0 ${
                            isShortage
                              ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50"
                              : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
                          }`}
                        >
                          {isShortage ? `Shortage ${formatSignedDecimal(m.gap)}` : "Aman"}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatDecimal(m.required)}
                        </span>{" "}
                        / {formatDecimal(m.available)} unit ({formatDecimal(m.utilization)}%)
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
                1. List Mesin yang Sering Mengalami Shortage
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
                              {formatDecimal(m.shortageCount)} days
                            </td>
                            <td className="px-4 py-3 text-red-500 font-medium">
                              {formatDecimal(m.maxShortageVolume)} units/day
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
                2. List Style yang menyebabkan{" "}
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
                                {formatDecimal(s.shortageCount)} pts
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
