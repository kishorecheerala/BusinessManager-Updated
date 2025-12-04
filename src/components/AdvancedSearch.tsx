import React, { useState, useEffect } from 'react';
import { useAdvancedSearch } from '../hooks/useAdvancedSearch';
import { Search, Filter, X, ArrowRight } from 'lucide-react';
import Button from './Button';

interface AdvancedSearchProps {
    onNavigate: (type: string, id: string) => void;
}

export const AdvancedSearch: React.FC<AdvancedSearchProps> = ({ onNavigate }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    results,
    loading,
    performSearch
  } = useAdvancedSearch();

  const [showAdvanced, setShowAdvanced] = useState(true); // Default to open in modal

  // Debounce search
  useEffect(() => {
      const timer = setTimeout(() => {
          if (searchQuery || Object.keys(filters).length > 0) {
              performSearch();
          }
      }, 500);
      return () => clearTimeout(timer);
  }, [searchQuery, filters, performSearch]);

  return (
    <div className="space-y-4">
      <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search anything (Name, Phone, Invoice ID)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border-2 border-indigo-100 dark:border-slate-700 rounded-xl text-lg focus:border-indigo-500 focus:ring-indigo-500 dark:bg-slate-800 dark:text-white transition-all shadow-sm"
            autoFocus
          />
      </div>

      <div className="flex items-center justify-between">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)} 
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline"
          >
              <Filter size={14} /> {showAdvanced ? 'Hide Filters' : 'Show Filters'}
          </button>
          
          {(searchQuery || Object.values(filters).some(Boolean)) && (
               <button onClick={clearFilters} className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors flex items-center gap-1">
                   <X size={12} /> Clear All
               </button>
          )}
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm animate-slide-down-fade">
          <FilterGroup label="Date Range" onChange={(v: string) => addFilter('dateRange', v)} value={filters['dateRange'] || ''}>
            <option value="">Any time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
          </FilterGroup>

          <FilterGroup label="Status" onChange={(v: string) => addFilter('status', v)} value={filters['status'] || ''}>
            <option value="">All Status</option>
            <option value="pending">Pending Due</option>
            <option value="completed">Paid</option>
          </FilterGroup>

          <FilterGroup label="Amount" onChange={(v: string) => addFilter('amountRange', v)} value={filters['amountRange'] || ''}>
            <option value="">Any Amount</option>
            <option value="0-10000">₹0 - ₹10k</option>
            <option value="10000-50000">₹10k - ₹50k</option>
            <option value="50000-100000">₹50k - ₹1L</option>
            <option value="100000+">₹1L+</option>
          </FilterGroup>
        </div>
      )}

      <div className="space-y-2">
          {loading && (
              <div className="p-8 text-center text-gray-400">
                  <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                  Searching...
              </div>
          )}

          {!loading && results.length > 0 && results.map((result: any) => (
            <div
              key={result.id}
              onClick={() => onNavigate(result.type, result.id)}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-gray-100 dark:border-slate-700 rounded-xl cursor-pointer transition-all shadow-sm hover:shadow-md group"
            >
              <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                      result.type === 'Invoice' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                      result.type === 'Customer' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                      'bg-gray-100 text-gray-600'
                  }`}>
                      {result.type.substring(0, 3).toUpperCase()}
                  </div>
                  <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{result.title}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2">
                          <span>{result.type}</span>
                          {result.date !== '-' && <span>• {result.date}</span>}
                      </div>
                  </div>
              </div>
              <div className="text-right">
                  <div className="font-bold text-slate-700 dark:text-slate-300">{result.amount !== '-' ? result.amount : ''}</div>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-indigo-500 ml-auto mt-1 transition-colors" />
              </div>
            </div>
          ))}
          
          {!loading && searchQuery && results.length === 0 && (
              <div className="p-8 text-center text-gray-400 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                  No results found matching your criteria.
              </div>
          )}
      </div>
    </div>
  );
};

const FilterGroup = ({ label, onChange, children, value }: any) => (
  <div>
    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1.5">{label}</label>
    <select 
        onChange={(e) => onChange(e.target.value)} 
        value={value}
        className="w-full p-2.5 text-sm border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
    >
      {children}
    </select>
  </div>
);