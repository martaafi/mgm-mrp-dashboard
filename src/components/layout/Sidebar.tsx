import React from "react";
import {
  Layers,
  LayoutDashboard,
  TableProperties,
  Clock,
  BarChart2,
  Bell,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";

export type TabValue =
  | "preview"
  | "summary"
  | "detail"
  | "history"
  | "chart"
  | "downtime"
  | "alerts";

interface SidebarProps {
  activeTab: TabValue;
  onTabChange: (tab: TabValue) => void;
  alertCount?: number;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  alertCount = 0,
  isCollapsed = false,
  onToggleCollapse,
  isMobileOpen = false,
  onCloseMobile,
  isFullscreen = false,
  onToggleFullscreen,
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
      icon: <Layers className="w-5 h-5 shrink-0" />,
    },
    {
      id: "summary",
      label: "Summary",
      icon: <LayoutDashboard className="w-5 h-5 shrink-0" />,
    },
    {
      id: "detail",
      label: "Detail Matriks",
      icon: <TableProperties className="w-5 h-5 shrink-0" />,
    },
    {
      id: "history",
      label: "Plan History",
      icon: <Clock className="w-5 h-5 shrink-0" />,
    },
    {
      id: "chart",
      label: "Analytics & Chart",
      icon: <BarChart2 className="w-5 h-5 shrink-0" />,
    },
    {
      id: "downtime",
      label: "Downtime Mesin",
      icon: <Wrench className="w-5 h-5 shrink-0" />,
    },
    {
      id: "alerts",
      label: "Sewa & Trial Alerts",
      icon: <Bell className="w-5 h-5 shrink-0" />,
      badge: alertCount,
    },
  ];

  return (
    <>
      {/* Desktop Sidebar (Collapsible Rail) */}
      <aside
        className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out z-20 h-full min-h-0 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className={`flex-1 flex flex-col overflow-y-auto min-h-0 ${isCollapsed ? "p-2" : "p-4"}`}>
          {/* Header Area */}
          {isCollapsed ? (
            <div className="flex items-center justify-center mb-4 pt-1">
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Perlebar Menu Sidebar"
                >
                  <PanelLeftOpen className="w-4 h-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between mb-4 px-3">
              <h3 className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Menu
              </h3>
              {onToggleCollapse && (
                <button
                  onClick={onToggleCollapse}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  title="Perkecil Menu Sidebar (Mini Rail)"
                >
                  <PanelLeftClose className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {/* Navigation Items */}
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                    isCollapsed
                      ? "justify-center py-2.5 px-0"
                      : "px-3 py-2.5"
                  } ${
                    isActive
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                >
                  {/* Active Indicator Line (Left) */}
                  {isActive && (
                    <div
                      className={`absolute left-0 top-1 bottom-1 bg-emerald-500 rounded-r ${
                        isCollapsed ? "w-1" : "w-1.5"
                      }`}
                    />
                  )}

                  <span
                    className={`${isCollapsed ? "" : "mr-3"} ${
                      isActive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400 group-hover:text-slate-500 dark:group-hover:text-slate-300"
                    }`}
                  >
                    {item.icon}
                  </span>

                  {/* Label (when expanded) */}
                  {!isCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}

                  {/* Notification Badge when expanded */}
                  {!isCollapsed &&
                    item.badge !== undefined &&
                    item.badge > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm animate-pulse">
                        {item.badge}
                      </span>
                    )}

                  {/* Notification Badge Dot when collapsed */}
                  {isCollapsed &&
                    item.badge !== undefined &&
                    item.badge > 0 && (
                      <span className="absolute top-1.5 right-2 flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                      </span>
                    )}

                  {/* Floating Tooltip in collapsed mode */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 z-50 flex items-center gap-1.5 border border-slate-700">
                      <span>{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-red-500 text-white">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Actions (Fullscreen Toggle & Collapse) */}
        <div className="p-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`w-full flex items-center ${
                isCollapsed ? "justify-center px-0" : "px-3"
              } py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer`}
              title={isFullscreen ? "Keluar Full Screen (Esc)" : "Full Screen Mode"}
            >
              {isFullscreen ? (
                <>
                  <Minimize2 className="w-4 h-4 text-amber-500 shrink-0" />
                  {!isCollapsed && <span className="ml-2 font-medium">Keluar Fullscreen</span>}
                </>
              ) : (
                <>
                  <Maximize2 className="w-4 h-4 text-indigo-500 shrink-0" />
                  {!isCollapsed && <span className="ml-2 font-medium">Full Screen</span>}
                </>
              )}
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            className={`w-full flex items-center ${
              isCollapsed ? "justify-center px-0" : "px-3"
            } py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer`}
            title={
              isCollapsed
                ? "Perlebar Sidebar (Buka Menu)"
                : "Perkecil Sidebar (Mini Rail)"
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-indigo-500" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 mr-2" />
                <span>Perkecil Menu</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile Drawer Content */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white dark:bg-slate-900 z-50 shadow-2xl flex flex-col lg:hidden transition-transform duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-sm">
              MRP
            </div>
            <span className="font-bold text-sm text-slate-800 dark:text-white">
              Menu Navigasi
            </span>
          </div>
          <button
            onClick={onCloseMobile}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Tutup menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto">
          <nav className="space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onTabChange(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <span
                    className={`mr-3 ${
                      isActive
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-slate-400"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold bg-red-500 text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </>
  );
};
