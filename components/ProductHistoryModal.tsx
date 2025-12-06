
import React, { useMemo } from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Calendar, TrendingUp, User, Package, History, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product } from '../types';
import Card from './Card';
import Button from './Button';

interface ProductHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    product?: Product;
}

interface HistoryEntry {
    id: string;
    date: string;
    type: 'SALE' | 'PURCHASE' | 'RETURN_IN' | 'RETURN_OUT' | 'ADJUSTMENT';
    quantity: number;
    price: number;
    partyName: string;
    refId: string;
    productName: string;
}

const ProductHistoryModal: React.FC<ProductHistoryModalProps> = ({ isOpen, onClose, product }) => {
    const { state } = useAppContext();

    const historyData = useMemo(() => {
        const entries: HistoryEntry[] = [];

        // 1. Sales (Stock Out)
        state.sales.forEach(sale => {
            sale.items.forEach(item => {
                if (product && item.productId !== product.id) return;

                const customer = state.customers.find(c => c.id === sale.customerId);
                entries.push({
                    id: `SALE-${sale.id}-${item.productId}`,
                    date: sale.date,
                    type: 'SALE',
                    quantity: -item.quantity, // Negative for stock out
                    price: item.price,
                    partyName: customer?.name || 'Unknown Customer',
                    refId: sale.id,
                    productName: item.productName
                });
            });
        });

        // 2. Purchases (Stock In)
        state.purchases.forEach(purchase => {
            purchase.items.forEach(item => {
                if (product && item.productId !== product.id) return;

                const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
                entries.push({
                    id: `PUR-${purchase.id}-${item.productId}`,
                    date: purchase.date,
                    type: 'PURCHASE',
                    quantity: item.quantity, // Positive for stock in
                    price: item.price,
                    partyName: supplier?.name || 'Unknown Supplier',
                    refId: purchase.supplierInvoiceId || purchase.id,
                    productName: item.productName
                });
            });
        });

        // 3. Returns
        state.returns.forEach(ret => {
            ret.items.forEach(item => {
                if (product && item.productId !== product.id) return;

                let partyName = 'Unknown';
                let type: HistoryEntry['type'] = 'RETURN_IN';
                let qty = item.quantity;

                if (ret.type === 'CUSTOMER') {
                    // Customer Return -> Stock In
                    const c = state.customers.find(cust => cust.id === ret.partyId);
                    partyName = c?.name || 'Customer';
                    type = 'RETURN_IN';
                } else {
                    // Supplier Return -> Stock Out
                    const s = state.suppliers.find(sup => sup.id === ret.partyId);
                    partyName = s?.name || 'Supplier';
                    type = 'RETURN_OUT';
                    qty = -item.quantity;
                }

                entries.push({
                    id: `RET-${ret.id}-${item.productId}`,
                    date: ret.returnDate,
                    type: type,
                    quantity: qty,
                    price: item.price,
                    partyName: partyName,
                    refId: ret.id,
                    productName: item.productName
                });
            });
        });

        // Sort descending by date
        return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.sales, state.purchases, state.returns, state.customers, state.suppliers, product]);

    const stats = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        let soldToday = 0;
        let soldMonth = 0;
        let totalSold = 0;

        historyData.forEach(entry => {
            if (entry.type === 'SALE') {
                const entryDate = new Date(entry.date);
                const qty = Math.abs(entry.quantity);
                
                totalSold += qty;

                if (entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear) {
                    soldMonth += qty;
                    if (entryDate.getDate() === today.getDate()) {
                        soldToday += qty;
                    }
                }
            }
        });

        return { soldToday, soldMonth, totalSold };
    }, [historyData]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in-fast backdrop-blur-sm">
            <Card className="w-full max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden animate-scale-in border-none shadow-2xl bg-white dark:bg-slate-900">
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0">
                    <div>
                        <div className="flex items-center gap-2">
                            <History className="text-indigo-500" size={20} />
                            <h2 className="font-bold text-lg text-slate-800 dark:text-white">
                                {product ? 'Product Flow' : 'Global Stock Flow'}
                            </h2>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            {product ? product.name : 'All Products History'}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Stats Bar */}
                <div className={`grid ${product ? 'grid-cols-4' : 'grid-cols-3'} gap-px bg-slate-200 dark:bg-slate-700 shrink-0`}>
                    <div className="bg-white dark:bg-slate-800 p-3 text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Sold Today</p>
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{stats.soldToday}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">This Month</p>
                        <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{stats.soldMonth}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-3 text-center">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Total Sold</p>
                        <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{stats.totalSold}</p>
                    </div>
                    {product && (
                        <div className="bg-white dark:bg-slate-800 p-3 text-center">
                            <p className="text-[10px] text-slate-500 uppercase font-bold">Current Stock</p>
                            <p className={`text-lg font-bold ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                {product.quantity}
                            </p>
                        </div>
                    )}
                </div>

                {/* Timeline List */}
                <div className="flex-grow overflow-y-auto p-4 bg-slate-50 dark:bg-slate-900/50">
                    {historyData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <History size={48} className="mb-2 opacity-20" />
                            <p>No transaction history found.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {historyData.map((entry, idx) => {
                                const isIncoming = entry.quantity > 0;
                                return (
                                    <div key={`${entry.id}-${idx}`} className="bg-white dark:bg-slate-800 p-3 rounded-xl border dark:border-slate-700 flex items-center gap-3 shadow-sm">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                            entry.type === 'SALE' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' :
                                            entry.type === 'PURCHASE' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                            entry.type === 'RETURN_IN' ? 'bg-orange-100 text-orange-600' :
                                            'bg-red-100 text-red-600'
                                        }`}>
                                            {entry.type === 'SALE' && <ArrowUpRight size={18} />}
                                            {entry.type === 'PURCHASE' && <ArrowDownLeft size={18} />}
                                            {entry.type.includes('RETURN') && <AlertCircle size={18} />}
                                        </div>
                                        
                                        <div className="flex-grow min-w-0">
                                            <div className="flex justify-between items-start">
                                                <div className="min-w-0 pr-2">
                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                                                        {product ? entry.type.replace('_', ' ') : entry.productName}
                                                    </p>
                                                    {!product && (
                                                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wide">
                                                            {entry.type.replace('_', ' ')}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className={`text-sm font-bold font-mono whitespace-nowrap ${isIncoming ? 'text-green-600' : 'text-red-500'}`}>
                                                    {isIncoming ? '+' : ''}{entry.quantity}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-end mt-0.5">
                                                <div>
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                                        {entry.type === 'PURCHASE' ? <Package size={12}/> : <User size={12}/>} 
                                                        {entry.partyName}
                                                    </p>
                                                    <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                                                        Ref: {entry.refId}
                                                    </p>
                                                </div>
                                                <p className="text-[10px] text-slate-400">
                                                    {new Date(entry.date).toLocaleDateString()} {new Date(entry.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0">
                    <Button onClick={onClose} variant="secondary" className="w-full">Close</Button>
                </div>
            </Card>
        </div>
    );
};

export default ProductHistoryModal;
