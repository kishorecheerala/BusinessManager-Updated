import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarProps {
  value: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

const Calendar: React.FC<CalendarProps> = ({ value, onChange }) => {
  const selectedDate = useMemo(() => {
    if (!value) return new Date();
    // Parse as UTC to avoid timezone shifts from YYYY-MM-DD string
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }, [value]);
  
  const [displayDate, setDisplayDate] = useState(new Date(Date.UTC(selectedDate.getUTCFullYear(), selectedDate.getUTCMonth(), 1)));

  const monthName = displayDate.toLocaleString('default', { month: 'long', timeZone: 'UTC' });
  const year = displayDate.getUTCFullYear();

  const daysInMonth = useMemo(() => {
    const date = new Date(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), 1);
    const days = [];
    const firstDay = date.getUTCDay(); // 0-6 (Sun-Sat)
    const daysInPrevMonth = new Date(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), 0).getUTCDate();
    
    // Previous month's days
    for (let i = firstDay; i > 0; i--) {
        days.push({ day: daysInPrevMonth - i + 1, isCurrentMonth: false });
    }

    // Current month's days
    const numDays = new Date(displayDate.getUTCFullYear(), displayDate.getUTCMonth() + 1, 0).getUTCDate();
    for (let i = 1; i <= numDays; i++) {
        days.push({ day: i, isCurrentMonth: true });
    }

    // Next month's days to fill grid
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ day: i, isCurrentMonth: false });
    }

    return days;
  }, [displayDate]);
  
  const handlePrevMonth = () => {
    setDisplayDate(new Date(displayDate.getUTCFullYear(), displayDate.getUTCMonth() - 1, 1));
  };
  
  const handleNextMonth = () => {
    setDisplayDate(new Date(displayDate.getUTCFullYear(), displayDate.getUTCMonth() + 1, 1));
  };

  const handleDateClick = (day: number) => {
    const newDate = new Date(Date.UTC(displayDate.getUTCFullYear(), displayDate.getUTCMonth(), day));
    const year = newDate.getUTCFullYear();
    const month = (newDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = newDate.getUTCDate().toString().padStart(2, '0');
    onChange(`${year}-${month}-${d}`);
  };

  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-2xl border dark:border-slate-700 w-full max-w-[320px]">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
            <button onClick={handlePrevMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <ChevronLeft size={18} />
            </button>
            <div className="font-bold text-center text-sm">
                {monthName} <span className="text-gray-500">{year}</span>
            </div>
            <button onClick={handleNextMonth} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <ChevronRight size={18} />
            </button>
        </div>
        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 font-medium">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => <div key={d} className="p-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((d, i) => {
                const isSelected = d.isCurrentMonth && d.day === selectedDate.getUTCDate() && displayDate.getUTCMonth() === selectedDate.getUTCMonth() && displayDate.getUTCFullYear() === selectedDate.getUTCFullYear();
                const isToday = d.isCurrentMonth && d.day === today.getDate() && displayDate.getUTCMonth() === today.getMonth() && displayDate.getUTCFullYear() === today.getFullYear();
                
                return (
                    <button 
                        key={i}
                        onClick={() => d.isCurrentMonth && handleDateClick(d.day)}
                        disabled={!d.isCurrentMonth}
                        className={`w-10 h-10 rounded-full text-sm font-medium transition-all duration-150 flex items-center justify-center
                            ${!d.isCurrentMonth ? 'text-gray-300 dark:text-slate-600' : ''}
                            ${d.isCurrentMonth ? 'hover:bg-gray-100 dark:hover:bg-slate-700' : ''}
                            ${isSelected ? '!bg-primary !text-white' : ''}
                            ${isToday && !isSelected ? 'ring-1 ring-primary/50 text-primary' : ''}
                        `}
                    >
                        {d.day}
                    </button>
                );
            })}
        </div>
    </div>
  );
};

export default Calendar;
