
import React, { useState, useEffect, useRef } from 'react';
import { Plus, User, Phone, MapPin, Search, Edit, Save, X, Trash2, IndianRupee, ShoppingCart, Download, Share2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Payment, Sale, Page } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ConfirmationModal from '../components/ConfirmationModal';
import DeleteButton from '../components/DeleteButton';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { generateThermalInvoicePDF, generateA4InvoicePdf } from '../utils/pdfGenerator';
import DateInput from '../components/DateInput';
import DatePill from '../components/DatePill';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const fetchImageAsBase64 = (url: string): Promise<string> =>
  fetch(url)
    .then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }));

// Standalone PaymentModal component to prevent re-renders on parent state change
const PaymentModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    sale: Sale | null | undefined;
    paymentDetails: { amount: string; method: 'CASH' | 'UPI' | 'CHEQUE'; date: string; reference: string; };
    setPaymentDetails: React.Dispatch<React.SetStateAction<{ amount: string; method: 'CASH' | 'UPI' | 'CHEQUE'; date: string; reference: string; }>>;
}> = ({ isOpen, onClose, onSubmit, sale, paymentDetails, setPaymentDetails }) => {
    if (!isOpen || !sale) return null;
    
    const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const dueAmount = Number(sale.totalAmount) - amountPaid;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card title="Add Payment" className="w-full max-w-sm animate-scale-in">
                <div className="space-y-4">
                    <p>Invoice Total: <span className="font-bold">₹{Number(sale.totalAmount).toLocaleString('en-IN')}</span></p>
                    <p>Amount Due: <span className="font-bold text-red-600">₹{dueAmount.toLocaleString('en-IN')}</span></p>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Amount</label>
                        <input type="number" placeholder="Enter amount" value={paymentDetails.amount} onChange={e => setPaymentDetails({ ...paymentDetails, amount: e.target.value })} className="w-full p-2 border rounded" autoFocus/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Method</label>
                        <select value={paymentDetails.method} onChange={e => setPaymentDetails({ ...paymentDetails, method: e.target.value as any })} className="w-full p-2 border rounded custom-select">
                            <option value="CASH">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="CHEQUE">Cheque</option>
                        </select>
                    </div>
                    
                    <DateInput
                        label="Payment Date"
                        value={paymentDetails.date} 
                        onChange={e => setPaymentDetails({ ...paymentDetails, date: e.target.value })} 
                    />

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Payment Reference (Optional)</label>
                        <input 
                            type="text"
                            placeholder="e.g. UPI ID, Cheque No."
                            value={paymentDetails.reference}
                            onChange={e => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div className="flex gap-2">
                       <Button onClick={onSubmit} className="w-full">Save Payment</Button>
                       <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};


interface CustomersPageProps {
  setIsDirty: (isDirty: boolean) => void;
  setCurrentPage: (page: Page) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ setIsDirty, setCurrentPage }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [newCustomer, setNewCustomer] = useState({ id: '', name: '', phone: '', address: '', area: '', reference: '' });
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [actionMenuSaleId, setActionMenuSaleId] = useState<string | null>(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editedCustomer, setEditedCustomer] = useState<Customer | null>(null);

    const [paymentModalState, setPaymentModalState] = useState<{ isOpen: boolean, saleId: string | null }>({ isOpen: false, saleId: null });
    const [paymentDetails, setPaymentDetails] = useState({
        amount: '',
        method: 'CASH' as 'CASH' | 'UPI' | 'CHEQUE',
        date: getLocalDateString(),
        reference: '',
    });
    
    const [confirmModalState, setConfirmModalState] = useState<{ isOpen: boolean, saleIdToDelete: string | null }>({ isOpen: false, saleIdToDelete: null });
    const isDirtyRef = useRef(false);
    const actionMenuRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(actionMenuRef, () => setActionMenuSaleId(null));

    useEffect(() => {
        if (state.selection && state.selection.page === 'CUSTOMERS') {
            if (state.selection.id === 'new') {
                setIsAdding(true);
                setSelectedCustomer(null); // Ensure we are not in detail view
            } else {
                const customerToSelect = state.customers.find(c => c.id === state.selection.id);
                if (customerToSelect) {
                    setSelectedCustomer(customerToSelect);
                }
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.customers, dispatch]);

    useEffect(() => {
        const currentlyDirty = (isAdding && !!(newCustomer.id || newCustomer.name || newCustomer.phone || newCustomer.address || newCustomer.area)) || isEditing;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [isAdding, newCustomer, isEditing, setIsDirty]);

    // On unmount, we must always clean up.
    useEffect(() => {
        return () => {
            setIsDirty(false);
        };
    }, [setIsDirty]);

    // Effect to keep selectedCustomer data in sync with global state
    useEffect(() => {
        if (selectedCustomer) {
            const currentCustomerData = state.customers.find(c => c.id === selectedCustomer.id);
            // Deep comparison to avoid re-render if data is the same
            if (JSON.stringify(currentCustomerData) !== JSON.stringify(selectedCustomer)) {
                setSelectedCustomer(currentCustomerData || null);
            }
        }
    }, [selectedCustomer?.id, state.customers]);

    // Effect to reset the editing form when the selected customer changes
    useEffect(() => {
        if (selectedCustomer) {
            setEditedCustomer(selectedCustomer);
        }
        setIsEditing(false);
    }, [selectedCustomer]);


    const handleAddCustomer = () => {
        const trimmedId = newCustomer.id.trim();
        if (!trimmedId) {
            alert('Customer ID is required.');
            return;
        }
        if (!newCustomer.name || !newCustomer.phone || !newCustomer.address || !newCustomer.area) {
            alert('Please fill all required fields (Name, Phone, Address, Area).');
            return;
        }

        const finalId = `CUST-${trimmedId}`;
        const isIdTaken = state.customers.some(c => c.id.toLowerCase() === finalId.toLowerCase());
        
        if (isIdTaken) {
            alert(`Customer ID "${finalId}" is already taken. Please choose another one.`);
            return;
        }

        const customerWithId: Customer = { 
            name: newCustomer.name,
            phone: newCustomer.phone,
            address: newCustomer.address,
            area: newCustomer.area,
            id: finalId,
            reference: newCustomer.reference || ''
        };
        dispatch({ type: 'ADD_CUSTOMER', payload: customerWithId });
        setNewCustomer({ id: '', name: '', phone: '', address: '', area: '', reference: '' });
        setIsAdding(false);
        showToast("Customer added successfully!");
    };
    
    const handleUpdateCustomer = () => {
        if (editedCustomer) {
            if (window.confirm('Are you sure you want to save these changes to the customer details?')) {
                dispatch({ type: 'UPDATE_CUSTOMER', payload: editedCustomer });
                setSelectedCustomer(editedCustomer);
                setIsEditing(false);
                showToast("Customer details updated successfully.");
            }
        }
    };

    const handleDeleteSale = (saleId: string) => {
        setConfirmModalState({ isOpen: true, saleIdToDelete: saleId });
    };

    const confirmDeleteSale = () => {
        if (confirmModalState.saleIdToDelete) {
            dispatch({ type: 'DELETE_SALE', payload: confirmModalState.saleIdToDelete });
            showToast('Sale deleted successfully.');
            setConfirmModalState({ isOpen: false, saleIdToDelete: null });
        }
    };

    const handleEditSale = (saleId: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page: 'SALES', id: saleId, action: 'edit' } });
        setCurrentPage('SALES');
    };

    const handleEditReturn = (returnId: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page: 'RETURNS', id: returnId, action: 'edit' } });
        setCurrentPage('RETURNS');
    };

    const handleAddPayment = () => {
        const sale = state.sales.find(s => s.id === paymentModalState.saleId);
        if (!sale || !paymentDetails.amount) {
            alert("Please enter a valid amount.");
            return;
        }
        
        const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const dueAmount = Number(sale.totalAmount) - amountPaid;
        const newPaymentAmount = parseFloat(paymentDetails.amount);

        if(newPaymentAmount > dueAmount + 0.01) { // Epsilon for float
            alert(`Payment of ₹${newPaymentAmount.toLocaleString('en-IN')} exceeds due amount of ₹${dueAmount.toLocaleString('en-IN')}.`);
            return;
        }

        const payment: Payment = {
            id: `PAY-${Date.now()}`,
            amount: newPaymentAmount,
            method: paymentDetails.method,
            date: new Date(paymentDetails.date).toISOString(),
            reference: paymentDetails.reference.trim() || undefined,
        };

        dispatch({ type: 'ADD_PAYMENT_TO_SALE', payload: { saleId: sale.id, payment } });
        showToast('Payment added successfully!');
        
        setPaymentModalState({ isOpen: false, saleId: null });
        setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
    };

    const handleDownloadThermalReceipt = async (sale: Sale) => {
        if (!selectedCustomer) return;
        try {
            const doc = await generateThermalInvoicePDF(sale, selectedCustomer, state.profile);
            doc.save(`Invoice-${sale.id}.pdf`);
        } catch (error) {
            console.error("Thermal receipt generation failed", error);
            alert("Failed to generate thermal receipt.");
        }
    };

    const handlePrintA4Invoice = async (sale: Sale) => {
        if (!selectedCustomer) return;
        const doc = await generateA4InvoicePdf(sale, selectedCustomer, state.profile);
        doc.autoPrint();
        const pdfUrl = doc.output('bloburl');
        window.open(pdfUrl, '_blank');
    };

    const handleShareInvoice = async (sale: Sale) => {
        if (!selectedCustomer) return;
        try {
            const doc = await generateThermalInvoicePDF(sale, selectedCustomer, state.profile);
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `Invoice-${sale.id}.pdf`, { type: 'application/pdf' });
            const businessName = state.profile?.name || 'Invoice';

            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `${businessName} - Invoice ${sale.id}`,
                    files: [pdfFile],
                });
            } else {
                doc.save(`Invoice-${sale.id}.pdf`);
            }
        } catch (error) {
            console.error("Share invoice failed", error);
            alert("Failed to generate or share invoice.");
        }
    };


    const handleShareDuesSummary = async () => {
        if (!selectedCustomer) return;

        const overdueSales = state.sales.filter(s => {
            const paid = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            return s.customerId === selectedCustomer.id && (Number(s.totalAmount) - paid) > 0.01;
        });

        if (overdueSales.length === 0) {
            alert(`${selectedCustomer.name} has no outstanding dues.`);
            return;
        }

        const totalDue = overdueSales.reduce((total, sale) => {
            const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            return total + (Number(sale.totalAmount) - paid);
        }, 0);
        
        const doc = new jsPDF();
        const profile = state.profile;
        let currentY = 15;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor('#0d9488'); // Primary color
        doc.text('Customer Dues Summary', 105, currentY, { align: 'center' });
        currentY += 8;
        
        if (profile) {
            doc.setFontSize(12);
            doc.setTextColor('#333333');
            doc.text(profile.name, 105, currentY, { align: 'center' });
            currentY += 5;
        }
        
        currentY += 5;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#000000');
        doc.text(`Billed To: ${selectedCustomer.name}`, 14, currentY);
        currentY += 6;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, currentY);
        currentY += 10;

        autoTable(doc, {
            startY: currentY,
            head: [['Invoice ID', 'Date', 'Total', 'Paid', 'Due']],
            body: overdueSales.map(sale => {
                const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const due = Number(sale.totalAmount) - paid;
                return [
                    sale.id,
                    new Date(sale.date).toLocaleDateString(),
                    `Rs. ${Number(sale.totalAmount).toLocaleString('en-IN')}`,
                    `Rs. ${paid.toLocaleString('en-IN')}`,
                    `Rs. ${due.toLocaleString('en-IN')}`
                ];
            }),
            theme: 'grid',
            headStyles: { fillColor: [13, 148, 136] }, // Primary color
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 15;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor('#0d9488');
        doc.text(
            `Total Outstanding Due: Rs. ${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            196, currentY, { align: 'right' }
        );

        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `Dues-Summary-${selectedCustomer.id}.pdf`, { type: 'application/pdf' });
        const businessName = state.profile?.name || 'Dues Summary';

        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: `${businessName} - Dues for ${selectedCustomer.name}`,
            files: [pdfFile],
          });
        } else {
          doc.save(`Dues-Summary-${selectedCustomer.id}.pdf`);
        }
    };


    const filteredCustomers = state.customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        c.area.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    if (selectedCustomer && editedCustomer) {
        const customerSales = state.sales.filter(s => s.customerId === selectedCustomer.id);
        const customerReturns = state.returns.filter(r => r.type === 'CUSTOMER' && r.partyId === selectedCustomer.id);
        
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setEditedCustomer({ ...editedCustomer, [e.target.name]: e.target.value });
        };

        return (
            <div className="space-y-4">
                <ConfirmationModal
                    isOpen={confirmModalState.isOpen}
                    onClose={() => setConfirmModalState({ isOpen: false, saleIdToDelete: null })}
                    onConfirm={confirmDeleteSale}
                    title="Confirm Sale Deletion"
                >
                    Are you sure you want to delete this sale? This action cannot be undone and will add the items back to stock.
                </ConfirmationModal>
                <PaymentModal
                    isOpen={paymentModalState.isOpen}
                    onClose={() => setPaymentModalState({isOpen: false, saleId: null})}
                    onSubmit={handleAddPayment}
                    sale={state.sales.find(s => s.id === paymentModalState.saleId)}
                    paymentDetails={paymentDetails}
                    setPaymentDetails={setPaymentDetails}
                />
                <Button onClick={() => setSelectedCustomer(null)}>&larr; Back to List</Button>
                <Card>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-primary">Customer Details: {selectedCustomer.name}</h2>
                        </div>
                        <div className="flex gap-2 items-center flex-shrink-0">
                            {isEditing ? (
                                <>
                                    <Button onClick={handleUpdateCustomer} className="h-9 px-3"><Save size={16} /> Save</Button>
                                    <button onClick={() => setIsEditing(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 transition-colors">
                                        <X size={20}/>
                                    </button>
                                </>
                            ) : (
                                <Button onClick={() => setIsEditing(true)}><Edit size={16}/> Edit</Button>
                            )}
                        </div>
                    </div>
                    {isEditing ? (
                        <div className="space-y-3">
                            <div><label className="text-sm font-medium">Name</label><input type="text" name="name" value={editedCustomer.name} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
                            <div><label className="text-sm font-medium">Phone</label><input type="text" name="phone" value={editedCustomer.phone} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
                            <div><label className="text-sm font-medium">Address</label><input type="text" name="address" value={editedCustomer.address} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
                            <div><label className="text-sm font-medium">Area</label><input type="text" name="area" value={editedCustomer.area} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
                            <div><label className="text-sm font-medium">Reference</label><input type="text" name="reference" value={editedCustomer.reference ?? ''} onChange={handleInputChange} className="w-full p-2 border rounded" /></div>
                        </div>
                    ) : (
                        <div className="space-y-1 text-gray-700">
                             <p><strong>ID:</strong> {selectedCustomer.id}</p>
                            <p><strong>Phone:</strong> {selectedCustomer.phone}</p>
                            <p><strong>Address:</strong> {selectedCustomer.address}</p>
                            <p><strong>Area:</strong> {selectedCustomer.area}</p>
                            {selectedCustomer.reference && <p><strong>Reference:</strong> {selectedCustomer.reference}</p>}
                        </div>
                    )}
                     <div className="mt-4 pt-4 border-t">
                        <Button onClick={handleShareDuesSummary} className="w-full">
                            <Share2 size={16} className="mr-2" />
                            Share Dues Summary
                        </Button>
                    </div>
                </Card>
                <Card title="Sales History">
                    {customerSales.length > 0 ? (
                        <div className="space-y-4">
                            {customerSales.slice().reverse().map(sale => {
                                const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                                const dueAmount = Number(sale.totalAmount) - amountPaid;
                                const isPaid = dueAmount <= 0.01;
                                const subTotal = Number(sale.totalAmount) + Number(sale.discount);

                                return (
                                <div key={sale.id} className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 shadow-sm overflow-hidden">
                                    <div className="bg-gray-50 dark:bg-slate-700/50 p-3 border-b dark:border-slate-600 flex justify-between items-center">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800 dark:text-gray-200">{sale.id}</p>
                                            <p className="text-xs text-gray-600 dark:text-gray-400">{new Date(sale.date).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right mx-2">
                                            <p className="font-bold text-lg text-primary">₹{Number(sale.totalAmount).toLocaleString('en-IN')}</p>
                                            <p className={`text-sm font-semibold ${isPaid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {isPaid ? 'Paid' : `Due: ₹${dueAmount.toLocaleString('en-IN')}`}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3">
                                        <div className="flex justify-end items-center gap-2 mb-3">
                                            <button onClick={() => handleEditSale(sale.id)} className="p-2 text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:hover:bg-blue-900/40 rounded-full transition-colors" aria-label="Edit Sale"><Edit size={16} /></button>
                                                <div className="relative" ref={actionMenuSaleId === sale.id ? actionMenuRef : undefined}>
                                                <button onClick={() => setActionMenuSaleId(sale.id)} className="p-2 text-teal-600 bg-teal-50 hover:bg-teal-100 dark:bg-teal-900/20 dark:text-teal-300 dark:hover:bg-teal-900/40 rounded-full transition-colors" aria-label="Share or Download Invoice">
                                                    <Share2 size={16} />
                                                </button>
                                                {actionMenuSaleId === sale.id && (
                                                    <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 text-text dark:text-slate-200 z-10 animate-scale-in origin-top-right">
                                                        <button onClick={() => { handlePrintA4Invoice(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700">Print (A4)</button>
                                                        <button onClick={() => { handleDownloadThermalReceipt(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700">Download Receipt</button>
                                                        <button onClick={() => { handleShareInvoice(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-700">Share Invoice</button>
                                                    </div>
                                                )}
                                            </div>
                                            <DeleteButton 
                                                variant="delete" 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }} 
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Items Purchased:</h4>
                                                <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                    {sale.items.map((item, index) => (
                                                        <li key={index}>
                                                            {item.productName} (x{item.quantity}) @ ₹{Number(item.price).toLocaleString('en-IN')} each
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-md text-sm border dark:border-slate-600">
                                                <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Transaction Details:</h4>
                                                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                                                    <div className="flex justify-between"><span>Subtotal:</span> <span>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between"><span>Discount:</span> <span>- ₹{Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between"><span>GST Included:</span> <span>₹{Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between font-bold border-t dark:border-slate-500 pt-1 mt-1 text-gray-800 dark:text-white"><span>Grand Total:</span> <span>₹{Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-1">Payments Made:</h4>
                                                {sale.payments.length > 0 ? (
                                                    <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                                        {sale.payments.map(payment => (
                                                            <li key={payment.id}>
                                                                ₹{Number(payment.amount).toLocaleString('en-IN')} {payment.method === 'RETURN_CREDIT' ? <span className="text-blue-600 dark:text-blue-400 font-semibold">(Return Credit)</span> : `via ${payment.method}`} on {new Date(payment.date).toLocaleDateString()}
                                                                {payment.reference && <span className="text-xs text-gray-500 dark:text-gray-500 block">Ref: {payment.reference}</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : <p className="text-sm text-gray-500 dark:text-gray-400">No payments made yet.</p>}
                                            </div>
                                            {!isPaid && (
                                                <div className="pt-2">
                                                    <Button onClick={() => setPaymentModalState({ isOpen: true, saleId: sale.id })} className="w-full">
                                                        <Plus size={16} className="mr-2"/> Add Payment
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )})}
                        </div>
                    ) : (
                        <p className="text-gray-500 dark:text-gray-400">No sales recorded for this customer.</p>
                    )}
                </Card>
                 <Card title="Returns History">
                    {customerReturns.length > 0 ? (
                         <div className="space-y-3">
                            {customerReturns.slice().reverse().map(ret => (
                                <div key={ret.id} className="p-3 bg-gray-50 dark:bg-slate-700/30 rounded-lg border dark:border-slate-700">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold dark:text-slate-200">Return on {new Date(ret.returnDate).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Original Invoice: {ret.referenceId}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-primary">Refunded: ₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                            <Button onClick={() => handleEditReturn(ret.id)} variant="secondary" className="p-2 h-auto">
                                                <Edit size={16} />
                                            </Button>
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
                        <p className="text-gray-500 dark:text-gray-400">No returns recorded for this customer.</p>
                    )}
                </Card>
            </div>
        );
    }


    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">Customers</h1>
                    <DatePill />
                </div>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {isAdding ? 'Cancel' : 'Add Customer'}
                </Button>
            </div>

            {isAdding && (
                <Card title="New Customer Form">
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer ID</label>
                            <div className="flex items-center mt-1">
                                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400">
                                    CUST-
                                </span>
                                <input 
                                    type="text" 
                                    placeholder="Enter unique ID" 
                                    value={newCustomer.id} 
                                    onChange={e => setNewCustomer({ ...newCustomer, id: e.target.value })} 
                                    className="w-full p-2 border rounded-r-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
                                />
                            </div>
                        </div>
                        <input type="text" placeholder="Name" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                        <input type="text" placeholder="Phone" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                        <input type="text" placeholder="Address" value={newCustomer.address} onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                        <input type="text" placeholder="Area/Location" value={newCustomer.area} onChange={e => setNewCustomer({ ...newCustomer, area: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                        <input type="text" placeholder="Reference (Optional)" value={newCustomer.reference} onChange={e => setNewCustomer({ ...newCustomer, reference: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                        <Button onClick={handleAddCustomer} className="w-full">Save Customer</Button>
                    </div>
                </Card>
            )}

            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search customers by name, phone, or area..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                />
            </div>

            <div className="space-y-3">
                {filteredCustomers.map((customer, index) => {
                    const customerSales = state.sales.filter(s => s.customerId === customer.id);
                    const totalPurchase = customerSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
                    const totalPaid = customerSales.reduce((sum, s) => sum + s.payments.reduce((pSum, p) => pSum + Number(p.amount), 0), 0);
                    const totalDue = totalPurchase - totalPaid;

                    return (
                        <Card 
                            key={customer.id} 
                            className="cursor-pointer transition-shadow animate-slide-up-fade" 
                            style={{ animationDelay: `${index * 50}ms` }}
                            onClick={() => setSelectedCustomer(customer)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg text-primary flex items-center gap-2"><User size={16}/> {customer.name}</p>
                                    <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2"><Phone size={14}/> {customer.phone}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2"><MapPin size={14}/> {customer.area}</p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    <div className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400">
                                        <ShoppingCart size={14} />
                                        <span className="font-semibold">₹{totalPurchase.toLocaleString('en-IN')}</span>
                                    </div>
                                     <div className={`flex items-center justify-end gap-1 ${totalDue > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                                        <IndianRupee size={14} />
                                        <span className="font-semibold">₹{totalDue.toLocaleString('en-IN')}</span>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
};

export default CustomersPage;
