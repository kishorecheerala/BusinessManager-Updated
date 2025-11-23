
import React, { useState, useRef } from 'react';
import { Plus, X, UserPlus, ShoppingCart, PackagePlus, Undo2 } from 'lucide-react';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { Page } from '../types';

interface FloatingActionButtonProps {
    onNavigate: (page: Page, action?: 'new') => void;
}

interface FabAction {
    icon: React.ElementType;
    label: string;
    page: Page;
    action?: 'new';
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onNavigate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const fabRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(fabRef, () => setIsOpen(false));

    const actions: FabAction[] = [
        { icon: UserPlus, label: 'Add Customer', page: 'CUSTOMERS', action: 'new' },
        { icon: ShoppingCart, label: 'New Sale', page: 'SALES' },
        { icon: PackagePlus, label: 'New Purchase', page: 'PURCHASES', action: 'new' },
        { icon: Undo2, label: 'New Return', page: 'RETURNS' },
    ];
    
    const handleActionClick = (page: Page, action?: 'new') => {
        setIsOpen(false);
        onNavigate(page, action);
    }

    return (
        <div ref={fabRef} className="fixed bottom-20 right-4 z-[100] md:hidden">
            {/* Backdrop */}
            {isOpen && <div className="fixed inset-0 bg-black bg-opacity-40" />}
            
            {/* Speed Dial Menu */}
            <div 
                className={`flex flex-col items-end space-y-3 transition-all duration-300 ease-in-out ${
                    isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
            >
                {actions.map((action, index) => (
                    <div 
                        key={action.page}
                        className="flex items-center gap-3"
                        style={{ transitionDelay: `${isOpen ? index * 30 : 0}ms` }}
                    >
                        <span className="bg-white text-sm text-primary font-semibold px-3 py-1 rounded-md shadow-md">
                            {action.label}
                        </span>
                        <button
                            onClick={() => handleActionClick(action.page, action.action)}
                            className="bg-white text-primary w-12 h-12 rounded-full flex items-center justify-center shadow-lg hover:bg-purple-50"
                            aria-label={action.label}
                        >
                            <action.icon className="w-6 h-6" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Main FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="bg-primary text-white w-16 h-16 rounded-full flex items-center justify-center shadow-xl mt-4 transform hover:scale-105 transition-transform"
                aria-expanded={isOpen}
                aria-label="Open quick actions menu"
            >
                <div className="relative w-7 h-7">
                    <Plus 
                        className={`absolute top-0 left-0 transition-all duration-300 ease-in-out ${
                            isOpen ? 'transform rotate-45 scale-75 opacity-0' : 'transform rotate-0 scale-100 opacity-100'
                        }`}
                        strokeWidth={3}
                    />
                    <X 
                        className={`absolute top-0 left-0 transition-all duration-300 ease-in-out ${
                            isOpen ? 'transform rotate-0 scale-100 opacity-100' : 'transform -rotate-45 scale-75 opacity-0'
                        }`}
                        strokeWidth={3}
                    />
                </div>
            </button>
        </div>
    );
};

export default FloatingActionButton;
