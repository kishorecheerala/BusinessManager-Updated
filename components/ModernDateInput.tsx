import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Calendar as CalendarIcon } from 'lucide-react';
import Calendar from './Calendar';

interface ModernDateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  label?: string;
  value: string; // YYYY-MM-DD
  onChange: (event: { target: { value: string } }) => void;
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
  containerClassName?: string;
  popupPosition?: 'top' | 'bottom';
}

const ModernDateInput: React.FC<ModernDateInputProps> = ({ label, value, onChange, disabled, isOpen: controlledOpen, onToggle, containerClassName = '', popupPosition = 'bottom', ...props }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isComponentOpen = controlledOpen !== undefined ? controlledOpen : internalIsOpen;
  const setComponentOpen = onToggle || setInternalIsOpen;

  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  // Calculate position when opening
  useEffect(() => {
    if (isComponentOpen && triggerRef.current) {
        const updatePosition = () => {
            if (!triggerRef.current) return;
            const rect = triggerRef.current.getBoundingClientRect();
            const popupWidth = 320; // Approximate width of calendar
            const screenWidth = window.innerWidth;

            let left = rect.left;
            
            // Prevent going off-screen to the right
            if (left + popupWidth > screenWidth) {
                left = screenWidth - popupWidth - 10; // 10px padding
            }
            // Prevent going off-screen to the left
            if (left < 10) {
                left = 10;
            }

            // Default to bottom
            let top = rect.bottom + 6; 
            
            // If prop explicitly asks for top, or if bottom would overflow screen height significantly
            if (popupPosition === 'top' || (rect.bottom + 350 > window.innerHeight && rect.top > 350)) {
                top = rect.top - 360; // Approximate height of calendar
            }

            setCoords({ top, left });
        };

        updatePosition();
        
        // Recalculate on scroll or resize to keep it attached
        window.addEventListener('scroll', updatePosition, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', updatePosition, true);
            window.removeEventListener('resize', updatePosition);
        };
    }
  }, [isComponentOpen, popupPosition]);

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
    <div className={`relative w-full ${containerClassName}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {label}
        </label>
      )}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setComponentOpen(!isComponentOpen)}
        disabled={disabled}
        className={`w-full p-2.5 border bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg text-left flex justify-between items-center text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-primary transition-colors disabled:opacity-60 disabled:cursor-not-allowed`}
        {...props}
      >
        <span className="flex items-center gap-2 overflow-hidden">
            <CalendarIcon size={16} className="text-gray-400 shrink-0" />
            <span className="truncate">{formattedDate}</span>
        </span>
      </button>

      {/* Render via Portal to break out of any squeezed containers */}
      {isComponentOpen && createPortal(
          <div className="fixed inset-0 z-[99999] isolate">
              {/* Invisible Backdrop for clicking outside */}
              <div className="fixed inset-0 bg-transparent" onClick={() => setComponentOpen(false)} />
              
              {/* Floating Popup */}
              <div 
                  className="fixed z-[100002] animate-scale-in"
                  style={{ 
                      top: coords.top, 
                      left: coords.left,
                      width: '320px', // Fixed width to prevent squeezing
                      maxWidth: '100vw'
                  }}
              >
                  <div className="bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden ring-1 ring-black/5">
                      <Calendar value={value} onChange={handleDateSelect} />
                  </div>
              </div>
          </div>,
          document.body
      )}
    </div>
  );
};

export default ModernDateInput;