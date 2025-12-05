
import React, { useState, useRef, useEffect } from 'react';
import { Plus, UserPlus, ShoppingCart, PackagePlus, Undo2, FileText, Receipt } from 'lucide-react';
import { Page } from '../types';
import { useOnClickOutside } from '../hooks/useOnClickOutside';

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
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    
    const fabRef = useRef<HTMLDivElement>(null);
    const dragStartPos = useRef({ x: 0, y: 0 });
    const initialTouchPos = useRef({ x: 0, y: 0 });
    const hasMoved = useRef(false);

    useOnClickOutside(fabRef, () => {
        if (isOpen) setIsOpen(false);
    });

    // Initialize position to bottom right on mount
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setPosition({ 
                x: window.innerWidth - 80, 
                y: window.innerHeight - 140 
            });
        }
    }, []);

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        setIsDragging(true);
        hasMoved.current = false;
        initialTouchPos.current = { x: clientX, y: clientY };
        
        if (fabRef.current) {
            const rect = fabRef.current.getBoundingClientRect();
            dragStartPos.current = {
                x: clientX - rect.left,
                y: clientY - rect.top
            };
        }
    };

    const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        if (!isDragging) return;
        
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;

        if (Math.abs(clientX - initialTouchPos.current.x) > 5 || Math.abs(clientY - initialTouchPos.current.y) > 5) {
            hasMoved.current = true;
        }

        let newX = clientX - dragStartPos.current.x;
        let newY = clientY - dragStartPos.current.y;

        const maxX = window.innerWidth - 70;
        const maxY = window.innerHeight - 70;
        
        newX = Math.max(10, Math.min(newX, maxX));
        newY = Math.max(10, Math.min(newY, maxY));

        setPosition({ x: newX, y: newY });
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
    };

    const handleClick = () => {
        if (!hasMoved.current) {
            setIsOpen(!isOpen);
        }
    };

    const actions: FabAction[] = [
        { icon: UserPlus, label: 'Add Customer', page: 'CUSTOMERS', action: 'new' },
        { icon: ShoppingCart, label: 'New Sale', page: 'SALES' },
        { icon: PackagePlus, label: 'New Purchase', page: 'PURCHASES', action: 'new' },
        { icon: Receipt, label: 'Add Expense', page: 'EXPENSES' },
        { icon: FileText, label: 'New Estimate', page: 'QUOTATIONS' },
        { icon: Undo2, label: 'New Return', page: 'RETURNS' },
    ];
    
    const handleActionClick = (page: Page, action?: 'new') => {
        setIsOpen(false);
        onNavigate(page, action);
    }

    const isTopHalf = position.y < window.innerHeight / 2;
    const isLeftHalf = position.x < window.innerWidth / 2;

    return (
        <div 
            ref={fabRef} 
            className="fixed z-[100] md:hidden touch-none"
            style={{ left: position.x, top: position.y }}
        >
            {/* Backdrop for menu */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/20 -z-10 transition-opacity" 
                    onClick={() => setIsOpen(false)}
                />
            )}
            
            {/* Card Menu */}
            {isOpen && (
                <div 
                    className={`absolute ${isTopHalf ? 'top-[110%]' : 'bottom-[110%]'} ${isLeftHalf ? 'left-0' : 'right-0'} w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-2 animate-scale-in z-50 ring-1 ring-black/5 origin-${isTopHalf ? 'top' : 'bottom'}-${isLeftHalf ? 'left' : 'right'}`}
                >
                    {actions.map((action, idx) => (
                        <button
                            key={idx}
                            onClick={(e) => { e.stopPropagation(); handleActionClick(action.page, action.action); }}
                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left group/item"
                        >
                            <div className="p-2 bg-gray-100 dark:bg-slate-700 group-hover/item:bg-white dark:group-hover/item:bg-slate-600 rounded-lg text-primary shadow-sm transition-transform group-hover/item:scale-110">
                                <action.icon size={18} />
                            </div>
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{action.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Main FAB */}
            <button
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleClick}
                className={`bg-theme text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl transform active:scale-95 transition-all duration-300 relative overflow-hidden ring-2 ring-white/20 ${isOpen ? 'rotate-45 scale-105 shadow-2xl' : ''}`}
                aria-expanded={isOpen}
                aria-label="Open quick actions menu"
            >
                <Plus strokeWidth={3} size={28} />
            </button>
        </div>
    );
};

export default FloatingActionButton;
