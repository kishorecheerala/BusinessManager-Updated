
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, User, Phone, MapPin, Search, Edit, Save, X, IndianRupee, ShoppingCart, Share2, Crown, ShieldAlert, BadgeCheck } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Payment, Sale, Page } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ConfirmationModal from '../components/ConfirmationModal';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { generateA4InvoicePdf, generateThermalInvoicePDF, generateGenericReportPDF } from '../utils/pdfGenerator';
import { useDialog } from '../context/DialogContext';
import PaymentModal from '../components/PaymentModal';
import AddCustomerModal from '../components/AddCustomerModal';
import { getLocalDateString } from '../utils/dateUtils';

// --- Customer Segmentation Helper ---
type CustomerSegment = 'VIP' | 'Regular' | 'New' | 'At-Risk';

const getCustomerSegment = (sales: Sale[]): CustomerSegment => {
    if (!sales || sales.length === 0) return 'New';
    
    const totalSpent = sales.reduce((acc, sale) => acc + Number(sale.totalAmount), 0);
    const orderCount = sales.length;
    
    // Check At-Risk (Last order > 60 days ago AND significant spend previously)
    const lastOrderDate = sales.reduce((latest, sale) => {
        const d = new Date(sale.date);
        return d > latest ? d : latest;
    }, new Date(0));
    
    const daysSinceLastOrder = (new Date().getTime() - lastOrderDate.getTime()) / (1000 * 3600 * 24);
    
    if (daysSinceLastOrder > 60 && totalSpent > 5000) return 'At-Risk';
    
    if (totalSpent > 50000 || orderCount > 10) return 'VIP';
    if (orderCount > 2) return 'Regular';
    
    return 'New';
};

const SegmentBadge: React.FC<{ segment: CustomerSegment }> = ({ segment }) => {
    switch (segment) {
        case 'VIP':
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200"><Crown size={10} className="mr-1"/> VIP</span>;
        case 'At-Risk':
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 border border-red-200"><ShieldAlert size={10} className="mr-1"/> At-Risk</span>;
        case 'Regular':
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200"><BadgeCheck size={10} className="mr-1"/> Regular</span>;
        default:
            return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-800 border border-green-200">New</span>;
    }
};

interface CustomersPageProps {
  setIsDirty: (isDirty: boolean) => void;
  setCurrentPage: (page: Page) => void;
}

