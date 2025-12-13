
import React, { useMemo, useState } from 'react';

import { X, FileText, Download, ArrowUpRight, ArrowDownLeft, FileSpreadsheet, Calendar as CalendarIcon, Filter } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import Dropdown from './Dropdown';
import { getLocalDateString } from '../utils/dateUtils';
import { useAppContext } from '../context/AppContext';
import { generateGenericReportPDF } from '../utils/pdfGenerator';
import { exportReportToSheet } from '../utils/googleSheets';

interface LedgerModalProps {
    isOpen: boolean;
    onClose: () => void;
    partyId: string;
    partyType: 'CUSTOMER' | 'SUPPLIER';
}

interface LedgerEntry {
    date: string; // ISO
    id: string;
    type: 'INVOICE' | 'PAYMENT' | 'RETURN' | 'OPENING';
    description: string;
    debit: number;
    credit: number;
    balance: number;
}

const LedgerModal: React.FC<LedgerModalProps> = ({ isOpen, onClose, partyId, partyType }) => {
    const { state, showToast } = useAppContext();
    const [isExporting, setIsExporting] = useState(false);

    // Filters
    const [dateFilter, setDateFilter] = useState('ALL'); // ALL, TODAY, YESTERDAY, THIS_MONTH, LAST_MONTH
    const [accountFilter, setAccountFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

    const party = useMemo(() => {
        if (partyId === 'ALL_CUSTOMERS') return { id: 'ALL', name: 'All Customers Transaction History', phone: '', address: '', area: '' } as any;
        if (partyType === 'CUSTOMER') return state.customers.find(c => c.id === partyId);
        return state.suppliers.find(s => s.id === partyId);
    }, [partyId, partyType, state.customers, state.suppliers]);

    const ledgerData = useMemo(() => {
        let entries: LedgerEntry[] = [];

        // 1. Gather ALL Data First
        if (partyType === 'CUSTOMER') {
            const salesToProcess = partyId === 'ALL_CUSTOMERS' ? state.sales : state.sales.filter(s => s.customerId === partyId);

            salesToProcess.forEach(sale => {
                const customerName = partyId === 'ALL_CUSTOMERS' ? (state.customers.find(c => c.id === sale.customerId)?.name || 'Unknown') : '';
                entries.push({
                    date: sale.date,
                    id: sale.id,
                    type: 'INVOICE',
                    description: `Sale Invoice ${customerName ? ` - ${customerName}` : ''} (${sale.items.length} items)`,
                    debit: Number(sale.totalAmount),
                    credit: 0,
                    balance: 0
                });

                sale.payments.forEach(pay => {
                    // Filter Payment by Account if needed
                    if (accountFilter !== 'ALL' && pay.accountId !== accountFilter) return;

                    entries.push({
                        date: pay.date,
                        id: pay.id,
                        type: 'PAYMENT',
                        description: `Payment ${customerName ? ` - ${customerName}` : ''} via ${pay.method}` + (pay.accountId ? ` (${state.bankAccounts.find(a => a.id === pay.accountId)?.name || 'Bank'})` : ''),
                        debit: 0,
                        credit: Number(pay.amount),
                        balance: 0
                    });
                });
            });

            const returnsToProcess = partyId === 'ALL_CUSTOMERS' ? state.returns.filter(r => r.type === 'CUSTOMER') : state.returns.filter(r => r.type === 'CUSTOMER' && r.partyId === partyId);
            returnsToProcess.forEach(ret => {
                const customerName = partyId === 'ALL_CUSTOMERS' ? (state.customers.find(c => c.id === ret.partyId)?.name || 'Unknown') : '';
                entries.push({
                    date: ret.returnDate,
                    id: ret.id,
                    type: 'RETURN',
                    description: `Return Credit ${customerName ? ` - ${customerName}` : ''}`,
                    debit: 0,
                    credit: Number(ret.amount),
                    balance: 0
                });
            });

        } else {
            // Supplier Logic (Keep as is for now, can extend later)
            state.purchases.filter(p => p.supplierId === partyId).forEach(purchase => {
                entries.push({
                    date: purchase.date,
                    id: purchase.id,
                    type: 'INVOICE',
                    description: `Purchase Invoice`,
                    debit: 0,
                    credit: Number(purchase.totalAmount),
                    balance: 0
                });

                purchase.payments.forEach(pay => {
                    if (accountFilter !== 'ALL' && pay.accountId !== accountFilter) return;

                    entries.push({
                        date: pay.date,
                        id: pay.id,
                        type: 'PAYMENT',
                        description: `Paid via ${pay.method}`,
                        debit: Number(pay.amount),
                        credit: 0,
                        balance: 0
                    });
                });
            });

            state.returns.filter(r => r.type === 'SUPPLIER' && r.partyId === partyId).forEach(ret => {
                entries.push({
                    date: ret.returnDate,
                    id: ret.id,
                    type: 'RETURN',
                    description: `Debit Note`,
                    debit: Number(ret.amount),
                    credit: 0,
                    balance: 0
                });
            });
        }

        // Sort by Date
        entries.sort((a, b) => {
            const timeA = new Date(a.date).getTime();
            const timeB = new Date(b.date).getTime();
            return sortOrder === 'ASC' ? timeA - timeB : timeB - timeA;
        });

        // 2. Calculate Opening Balance based on Date Filter
        let startDate = new Date(0); // Epoch
        const now = new Date();

        if (dateFilter === 'TODAY') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (dateFilter === 'YESTERDAY') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        } else if (dateFilter === 'THIS_MONTH') {
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        } else if (dateFilter === 'LAST_MONTH') {
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        }

        let openingBalance = 0;
        const filteredEntries: LedgerEntry[] = [];

        // For Balance Calculation, we MUST process chronologically (ASC) first
        // If sortOrder is DESC, we'll reverse the FINAL list, but calculation needs ASC.
        // So let's create a temp ASC sorted list for calculation.
        const calcEntries = [...entries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        calcEntries.forEach(entry => {
            const entryDate = new Date(entry.date);

            let netChange = 0;
            if (partyType === 'CUSTOMER') {
                netChange = entry.debit - entry.credit;
            } else {
                netChange = entry.credit - entry.debit;
            }

            if (dateFilter !== 'ALL' && entryDate < startDate) {
                openingBalance += netChange;
            } else {
                let include = true;
                if (dateFilter === 'YESTERDAY') {
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (entryDate >= todayStart) include = false;
                }
                if (dateFilter === 'LAST_MONTH') {
                    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (entryDate >= thisMonthStart) include = false;
                }

                if (include) {
                    filteredEntries.push(entry);
                }
            }
        });

        // Add Opening Balance Entry if needed
        if (dateFilter !== 'ALL' && Math.abs(openingBalance) > 0.01) {
            filteredEntries.unshift({
                date: startDate.toISOString(),
                id: 'OPENING',
                type: 'OPENING',
                description: 'Opening Balance (Previous / Filtered Out)',
                debit: openingBalance > 0 && partyType === 'CUSTOMER' ? openingBalance : 0,
                credit: openingBalance < 0 && partyType === 'CUSTOMER' ? Math.abs(openingBalance) : 0,
                balance: openingBalance
            });
        }

        let running = dateFilter !== 'ALL' ? openingBalance : 0;

        const calculated = filteredEntries.map((entry, idx) => {
            if (entry.type === 'OPENING') {
                return { ...entry, balance: running };
            }

            if (partyType === 'CUSTOMER') {
                running += entry.debit - entry.credit;
            } else {
                running += entry.credit - entry.debit;
            }
            return { ...entry, balance: running };
        });

        // Now if Sort Order is DESC, reverse the final list
        // Note: Running balance implies chronological order. If we show latest first, existing balance column might look weird (balance reduces as you go down? or balance is just snapshot at that time?).
        // Standard ledger usually shows chronological. But if user WANTS latest first, we just reverse the array.
        //The balance on the row should represent the balance "after" that transaction.
        // So 2024-01-01: Bal 100. 2024-01-02: Bal 200.
        // Desc: 2024-01-02: Bal 200. 2024-01-01: Bal 100.
        // This is correct.

        if (sortOrder === 'DESC') {
            return calculated.reverse();
        }
        return calculated;

    }, [partyId, partyType, state.sales, state.purchases, state.returns, dateFilter, accountFilter, state.bankAccounts, state.customers, sortOrder]);

    const totalDebit = ledgerData.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = ledgerData.reduce((sum, e) => sum + e.credit, 0);
    // Closing Balance logic needs to be careful with DESC sort.
    // If DESC, closing balance is the balance of the FIRST item (latest).
    // If ASC, it's the LAST item.
    // Actually, simply taking the chronological last balance is safest.
    // But since we just reversed `calculated`, and `calculated` ends with the latest...
    // If DESC (reversed), the latest balance is at index 0.
    // If ASC, it's at length-1.
    const closingBalance = ledgerData.length > 0 ?
        (sortOrder === 'DESC' ? ledgerData[0].balance : ledgerData[ledgerData.length - 1].balance)
        : 0;

    const accountOptions = [
        { value: 'ALL', label: 'All Accounts' },
        ...(state.bankAccounts || []).map(a => ({ value: a.id, label: a.name }))
    ];

    const dateOptions = [
        { value: 'ALL', label: 'All Time' },
        { value: 'TODAY', label: 'Today' },
        { value: 'YESTERDAY', label: 'Yesterday' },
        { value: 'THIS_MONTH', label: 'This Month' },
        { value: 'LAST_MONTH', label: 'Last Month' },
    ];
    const handleDownloadPDF = async () => {
        try {
            const title = partyType === 'CUSTOMER' ? 'Customer Statement' : 'Supplier Ledger';
            const subtitle = `Statement for: ${party?.name || 'Unknown'}`;
            const headers = ['Date', 'Ref', 'Description', 'Debit', 'Credit', 'Balance'];
            const rows = ledgerData.map(e => [
                new Date(e.date).toLocaleDateString(),
                e.id,
                e.description,
                e.debit ? e.debit.toLocaleString() : '-',
                e.credit ? e.credit.toLocaleString() : '-',
                e.balance.toLocaleString()
            ]);

            const summary = [
                { label: 'Total Debit', value: totalDebit.toLocaleString() },
                { label: 'Total Credit', value: totalCredit.toLocaleString() },
                { label: 'Closing Balance', value: closingBalance.toLocaleString(), color: closingBalance > 0 ? '#dc2626' : '#16a34a' }
            ];

            const doc = await generateGenericReportPDF(title, subtitle, headers, rows, summary, state.profile, state.reportTemplate, state.customFonts);
            doc.save(`Statement_${party?.name.replace(/[^a-z0-9]/gi, '_')}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate statement", 'error');
        }
    };

    const handleExportSheets = async () => {
        if (!state.googleUser?.accessToken) {
            showToast("Sign in with Google required for Sheets export.", 'info');
            return;
        }
        setIsExporting(true);
        try {
            const title = `${partyType === 'CUSTOMER' ? 'Customer' : 'Supplier'} Statement - ${party?.name}`;
            const headers = ['Date', 'Transaction ID', 'Type', 'Description', 'Debit', 'Credit', 'Running Balance'];
            const rows = ledgerData.map(e => [
                new Date(e.date).toLocaleDateString(),
                e.id,
                e.type,
                e.description,
                e.debit.toString(),
                e.credit.toString(),
                e.balance.toString()
            ]);

            // Add Summary Rows
            rows.push(['', '', '', 'TOTALS', totalDebit.toString(), totalCredit.toString(), closingBalance.toString()]);

            const url = await exportReportToSheet(state.googleUser.accessToken, title, headers, rows);
            window.open(url, '_blank');
            showToast("Statement exported to Google Sheets!", 'success');
        } catch (e) {
            console.error(e);
            showToast("Export failed.", 'error');
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen || !party) return null;

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            className="p-0 sm:p-4"
        >
            {/* Stable Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-fast"
                onClick={onClose}
            />
            {/* Content */}
            <Card className="relative z-10 w-full max-w-4xl h-full sm:h-[85vh] flex flex-col p-0 overflow-hidden animate-scale-in border-none shadow-2xl rounded-none sm:rounded-lg">
                {/* Header */}
                <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="font-bold text-lg flex items-center gap-2">
                            <FileText size={20} className="text-yellow-400" />
                            {party.name}
                        </h2>
                        <p className="text-xs text-slate-400">Statement of Accounts</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20} /></button>
                </div>

                {/* Toolbar */}
                <div className="bg-gray-100 dark:bg-slate-700/50 p-3 border-b dark:border-slate-700 flex justify-between items-center flex-wrap gap-2">
                    <div className="flex gap-4 text-sm">
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Total Debit</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">₹{totalDebit.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Total Credit</span>
                            <span className="font-bold text-gray-800 dark:text-gray-200">₹{totalCredit.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Closing Bal.</span>
                            <span className={`font-bold text-lg ${closingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{closingBalance.toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <div className="w-32">
                            <Dropdown
                                options={dateOptions}
                                value={dateFilter}
                                onChange={setDateFilter}
                                small
                            />
                        </div>
                        <div className="w-32">
                            <Dropdown
                                options={accountOptions}
                                value={accountFilter}
                                onChange={setAccountFilter}
                                placeholder="Account"
                                small
                            />
                        </div>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            onClick={() => setSortOrder(prev => prev === 'ASC' ? 'DESC' : 'ASC')}
                            variant="secondary"
                            className="h-8 text-xs"
                        >
                            <Filter size={14} className="mr-2" />
                            {sortOrder === 'ASC' ? 'Oldest First' : 'Latest First'}
                        </Button>
                        <Button
                            onClick={handleExportSheets}
                            className="h-8 text-xs bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border-transparent"
                            disabled={isExporting}
                        >
                            <FileSpreadsheet size={14} className="mr-2" /> {isExporting ? 'Exporting...' : 'Sheets'}
                        </Button>
                        <Button onClick={handleDownloadPDF} variant="secondary" className="h-8 text-xs">
                            <Download size={14} className="mr-2" /> PDF
                        </Button>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-grow overflow-auto bg-white dark:bg-slate-900">
                    <table className="w-full text-sm text-left border-collapse">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-800 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Ref ID</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3 text-right">Debit</th>
                                <th className="px-4 py-3 text-right">Credit</th>
                                <th className="px-4 py-3 text-right">Balance</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                            {ledgerData.map((entry, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                        {new Date(entry.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-500">
                                        {entry.id}
                                    </td>
                                    <td className="px-4 py-2 text-gray-800 dark:text-gray-200 max-w-xs truncate">
                                        <div className="flex items-center gap-2">
                                            {entry.type === 'INVOICE' && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>}
                                            {entry.type === 'PAYMENT' && <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>}
                                            {entry.type === 'RETURN' && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>}
                                            {entry.description}
                                        </div>
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                                        {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-medium text-gray-700 dark:text-gray-300">
                                        {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                                    </td>
                                    <td className="px-4 py-2 text-right font-bold text-gray-800 dark:text-gray-100 bg-gray-50/50 dark:bg-slate-800/30">
                                        {entry.balance.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {ledgerData.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-500">No transactions found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default LedgerModal;
