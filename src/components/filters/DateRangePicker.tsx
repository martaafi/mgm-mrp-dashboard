import React, { useState, useRef, useEffect } from "react";
import {
  format,
  isSameMonth,
  addMonths,
  subMonths,
  isWithinInterval,
  isSameDay,
  isBefore,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  getISOWeek,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  align?: "left" | "right";
  showTodayButton?: boolean;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  align = "left",
  showTodayButton = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    startDate ? new Date(startDate) : new Date(),
  );

  // Temporary selection state for when the popup is open
  const [tempStart, setTempStart] = useState<Date | null>(
    startDate ? new Date(startDate) : null,
  );
  const [tempEnd, setTempEnd] = useState<Date | null>(
    endDate ? new Date(endDate) : null,
  );

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = () => {
    setTempStart(startDate ? new Date(startDate) : null);
    setTempEnd(endDate ? new Date(endDate) : null);
    if (startDate) setCurrentMonth(new Date(startDate));
    setIsOpen(!isOpen);
  };

  const handleApply = () => {
    if (tempStart) {
      onStartDateChange(format(tempStart, "yyyy-MM-dd"));
      onEndDateChange(format(tempEnd || tempStart, "yyyy-MM-dd"));
    }
    setIsOpen(false);
  };

  const handleDateClick = (day: Date) => {
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(day);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (isBefore(day, tempStart)) {
        setTempStart(day);
      } else {
        setTempEnd(day);
      }
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const renderHeader = () => {
    return (
      <div className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-100 py-2 px-3 flex justify-between items-center rounded-t-lg">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" />
        </button>
        <span className="font-semibold text-[13px]">
          {format(currentMonth, "MMMM yyyy", { locale: enUS })}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" />
        </button>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    return (
      <div className="grid grid-cols-8 gap-0 pt-2 pb-1.5 px-2 border-b border-slate-100 dark:border-slate-700">
        <div className="text-center text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider">
          Wk
        </div>
        {days.map((day, idx) => (
          <div
            key={idx}
            className={`text-center text-[10px] font-bold uppercase tracking-wider ${
              idx >= 5 ? "text-red-400 dark:text-red-400" : "text-slate-400 dark:text-slate-400"
            }`}
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDateRange = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday
    const endDateRange = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const dateFormat = "d";
    const rows = [];
    let days = [];
    let day = startDateRange;

    const handleWeekClick = (weekStartDay: Date) => {
      setTempStart(weekStartDay);
      // Planning week is Monday - Saturday (Sunday is excluded)
      setTempEnd(addDays(weekStartDay, 5));
    };

    while (day <= endDateRange) {
      const weekStartDay = new Date(day);
      const isoWeekNum = getISOWeek(weekStartDay);

      const weekCell = (
        <div
          key={`week-${isoWeekNum}`}
          className="flex items-center justify-center h-7 text-[10px] font-bold text-indigo-500 dark:text-indigo-400 cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded"
          onClick={() => handleWeekClick(weekStartDay)}
          title="Select whole week"
        >
          W{isoWeekNum}
        </div>
      );

      for (let i = 0; i < 7; i++) {
        const formattedDate = format(day, dateFormat);
        const cloneDay = new Date(day);
        const isCurrentMonth = isSameMonth(day, monthStart);

        // Selection logic
        const isSelectedStart = tempStart ? isSameDay(day, tempStart) : false;
        const isSelectedEnd = tempEnd ? isSameDay(day, tempEnd) : false;
        const isInRange =
          tempStart && tempEnd
            ? isWithinInterval(day, { start: tempStart, end: tempEnd })
            : false;

        let cellClasses =
          "flex items-center justify-center h-7 w-full text-xs font-medium cursor-pointer transition-colors relative z-10 ";
        let wrapperClasses = "relative h-7 ";

        if (!isCurrentMonth) {
          cellClasses += "text-slate-300 dark:text-slate-600 ";
        } else {
          cellClasses +=
            "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 rounded ";
        }

        // Range backgrounds
        if (isInRange && !isSelectedStart && !isSelectedEnd) {
          wrapperClasses += "bg-slate-200 dark:bg-slate-700/60 ";
          cellClasses = cellClasses.replace(
            "hover:bg-slate-100 dark:hover:bg-slate-700",
            "hover:bg-slate-300 dark:hover:bg-slate-600",
          );
        }

        if (isSelectedStart) {
          wrapperClasses +=
            tempStart && tempEnd && !isSameDay(tempStart, tempEnd)
              ? "bg-slate-200 dark:bg-slate-700/60 rounded-l-md "
              : "";
          cellClasses =
            "flex items-center justify-center h-7 w-full text-xs font-bold cursor-pointer relative z-10 bg-slate-800 dark:bg-indigo-600 text-white rounded-md shadow-sm";
        }

        if (
          isSelectedEnd &&
          tempStart &&
          tempEnd &&
          !isSameDay(tempStart, tempEnd)
        ) {
          wrapperClasses += tempStart ? "bg-slate-200 dark:bg-slate-700/60 rounded-r-md " : "";
          cellClasses =
            "flex items-center justify-center h-7 w-full text-xs font-bold cursor-pointer relative z-10 bg-slate-800 dark:bg-indigo-600 text-white rounded-md shadow-sm";
        }

        days.push(
          <div
            key={day.toString()}
            className={wrapperClasses}
            onClick={() => handleDateClick(cloneDay)}
          >
            <div className={cellClasses}>
              <span>{formattedDate}</span>
            </div>
          </div>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div className="grid grid-cols-8 gap-0 px-2 mt-1" key={day.toString()}>
          {weekCell}
          {days}
        </div>,
      );
      days = [];
    }
    return <div className="pb-2">{rows}</div>;
  };

  const formatDisplayDate = (d: string) => {
    if (!d) return "Select date";
    return format(new Date(d), "dd MMM yyyy", { locale: enUS });
  };

  const formatRangeText = () => {
    if (!tempStart) return "Select start date";
    if (!tempEnd) return `from ${format(tempStart, "d MMMM")}`;
    return `Dates: from ${format(tempStart, "d MMMM")} to ${format(tempEnd, "d MMMM")}`.toLowerCase();
  };

  const getTodayDate = () => {
    const today = new Date();
    if (today.getDay() === 0) {
      today.setDate(today.getDate() + 1); // Default to Monday if today is Sunday
    }
    return today;
  };

  const todayDate = getTodayDate();
  const todayStr = format(todayDate, "yyyy-MM-dd");
  const isTodayActive = startDate === todayStr && endDate === todayStr;

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const t = getTodayDate();
    const tStr = format(t, "yyyy-MM-dd");
    onStartDateChange(tStr);
    onEndDateChange(tStr);
    setTempStart(t);
    setTempEnd(t);
    setCurrentMonth(t);
    setIsOpen(false);
  };

  return (
    <div className="inline-flex items-center gap-1.5" ref={popoverRef}>
      {/* Trigger & Popover Container */}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          className="flex items-center justify-between min-w-[210px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-300 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        >
          <div className="flex items-center">
            <CalendarIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 mr-2" />
            <span className="font-medium">
              {startDate && endDate
                ? `${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`
                : "Pilih Tanggal"}
            </span>
          </div>
        </button>

        {/* Popover Calendar */}
        {isOpen && (
          <div
            className={`absolute top-full ${
              align === "right" ? "right-0" : "left-0"
            } mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 w-[290px] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200`}
          >
            {renderHeader()}
            {renderDays()}
            {renderCells()}

            {/* Footer Action */}
            <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-700 p-2.5">
              <div className="text-slate-700 dark:text-slate-300 text-[11px] mb-2 font-medium capitalize">
                {formatRangeText()}
              </div>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={handleSelectToday}
                  className="py-1.5 px-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800/60 rounded transition-colors"
                  title="Pilih hari ini"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!tempStart}
                  className="flex-1 py-1.5 text-xs font-bold text-white bg-slate-800 dark:bg-indigo-600 rounded shadow-sm hover:bg-slate-700 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Ok
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Today Button Outside */}
      {showTodayButton && (
        <button
          type="button"
          onClick={handleSelectToday}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all shadow-sm ${
            isTodayActive
              ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500 shadow-indigo-500/20"
              : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
          title="Pilih tanggal hari ini (Today)"
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Today</span>
        </button>
      )}
    </div>
  );
};
