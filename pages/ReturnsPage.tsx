
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Undo2, Users, Package, Plus, Trash2, Share2, Edit, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Return, ReturnItem, Sale, Purchase, Customer, Supplier } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Dropdown from '../components/Dropdown';
import DatePill from '../components/DatePill';
import DateInput from '../components/DateInput';
import { generateDebitNotePDF } from '../utils/pdfGenerator';
import { getLocalDateString } from '../utils/dateUtils';

type ReturnType = 'CUSTOMER' | 'SUPPLIER';

interface ReturnsPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const ReturnsPage: React.FC<ReturnsPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [returnType, setReturnType] = useState<ReturnType>('CUSTOMER');
    const [partyId, setPartyId] = useState('');
    const [referenceId, setReferenceId] = useState('');
    const [returnedItems, setReturnedItems] = useState<{ [productId: string]: number }>({});
    const [returnAmount, setReturnAmount] = useState('');
    const [returnDate, setReturnDate] = useState(getLocalDateString());
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');

    const [mode, setMode] = useState<'add' | 'edit'>('add');
    const [returnToEditId, setReturnToEditId] = useState<string | null>(null);

    const isDirtyRef = useRef(false);

    useEffect(() => {
        if (state.selection?.page === 'RETURNS' && state.selection.action === 'edit') {
            const returnToEdit = state.returns.find(r => r.id === state.selection.id);
            if (returnToEdit) {
                setMode('edit');
                setReturnToEditId(returnToEdit.id);
                setReturnType(returnToEdit.type);
                setPartyId(returnToEdit.partyId);
                setReferenceId(returnToEdit.referenceId);
                setReturnAmount(returnToEdit.amount.toString());
                setReturnDate(getLocalDateString(new Date(returnToEdit.returnDate)));
                setReason(returnToEdit.reason || '');
                setNotes(returnToEdit.notes || '');
                const itemsToEdit = returnToEdit.items.reduce((acc, item) => {
                    acc[item.productId] = item.quantity;
                    return acc;
                }, {} as { [productId: string]: number });
                setReturnedItems(itemsToEdit);
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.returns, dispatch]);

    useEffect(() => {
        const currentlyDirty = mode === 'add' && (!!partyId || !!referenceId || Object.keys(returnedItems).length > 0 || !!returnAmount);
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [partyId, referenceId, returnedItems, returnAmount, mode, setIsDirty]);

    useEffect(() => {
        return () => setIsDirty(false);
    }, [setIsDirty]);
    
    const resetForm = () => {
        setPartyId('');
        setReferenceId('');
        setReturnedItems({});
        setReturnAmount('');
        setReturnDate(getLocalDateString());
        setReason('');
        setNotes('');
        setMode('add');
        setReturnToEditId(null);
    };

    const partyOptions = useMemo(() => {
        if (returnType === 'CUSTOMER') {
            return state.customers.map((c: Customer) => ({
                value: c.id,
                label: `${c.name} - ${c.area}`,
                searchText: `${c.name} ${c.area}`
            }));
        }
        return state.suppliers.map((s: Supplier) => ({
            value: s.id,
            label: `${s.name} - ${s.location}`,
            searchText: `${s.name} ${s.location}`
        }));
    }, [returnType, state.customers, state.suppliers]);

    const invoiceList = useMemo(() => {
        if (!partyId) return [];
        return returnType === 'CUSTOMER'
            ? state.sales.filter(s => s.customerId === partyId)
            : state.purchases.filter(p => p.supplierId === partyId);
    }, [partyId, returnType, state.sales, state.purchases]);

    const selectedInvoice = useMemo(() => {
        if (!referenceId) return null;
        const list = returnType === 'CUSTOMER' ? state.sales : state.purchases;
        return list.find(inv => inv.id === referenceId);
    }, [referenceId, returnType, state.sales, state.purchases]);

    const handleItemQuantityChange = (productId: string, quantityStr: string) => {
        const originalItem = selectedInvoice?.items.find(i => i.productId === productId);
        if (!originalItem) return;

        const maxQuantity = originalItem.quantity;
        let quantity = parseInt(quantityStr, 10);

        if (isNaN(quantity)) quantity = 0;
        if (quantity > maxQuantity) quantity = maxQuantity;
        if (quantity < 0) quantity = 0;
        
        setReturnedItems(prev => {
            const newItems = { ...prev };
            if (quantity > 0) {
                newItems[productId] = quantity;
            } else {
                delete newItems[productId];
            }
            return newItems;
        });
    };
    
    const calculatedReturnValue = useMemo(() => {
        if (!selectedInvoice) return 0;
        return Object.keys(returnedItems).reduce((total, productId) => {
            const quantity = returnedItems[productId];
            const item = selectedInvoice.items.find(i => i.productId === productId);
            if (item) {
                return total + (Number(item.price) * quantity);
            }
            return total;
        }, 0);
    }, [returnedItems, selectedInvoice]);

    const handleProcessReturn = async () => {
        const amount = parseFloat(returnAmount);
        if (!partyId || !referenceId || Object.keys(returnedItems).length === 0 || isNaN(amount) || amount <= 0) {
            showToast('Please fill all required fields: select party, invoice, items, and enter a valid return amount.', 'error');
            return;
        }
        
        const itemsToReturn: ReturnItem[] = Object.keys(returnedItems).map((productId) => {
            const quantity = returnedItems[productId];
            const originalItem = selectedInvoice!.items.find(i => i.productId === productId)!;
            return {
                productId,
                productName: originalItem.productName,
                quantity,
                price: Number(originalItem.price),
            };
        });
        
        const now = new Date();
        const returnId = mode === 'add'
            ? `RET-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`
            : returnToEditId!;

        const returnData: Return = {
            id: returnId, type: returnType, referenceId, partyId, items: itemsToReturn,
            returnDate: new Date(`${returnDate}T${new Date().toTimeString().split(' ')[0]}`).toISOString(), amount, reason, notes,
        };

        if (mode === 'add') {
            dispatch({ type: 'ADD_RETURN', payload: returnData });
            showToast('Return processed successfully!', 'success');
        } else {
            const oldReturn = state.returns.find(r => r.id === returnToEditId);
            if (oldReturn) {
                 dispatch({ type: 'UPDATE_RETURN', payload: { oldReturn, updatedReturn: returnData } });
                 showToast('Return updated successfully!', 'success');
            }
        }

        if (returnType === 'SUPPLIER') {
            const supplier = state.suppliers.find(s => s.id === partyId);
            const doc = await generateDebitNotePDF(returnData, supplier, state.profile, state.debitNoteTemplate);
            const dateStr = new Date(returnDate).toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`DebitNote_${returnId}_${dateStr}.pdf`);
        }

        resetForm();
    };

    const invoiceTotal = Number(selectedInvoice?.totalAmount) || 0;
    const amountPaid = selectedInvoice ? (selectedInvoice.payments || []).reduce((sum, p) => sum + Number(p.amount), 0) : 0;
    const currentDue = invoiceTotal - amountPaid;

    const customerReturns = state.returns.filter(r => r.type === 'CUSTOMER');
    const supplierReturns = state.returns.filter(r => r.type === 'SUPPLIER');

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg text-primary">
                        <Undo2 className="w-6 h-6" />
                    </div>
                     <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        Returns Management
                    </h1>
                    <DatePill />
                </div>
            </div>

            <Card title="Process a New Return">
                <div className="border-b mb-4 dark:border-slate-700">
                    <nav className="-mb-px flex space-x-6">
                        <button onClick={() => { resetForm(); setReturnType('CUSTOMER'); }} className={`py-2 px-1 border-b-2 font-semibold ${returnType === 'CUSTOMER' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-500'}`}>
                            Customer Return
                        </button>
                        <button onClick={() => { resetForm(); setReturnType('SUPPLIER'); }} className={`py-2 px-1 border-b-2 font-semibold ${returnType === 'SUPPLIER' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-slate-500'}`}>
                            Return to Supplier
                        </button>
                    </nav>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">{returnType === 'CUSTOMER' ? 'Customer' : 'Supplier'}</label>
                        <Dropdown 
                            options={partyOptions}
                            value={partyId}
                            onChange={(val) => { setPartyId(val); setReferenceId(''); setReturnedItems({}); }}
                            placeholder={`Select ${returnType.toLowerCase()}`}
                            searchable={true}
                            searchPlaceholder={`Search by name or ${returnType === 'CUSTOMER' ? 'area' : 'location'}...`}
                            icon="search"
                        />
                    </div>

                    {partyId && (
                        <div>
                             <label className="block text-sm font-medium dark:text-gray-300">Original Invoice</label>
                             <Dropdown 
                                options={invoiceList.map(inv => ({ value: inv.id, label: `${inv.id} - ${new Date(inv.date).toLocaleDateString()}`}))}
                                value={referenceId}
                                onChange={(val) => { setReferenceId(val); setReturnedItems({}); }}
                                placeholder="Select invoice"
                                searchable={true}
                                searchPlaceholder="Search invoices..."
                                icon="search"
                            />
                        </div>
                    )}
                    
                    {selectedInvoice && (
                        <>
                           <div className="p-3 bg-primary/5 dark:bg-primary/20 rounded-lg border border-primary/20 dark:border-primary/30 text-sm space-y-1">
                                <div className="flex justify-between dark:text-gray-300"><span>Invoice Total:</span> <span className="font-semibold dark:text-white">₹{invoiceTotal.toLocaleString('en-IN')}</span></div>
                                <div className="flex justify-between dark:text-gray-300"><span>Amount Paid:</span> <span className="font-semibold text-green-600 dark:text-green-400">₹{amountPaid.toLocaleString('en-IN')}</span></div>
                                <div className="flex justify-between dark:text-gray-300"><span>Current Due:</span> <span className="font-semibold text-red-600 dark:text-red-400">₹{currentDue.toLocaleString('en-IN')}</span></div>
                           </div>
                           
                           <div>
                                <h3 className="text-md font-semibold text-gray-800 dark:text-gray-200 mb-2">Select Items to Return</h3>
                                <div className="space-y-2">
                                {selectedInvoice.items.map(item => (
                                    <div key={item.productId} className="grid grid-cols-3 gap-2 items-center">
                                        <div className="col-span-2">
                                            <p className="font-semibold text-sm dark:text-slate-200">{item.productName}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Purchased: {item.quantity} @ ₹{item.price}</p>
                                        </div>
                                        <input
                                            type="number"
                                            placeholder="Qty"
                                            value={returnedItems[item.productId] || ''}
                                            onChange={e => handleItemQuantityChange(item.productId, e.target.value)}
                                            className="w-full p-2 border rounded text-center dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                            max={item.quantity}
                                        />
                                    </div>
                                ))}
                                </div>
                           </div>
                           
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium dark:text-gray-300">{returnType === 'CUSTOMER' ? 'Amount Refunded' : 'Credit Note Value'}</label>
                                    <input type="number" value={returnAmount} onChange={e => setReturnAmount(e.target.value)} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder={`${calculatedReturnValue.toFixed(2)}`} />
                                </div>
                                <DateInput
                                    label="Return Date"
                                    value={returnDate}
                                    onChange={e => setReturnDate(e.target.value)}
                                />
                           </div>
                           <input type="text" placeholder="Reason (Optional)" value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                           {returnType === 'SUPPLIER' &&
                             <input type="text" placeholder="Return Notes for PDF (Debit Note)..." value={notes} onChange={e => setNotes(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                           }
                        </>
                    )}

                    <div className="flex gap-2">
                        <Button onClick={handleProcessReturn} className="w-full">
                            {mode === 'add' ? 'Process Return' : 'Update Return'}
                        </Button>
                         <Button onClick={resetForm} variant="secondary" className="w-full">
                            Cancel
                        </Button>
                    </div>
                </div>
            </Card>

            {returnType === 'CUSTOMER' && (
                <Card title="Recent Customer Returns" className="animate-fade-in-fast">
                    <div className="space-y-3">
                        {customerReturns.length > 0 ? (
                            customerReturns.slice().reverse().map(ret => {
                                const party = state.customers.find(c => c.id === ret.partyId);
                                
                                return (
                                    <div key={ret.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-700">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold dark:text-slate-200">{party?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Return ID: {ret.id}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(ret.returnDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t dark:border-slate-600 flex justify-between items-center">
                                            <ul className="text-sm list-disc list-inside text-gray-600 dark:text-gray-400">
                                                {ret.items.map((item, idx) => (
                                                    <li key={idx}>{item.productName} (x{item.quantity})</li>
                                                ))}
                                            </ul>
                                            <Button onClick={() => {
                                                if (isDirtyRef.current && !window.confirm("You have unsaved changes. Are you sure you want to discard them and edit this return?")) return;
                                                resetForm();
                                                // Trigger edit mode by setting state
                                                setMode('edit');
                                                setReturnToEditId(ret.id);
                                                setReturnType(ret.type);
                                                setPartyId(ret.partyId);
                                                setReferenceId(ret.referenceId);
                                                setReturnAmount(ret.amount.toString());
                                                setReturnDate(getLocalDateString(new Date(ret.returnDate)));
                                                setReason(ret.reason || '');
                                                setNotes(ret.notes || '');
                                                const itemsToEdit = ret.items.reduce((acc, item) => {
                                                    acc[item.productId] = item.quantity;
                                                    return acc;
                                                }, {} as { [productId: string]: number });
                                                setReturnedItems(itemsToEdit);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }} variant="secondary" className="p-2 h-auto">
                                                <Edit size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center">No customer returns have been processed yet.</p>
                        )}
                    </div>
                </Card>
            )}

            {returnType === 'SUPPLIER' && (
                <Card title="Recent Supplier Returns" className="animate-fade-in-fast">
                    <div className="space-y-3">
                        {supplierReturns.length > 0 ? (
                            supplierReturns.slice().reverse().map(ret => {
                                const party = state.suppliers.find(s => s.id === ret.partyId);
                                
                                return (
                                    <div key={ret.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-700">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold dark:text-slate-200">{party?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Return ID: {ret.id}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-primary">₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(ret.returnDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t dark:border-slate-600 flex justify-between items-center">
                                            <ul className="text-sm list-disc list-inside text-gray-600 dark:text-gray-400">
                                                {ret.items.map((item, idx) => (
                                                    <li key={idx}>{item.productName} (x{item.quantity})</li>
                                                ))}
                                            </ul>
                                            <Button onClick={() => {
                                                if (isDirtyRef.current && !window.confirm("You have unsaved changes. Are you sure you want to discard them and edit this return?")) return;
                                                resetForm();
                                                // Trigger edit mode by setting state
                                                setMode('edit');
                                                setReturnToEditId(ret.id);
                                                setReturnType(ret.type);
                                                setPartyId(ret.partyId);
                                                setReferenceId(ret.referenceId);
                                                setReturnAmount(ret.amount.toString());
                                                setReturnDate(getLocalDateString(new Date(ret.returnDate)));
                                                setReason(ret.reason || '');
                                                setNotes(ret.notes || '');
                                                const itemsToEdit = ret.items.reduce((acc, item) => {
                                                    acc[item.productId] = item.quantity;
                                                    return acc;
                                                }, {} as { [productId: string]: number });
                                                setReturnedItems(itemsToEdit);
                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                            }} variant="secondary" className="p-2 h-auto">
                                                <Edit size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center">No supplier returns have been processed yet.</p>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
};

export default ReturnsPage;
