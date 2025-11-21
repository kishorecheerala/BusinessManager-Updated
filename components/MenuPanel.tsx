import React from 'react';
import { User, BarChart2 } from 'lucide-react';
import { Page } from '../types';

interface MenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileClick: () => void;
  onNavigate: (page: Page) => void;
}

const MenuPanel: React.FC<MenuPanelProps> = ({ isOpen, onClose, onProfileClick, onNavigate }) => {
    if (!isOpen) return null;

    return (
        <div 
          className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 text-text dark:text-slate-200 animate-scale-in origin-top-left z-40"
          role="dialog"
          aria-label="Main Menu"
        >
            <div className="p-2">
                <button
                    onClick={onProfileClick}
                    className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">My Business Profile</span>
                </button>
                <button
                    onClick={() => onNavigate('INSIGHTS')}
                    className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <BarChart2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">Business Insights</span>
                </button>
            </div>
        </div>
    );
};

export default MenuPanel;