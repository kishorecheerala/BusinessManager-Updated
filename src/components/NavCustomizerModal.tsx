
import React, { useState, useEffect } from 'react';
import { X, GripVertical, Check, Info, Plus, Trash2 } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { Page } from '../types';
import { Home, Users, ShoppingCart, Package, Receipt, Undo2, FileText, BarChart2, PenTool, Gauge, UserPlus, PackagePlus } from 'lucide-react';

interface NavCustomizerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PAGE_ICONS: Record<string, React.ElementType> = {
    'DASHBOARD': Home,
    'CUSTOMERS': Users,
    'SALES': ShoppingCart,
    'PURCHASES': Package,
    'INSIGHTS': BarChart2,
    'PRODUCTS': Package, 
    'REPORTS': FileText,
    'EXPENSES': Receipt,
    'RETURNS': Undo2,
    'QUOTATIONS': FileText,
    'INVOICE_DESIGNER': PenTool,
};

const PAGE_LABELS: Record<string, string> = {
    'DASHBOARD': 'Home',
    'CUSTOMERS': 'Customers',
    'SALES': 'Sales',
    'PURCHASES': 'Purchases',
    'INSIGHTS': 'Insights',
    'PRODUCTS': 'Products',
    'REPORTS': 'Reports',
    'EXPENSES': 'Expenses',
    'RETURNS': 'Returns',
    'QUOTATIONS': 'Estimates',
    'INVOICE_DESIGNER': 'Designer',
};

const QUICK_ACTION_META: Record<string, { icon: React.ElementType, label: string }> = {
    'add_sale': { icon: ShoppingCart, label: 'Sale' },
    'add_customer': { icon: UserPlus, label: 'Customer' },
    'add_expense': { icon: Receipt, label: 'Expense' },
    'add_purchase': { icon: PackagePlus, label: 'Purchase' },
    'add_quote': { icon: FileText, label: 'Estimate' },
    'add_return': { icon: Undo2, label: 'Return' },
    'view_products': { icon: Package, label: 'Products' },
    'view_reports': { icon: FileText, label: 'Reports' },
    'view_insights': { icon: BarChart2, label: 'Insights' },
};

