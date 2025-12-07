
import React, { useState, useRef, ReactNode, useMemo } from 'react';
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown if a click is detected outside of the component
  useOnClickOutside(dropdownRef, () => {
      if (isOpen) {
          setIsOpen(false);
      }
  });

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
    if (!disabled) setIsOpen(prev => !prev);
  };
  
  const handleOptionClick = (selectedValue: string) => {
    onChange(selectedValue);
    setIsOpen(false);
  };

  const TriggerIcon = icon === 'search' ? Search : ChevronDown;

  return (
    <div ref={dropdownRef} className={`relative ${className} ${isOpen ? 'z-[1000]' : ''}`}>
      <button
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
      
      {isOpen && (
        <div 
          className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 z-[1000] animate-scale-in flex flex-col overflow-hidden ring-1 ring-black/5"
          style={{ maxHeight: '250px' }}
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
        </div>
      )}
    </div>
  );
};

export default Dropdown;
