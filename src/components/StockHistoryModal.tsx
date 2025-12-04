
import React, { useState, useEffect } from 'react';
import { X, History, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product, StockHistoryEntry } from '../types';
import Card from './Card';
import Button from './Button';

interface StockHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    product: Product;
}

const StockHistoryModal: React.FC<StockHistoryModalProps> = ({ isOpen, onClose, product }) => {
    const { state } = useAppContext();
    const [history, setHistory] = useState<StockHistoryEntry[]>([]);

    useEffect(() => {
        if (isOpen && product) {
            // Filter history for this product and sort descending by time
            const productHistory = state.stock_history
                .filter(h => h.productId === product.id)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            setHistory(productHistory);
        }
    }, [isOpen, product, state.stock_history]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4 animate-fade-in-fast">
            <Card className="w-full max-w-lg h-[80vh] flex flex-col p-0 overflow-hidden animate-scale-in shadow-2xl">
                {/* Header */}
                <div className="bg-white dark:bg-slate-900 p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2">
                            <History size={20} className="text-primary" />
                            Stock History
                        </h2>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{product.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors text-gray-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-y-auto p-4 bg-gray-50 dark:bg-slate-900/50">
                    {history.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <AlertCircle size={48} className="mb-2 opacity-50" />
                            <p>No history recorded for this item yet.</p>
                        </div>
                    ) : (
                        <div className="relative border-l-2 border-gray-200 dark:border-slate-700 ml-4 space-y-6">
                            {history.map((entry, idx) => {
                                const isPositive = entry.change > 0;
                                const isZero = entry.change === 0;
                                return (
                                    <div key={entry.id} className="relative pl-6">
                                        {/* Timeline Dot */}
                                        <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-white dark:border-slate-900 ${isPositive ? 'bg-green-500' : isZero ? 'bg-gray-400' : 'bg-red-500'}`}></div>
                                        
                                        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-gray-100 dark:border-slate-700 shadow-sm">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{entry.reason}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(entry.timestamp).toLocaleString()}</span>
                                            </div>
                                            
                                            <div className="flex items-center gap-2 text-sm mb-1">
                                                <span className={`font-bold ${isPositive ? 'text-green-600' : isZero ? 'text-gray-500' : 'text-red-600'}`}>
                                                    {isPositive ? '+' : ''}{entry.change}
                                                </span>
                                                <span className="text-gray-400 text-xs">→</span>
                                                <span className="font-mono text-gray-600 dark:text-gray-300">
                                                    New Balance: {entry.newQuantity}
                                                </span>
                                            </div>
                                            
                                            {entry.referenceId && (
                                                <div className="text-[10px] text-gray-500 bg-gray-50 dark:bg-slate-700/50 px-2 py-1 rounded inline-block font-mono">
                                                    Ref: {entry.referenceId}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-700 shrink-0 flex justify-between items-center">
                    <div className="text-xs text-gray-500">
                        Current Stock: <span className={`font-bold ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>{product.quantity}</span>
                    </div>
                    <Button onClick={onClose} variant="secondary" className="px-4 py-2 text-xs h-auto">
                        Close
                    </Button>
                </div>
            </Card>
        </div>
    );
};

export default StockHistoryModal;
