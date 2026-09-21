import React from "react";
import {
  Layers,
  LayoutDashboard,
  TableProperties,
  Clock,
  BarChart2,
  Bell,
  Wrench,
} from "lucide-react";

export type TabValue = "preview" | "summary" | "detail" | "history" | "chart" | "downtime" | "alerts";

interface SidebarProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  alertCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  alertCount = 0,
}) => {
  const menuItems: {
    id: TabValue;
    label: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: "preview",
      label: "Preview",
      icon: <Layers className="w-5 h-5" />,
    },
    {
      id: "summary",
      label: "Summary",
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      id: "detail",
      label: "Detail",
      icon: <TableProperties className="w-5 h-5" />,
    },
    {
      id: "history",
      label: "History PPIC",
      icon: <Clock className="w-5 h-5" />,
    },
    {
      id: "chart",
      label: "Analytics",
      icon: <BarChart2 className="w-5 h-5" />,
    },
    {
      id: "downtime",
      label: "Downtime Mesin",
      icon: <Wrench className="w-5 h-5" />,
    },
    {
      id: "alerts",
      label: "Rental Alerts",
      icon: <Bell className="w-5 h-5" />,
      badge: alertCount,
    },
  ];

  return (
    <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col flex-shrink-0 transition-colors">
      <div className="p-4 flex-1">
        <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 px-3">
          Menu
        </h3>
        <nav className="space-y-1.5">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative overflow-hidden ${
                  isActive
                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                {/* Active Indicator Line (Left) */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-500" />
                )}

                <span
                  className={`mr-3 ${
                    isActive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"
                  }`}
                >
                  {item.icon}
                </span>
                {item.label}

                {/* Notification Badge */}
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm animate-pulse">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
