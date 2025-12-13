import React, { useState, useRef, ReactNode, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search } from 'lucide-react';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

export interface DropdownOption {
  value: string;
  label: ReactNode;
  searchText?: string; // Optional text for searching
}

interface DropdownProps {
  options: DropdownOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  icon?: 'chevron' | 'search';
  className?: string;
}

const Dropdown: React.FC<DropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Search...',
  icon = 'chevron',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the dropdown menu itself
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [positionClass, setPositionClass] = useState('origin-top');

  useOnClickOutside(dropdownRef, () => setIsOpen(false), triggerRef);

  const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);

  const filteredOptions = useMemo(() => {
    if (!searchable || !searchTerm) {
      return options;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return options.filter(option =>
      (option.searchText || (typeof option.label === 'string' ? option.label : ''))
        .toLowerCase()
        .includes(lowercasedTerm)
    );
  }, [options, searchTerm, searchable]);

  const handleTriggerClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (!disabled) {
      if (!isOpen && triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const popupHeight = 250; // Approximated

        let top;
        // If there's not enough space below AND there's more space above, open upwards.
        if (spaceBelow < popupHeight && spaceAbove > spaceBelow) {
          const calculatedTop = rect.top - Math.min(popupHeight, spaceAbove - 10) - 4;
          top = Math.max(10, calculatedTop); // Ensure it doesn't go off-screen top
          setPositionClass('origin-bottom');
        } else {
          top = rect.bottom + 4; // Position below
          setPositionClass('origin-top');
        }

        setCoords({
          top: top,
          left: rect.left,
          width: rect.width
        });
      }
      setIsOpen(prev => !prev);
    }
  };

  const handleOptionClick = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const TriggerIcon = icon === 'search' ? Search : ChevronDown;

  const DropdownMenu = () => (
    <div
      ref={dropdownRef}
      className={`fixed bg-white dark:bg-slate-800 rounded-lg shadow-2xl border dark:border-slate-700 z-[100000] animate-scale-in flex flex-col overflow-hidden ring-1 ring-black/5 ${positionClass}`}
      style={{
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        maxHeight: '250px'
      }}
    >
      {searchable && (
        <div className="p-2 border-b dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full p-2 pl-8 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          </div>
        </div>
      )}
      <ul className="overflow-y-auto custom-scrollbar" role="listbox">
        {filteredOptions.length > 0 ? filteredOptions.map(option => (
          <li
            key={option.value}
            onClick={() => handleOptionClick(option.value)}
            className={`px-3 py-2 text-sm hover:bg-primary/5 dark:hover:bg-slate-700 cursor-pointer ${value === option.value ? 'bg-primary/10 font-semibold text-primary dark:bg-primary/20' : 'text-gray-700 dark:text-gray-200'}`}
            role="option"
            aria-selected={value === option.value}
          >
            {option.label}
          </li>
        )) : (
          <li className="px-4 py-3 text-sm text-gray-500 text-center">No options found.</li>
        )}
      </ul>
    </div >
  );

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleTriggerClick}
        disabled={disabled}
        className="w-full p-2.5 border rounded-lg bg-white text-left flex justify-between items-center dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-slate-800 transition-colors shadow-sm"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`truncate text-sm ${!selectedOption ? 'text-gray-500 dark:text-gray-400' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <TriggerIcon
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${icon === 'chevron' && isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && createPortal(<DropdownMenu />, document.body)}
    </div>
  );
};

export default Dropdown;