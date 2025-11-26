
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Save, X, Search, Download, Printer, FileSpreadsheet, Upload, CheckCircle, XCircle, Info, QrCode } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Supplier, Purchase, Payment, Return, Page, Product, PurchaseItem } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ConfirmationModal from '../components/ConfirmationModal';
import DeleteButton from '../components/DeleteButton';
import AddSupplierModal from '../components/AddSupplierModal';
import BatchBarcodeModal from '../components/BatchBarcodeModal';
import Dropdown from '../components/Dropdown';
import PaymentModal from '../components/PaymentModal';
import { generateDebitNotePDF } from '../utils/pdfGenerator';
import DatePill from '../components/DatePill';
import DateInput from '../components/DateInput';
import { Html5Qrcode } from 'html5-qrcode';
import { PurchaseForm } from '../components/AddPurchaseView';

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
        if (!purchase || !paymentDetails.amount) {
            showToast("Please enter a valid amount.", 'error');
            return;
        }
        
        const amountPaid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const dueAmount = Number(purchase.totalAmount) - amountPaid;
        const newPaymentAmount = parseFloat(paymentDetails.amount);

        if(newPaymentAmount > dueAmount + 0.01) {
            showToast(`Payment exceeds due amount of ₹${dueAmount.toLocaleString('en-IN')}.`, 'error');
            return;
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
            showToast("Error updating purchase: Original data not found.", 'error');
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
            showToast("Supplier not found.", 'error');
            return;
        }
        try {
            const doc = await generateDebitNotePDF(newReturn, supplier, state.profile, state.debitNoteTemplate, state.customFonts);
            const dateStr = new Date(newReturn.returnDate).toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`DebitNote_${newReturn.id}_${dateStr}.pdf`);
        } catch (e) {
            console.error("PDF Error", e);
            showToast("Failed to generate PDF", 'error');
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

        if (view === 'edit_supplier' && selectedSupplier) {
            return (
                <div className="space-y-4 animate-fade-in-fast">
                    <Button onClick={() => setView('list')} variant="secondary">&larr; Back to Details</Button>
                    <AddSupplierModal 
                        isOpen={true} 
                        onClose={() => setView('list')}
                        onSave={(updated) => {
                            handleUpdateSupplier(updated);
                            setView('list');
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
                    showToast("Could not find original purchase to update.", "error");
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
                                                <p className={`text-sm font-semibold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                                                    {isPaid ? 'Paid' : `Due: ₹${dueAmount.toLocaleString('en-IN')}`}
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

                                                <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-md text-sm border dark:border-slate-600">
                                                    <div className="flex justify-between"><span>Total Amount:</span> <span>₹{Number(purchase.totalAmount).toLocaleString('en-IN')}</span></div>
                                                    <div className="flex justify-between text-green-600"><span>Paid:</span> <span>₹{amountPaid.toLocaleString('en-IN')}</span></div>
                                                    <div className="flex justify-between font-bold border-t dark:border-slate-600 pt-1 mt-1"><span>Due:</span> <span className={dueAmount > 0 ? 'text-red-600' : 'text-green-600'}>₹{dueAmount.toLocaleString('en-IN')}</span></div>
                                                </div>

                                                {/* Payment Schedule Section */}
                                                {dueAmount > 0 && (
                                                    <div className="mt-2">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300">Payment Schedule:</h4>
                                                            {!isEditingThisSchedule && (
                                                                <button onClick={() => handleEditScheduleClick(purchase)} className="text-xs text-blue-600 hover:underline">Edit Schedule</button>
                                                            )}
                                                        </div>
                                                        
                                                        {isEditingThisSchedule ? (
                                                            <div className="space-y-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                                                                {tempDueDates.map((date, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2">
                                                                        <DateInput 
                                                                            value={date} 
                                                                            onChange={(e) => handleTempDateChange(idx, e.target.value)}
                                                                            className="text-xs py-1"
                                                                        />
                                                                        <button onClick={() => removeTempDate(idx)} className="text-red-500"><X size={14}/></button>
                                                                    </div>
                                                                ))}
                                                                <div className="flex gap-2 mt-2">
                                                                    <button onClick={addTempDate} className="text-xs text-blue-600 flex items-center gap-1"><Plus size={12}/> Add Date</button>
                                                                    <div className="flex-grow"></div>
                                                                    <button onClick={() => setEditingScheduleId(null)} className="text-xs text-gray-500 mr-2">Cancel</button>
                                                                    <button onClick={() => handleSaveSchedule(purchase)} className="text-xs bg-blue-600 text-white px-2 py-1 rounded">Save</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                                                {purchase.paymentDueDates && purchase.paymentDueDates.length > 0 ? (
                                                                    <div className="flex flex-wrap gap-1">
                                                                        {purchase.paymentDueDates.map((date, idx) => (
                                                                            <span key={idx} className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded text-xs border border-yellow-200 dark:border-yellow-700">
                                                                                {new Date(date).toLocaleDateString()}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-xs italic text-gray-400">No scheduled dates</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div>
                                                    <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Payments History:</h4>
                                                    {purchase.payments.length > 0 ? (
                                                        <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                            {purchase.payments.map(payment => (
                                                                <li key={payment.id}>
                                                                    ₹{Number(payment.amount).toLocaleString('en-IN')} via {payment.method} on {new Date(payment.date).toLocaleDateString()}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    ) : <p className="text-sm text-gray-500 dark:text-gray-400 italic">No payments recorded.</p>}
                                                </div>

                                                {!isPaid && (
                                                    <div className="pt-2">
                                                        <Button onClick={() => setPaymentModalState({ isOpen: true, purchaseId: purchase.id })} className="w-full text-sm h-8">
                                                            <Plus size={14} className="mr-1"/> Record Payment
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )})}
                            </div>
                        ) : (
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No purchase history for this supplier.</p>
                        )}
                    </Card>
                    <Card title="Returns to Supplier">
                        {supplierReturns.length > 0 ? (
                            <div className="space-y-3">
                                {supplierReturns.slice().reverse().map(ret => (
                                    <div key={ret.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 shadow-sm">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-200">Return on {new Date(ret.returnDate).toLocaleDateString()}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {ret.referenceId}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-bold text-primary">₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                                <div className="flex gap-1">
                                                    <Button onClick={() => handleDownloadDebitNote(ret)} variant="secondary" className="p-1.5 h-auto text-xs" title="Download Debit Note">
                                                        <Download size={14} />
                                                    </Button>
                                                    <Button onClick={() => handleEditReturn(ret.id)} variant="secondary" className="p-1.5 h-auto text-xs" title="Edit Return">
                                                        <Edit size={14} />
                                                    </Button>
                                                </div>
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
                            <p className="text-gray-500 dark:text-gray-400 text-center py-4">No returns recorded.</p>
                        )}
                    </Card>
                </div>
            );
        }

        // Default List View
        const filteredSuppliers = state.suppliers.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.location.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Purchases</h1>
                        <DatePill />
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                        <Button onClick={() => setView('add_supplier')} variant="secondary" className="flex-1 sm:flex-none">
                            <Plus size={16} className="mr-2"/> Supplier
                        </Button>
                        <Button onClick={() => setView('add_purchase')} className="flex-1 sm:flex-none">
                            <Plus size={16} className="mr-2"/> Purchase
                        </Button>
                    </div>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search suppliers by name or location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-primary outline-none"
                    />
                </div>

                <div className="space-y-3">
                    {filteredSuppliers.map((supplier, index) => {
                        const supplierPurchases = state.purchases.filter(p => p.supplierId === supplier.id);
                        const totalPurchased = supplierPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
                        const totalPaid = supplierPurchases.reduce((sum, p) => sum + (p.payments || []).reduce((pSum, pay) => pSum + Number(pay.amount), 0), 0);
                        const totalDue = totalPurchased - totalPaid;

                        return (
                            <Card 
                                key={supplier.id} 
                                className="cursor-pointer transition-shadow animate-slide-up-fade hover:shadow-md" 
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => setSelectedSupplier(supplier)}
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-primary">{supplier.name}</p>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">{supplier.location}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">{supplier.phone}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Total Due</p>
                                        <p className={`font-bold text-lg ${totalDue > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                            ₹{totalDue.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                    {filteredSuppliers.length === 0 && (
                        <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                            <p>No suppliers found. Add a supplier to get started.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="animate-fade-in-fast">
            {lastPurchase && (
                <BatchBarcodeModal 
                    isOpen={isBatchBarcodeModalOpen}
                    onClose={() => setIsBatchBarcodeModalOpen(false)}
                    purchaseItems={lastPurchase.items.map(item => ({ ...item, quantity: Number(item.quantity) }))}
                    businessName={state.profile?.name || 'Business Manager'}
                    title="Print Barcodes for New Stock"
                />
            )}
            {renderContent()}
        </div>
    );
};

export default PurchasesPage;
