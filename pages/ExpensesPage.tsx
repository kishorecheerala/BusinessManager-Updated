
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, Trash2, Filter, Receipt, DollarSign, X, Camera, Image as ImageIcon } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Expense, ExpenseCategory } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import DeleteButton from '../components/DeleteButton';
import DateInput from '../components/DateInput';
import Dropdown from '../components/Dropdown';
import { compressImage } from '../utils/imageUtils';
import { useDialog } from '../context/DialogContext';
import { getLocalDateString } from '../utils/dateUtils';

interface ExpensesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
    { value: 'Rent', label: 'Rent' },
    { value: 'Salary', label: 'Salaries' },
    { value: 'Electricity', label: 'Electricity' },
    { value: 'Transport', label: 'Transport' },
    { value: 'Maintenance', label: 'Maintenance' },
    { value: 'Marketing', label: 'Marketing' },
    { value: 'Food', label: 'Food & Refreshments' },
    { value: 'Other', label: 'Other' }
];

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' }
];

const ExpensesPage: React.FC<ExpensesPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState<ExpenseCategory>('Other');
    const [date, setDate] = useState(getLocalDateString());
    const [note, setNote] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'CASH'|'UPI'|'CHEQUE'>('CASH');
    const [isAdding, setIsAdding] = useState(false);
    const [receiptImage, setReceiptImage] = useState<string | null>(null);
    
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [filterMonth, setFilterMonth] = useState(new Date().getMonth().toString());
    const [filterYear, setFilterYear] = useState(new Date().getFullYear().toString());
    const [viewImageModal, setViewImageModal] = useState<string | null>(null);

    const isDirtyRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-open add form if navigated via Quick Action
    useEffect(() => {
        if (state.selection && state.selection.page === 'EXPENSES' && state.selection.id === 'new') {
            setIsAdding(true);
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection]);

    useEffect(() => {
        const formIsDirty = isAdding && (!!amount || !!note || !!receiptImage);
        if (formIsDirty !== isDirtyRef.current) {
            isDirtyRef.current = formIsDirty;
            setIsDirty(formIsDirty);
        }
    }, [isAdding, amount, note, receiptImage, setIsDirty]);

    useEffect(() => {
        return () => setIsDirty(false);
    }, [setIsDirty]);

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                // Compress image to save storage space
                const base64 = await compressImage(e.target.files[0], 800, 0.7);
                setReceiptImage(base64);
                showToast("Receipt photo attached.", 'success');
            } catch (error) {
                showToast("Error processing image.", 'error');
            } finally {
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        }
    };

    const handleAddExpense = () => {
        if (!amount || parseFloat(amount) <= 0) {
            showToast("Please enter a valid amount.", 'error');
            return;
        }

        const newExpense: Expense = {
            id: `EXP-${Date.now()}`,
            amount: parseFloat(amount),
            category,
            date: new Date(date).toISOString(),
            note: note.trim(),
            paymentMethod,
            receiptImage: receiptImage || undefined
        };

        dispatch({ type: 'ADD_EXPENSE', payload: newExpense });
        showToast("Expense added successfully!");
        
        // Reset form
        setAmount('');
        setNote('');
        setCategory('Other');
        setDate(getLocalDateString());
        setReceiptImage(null);
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        const confirmed = await showConfirm("Delete this expense record?");
        if (confirmed) {
            dispatch({ type: 'DELETE_EXPENSE', payload: id });
            showToast("Expense deleted.");
        }
    };

    // Filter Logic
    const filteredExpenses = useMemo(() => {
        return state.expenses.filter(e => {
            const expenseDate = new Date(e.date);
            const matchesMonth = filterMonth === 'all' || expenseDate.getMonth().toString() === filterMonth;
            const matchesYear = expenseDate.getFullYear().toString() === filterYear;
            const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
            return matchesMonth && matchesYear && matchesCategory;
        }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [state.expenses, filterMonth, filterYear, filterCategory]);

    const totalExpenses = useMemo(() => 
        filteredExpenses.reduce((sum, e) => sum + e.amount, 0), 
    [filteredExpenses]);

    const years = useMemo(() => {
        const yearsSet = new Set<string>([new Date().getFullYear().toString()]);
        state.expenses.forEach(e => yearsSet.add(new Date(e.date).getFullYear().toString()));
        return Array.from(yearsSet).sort().reverse();
    }, [state.expenses]);

    return (
        <div className="space-y-6 animate-fade-in-fast">
            {viewImageModal && (
                <div className="fixed inset-0 bg-black/80 z-[150] flex items-center justify-center p-4" onClick={() => setViewImageModal(null)}>
                    <div className="relative max-w-full max-h-full">
                        <button className="absolute -top-10 right-0 text-white p-2" onClick={() => setViewImageModal(null)}><X size={24}/></button>
                        <img src={viewImageModal} alt="Receipt" className="max-w-full max-h-[90vh] rounded-lg" />
                    </div>
                </div>
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <Receipt /> Expenses
                    </h1>
                </div>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    {isAdding ? <><X size={16} className="mr-2"/> Cancel</> : <><Plus size={16} className="mr-2"/> Add Expense</>}
                </Button>
            </div>

            {isAdding && (
                <Card title="Add New Expense" className="animate-slide-down-fade border-l-4 border-l-rose-500 relative">
                    <div className="space-y-4">
                        
                        {/* Receipt Attachment Bar */}
                        <div className="bg-indigo-50 dark:bg-indigo-900/20 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div className="p-2 bg-indigo-100 dark:bg-indigo-800 rounded-full">
                                    <ImageIcon className="text-indigo-600 dark:text-indigo-300" size={18} />
                                </div>
                                <span className="text-sm font-medium text-indigo-900 dark:text-indigo-100">
                                    {receiptImage ? 'Receipt Attached' : 'Attach Receipt Photo'}
                                </span>
                            </div>
                            
                            <div className="flex gap-2">
                                {receiptImage && (
                                    <button 
                                        onClick={() => setReceiptImage(null)}
                                        className="px-3 py-1.5 bg-red-100 text-red-700 hover:bg-red-200 text-xs font-bold rounded shadow-sm transition-colors border border-red-200"
                                    >
                                        Remove
                                    </button>
                                )}
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md flex items-center gap-1 transition-colors shadow-sm font-bold"
                                >
                                    <Camera size={14} /> {receiptImage ? 'Change' : 'Camera'}
                                </button>
                            </div>
                            <input 
                                type="file" 
                                accept="image/*" 
                                capture="environment" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleImageUpload}
                            />
                        </div>

                        {receiptImage && (
                            <div className="w-full h-32 bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center border dark:border-slate-700 relative group">
                                <img src={receiptImage} alt="Receipt Preview" className="h-full object-contain" />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <span className="text-white text-xs font-bold">Preview</span>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                                <div className="relative">
                                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input 
                                        type="number" 
                                        value={amount} 
                                        onChange={e => setAmount(e.target.value)} 
                                        className="w-full p-2 pl-9 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-rose-500"
                                        placeholder="0.00"
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                                <Dropdown 
                                    options={EXPENSE_CATEGORIES}
                                    value={category}
                                    onChange={(val) => setCategory(val as ExpenseCategory)}
                                />
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DateInput 
                                label="Date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                                <Dropdown 
                                    options={PAYMENT_METHODS}
                                    value={paymentMethod}
                                    onChange={(val) => setPaymentMethod(val as any)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note (Optional)</label>
                            <input 
                                type="text" 
                                value={note} 
                                onChange={e => setNote(e.target.value)} 
                                className="w-full p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                placeholder="Description..."
                            />
                        </div>

                        <Button onClick={handleAddExpense} className="w-full bg-rose-600 hover:bg-rose-700 focus:ring-rose-600">
                            Save Expense
                        </Button>
                    </div>
                </Card>
            )}

            <Card>
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-4 border-b dark:border-slate-700 pb-4">
                    <h2 className="text-lg font-bold text-gray-700 dark:text-gray-300">Expense History</h2>
                    
                    <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                        <select 
                            value={filterCategory} 
                            onChange={e => setFilterCategory(e.target.value)}
                            className="p-2 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            <option value="all">All Categories</option>
                            {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <select 
                            value={filterMonth} 
                            onChange={e => setFilterMonth(e.target.value)}
                            className="p-2 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            <option value="all">All Months</option>
                            {Array.from({length: 12}).map((_, i) => (
                                <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'short' })}</option>
                            ))}
                        </select>
                        <select 
                            value={filterYear} 
                            onChange={e => setFilterYear(e.target.value)}
                            className="p-2 text-sm border rounded-md dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>

                <div className="mb-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-100 dark:border-rose-900/50 rounded-lg flex justify-between items-center">
                    <span className="text-rose-800 dark:text-rose-200 font-medium">Total Expenses (Filtered)</span>
                    <span className="text-xl font-bold text-rose-700 dark:text-rose-300">₹{totalExpenses.toLocaleString('en-IN')}</span>
                </div>

                <div className="space-y-3">
                    {filteredExpenses.length > 0 ? (
                        filteredExpenses.map((expense, index) => (
                            <div 
                                key={expense.id} 
                                className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg flex justify-between items-center shadow-sm hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors animate-slide-up-fade"
                                style={{ animationDelay: `${index * 50}ms` }}
                            >
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-800 dark:text-gray-200">{expense.category}</span>
                                        <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-slate-700 rounded-full text-gray-500 dark:text-gray-400">{expense.paymentMethod}</span>
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400 flex gap-2 mt-1">
                                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                                        {expense.note && <span>• {expense.note}</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {expense.receiptImage && (
                                        <button onClick={() => setViewImageModal(expense.receiptImage!)} className="text-blue-600 hover:bg-blue-50 p-1 rounded-full">
                                            <ImageIcon size={18} />
                                        </button>
                                    )}
                                    <span className="font-bold text-rose-600 dark:text-rose-400">₹{expense.amount.toLocaleString('en-IN')}</span>
                                    <DeleteButton variant="delete" onClick={() => handleDelete(expense.id)} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                            <Filter size={32} className="mx-auto mb-2 opacity-50" />
                            <p>No expenses found for selected filters.</p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default ExpensesPage;
