
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Edit, Save, X, Search, Download, Printer, FileSpreadsheet, Upload, CheckCircle, XCircle, Info, QrCode, Calendar as CalendarIcon, Image as ImageIcon, Share2, MessageCircle, Eye, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
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
import { generateDebitNotePDF, generateImagesToPDF } from '../utils/pdfGenerator';
import DatePill from '../components/DatePill';
import DateInput from '../components/DateInput';
import { Html5Qrcode } from 'html5-qrcode';
import { PurchaseForm } from '../components/AddPurchaseView';
import { getLocalDateString } from '../utils/dateUtils';
import { createCalendarEvent } from '../utils/googleCalendar';

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
    const [viewImageModal, setViewImageModal] = useState<string | null>(null);

    // Image Viewer State
    const [viewerZoom, setViewerZoom] = useState(1);
    const [viewerPan, setViewerPan] = useState({ x: 0, y: 0 });
    const [isViewerDragging, setIsViewerDragging] = useState(false);
    const viewerDragStart = useRef({ x: 0, y: 0 });
    const pinchStartDist = useRef<number | null>(null);
    const startZoom = useRef(1);

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

    // Reset Viewer on Open
    useEffect(() => {
        if (viewImageModal) {
            setViewerZoom(1);
            setViewerPan({ x: 0, y: 0 });
        }
    }, [viewImageModal]);
    
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
        setView('list'); // Switch back to list view (which renders the modal)
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

    const handleAddToCalendar = async (dateStr: string, supplierName: string, purchaseId: string) => {
        if (!state.googleUser?.accessToken) {
            showToast("Please sign in to Google to use Calendar integration.", 'info');
            return;
        }

        try {
            // Set time to 10:00 AM on due date
            const startTime = new Date(dateStr);
            startTime.setHours(10, 0, 0, 0);

            await createCalendarEvent(state.googleUser.accessToken, {
                summary: `Payment Due: ${supplierName}`,
                description: `Purchase ID: ${purchaseId}\nReminder created from Business Manager.`,
                startTime: startTime.toISOString()
            });
            showToast("Reminder added to your Google Calendar!", 'success');
        } catch (error: any) {
            if (error.message === "AUTH_ERROR") {
                showToast("Calendar permission denied. Please Sign Out and Sign In again.", 'error');
            } else {
                showToast("Failed to create event.", 'error');
            }
        }
    };

    // Share attached images as a compiled PDF
    const handleSharePurchaseDocs = async (purchase: Purchase) => {
        const images = (purchase.invoiceImages || [purchase.invoiceUrl]).filter(Boolean) as string[];
        if (images.length === 0) {
            showToast("No invoice images attached to share.", 'info');
            return;
        }

        showToast("Compiling document...", 'info');
        const fileName = `Invoice_${purchase.id}_${getLocalDateString()}.pdf`;
        
        try {
            const doc = generateImagesToPDF(images, fileName);
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Invoice ${purchase.id}`,
                    text: `Invoice documents for purchase ${purchase.id}`
                });
            } else {
                // Fallback to download
                doc.save(fileName);
                showToast("Sharing not supported, file downloaded instead.", 'info');
            }
        } catch (e) {
            console.error("Share PDF failed", e);
            showToast("Failed to generate shareable document.", 'error');
        }
    };

    const sendPurchaseOrder = (purchase: Purchase) => {
        const itemsText = purchase.items.map(i => `${i.productName} (x${i.quantity})`).join('\n');
        const text = `New Order for ${selectedSupplier?.name || 'Supplier'}:\n\n${itemsText}\n\nTotal Est: Rs. ${purchase.totalAmount}`;
        const phone = selectedSupplier?.phone?.replace(/\D/g, '') || '';
        if (!phone) {
            showToast("Supplier phone number missing.", 'error');
            return;
        }
        const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };

    // --- Image Viewer Handlers ---
    const handleViewerTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 2) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            pinchStartDist.current = dist;
            startZoom.current = viewerZoom;
        } else if (e.touches.length === 1) {
            setIsViewerDragging(true);
            viewerDragStart.current = { x: e.touches[0].clientX - viewerPan.x, y: e.touches[0].clientY - viewerPan.y };
        }
    };

    const handleViewerTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 2 && pinchStartDist.current) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            const newZoom = startZoom.current * (dist / pinchStartDist.current);
            setViewerZoom(Math.max(0.5, Math.min(newZoom, 5)));
        } else if (e.touches.length === 1 && isViewerDragging) {
            e.preventDefault(); // Prevent scroll
            setViewerPan({
                x: e.touches[0].clientX - viewerDragStart.current.x,
                y: e.touches[0].clientY - viewerDragStart.current.y
            });
        }
    };

    const handleViewerTouchEnd = () => {
        setIsViewerDragging(false);
        pinchStartDist.current = null;
    };

    const handleViewerMouseDown = (e: React.MouseEvent) => {
        setIsViewerDragging(true);
        viewerDragStart.current = { x: e.clientX - viewerPan.x, y: e.clientY - viewerPan.y };
    };
    
    const handleViewerMouseMove = (e: React.MouseEvent) => {
        if (isViewerDragging) {
            e.preventDefault();
            setViewerPan({
                x: e.clientX - viewerDragStart.current.x,
                y: e.clientY - viewerDragStart.current.y
            });
        }
    };

    const handleViewerMouseUp = () => setIsViewerDragging(false);

    // Define the Image Viewer Modal JSX here to use in multiple places
    const imageViewerModal = viewImageModal ? (
        <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4 animate-fade-in-fast backdrop-blur-sm" onClick={() => setViewImageModal(null)}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden h-[70vh] relative animate-scale-in border border-white/10" onClick={(e) => e.stopPropagation()}>
                
                {/* Header */}
                <div className="flex justify-between items-center p-3 border-b dark:border-slate-800 z-20 bg-white dark:bg-slate-900 shrink-0">
                     <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ImageIcon size={18} className="text-primary"/> Invoice Viewer
                     </h3>
                     <div className="flex gap-2">
                         <a 
                            href={viewImageModal} 
                            download={`Invoice_${Date.now()}.jpg`}
                            className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
                            title="Download"
                         >
                            <Download size={18} />
                         </a>
                         <button onClick={() => setViewImageModal(null)} className="p-2 bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors">
                            <X size={18}/>
                         </button>
                     </div>
                </div>

                {/* Image Area */}
                <div 
                    className="flex-1 overflow-hidden relative bg-slate-100 dark:bg-black touch-none flex items-center justify-center cursor-move"
                    onTouchStart={handleViewerTouchStart}
                    onTouchMove={handleViewerTouchMove}
                    onTouchEnd={handleViewerTouchEnd}
                    onMouseDown={handleViewerMouseDown}
                    onMouseMove={handleViewerMouseMove}
                    onMouseUp={handleViewerMouseUp}
                    onMouseLeave={handleViewerMouseUp}
                >
                    <img 
                        src={viewImageModal} 
                        alt="Invoice"
                        style={{ 
                            transform: `translate(${viewerPan.x}px, ${viewerPan.y}px) scale(${viewerZoom})`,
                            maxWidth: viewerZoom === 1 ? '100%' : 'none',
                            maxHeight: viewerZoom === 1 ? '100%' : 'none'
                        }}
                        className="transition-transform duration-75 ease-out select-none" 
                        draggable={false}
                    />
                </div>

                {/* Footer Controls */}
                <div className="p-3 border-t dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-center items-center gap-6 z-20 shrink-0">
                     <button onClick={() => setViewerZoom(z => Math.max(0.5, z - 0.2))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><ZoomOut size={20} /></button>
                     <span className="text-sm font-mono font-bold w-12 text-center">{Math.round(viewerZoom * 100)}%</span>
                     <button onClick={() => setViewerZoom(z => Math.min(5, z + 0.2))} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800"><ZoomIn size={20} /></button>
                     <button onClick={() => { setViewerZoom(1); setViewerPan({x:0, y:0}); }} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 ml-4" title="Reset View"><RotateCcw size={20} /></button>
                </div>
            </div>
        </div>
    ) : null;

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
                    paymentDueDates: tempDueDates.filter(d => d).sort()
                };
                dispatch({ type: 'UPDATE_PURCHASE', payload: { oldPurchase: purchaseToUpdate, updatedPurchase } });
                setEditingScheduleId(null);
                showToast("Payment schedule updated.");
            };

            return (
                <div className="space-y-6 animate-fade-in-fast">
                    {/* Ensure Image Modal is rendered here in the details view */}
                    {imageViewerModal}

                    <ConfirmationModal
                        isOpen={confirmModalState.isOpen}
                        onClose={() => setConfirmModalState({ isOpen: false, purchaseIdToDelete: null })}
                        onConfirm={confirmDeletePurchase}
                        title="Confirm Purchase Deletion"
                    >
                        Are you sure you want to delete this purchase? This will remove the items from inventory.
                    </ConfirmationModal>

                    <PaymentModal
                        isOpen={paymentModalState.isOpen}
                        onClose={() => setPaymentModalState({ isOpen: false, purchaseId: null })}
                        onSubmit={handleAddPayment}
                        totalAmount={selectedPurchase ? selectedPurchase.totalAmount : 0}
                        dueAmount={selectedPurchaseDue}
                        paymentDetails={paymentDetails}
                        setPaymentDetails={setPaymentDetails}
                        type="purchase"
                    />

                    <div className="flex items-center gap-2">
                        <Button onClick={() => setSelectedSupplier(null)} variant="secondary">&larr; Back to List</Button>
                        <h1 className="text-2xl font-bold text-primary">{selectedSupplier.name}</h1>
                    </div>

                    <Card>
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><span className="font-bold">Phone:</span> {selectedSupplier.phone}</p>
                                <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><span className="font-bold">Location:</span> {selectedSupplier.location}</p>
                                {selectedSupplier.gstNumber && <p className="text-gray-600 dark:text-gray-300 flex items-center gap-2"><span className="font-bold">GST:</span> {selectedSupplier.gstNumber}</p>}
                            </div>
                            <Button onClick={() => setView('edit_supplier')} variant="secondary"><Edit size={16} className="mr-2"/> Edit Details</Button>
                        </div>
                    </Card>

                    <Card title="Purchase History">
                        {supplierPurchases.length > 0 ? (
                            <div className="space-y-4">
                                {supplierPurchases.slice().reverse().map(purchase => {
                                    const amountPaid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                                    const dueAmount = Number(purchase.totalAmount) - amountPaid;
                                    const isPaid = dueAmount <= 0.01;
                                    const isEditingSchedule = editingScheduleId === purchase.id;
                                    const hasImages = (purchase.invoiceImages && purchase.invoiceImages.length > 0) || !!purchase.invoiceUrl;

                                    return (
                                        <div key={purchase.id} className="border dark:border-slate-700 rounded-lg p-4 bg-gray-50 dark:bg-slate-700/30">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="font-bold text-lg dark:text-white">#{purchase.id}</p>
                                                    <p className="text-sm text-gray-500 dark:text-gray-400">{new Date(purchase.date).toLocaleDateString()}</p>
                                                    {purchase.supplierInvoiceId && <p className="text-sm text-gray-500 dark:text-gray-400">Ref: {purchase.supplierInvoiceId}</p>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-bold text-xl text-primary">₹{Number(purchase.totalAmount).toLocaleString('en-IN')}</p>
                                                    <p className={`font-bold ${isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                        {isPaid ? 'Paid' : `Due: ₹${dueAmount.toLocaleString('en-IN')}`}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Items */}
                                            <div className="bg-white dark:bg-slate-800 rounded p-2 mb-3 text-sm border dark:border-slate-600">
                                                <p className="font-semibold mb-1 dark:text-gray-200">Items:</p>
                                                <ul className="list-disc list-inside text-gray-600 dark:text-gray-400">
                                                    {purchase.items.map((item, idx) => (
                                                        <li key={idx}>{item.productName} (x{item.quantity})</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Attachments */}
                                            {hasImages && (
                                                <div className="mb-3">
                                                    <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                                        {(purchase.invoiceImages || [purchase.invoiceUrl]).filter(Boolean).map((img, idx) => (
                                                            <div key={idx} className="relative h-12 w-12 flex-shrink-0 cursor-pointer border dark:border-slate-600 rounded overflow-hidden hover:opacity-80 transition-opacity shadow-sm" onClick={() => setViewImageModal(img!)}>
                                                                <img src={img} alt="Invoice" className="h-full w-full object-cover" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Payment Schedule */}
                                            {!isPaid && (
                                                <div className="mb-3">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="text-sm font-semibold dark:text-gray-200">Payment Schedule:</p>
                                                        {!isEditingSchedule && (
                                                            <button onClick={() => handleEditScheduleClick(purchase)} className="text-xs text-blue-600 hover:underline">Edit Schedule</button>
                                                        )}
                                                    </div>
                                                    
                                                    {isEditingSchedule ? (
                                                        <div className="space-y-2 bg-white dark:bg-slate-800 p-2 rounded border border-blue-200 dark:border-slate-600">
                                                            {tempDueDates.map((date, idx) => (
                                                                <div key={idx} className="flex gap-2">
                                                                    <DateInput value={date} onChange={(e) => handleTempDateChange(idx, e.target.value)} />
                                                                    <DeleteButton variant="remove" onClick={() => removeTempDate(idx)} />
                                                                </div>
                                                            ))}
                                                            <div className="flex gap-2 mt-2">
                                                                <Button onClick={addTempDate} variant="secondary" className="text-xs h-8"><Plus size={12} className="mr-1"/> Add Date</Button>
                                                                <div className="flex-grow"></div>
                                                                <Button onClick={() => setEditingScheduleId(null)} variant="secondary" className="text-xs h-8">Cancel</Button>
                                                                <Button onClick={() => handleSaveSchedule(purchase)} className="text-xs h-8">Save</Button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        purchase.paymentDueDates && purchase.paymentDueDates.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {purchase.paymentDueDates.map((date, idx) => {
                                                                    const d = new Date(date);
                                                                    const isOverdue = d < new Date() && !isPaid;
                                                                    return (
                                                                        <div key={idx} className={`text-xs px-2 py-1 rounded border flex items-center gap-2 ${isOverdue ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300' : 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-slate-700 dark:text-gray-300'}`}>
                                                                            {d.toLocaleDateString()}
                                                                            <button 
                                                                                onClick={() => handleAddToCalendar(date, selectedSupplier.name, purchase.id)}
                                                                                className="hover:text-primary transition-colors p-0.5 rounded"
                                                                                title="Add to Google Calendar"
                                                                            >
                                                                                <CalendarIcon size={12} />
                                                                            </button>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : <p className="text-xs text-gray-500 italic">No scheduled dates.</p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-2 pt-2 border-t dark:border-slate-600 mt-2">
                                                {!isPaid && (
                                                    <Button onClick={() => setPaymentModalState({ isOpen: true, purchaseId: purchase.id })} className="text-xs h-8 flex-grow sm:flex-grow-0">
                                                        Record Payment
                                                    </Button>
                                                )}
                                                {/* Solid Green Send Order Button */}
                                                <button 
                                                    onClick={() => sendPurchaseOrder(purchase)} 
                                                    className="flex-grow sm:flex-grow-0 h-8 px-4 text-xs font-bold bg-green-600 hover:bg-green-700 text-white rounded-md shadow-sm transition-colors flex items-center justify-center"
                                                >
                                                    <MessageCircle size={14} className="mr-1.5" /> Send Order
                                                </button>
                                                
                                                {/* View Image Button */}
                                                {hasImages && (
                                                    <button 
                                                        onClick={() => setViewImageModal((purchase.invoiceImages && purchase.invoiceImages[0]) || purchase.invoiceUrl || '')}
                                                        className="flex-grow sm:flex-grow-0 h-8 px-3 text-xs font-bold bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 rounded-md shadow-sm transition-colors flex items-center justify-center border border-gray-300 dark:border-slate-600"
                                                        title="View Invoice Image"
                                                    >
                                                        <Eye size={14} className="mr-1.5" /> View
                                                    </button>
                                                )}

                                                {/* New Share Docs Button */}
                                                {hasImages && (
                                                    <button 
                                                        onClick={() => handleSharePurchaseDocs(purchase)}
                                                        className="flex-grow sm:flex-grow-0 h-8 px-3 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-md shadow-sm transition-colors flex items-center justify-center"
                                                        title="Share PDF for GST"
                                                    >
                                                        <Share2 size={14} className="mr-1.5" /> Share
                                                    </button>
                                                )}

                                                <Button onClick={() => { setPurchaseToEdit(purchase); setView('edit_purchase'); }} variant="secondary" className="text-xs h-8 px-2 flex-grow sm:flex-grow-0">
                                                    <Edit size={14} />
                                                </Button>
                                                <DeleteButton variant="delete" onClick={() => handleDeletePurchase(purchase.id)} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">No purchases recorded for this supplier.</p>
                        )}
                    </Card>

                    <Card title="Debit Notes (Returns)">
                        {supplierReturns.length > 0 ? (
                            <div className="space-y-3">
                                {supplierReturns.slice().reverse().map(ret => (
                                    <div key={ret.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-700 flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold text-sm dark:text-white">Return #{ret.id}</p>
                                            <p className="text-xs text-gray-500">{new Date(ret.returnDate).toLocaleDateString()}</p>
                                            <p className="text-xs font-bold text-red-600">Value: ₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button onClick={() => handleDownloadDebitNote(ret)} variant="secondary" className="p-2 h-auto"><Download size={16}/></Button>
                                            <Button onClick={() => handleEditReturn(ret.id)} variant="secondary" className="p-2 h-auto"><Edit size={16}/></Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">No debit notes created.</p>
                        )}
                    </Card>
                </div>
            );
        }

        const filteredSuppliers = state.suppliers.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.location.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return (
            <div className="space-y-4 animate-fade-in-fast">
                {/* View Image Modal */}
                {imageViewerModal}

                {isBatchBarcodeModalOpen && lastPurchase && (
                    <BatchBarcodeModal 
                        isOpen={isBatchBarcodeModalOpen} 
                        onClose={() => { setIsBatchBarcodeModalOpen(false); setView('list'); setPurchaseToEdit(null); }} 
                        purchaseItems={lastPurchase.items} 
                        businessName={state.profile?.name || ''} 
                        title="Bulk Barcode Print"
                    />
                )}

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Purchases</h1>
                        <DatePill />
                    </div>
                    <Button onClick={() => setView('add_purchase')}>
                        <Plus size={16} className="mr-2"/> Create Purchase
                    </Button>
                </div>

                <div>
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Search suppliers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    {filteredSuppliers.map((supplier, index) => {
                        const supplierPurchases = state.purchases.filter(p => p.supplierId === supplier.id);
                        const totalPurchased = supplierPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
                        const totalPaid = supplierPurchases.reduce((sum, p) => sum + (p.payments || []).reduce((psum, pay) => psum + Number(pay.amount), 0), 0);
                        const due = totalPurchased - totalPaid;

                        return (
                            <Card 
                                key={supplier.id} 
                                className="cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors animate-slide-up-fade"
                                style={{ animationDelay: `${index * 50}ms` }}
                                onClick={() => setSelectedSupplier(supplier)}
                            >
                                <div className="flex justify-between items-center">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">{supplier.name}</h3>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">{supplier.location}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Outstanding Due</p>
                                        <p className={`font-bold text-lg ${due > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                                            ₹{due.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                    {filteredSuppliers.length === 0 && (
                        <div className="text-center py-10">
                            <p className="text-gray-500 dark:text-gray-400">No suppliers found.</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return renderContent();
};

export default PurchasesPage;
