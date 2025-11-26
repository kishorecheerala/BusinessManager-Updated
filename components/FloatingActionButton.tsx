
import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, UserPlus, ShoppingCart, PackagePlus, Undo2, FileText } from 'lucide-react';
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
        setPosition({ 
            x: window.innerWidth - 70, 
            y: window.innerHeight - 120 
        });
    }, []);

    const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        // Only dragging the main button
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

        // Check if moved significantly to count as drag
        if (Math.abs(clientX - initialTouchPos.current.x) > 5 || Math.abs(clientY - initialTouchPos.current.y) > 5) {
            hasMoved.current = true;
        }

        // Calculate new position
        let newX = clientX - dragStartPos.current.x;
        let newY = clientY - dragStartPos.current.y;

        // Constrain to screen
        const maxX = window.innerWidth - 60;
        const maxY = window.innerHeight - 60;
        
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
        { icon: FileText, label: 'New Estimate', page: 'QUOTATIONS' },
        { icon: Undo2, label: 'New Return', page: 'RETURNS' },
    ];
    
    const handleActionClick = (page: Page, action?: 'new') => {
        setIsOpen(false);
        onNavigate(page, action);
    }

    return (
        <div 
            ref={fabRef} 
            className="fixed z-[100] md:hidden touch-none"
            style={{ left: position.x, top: position.y }}
        >
            {/* Backdrop for menu */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-40 -z-10" 
                    onClick={() => setIsOpen(false)}
                />
            )}
            
            {/* Speed Dial Menu - Always anchored relative to button */}
            <div 
                className={`absolute bottom-full right-0 mb-4 flex flex-col items-end space-y-3 transition-all duration-300 ease-in-out ${
                    isOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
                }`}
                style={{ minWidth: '200px' }}
            >
                {actions.map((action, index) => (
                    <div 
                        key={action.page}
                        className="flex items-center justify-end gap-3 w-full"
                        style={{ transitionDelay: `${isOpen ? index * 30 : 0}ms` }}
                    >
                        <span className="bg-white dark:bg-slate-800 text-xs font-semibold text-gray-700 dark:text-gray-200 px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap border dark:border-slate-700">
                            {action.label}
                        </span>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleActionClick(action.page, action.action); }}
                            className="bg-white dark:bg-slate-800 text-primary w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:bg-purple-50 dark:hover:bg-slate-700 border dark:border-slate-700"
                            aria-label={action.label}
                        >
                            <action.icon className="w-5 h-5" />
                        </button>
                    </div>
                ))}
            </div>

            {/* Main FAB - Uses bg-theme for dynamic gradient */}
            <button
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={handleClick}
                className="bg-theme text-white w-12 h-12 rounded-full flex items-center justify-center shadow-xl transform active:scale-95 transition-transform relative overflow-hidden"
                aria-expanded={isOpen}
                aria-label="Open quick actions menu"
            >
                <div className="relative w-6 h-6 pointer-events-none">
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