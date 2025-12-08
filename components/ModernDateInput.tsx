
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import Calendar from './Calendar';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

interface ModernDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (event: { target: { value: string } }) => void;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  containerClassName?: string;
  popupPosition?: 'top' | 'bottom';
}

const ModernDateInput: React.FC<ModernDateInputProps> = ({ label, value, onChange, disabled, isOpen, onToggle, containerClassName = '', popupPosition = 'bottom', ...props }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isComponentOpen = isOpen !== undefined ? isOpen : internalIsOpen;
  const setComponentOpen = onToggle || setInternalIsOpen;

  const ref = useRef<HTMLDivElement>(null);
  useOnClickOutside(ref, () => {
      if (isComponentOpen) {
          setComponentOpen(false);
      }
  });

  const handleDateSelect = (dateString: string) => {
    // Mimic input event object for compatibility
    onChange({ target: { value: dateString } });
    setComponentOpen(false);
  };
  
  const formattedDate = useMemo(() => {
      try {
        if (!value) return 'Select Date';
        // Ensure we parse as UTC to avoid timezone shifts from YYYY-MM-DD string
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return date.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
        });
      } catch (e) {
          return 'Invalid Date';
      }
  }, [value]);

  return (
    <div className={`relative w-full ${containerClassName}`} ref={ref}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setComponentOpen(!isComponentOpen)}
        disabled={disabled}
        className={`w-full p-2.5 border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg text-left flex justify-between items-center text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
        {...props}
      >
        <span className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-gray-400" />
            <span>{formattedDate}</span>
        </span>
      </button>

      {isComponentOpen && (
          <div className={`absolute z-50 animate-scale-in w-full ${popupPosition === 'top' ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'}`}>
              <Calendar value={value} onChange={handleDateSelect} />
          </div>
      )}
    </div>
  );
};

export default ModernDateInput;
