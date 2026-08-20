import React, { useMemo, useState } from "react";
import {
  ProductionPlan,
  MachineRequirementPerStyle,
  MachineAvailability,
} from "../../types/mrp";
import {
  getGapTrendData,
  getStyleShortagesData,
  getMachineShortagesData,
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
import { AlertCircle, Info, PieChart as PieChartIcon } from "lucide-react";

interface ChartDashboardProps {
  plans: ProductionPlan[];
  requirements: MachineRequirementPerStyle[];
  availabilities: MachineAvailability[];
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

export const ChartDashboard: React.FC<ChartDashboardProps> = ({
  plans,
  requirements,
  availabilities,
}) => {
  const [selectedMachine, setSelectedMachine] = useState<string>("ALL");

  const trendData = useMemo(
    () => getGapTrendData(plans, requirements, availabilities),
    [plans, requirements, availabilities],
  );

  const [selectedStyleMachineFilter, setSelectedStyleMachineFilter] = useState<string>("ALL");

  const styleShortages = useMemo(
    () => getStyleShortagesData(plans, requirements, availabilities, selectedStyleMachineFilter),
    [plans, requirements, availabilities, selectedStyleMachineFilter],
  );

  const machineShortages = useMemo(
    () => getMachineShortagesData(plans, requirements, availabilities),
    [plans, requirements, availabilities],
  );

  const machineOptions = useMemo(() => {
    const types = new Set<string>();
    availabilities.forEach((a) => types.add(a.jenisMesin.toUpperCase()));
    return ["ALL", ...Array.from(types).sort()];
  }, [availabilities]);

  const machineTypeComposition = useMemo(() => {
    const map = new Map<string, number>();
    let total = 0;
    availabilities.forEach((a) => {
      const t = a.jenisMesin.toUpperCase();
      map.set(t, (map.get(t) || 0) + a.jumlahMesin);
      total += a.jumlahMesin;
    });

    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map((x) => ({ name: x[0], value: x[1], percent: total > 0 ? x[1] / total : 0 }));
  }, [availabilities]);

  const ownershipComposition = useMemo(() => {
    let base = 0,
      pinjam = 0,
      sewa = 0;
    availabilities.forEach((a) => {
      base += a.baseCount !== undefined ? a.baseCount : a.jumlahMesin;
      pinjam += a.pinjamCount || 0;
      sewa += a.sewaCount || 0;
    });
    const total = base + pinjam + sewa;
    return [
      { name: "Milik Pabrik (Base)", value: base, percent: total > 0 ? base / total : 0 },
      { name: "Pinjam Internal", value: pinjam, percent: total > 0 ? pinjam / total : 0 },
      { name: "Sewa", value: sewa, percent: total > 0 ? sewa / total : 0 },
    ].filter((x) => x.value > 0);
  }, [availabilities]);

  const PIE_COLORS = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f97316",
    "#64748b",
  ];
  const OWNERSHIP_COLORS = ["#10b981", "#f59e0b", "#ef4444"];

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
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center">
            <PieChartIcon className="w-5 h-5 mr-2 text-indigo-500" />
            Overview: Ketersediaan Mesin (Kapasitas Pabrik)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Machine Type Pie Chart */}
            <div className="h-64 w-full">
              <h3 className="text-sm font-semibold text-center text-slate-600 dark:text-slate-400 mb-2">
                Komposisi Jenis Mesin
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={machineTypeComposition}
                  margin={{ top: 10, right: 10, left: -20, bottom: 30 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 10 }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={60} 
                  />
                  <YAxis tick={{ fontSize: 11 }} width={50} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#f8fafc",
                    }}
                    cursor={{ fill: "rgba(51, 65, 85, 0.1)" }}
                    formatter={(value: any, _name: string, props: any) => [
                      `${value} unit (${(props.payload.percent * 100).toFixed(1)}%)`,
                      props.payload.name,
                    ]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    <LabelList 
                      dataKey="percent" 
                      position="top" 
                      formatter={(val: number) => val > 0.01 ? `${(val * 100).toFixed(0)}%` : ''} 
                      style={{ fontSize: "10px", fill: "#64748b", fontWeight: "600" }} 
                    />
                    {machineTypeComposition.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Ownership Pie Chart */}
            <div className="h-64 w-full">
              <h3 className="text-sm font-semibold text-center text-slate-600 dark:text-slate-400 mb-2">
                Status Kepemilikan Mesin
              </h3>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ownershipComposition}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => percent > 0.02 ? `${name} (${(percent * 100).toFixed(0)}%)` : ''}
                    labelLine={true}
                    style={{ fontSize: "11px", fontWeight: "500" }}
                  >
                    {ownershipComposition.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={OWNERSHIP_COLORS[index % OWNERSHIP_COLORS.length]}
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
                    formatter={(value: any, name: string, props: any) => [
                      `${value} unit (${(props.payload.percent * 100).toFixed(1)}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Shortages Analysis Section */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center relative group w-max">
              <AlertCircle className="w-5 h-5 mr-2 text-red-500" />
              Analysis: Machine & Style Shortages
              <Info className="w-4 h-4 ml-2 text-slate-400 cursor-help" />
              <div className="absolute left-0 top-full mt-2 hidden group-hover:block w-80 p-3 bg-slate-800 border border-slate-700 text-xs text-slate-200 rounded-lg shadow-xl z-50 font-normal">
                <strong>Klik pada baris mesin</strong> di tabel kiri untuk memfilter tabel style di sebelah kanan.
                <br /><br />
                <strong>Impact Score</strong> dihitung berdasarkan porsi kebutuhan mesin oleh suatu style pada saat terjadi shortage.
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
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Machine</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Shortage Days</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Max Daily Shortage</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {machineShortages.map((m, idx) => {
                        const isSelected = selectedStyleMachineFilter === m.machine;
                        return (
                          <tr
                            key={idx}
                            onClick={() => setSelectedStyleMachineFilter(isSelected ? "ALL" : m.machine)}
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
                2. Styles Causing {selectedStyleMachineFilter !== "ALL" ? `[${selectedStyleMachineFilter}]` : ""} Shortages
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
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Style</th>
                        <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Machines Short</th>
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
                              Impact Score: <strong className="text-red-500 dark:text-red-400">{s.shortageCount} pts</strong>
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

        {/* Trend Chart Section */}
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
      </div>
    </ErrorBoundary>
  );
};
