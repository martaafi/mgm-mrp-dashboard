import React from 'react';
import { Filter, RotateCcw, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { FilterState } from '../../types/mrp';
import { DateRangePicker } from './DateRangePicker';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (key: keyof FilterState, value: string) => void;
  onResetFilters: () => void;
  lastUpdated?: string | null;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  lastUpdated,
}) => {
  const isFiltered = filters.startDate !== '' || filters.endDate !== '';

  const formatDisplayDate = (d: string) => {
    if (!d) return "";
    return format(new Date(d), "dd MMM yyyy");
  };

  const formatLastUpdatedString = (d: string) => {
    if (!d) return "";
    if (d.includes("/")) {
      const [datePart, timePart] = d.split(" ");
      if (datePart) {
        const parts = datePart.split("/");
        if (parts.length === 3) {
          const [day, month, year] = parts;
          const parsedDate = new Date(`${year}-${month}-${day}T${timePart || "00:00:00"}`);
          if (!isNaN(parsedDate.getTime())) {
            return format(parsedDate, "dd MMM yyyy HH:mm:ss");
          }
        }
      }
    }
    return d;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm mb-6 transition-colors">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left icon label */}
        <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
          <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filter Dashboard:</span>
        </div>

        {/* Filter inputs */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <DateRangePicker 
            startDate={filters.startDate}
            endDate={filters.endDate}
            onStartDateChange={(date) => onFilterChange('startDate', date)}
            onEndDateChange={(date) => onFilterChange('endDate', date)}
          />
        </div>

        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
              Last Update: {formatLastUpdatedString(lastUpdated)}
            </span>
          )}
          {/* Reset Filters button */}
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800/50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pills */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 transition-colors">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">Active Filters:</span>
          {filters.startDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
              Start: {formatDisplayDate(filters.startDate)}
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
              End: {formatDisplayDate(filters.endDate)}
            </span>
          )}

        </div>
      )}
    </div>
  );
};
