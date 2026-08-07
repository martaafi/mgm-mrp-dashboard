import React from 'react';
import { Filter, RotateCcw, Calendar } from 'lucide-react';
import { FilterState } from '../../types/mrp';

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

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm mb-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left icon label */}
        <div className="flex items-center space-x-2 text-slate-600">
          <Filter className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold uppercase tracking-wider">Filter Dashboard:</span>
        </div>

        {/* Filter inputs */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          {/* Start Date */}
          <div className="flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFilterChange('startDate', e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              aria-label="Start Date"
            />
          </div>

          <span className="text-slate-400 text-xs font-semibold px-1">to</span>

          {/* End Date */}
          <div className="flex items-center bg-white border border-slate-200 hover:border-slate-300 rounded-lg px-2.5 py-1.5 focus-within:border-indigo-500 shadow-sm">
            <Calendar className="w-3.5 h-3.5 text-slate-400 mr-1.5 shrink-0" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFilterChange('endDate', e.target.value)}
              className="bg-transparent text-xs font-medium text-slate-800 focus:outline-none cursor-pointer"
              aria-label="End Date"
            />
          </div>

        </div>

        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
              Last Update: {lastUpdated}
            </span>
          )}
          {/* Reset Filters button */}
          {isFiltered && (
            <button
              onClick={onResetFilters}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Filter Pills */}
      {isFiltered && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-slate-200">
          <span className="text-xs font-medium text-slate-500 mr-1">Active Filters:</span>
          {filters.startDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Start: {filters.startDate}
            </span>
          )}
          {filters.endDate && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              End: {filters.endDate}
            </span>
          )}

        </div>
      )}
    </div>
  );
};
