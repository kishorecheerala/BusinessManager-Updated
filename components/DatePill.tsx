
import React from 'react';
import { CalendarClock } from 'lucide-react';

interface DatePillProps {
  className?: string;
}

const DatePill: React.FC<DatePillProps> = ({ className = '' }) => {
  return (
    <span className={`text-xs sm:text-sm font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-3 py-1.5 rounded-full shadow-md border border-teal-500/30 flex items-center gap-2 whitespace-nowrap ${className}`}>
      <CalendarClock className="w-3 h-3 sm:w-4 sm:h-4 text-white/80" />
      <span className="hidden sm:inline">{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
      <span className="sm:hidden">{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
    </span>
  );
};

export default DatePill;
