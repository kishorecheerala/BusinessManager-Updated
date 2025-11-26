
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Save, X, Search, Download, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Supplier, Purchase, Payment, Return, Page } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ConfirmationModal from '../components/ConfirmationModal';
import DeleteButton from '../components/DeleteButton';
import { PurchaseForm } from '../components/AddPurchaseView';
import AddSupplierModal from '../components/AddSupplierModal';
import BatchBarcodeModal from '../components/BatchBarcodeModal';
import Dropdown from '../components/Dropdown';
import PaymentModal from '../components/PaymentModal';
import { generateDebitNotePDF } from '../utils/pdfGenerator';
import DatePill from '../components/DatePill';
import DateInput from '../components/DateInput';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface PurchasesPageProps {
  setIsDirty: (isDirty: boolean) => void;
  setCurrentPage: (page: Page) => void;
}

const PurchasesPage: React.FC<PurchasesPageProps> = ({ setIsDirty, setCurrentPage }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [view, setView] = useState<'list' | 'add_purchase' | 'edit_purchase' | 'add_supplier' | 'edit_supplier'>('list');
    const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [purchaseToEdit, setPurchaseToEdit] = useState<Purchase | null>(null);

    const [paymentModalState, setPaymentModalState] = useState<{ isOpen: boolean, purchaseId: string | null }>({ isOpen: false, purchaseId: null });
    const [paymentDetails, setPaymentDetails] = useState({ amount: '', method: 'CASH' as 'CASH' | 'UPI' | 'CHEQUE', date: getLocalDateString(), reference: '' });
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, purchaseIdToDelete: string | null }>({ isOpen: false, purchaseIdToDelete: null });
    const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
    const [tempDueDates, setTempDueDates] = useState<string[]>([]);
    
    const [isBatchBarcodeModalOpen, setIsBatchBarcodeModalOpen] = useState(false);
    const [lastPurchase, setLastPurchase] = useState<Purchase | null>(null);

    const isDirtyRef = useRef(false);

    useEffect(() => {
        if (state.selection && state.selection.page === 'PURCHASES') {
            if (state.selection.id === 'new') {
                setView('add_purchase');
                setSelectedSupplier(null);
            } else {
                const supplierToSelect = state.suppliers.find(s => s.id === state.selection.id);
                if (supplierToSelect) {
                    setSelectedSupplier(supplierToSelect);
                    setView('list');
                }
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.suppliers, dispatch]);
    
    useEffect(() => {
        const detailViewDirty = !!(selectedSupplier && (editingScheduleId));
        // add_supplier and edit_supplier are now inline views
        const currentlyDirty = detailViewDirty || view === 'add_supplier' || view === 'edit_supplier';
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [view, selectedSupplier, editingScheduleId, setIsDirty]);

    useEffect(() => {
        return () => {
            setIsDirty(false);
        };
    }, [setIsDirty]);
    
    useEffect(() => {
        if (selectedSupplier) {
            const currentSupplierData = state.suppliers.find(s => s.id === selectedSupplier.id);
            if (JSON.stringify(currentSupplierData) !== JSON.stringify(selectedSupplier)) {
                setSelectedSupplier(currentSupplierData || null);
            }
        }
    }, [selectedSupplier?.id, state.suppliers]);
    
    const handleAddSupplier = (newSupplier: Supplier) => {
        dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
        showToast("Supplier added successfully!");
        setView('list');
    };
    
    const handleUpdateSupplier = (updatedSupplier: Supplier) => {
        dispatch({ type: 'UPDATE_SUPPLIER', payload: updatedSupplier });
        showToast("Supplier details updated.");
        setSelectedSupplier(updatedSupplier);
        setView('list');
    };
    
    const handleAddPayment = () => {
        const purchase = state.purchases.find(p => p.id === paymentModalState.purchaseId);
        if (!purchase || !paymentDetails.amount) return alert("Please enter a valid amount.");
        
        const amountPaid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const dueAmount = Number(purchase.totalAmount) - amountPaid;
        const newPaymentAmount = parseFloat(paymentDetails.amount);

        if(newPaymentAmount > dueAmount + 0.01) {
            return alert(`Payment exceeds due amount of ₹${dueAmount.toLocaleString('en-IN')}.`);
        }

        const payment: Payment = {
            id: `PAY-P-${Date.now()}`,
            amount: newPaymentAmount,
            method: paymentDetails.method,
            date: new Date(`${paymentDetails.date}T${new Date().toTimeString().split(' ')[0]}`).toISOString(),
            reference: paymentDetails.reference.trim() || undefined,
        };

        dispatch({ type: 'ADD_PAYMENT_TO_PURCHASE', payload: { purchaseId: purchase.id, payment } });
        showToast("Payment added successfully.");
        setPaymentModalState({ isOpen: false, purchaseId: null });
        setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
    };

    const handleDeletePurchase = (purchaseId: string) => {
        setConfirmModalState({ isOpen: true, purchaseIdToDelete: purchaseId });
    };

    const confirmDeletePurchase = () => {
        if (confirmModalState.purchaseIdToDelete) {
            dispatch({ type: 'DELETE_PURCHASE', payload: confirmModalState.purchaseIdToDelete });
            showToast('Purchase deleted successfully. Stock has been adjusted.');
            setConfirmModalState({ isOpen: false, purchaseIdToDelete: null });
        }
    };

    const handleEditReturn = (returnId: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page: 'RETURNS', id: returnId, action: 'edit' } });
        setCurrentPage('RETURNS');
    };
    
    const handleCompletePurchase = (purchaseData: Purchase) => {
        dispatch({ type: 'ADD_PURCHASE', payload: purchaseData });
        purchaseData.items.forEach(item => {
            dispatch({
                type: 'ADD_PRODUCT',
                payload: {
                    id: item.productId,
                    name: item.productName,
                    quantity: Number(item.quantity),
                    purchasePrice: Number(item.price),
                    salePrice: Number(item.saleValue),
                    gstPercent: Number(item.gstPercent),
                }
            });
        });

        showToast("Purchase recorded successfully! Inventory updated.");
        setLastPurchase(purchaseData);
        setIsBatchBarcodeModalOpen(true);
    };

    const handleUpdatePurchase = (updatedPurchase: Purchase) => {
        if (!purchaseToEdit) {
            showToast("Error updating purchase: Original data not found.", 'info');
            return;
        }

        dispatch({ type: 'UPDATE_PURCHASE', payload: { oldPurchase: purchaseToEdit, updatedPurchase } });
        showToast("Purchase updated successfully!");
        
        setView('list');
        setPurchaseToEdit(null); 
    };
    
    const handleDownloadDebitNote = async (newReturn: Return) => {
        const supplier = state.suppliers.find(s => s.id === newReturn.partyId);
        if (!supplier) {
            alert("Supplier not found.");
            return;
        }
        try {
            const doc = await generateDebitNotePDF(newReturn, supplier, state.profile);
            const dateStr = new Date(newReturn.returnDate).toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`DebitNote_${newReturn.id}_${dateStr}.pdf`);
        } catch (e) {
            console.error("PDF Error", e);
            showToast("Failed to generate PDF", 'info');
        }
    };

    const renderContent = () => {
        if (view === 'add_purchase' || view === 'edit_purchase') {
            return (
                <PurchaseForm
                    mode={view === 'add_purchase' ? 'add' : 'edit'}
                    initialData={purchaseToEdit}
                    suppliers={state.suppliers}
                    products={state.products}
                    onSubmit={view === 'add_purchase' ? handleCompletePurchase : handleUpdatePurchase}
                    onBack={() => { setView('list'); setPurchaseToEdit(null); }}
                    setIsDirty={setIsDirty}
                    dispatch={dispatch}
                    showToast={showToast}
                />
            );
        }

        // New Inline Add Supplier View
        if (view === 'add_supplier') {
            return (
                <div className="space-y-4 animate-fade-in-fast">
                    <Button onClick={() => setView('list')} variant="secondary">&larr; Back to List</Button>
                    <AddSupplierModal 
                        isOpen={true} 
                        onClose={() => setView('list')} 
                        onSave={handleAddSupplier} 
                        existingSuppliers={state.suppliers}
                        inline={true}
                    />
                </div>
            );
        }

        // New Inline Edit Supplier View
        if (view === 'edit_supplier' && selectedSupplier) {
            return (
                <div className="space-y-4 animate-fade-in-fast">
                    <Button onClick={() => setView('list')} variant="secondary">&larr; Back to Details</Button>
                    <AddSupplierModal 
                        isOpen={true} 
                        onClose={() => setView('list')}
                        onSave={(updated) => {
                            handleUpdateSupplier(updated);
                            setView('list'); // Explicitly go back to list/details after save
                        }} 
                        existingSuppliers={state.suppliers}
                        initialData={selectedSupplier}
                        inline={true}
                    />
                </div>
            );
        }
        
        if (selectedSupplier) {
            const supplierPurchases = state.purchases.filter(p => p.supplierId === selectedSupplier.id);
            const supplierReturns = state.returns.filter(r => r.type === 'SUPPLIER' && r.partyId === selectedSupplier.id);
            
            const selectedPurchase = state.purchases.find(p => p.id === paymentModalState.purchaseId);
            const selectedPurchasePaid = selectedPurchase ? (selectedPurchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0) : 0;
            const selectedPurchaseDue = selectedPurchase ? Number(selectedPurchase.totalAmount) - selectedPurchasePaid : 0;

            const handleEditScheduleClick = (purchase: Purchase) => {
                setEditingScheduleId(purchase.id);
                setTempDueDates(purchase.paymentDueDates || []);
            };
            
            const handleTempDateChange = (index: number, value: string) => {
                const newDates = [...tempDueDates];
                newDates[index] = value;
                setTempDueDates(newDates);
            };

            const addTempDate = () => {
                setTempDueDates([...tempDueDates, getLocalDateString()]);
            };

            const removeTempDate = (index: number) => {
                setTempDueDates(tempDueDates.filter((_, i) => i !== index));
            };
            
            const handleSaveSchedule = (purchaseToUpdate: Purchase) => {
                const updatedPurchase: Purchase = {
                    ...purchaseToUpdate,
                    paymentDueDates: tempDueDates.filter(date => date).sort(),
                };

                const oldPurchase = state.purchases.find(p => p.id === purchaseToUpdate.id);
                if (!oldPurchase) {
                    showToast("Could not find original purchase to update.", "info");
                    return;
                }

                dispatch({ type: 'UPDATE_PURCHASE', payload: { oldPurchase, updatedPurchase } });
                showToast("Payment schedule updated successfully.");
                setEditingScheduleId(null);
                setTempDueDates([]);
            };

            return (
                <div className="space-y-4">
                    <ConfirmationModal isOpen={confirmModalState.isOpen} onClose={() => setConfirmModalState({isOpen: false, purchaseIdToDelete: null})} onConfirm={confirmDeletePurchase} title="Confirm Purchase Deletion">
                        Are you sure you want to delete this purchase? This will remove the items from your stock. This action cannot be undone.
                    </ConfirmationModal>
                    <PaymentModal
                        isOpen={paymentModalState.isOpen}
                        onClose={() => setPaymentModalState({isOpen: false, purchaseId: null})}
                        onSubmit={handleAddPayment}
                        totalAmount={selectedPurchase ? Number(selectedPurchase.totalAmount) : 0}
                        dueAmount={selectedPurchaseDue}
                        paymentDetails={paymentDetails}
                        setPaymentDetails={setPaymentDetails}
                        type="purchase"
                    />
                    <Button onClick={() => setSelectedSupplier(null)}>&larr; Back to Suppliers</Button>
                    <Card className="animate-slide-up-fade">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-primary">Supplier Details: {selectedSupplier.name}</h2>
                            <Button onClick={() => setView('edit_supplier')} variant="secondary" className="h-9 px-3"><Edit size={16} className="mr-2"/> Edit</Button>
                        </div>
                        <div className="space-y-1 text-gray-700 dark:text-gray-300">
                            <p><strong>ID:</strong> {selectedSupplier.id}</p>
                            <p><strong>Phone:</strong> {selectedSupplier.phone}</p>
                            <p><strong>Location:</strong> {selectedSupplier.location}</p>
                            {selectedSupplier.gstNumber && <p><strong>GSTIN:</strong> {selectedSupplier.gstNumber}</p>}
                            {selectedSupplier.reference && <p><strong>Reference:</strong> {selectedSupplier.reference}</p>}
                            {selectedSupplier.account1 && <p><strong>Account 1:</strong> {selectedSupplier.account1}</p>}
                            {selectedSupplier.account2 && <p><strong>Account 2:</strong> {selectedSupplier.account2}</p>}
                            {selectedSupplier.upi && <p><strong>UPI ID:</strong> {selectedSupplier.upi}</p>}
                        </div>
                    </Card>
                    <Card title="Purchase History" className="animate-slide-up-fade" style={{ animationDelay: '100ms' }}>
                        {supplierPurchases.length > 0 ? (
                            <div className="space-y-2">
                                {supplierPurchases.slice().reverse().map(purchase => {
                                    const amountPaid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                                    const dueAmount = Number(purchase.totalAmount) - amountPaid;
                                    const isPaid = dueAmount <= 0.01;
                                    const isEditingThisSchedule = editingScheduleId === purchase.id;

                                    const totalGst = purchase.items.reduce((sum, item) => {
                                        const itemTotal = Number(item.price) * Number(item.quantity);
                                        const itemGst = itemTotal - (itemTotal / (1 + (Number(item.gstPercent) / 100)));
                                        return sum + itemGst;
                                    }, 0);
                                    const subTotal = Number(purchase.totalAmount) - totalGst;

                                    return (
                                    <div key={purchase.id} className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 overflow-hidden mb-4 shadow-sm">
                                        <div className="w-full text-left p-3 flex justify-between items-center bg-gray-50 dark:bg-slate-700 border-b dark:border-slate-600">
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-800 dark:text-gray-200">{purchase.id}</p>
                                                <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(purchase.date).toLocaleString([], { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                                                {purchase.supplierInvoiceId && <p className="text-xs text-gray-500 dark:text-gray-400">Inv: {purchase.supplierInvoiceId}</p>}
                                            </div>
                                            <div className="text-right mx-2">
                                                <p className="font-bold text-lg text-primary">₹{Number(purchase.totalAmount).toLocaleString('en-IN')}</p>
                                                <p className={`text-sm font-semibold text-red-600 dark:text-red-400`}>
                                                    Due: ₹{dueAmount.toLocaleString('en-IN')}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="p-3 bg-white dark:bg-slate-800">
                                            <div className="flex justify-end items-center mb-2">
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => { setPurchaseToEdit(purchase); setView('edit_purchase'); }} className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full" aria-label="Edit Purchase">
                                                        <Edit size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            setLastPurchase(purchase);
                                                            setIsBatchBarcodeModalOpen(true);
                                                        }}
                                                        className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-full"
                                                        aria-label="Print Barcode Labels"
                                                    >
                                                        <Printer size={16} />
                                                    </button>
                                                    <DeleteButton 
                                                        variant="delete" 
                                                        onClick={(e) => { e.stopPropagation(); handleDeletePurchase(purchase.id); }} 
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-3">
                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Items:</h4>
                                                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                        {purchase.items.map((item, index) => (
                                                            <li key={index}>
                                                                {item.productName} (x{item.quantity}) @ ₹{Number(item.price).toLocaleString('en-IN')}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>

                                                <div className="p-2 bg-white dark:bg-slate-700 rounded-md text-sm border dark:border-slate-600">
                                                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Transaction Details:</h4>
                                                    <div className="space-y-1 text-gray-600 dark:text-gray-300">
                                                        <div className="flex justify-between"><span>Subtotal (excl. GST):</span> <span>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                                        <div className="flex justify-between"><span>GST Amount:</span> <span>+ ₹{totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                                                        <div className="flex justify-between font-bold border-t dark:border-slate-500 pt-1 mt-1 text-gray-800 dark:text-white"><span>Grand Total:</span> <span>₹{Number(purchase.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    </div>
                                                </div>

                                                <div className="p-2 bg-white dark:bg-slate-700 rounded-md text-sm border dark:border-slate-600">
                                                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Payment Schedule</h4>
                                                    {isEditingThisSchedule ? (
                                                        <div className="space-y-2">
                                                            {tempDueDates.map((date, index) => (
                                                                <div key={index} className="flex items-center gap-2">
                                                                    <DateInput 
                                                                        value={date} 
                                                                        onChange={(e) => handleTempDateChange(index, e.target.value)} 
                                                                    />
                                                                    <DeleteButton variant="remove" onClick={() => removeTempDate(index)} />
                                                                </div>
                                                            ))}
                                                            <Button onClick={addTempDate} variant="secondary" className="w-full py-1 text-xs">
                                                                <Plus size={14} className="mr-1"/> Add Date
                                                            </Button>
                                                            <div className="flex gap-2 pt-2 border-t dark:border-slate-600 mt-2">
                                                                <Button onClick={() => handleSaveSchedule(purchase)} className="flex-grow py-1">Save</Button>
                                                                <Button onClick={() => setTempDueDates([])} variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-200 py-1 dark:bg-red-900/50 dark:text-red-200">Clear All</Button>
                                                                <Button onClick={() => { setEditingScheduleId(null); setTempDueDates([]); }} variant="secondary" className="bg-gray-200 text-gray-700 hover:bg-gray-300 py-1 dark:bg-slate-600 dark:text-slate-200">Cancel</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex justify-between items-start">
                                                            {(purchase.paymentDueDates && purchase.paymentDueDates.length > 0) ? (
                                                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                                    {purchase.paymentDueDates.map((dateStr, index) => {
                                                                        const today = new Date(); today.setHours(0, 0, 0, 0);
                                                                        const dueDate = new Date(dateStr + 'T00:00:00');
                                                                        const isOverdue = dueDate < today;
                                                                        return (
                                                                            <li key={index} className={`${isOverdue ? 'text-red-600 dark:text-red-400 font-bold' : ''}`}>
                                                                                {dueDate.toLocaleDateString('en-IN')} {isOverdue && '(Overdue)'}
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            ) : <p className="text-xs text-gray-500 dark:text-gray-400">No due dates scheduled.</p>}
                                                            <Button onClick={() => handleEditScheduleClick(purchase)} variant="secondary" className="py-1 px-2 text-xs">
                                                                <Edit size={14}/> Edit
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>

                                                {(purchase.payments || []).length > 0 && (
                                                    <div>
                                                        <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Payments Made:</h4>
                                                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                            {(purchase.payments || []).map(p => (
                                                            <li key={p.id}>
                                                                ₹{Number(p.amount).toLocaleString('en-IN')} {p.method === 'RETURN_CREDIT' ? <span className="text-blue-600 dark:text-blue-400 font-semibold">(Return Credit)</span> : `via ${p.method}`} on {new Date(p.date).toLocaleDateString()}
                                                                {p.reference && <span className="text-xs text-gray-500 dark:text-gray-500 block">Ref: {p.reference}</span>}
                                                            </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                
                                                {!isPaid && (
                                                    <div className="pt-2">
                                                        <Button onClick={() => setPaymentModalState({ isOpen: true, purchaseId: purchase.id })} className="w-full">
                                                            <Plus size={16} className="mr-2"/> Add Payment
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        ) : <p className="text-gray-500 dark:text-gray-400">No purchases recorded for this supplier.</p>}
                    </Card>
                    <Card title="Returns History" className="animate-slide-up-fade" style={{ animationDelay: '200ms' }}>
                        {supplierReturns.length > 0 ? (
                            <div className="space-y-3">
                                {supplierReturns.slice().reverse().map(ret => (
                                    <div key={ret.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-700">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold dark:text-slate-200">Return on {new Date(ret.returnDate).toLocaleDateString()}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Original Invoice: {ret.referenceId}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold text-primary">Credit: ₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                                <button 
                                                    onClick={() => handleEditReturn(ret.id)}
                                                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full" 
                                                    aria-label="Edit Return"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDownloadDebitNote(ret)} 
                                                    className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-full" 
                                                    aria-label="Download Debit Note"
                                                >
                                                    <Download size={16} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-2 pt-2 border-t dark:border-slate-600">
                                            <ul className="text-sm list-disc list-inside text-gray-600 dark:text-gray-400">
                                                {ret.items.map((item, idx) => (
                                                    <li key={idx}>{item.productName} (x{item.quantity})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400">No returns recorded for this supplier.</p>
                        )}
                    </Card>
                </div>
            );
        }
        
        const filteredSuppliers = state.suppliers.filter(supplier =>
            supplier.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            supplier.phone.includes(searchTerm) ||
            supplier.location.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Purchases & Suppliers</h1>
                        <DatePill />
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <Button onClick={() => setView('add_purchase')} className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Create New Purchase
                    </Button>
                    <Button onClick={() => setView('add_supplier')} variant="secondary" className="w-full">
                        <Plus className="w-4 h-4 mr-2" />
                        Add New Supplier
                    </Button>
                </div>
                
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search suppliers by name, phone, or location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    />
                </div>

                <Card title="All Suppliers">
                    <div className="space-y-3">
                        {filteredSuppliers.map((supplier, index) => {
                            const supplierPurchases = state.purchases.filter(p => p.supplierId === supplier.id);
                            const totalSpent = supplierPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
                            const totalPaid = supplierPurchases.reduce((sum, p) => sum + (p.payments || []).reduce((pSum, payment) => pSum + Number(payment.amount), 0), 0);
                            const totalDue = totalSpent - totalPaid;

                            return (
                                <div 
                                    key={supplier.id} 
                                    onClick={() => setSelectedSupplier(supplier)} 
                                    className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg cursor-pointer hover:bg-primary/5 dark:hover:bg-slate-700 border dark:border-slate-700 animate-slide-up-fade"
                                    style={{ animationDelay: `${index * 50}ms` }}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold text-gray-800 dark:text-gray-200">{supplier.name}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.location}</p>
                                            <p className="text-xs text-gray-400 dark:text-gray-500">{supplier.phone}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-gray-700 dark:text-gray-300">Spent: ₹{totalSpent.toLocaleString('en-IN')}</p>
                                            <p className={`text-sm font-semibold ${totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                                {totalDue > 0 ? `Due: ₹${totalDue.toLocaleString('en-IN')}` : 'Settled'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {filteredSuppliers.length === 0 && <p className="text-gray-500 dark:text-gray-400 text-center p-4">No suppliers found matching your search.</p>}
                    </div>
                </Card>
            </div>
        );
    };
    
    return (
        <>
            {isBatchBarcodeModalOpen && lastPurchase && (
                <BatchBarcodeModal
                    isOpen={isBatchBarcodeModalOpen}
                    onClose={() => setIsBatchBarcodeModalOpen(false)}
                    purchaseItems={lastPurchase.items}
                    businessName={state.profile?.name || 'Business Manager'}
                    title="Batch Barcode Print"
                />
            )}
            {renderContent()}
        </>
    );
};

export default PurchasesPage;