const CustomersPage: React.FC<CustomersPageProps> = ({ setIsDirty, setCurrentPage }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAdding, setIsAdding] = useState(false);
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
        const currentlyDirty = isEditing;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [isEditing, setIsDirty]);

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


    const handleAddCustomer = (customer: Customer) => {
        dispatch({ type: 'ADD_CUSTOMER', payload: customer });
        setIsAdding(false);
        showToast("Customer added successfully!");
    };
    
    const handleUpdateCustomer = async () => {
        if (editedCustomer) {
            const confirmed = await showConfirm('Are you sure you want to save these changes to the customer details?');
            if (confirmed) {
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
            showToast("Please enter a valid amount.", 'error');
            return;
        }
        
        const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const dueAmount = Number(sale.totalAmount) - amountPaid;
        const newPaymentAmount = parseFloat(paymentDetails.amount);

        if(newPaymentAmount > dueAmount + 0.01) { // Epsilon for float
            showToast(`Payment of ₹${newPaymentAmount.toLocaleString('en-IN')} exceeds due amount of ₹${dueAmount.toLocaleString('en-IN')}.`, 'error');
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

    // Updated Handlers for PDF Generation
    const handleDownloadThermalReceipt = async (sale: Sale) => {
        if (!selectedCustomer) return;
        try {
            const doc = await generateThermalInvoicePDF(sale, selectedCustomer, state.profile, state.receiptTemplate, state.customFonts);
            const cleanName = selectedCustomer.name.replace(/[^a-z0-9]/gi, '_');
            const dateStr = new Date(sale.date).toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Receipt_${cleanName}_${dateStr}.pdf`);
        } catch (e) {
            console.error("PDF Error", e);
            showToast("Failed to generate receipt", 'error');
        }
    };

    const handlePrintA4Invoice = async (sale: Sale) => {
        if (!selectedCustomer) return;
        const doc = await generateA4InvoicePdf(sale, selectedCustomer, state.profile, state.invoiceTemplate, state.customFonts);
        doc.autoPrint();
        const pdfUrl = doc.output('bloburl');
        window.open(pdfUrl, '_blank');
    };

    const handleShareInvoice = async (sale: Sale) => {
        if (!selectedCustomer) return;
        try {
            const doc = await generateA4InvoicePdf(sale, selectedCustomer, state.profile, state.invoiceTemplate, state.customFonts);
            const pdfBlob = doc.output('blob');
            
            const cleanName = selectedCustomer.name.replace(/[^a-z0-9]/gi, '_');
            const dateStr = new Date(sale.date).toLocaleDateString('en-IN').replace(/\//g, '-');
            const filename = `Invoice_${cleanName}_${dateStr}.pdf`;
            
            const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
            const businessName = state.profile?.name || 'Invoice';

            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `${businessName} - Invoice ${sale.id}`,
                    files: [pdfFile],
                });
            } else {
                doc.save(filename);
            }
        } catch (e) {
            console.error("PDF Share Error", e);
            showToast("Failed to generate or share invoice", 'error');
        }
    };

    const handleShareDuesSummary = async () => {
        if (!selectedCustomer) return;

        const overdueSales = state.sales.filter(s => {
            const paid = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            return s.customerId === selectedCustomer.id && (Number(s.totalAmount) - paid) > 0.01;
        });

        if (overdueSales.length === 0) {
            showToast(`${selectedCustomer.name} has no outstanding dues.`, 'info');
            return;
        }

        const totalDue = overdueSales.reduce((total, sale) => {
            const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            return total + (Number(sale.totalAmount) - paid);
        }, 0);
        
        try {
            const doc = await generateGenericReportPDF(
                "Customer Dues Summary",
                `Statement For: ${selectedCustomer.name}`,
                ['Invoice ID', 'Date', 'Total', 'Paid', 'Due'],
                overdueSales.map(sale => {
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
                [{ label: 'Total Outstanding Due', value: `Rs. ${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' }],
                state.profile,
                state.reportTemplate,
                state.customFonts
            );

            const pdfBlob = doc.output('blob');
            const cleanName = selectedCustomer.name.replace(/[^a-z0-9]/gi, '_');
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            const filename = `Dues_${cleanName}_${dateStr}.pdf`;
            
            const pdfFile = new File([pdfBlob], filename, { type: 'application/pdf' });
            const businessName = state.profile?.name || 'Dues Summary';

            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
              await navigator.share({
                title: `${businessName} - Dues for ${selectedCustomer.name}`,
                files: [pdfFile],
              });
            } else {
              doc.save(filename);
            }
        } catch (e) {
            console.error("PDF Report Error", e);
            showToast("Failed to generate report.", 'error');
        }
    };

    const filteredCustomers = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return state.customers.filter(c =>
            c.name.toLowerCase().includes(lowerTerm) ||
            c.phone.includes(lowerTerm) ||
            c.area.toLowerCase().includes(lowerTerm)
        );
    }, [state.customers, searchTerm]);
    
    if (selectedCustomer && editedCustomer) {
        const customerSales = state.sales.filter(s => s.customerId === selectedCustomer.id);
        const customerReturns = state.returns.filter(r => r.type === 'CUSTOMER' && r.partyId === selectedCustomer.id);
        
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            setEditedCustomer({ ...editedCustomer, [e.target.name]: e.target.value });
        };
        
        const selectedSaleForPayment = state.sales.find(s => s.id === paymentModalState.saleId);
        const amountPaidForSelected = selectedSaleForPayment ? selectedSaleForPayment.payments.reduce((sum, p) => sum + Number(p.amount), 0) : 0;
        const dueAmountForSelected = selectedSaleForPayment ? Number(selectedSaleForPayment.totalAmount) - amountPaidForSelected : 0;

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
                    totalAmount={selectedSaleForPayment ? selectedSaleForPayment.totalAmount : 0}
                    dueAmount={dueAmountForSelected}
                    paymentDetails={paymentDetails}
                    setPaymentDetails={setPaymentDetails}
                />
                <Button onClick={() => setSelectedCustomer(null)}>&larr; Back to List</Button>
                <Card>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                                {selectedCustomer.name}
                                <SegmentBadge segment={getCustomerSegment(customerSales)} />
                            </h2>
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
                                <div key={sale.id} className="bg-gray-50 rounded-lg border overflow-hidden transition-all duration-300">
                                    <div className="w-full text-left p-3 flex justify-between items-center bg-gray-100 border-b">
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800">{sale.id}</p>
                                            <p className="text-xs text-gray-600">{new Date(sale.date).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right mx-2">
                                            <p className="font-bold text-lg text-primary">₹{Number(sale.totalAmount).toLocaleString('en-IN')}</p>
                                            <p className={`text-sm font-semibold ${isPaid ? 'text-green-600' : 'text-red-600'}`}>
                                                {isPaid ? 'Paid' : `Due: ₹${dueAmount.toLocaleString('en-IN')}`}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="p-3 bg-white">
                                        <div className="flex justify-end items-start mb-2">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleEditSale(sale.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" aria-label="Edit Sale"><Edit size={16} /></button>
                                                    <div className="relative" ref={actionMenuSaleId === sale.id ? actionMenuRef : undefined}>
                                                    <button onClick={() => setActionMenuSaleId(sale.id)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-full" aria-label="Share or Download Invoice">
                                                        <Share2 size={16} />
                                                    </button>
                                                    {actionMenuSaleId === sale.id && (
                                                        <div className="absolute top-full right-0 mt-1 w-48 bg-white rounded-md shadow-lg border text-text z-10 animate-scale-in origin-top-right">
                                                            <button onClick={() => { handlePrintA4Invoice(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Print (A4)</button>
                                                            <button onClick={() => { handleDownloadThermalReceipt(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Download Receipt</button>
                                                            <button onClick={() => { handleShareInvoice(sale); setActionMenuSaleId(null); }} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Share Invoice</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <DeleteButton 
                                                    variant="delete" 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteSale(sale.id); }} 
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-700 mb-1">Items Purchased:</h4>
                                                <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                                    {sale.items.map((item, index) => (
                                                        <li key={index}>
                                                            {item.productName} (x{item.quantity}) @ ₹{Number(item.price).toLocaleString('en-IN')} each
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="p-2 bg-white rounded-md text-sm border">
                                                <h4 className="font-semibold text-gray-700 mb-2">Transaction Details:</h4>
                                                <div className="space-y-1">
                                                    <div className="flex justify-between"><span>Subtotal:</span> <span>₹{subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between"><span>Discount:</span> <span>- ₹{Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between"><span>GST Included:</span> <span>₹{Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                    <div className="flex justify-between font-bold border-t pt-1 mt-1"><span>Grand Total:</span> <span>₹{Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-sm text-gray-700 mb-1">Payments Made:</h4>
                                                {sale.payments.length > 0 ? (
                                                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                                                        {sale.payments.map(payment => (
                                                            <li key={payment.id}>
                                                                ₹{Number(payment.amount).toLocaleString('en-IN')} {payment.method === 'RETURN_CREDIT' ? <span className="text-blue-600 font-semibold">(Return Credit)</span> : `via ${payment.method}`} on {new Date(payment.date).toLocaleDateString()}
                                                                {payment.reference && <span className="text-xs text-gray-500 block">Ref: {payment.reference}</span>}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                ) : <p className="text-sm text-gray-500">No payments made yet.</p>}
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
                        <p className="text-gray-500">No sales recorded for this customer.</p>
                    )}
                </Card>
                 <Card title="Returns History">
                    {customerReturns.length > 0 ? (
                         <div className="space-y-3">
                            {customerReturns.slice().reverse().map(ret => (
                                <div key={ret.id} className="p-3 bg-gray-50 rounded-lg border">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-semibold">Return on {new Date(ret.returnDate).toLocaleDateString()}</p>
                                            <p className="text-xs text-gray-500">Original Invoice: {ret.referenceId}</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-semibold text-primary">Refunded: ₹{Number(ret.amount).toLocaleString('en-IN')}</p>
                                            <Button onClick={() => handleEditReturn(ret.id)} variant="secondary" className="p-2 h-auto">
                                                <Edit size={16} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="mt-2 pt-2 border-t">
                                        <ul className="text-sm list-disc list-inside text-gray-600">
                                            {ret.items.map((item, idx) => (
                                                <li key={idx}>{item.productName} (x{item.quantity})</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500">No returns recorded for this customer.</p>
                    )}
                </Card>
            </div>
        );
    }


    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-primary">Customers</h1>
                <Button onClick={() => setIsAdding(!isAdding)}>
                    <Plus className="w-4 h-4 mr-2" />
                    {isAdding ? 'Cancel' : 'Add Customer'}
                </Button>
            </div>

            <AddCustomerModal 
                isOpen={isAdding} 
                onClose={() => setIsAdding(false)} 
                onAdd={handleAddCustomer} 
                existingCustomers={state.customers}
            />

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
                            className="cursor-pointer transition-shadow animate-slide-up-fade hover:shadow-lg" 
                            style={{ animationDelay: `${index * 50}ms` }}
                            onClick={() => setSelectedCustomer(customer)}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg text-primary flex items-center gap-2">
                                        <User size={16}/> {customer.name}
                                        <SegmentBadge segment={getCustomerSegment(customerSales)} />
                                    </p>
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