const NavCustomizerModal: React.FC<NavCustomizerModalProps> = ({ isOpen, onClose }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [activeTab, setActiveTab] = useState<'nav' | 'quick'>('nav');
    const [currentNavOrder, setCurrentNavOrder] = useState<string[]>([]);
    const [currentQuickActions, setCurrentQuickActions] = useState<string[]>([]);
    
    // For manual drag fallback (touch-based swapping)
    const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
    const [selectedForSwap, setSelectedForSwap] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen) {
            // Filter out SYSTEM_OPTIMIZER if it exists in persisted state to avoid errors
            setCurrentNavOrder([...state.navOrder].filter(id => id !== 'SYSTEM_OPTIMIZER'));
            setCurrentQuickActions([...state.quickActions]);
        }
    }, [isOpen, state.navOrder, state.quickActions]);

    const handleSave = () => {
        if (activeTab === 'nav') {
            dispatch({ type: 'UPDATE_NAV_ORDER', payload: currentNavOrder });
            showToast("Navigation layout updated.");
        } else {
            dispatch({ type: 'UPDATE_QUICK_ACTIONS', payload: currentQuickActions });
            showToast("Quick actions updated.");
        }
        onClose();
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        e.dataTransfer.setData("text/plain", index.toString());
        e.dataTransfer.effectAllowed = "move";
        setDraggedItemIndex(index);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number, listType: 'nav' | 'quick') => {
        e.preventDefault();
        const dragIndexStr = e.dataTransfer.getData("text/plain");
        const dragIndex = parseInt(dragIndexStr, 10);
        
        if (dragIndex !== dropIndex) {
            if (listType === 'nav') {
                const newOrder = [...currentNavOrder];
                const [movedItem] = newOrder.splice(dragIndex, 1);
                newOrder.splice(dropIndex, 0, movedItem);
                setCurrentNavOrder(newOrder);
            } else {
                const newOrder = [...currentQuickActions];
                const [movedItem] = newOrder.splice(dragIndex, 1);
                newOrder.splice(dropIndex, 0, movedItem);
                setCurrentQuickActions(newOrder);
            }
        }
        setDraggedItemIndex(null);
    };

    const handleItemClick = (index: number, listType: 'nav' | 'quick') => {
        if (selectedForSwap === null) {
            setSelectedForSwap(index);
        } else {
            // Swap
            if (listType === 'nav') {
                const newOrder = [...currentNavOrder];
                const itemA = newOrder[selectedForSwap];
                const itemB = newOrder[index];
                newOrder[selectedForSwap] = itemB;
                newOrder[index] = itemA;
                setCurrentNavOrder(newOrder);
            } else {
                const newOrder = [...currentQuickActions];
                const itemA = newOrder[selectedForSwap];
                const itemB = newOrder[index];
                newOrder[selectedForSwap] = itemB;
                newOrder[index] = itemA;
                setCurrentQuickActions(newOrder);
            }
            setSelectedForSwap(null);
        }
    };

    const toggleQuickAction = (actionId: string) => {
        if (currentQuickActions.includes(actionId)) {
            setCurrentQuickActions(currentQuickActions.filter(id => id !== actionId));
        } else {
            setCurrentQuickActions([...currentQuickActions, actionId]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 animate-fade-in-fast backdrop-blur-sm">
            <Card className="w-full max-w-sm h-[80vh] flex flex-col p-0 overflow-hidden bg-gray-50 dark:bg-slate-900 border-none shadow-2xl">
                <div className="bg-white dark:bg-slate-800 p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Customize</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex bg-white dark:bg-slate-800 border-b dark:border-slate-700">
                    <button 
                        onClick={() => { setActiveTab('nav'); setSelectedForSwap(null); }}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'nav' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
                    >
                        Navigation Bar
                    </button>
                    <button 
                        onClick={() => { setActiveTab('quick'); setSelectedForSwap(null); }}
                        className={`flex-1 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'quick' ? 'border-primary text-primary' : 'border-transparent text-gray-500'}`}
                    >
                        Quick Actions
                    </button>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-300 flex items-start gap-2 shrink-0">
                    <Info size={16} className="mt-0.5 shrink-0" />
                    <p>
                        {activeTab === 'nav' 
                            ? "Drag items to reorder. The top 4 appear in the main bar, others in 'More'." 
                            : "Select items to show in the Quick Add (+) menu. Drag to reorder active items."}
                        <br/><span className="opacity-70 mt-1 block">(Or tap item A then B to swap)</span>
                    </p>
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-6">
                    {activeTab === 'nav' ? (
                        <>
                            <div>
                                <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 pl-2">Bottom Bar (Visible)</h3>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                    {currentNavOrder.slice(0, 4).map((pageId, idx) => {
                                        const Icon = PAGE_ICONS[pageId];
                                        const isSelected = selectedForSwap === idx;
                                        // Skip if icon/label missing (e.g. removed system page)
                                        if (!Icon) return null;
                                        return (
                                            <div 
                                                key={pageId}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, idx)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, idx, 'nav')}
                                                onClick={() => handleItemClick(idx, 'nav')}
                                                className={`flex items-center gap-3 p-3 border-b dark:border-slate-700 last:border-0 active:bg-blue-50 dark:active:bg-blue-900/30 transition-colors cursor-move ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-inset ring-blue-500' : ''}`}
                                            >
                                                <GripVertical size={18} className="text-gray-400" />
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                    <Icon size={20} />
                                                </div>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">{PAGE_LABELS[pageId]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            <div>
                                <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 pl-2">More Menu (Hidden)</h3>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                    {currentNavOrder.slice(4).map((pageId, idx) => {
                                        const actualIdx = idx + 4;
                                        const Icon = PAGE_ICONS[pageId];
                                        const isSelected = selectedForSwap === actualIdx;
                                        if (!Icon) return null;
                                        return (
                                            <div 
                                                key={pageId}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, actualIdx)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, actualIdx, 'nav')}
                                                onClick={() => handleItemClick(actualIdx, 'nav')}
                                                className={`flex items-center gap-3 p-3 border-b dark:border-slate-700 last:border-0 active:bg-blue-50 dark:active:bg-blue-900/30 transition-colors cursor-move ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-inset ring-blue-500' : ''}`}
                                            >
                                                <GripVertical size={18} className="text-gray-400" />
                                                <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg text-gray-500 dark:text-gray-400">
                                                    <Icon size={20} />
                                                </div>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">{PAGE_LABELS[pageId]}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div>
                                <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 pl-2">Active Actions (Reorder)</h3>
                                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                                    {currentQuickActions.map((actionId, idx) => {
                                        const meta = QUICK_ACTION_META[actionId];
                                        const Icon = meta.icon;
                                        const isSelected = selectedForSwap === idx;
                                        return (
                                            <div 
                                                key={actionId}
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, idx)}
                                                onDragOver={handleDragOver}
                                                onDrop={(e) => handleDrop(e, idx, 'quick')}
                                                onClick={() => handleItemClick(idx, 'quick')}
                                                className={`flex items-center gap-3 p-3 border-b dark:border-slate-700 last:border-0 active:bg-blue-50 dark:active:bg-blue-900/30 transition-colors cursor-move ${isSelected ? 'bg-blue-100 dark:bg-blue-900/50 ring-2 ring-inset ring-blue-500' : ''}`}
                                            >
                                                <GripVertical size={18} className="text-gray-400" />
                                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                                    <Icon size={20} />
                                                </div>
                                                <span className="font-medium text-gray-700 dark:text-gray-200">{meta.label}</span>
                                                <button onClick={(e) => { e.stopPropagation(); toggleQuickAction(actionId); }} className="ml-auto text-red-500 p-2">
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            <div>
                                <h3 className="text-xs font-bold uppercase text-gray-500 mb-2 pl-2">Available Actions</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(QUICK_ACTION_META).filter(id => !currentQuickActions.includes(id)).map(actionId => {
                                        const meta = QUICK_ACTION_META[actionId];
                                        const Icon = meta.icon;
                                        return (
                                            <button 
                                                key={actionId}
                                                onClick={() => toggleQuickAction(actionId)}
                                                className="flex items-center gap-2 p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left"
                                            >
                                                <div className="p-1.5 bg-gray-100 dark:bg-slate-700 rounded text-gray-500 dark:text-gray-400">
                                                    <Icon size={16} />
                                                </div>
                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{meta.label}</span>
                                                <Plus size={14} className="ml-auto text-green-600" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex gap-3 shrink-0">
                    <Button onClick={onClose} variant="secondary" className="flex-1">Cancel</Button>
                    <Button onClick={handleSave} className="flex-[2] bg-primary text-white shadow-lg">
                        <Check size={18} className="mr-2" /> Save Layout
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default NavCustomizerModal;