import React from 'react';
import { X } from 'lucide-react';
import { AdvancedSearch } from './AdvancedSearch';
import { Page } from '../types';

interface UniversalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: Page, id: string) => void;
}

const UniversalSearch: React.FC<UniversalSearchProps> = ({ isOpen, onClose, onNavigate }) => {
    if (!isOpen) return null;

    // Adapt onNavigate string types to Page type if necessary, or assume AdvancedSearch uses same types
    const handleNavigate = (type: string, id: string) => {
        // Map 'Invoice' -> 'SALES', 'Customer' -> 'CUSTOMERS'
        if (type === 'SALES' || type === 'Invoice') onNavigate('SALES', id);
        else if (type === 'CUSTOMERS' || type === 'Customer') onNavigate('CUSTOMERS', id);
        else if (type === 'PURCHASES') onNavigate('PURCHASES', id);
        else if (type === 'PRODUCTS') onNavigate('PRODUCTS', id);
        
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex flex-col p-4 animate-fade-in-fast backdrop-blur-sm" role="dialog" aria-modal="true">
            <div className="w-full max-w-3xl mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Universal Search</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto bg-gray-50 dark:bg-slate-900 flex-grow">
                    <AdvancedSearch onNavigate={handleNavigate} />
                </div>
            </div>
        </div>
    );
};

export default UniversalSearch;