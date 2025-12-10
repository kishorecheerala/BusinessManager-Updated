
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Share2, Search, X, IndianRupee, QrCode, Save, Edit, ScanLine, PauseCircle, PlayCircle, Clock, History, ArrowRight, FileText } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem, Customer, Product, Payment, ParkedSale } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateTotals } from '../utils/calculations';
import { useHotkeys } from '../hooks/useHotkeys';
import AddCustomerModal from '../components/AddCustomerModal';
import ProductSearchModal from '../components/ProductSearchModal';
import QRScannerModal from '../components/QRScannerModal';
import ModernDateInput from '../components/ModernDateInput';
import { generateA4InvoicePdf, generateReceiptPDF } from '../utils/pdfGenerator';
import Input from '../components/Input';
import Dropdown from '../components/Dropdown';
import PaymentModal from '../components/PaymentModal';

interface SalesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const SalesPage: React.FC<SalesPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { currentSale, parkedSales } = state; // Access global draft/parked state
    
    // Initialize form from Global State (Restores progress on navigation)
    const [mode, setMode] = useState<'add' | 'edit'>((currentSale.editId ? 'edit' : 'add'));
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

    const [customerId, setCustomerId] = useState(currentSale.customerId || '');
    const [items, setItems] = useState<SaleItem[]>(currentSale.items || []);
    const [discount, setDiscount] = useState(currentSale.discount || '0');
    const [saleDate, setSaleDate] = useState(currentSale.date || getLocalDateString());
    
    // Payment Details State (Synced with Global Draft)
    const [paymentDetails, setPaymentDetails] = useState(currentSale.paymentDetails || {
        amount: '',
        method: 'CASH' as 'CASH' | 'UPI' | 'CHEQUE',
        date: getLocalDateString(),
        reference: '',
    });

    // Add Payment Modal State for Editing Existing Sales
    const [editPaymentModal, setEditPaymentModal] = useState<{ isOpen: boolean, saleId: string | null, payment: Payment | null }>({ isOpen: false, saleId: null, payment: null });
    const [tempPaymentDetails, setTempPaymentDetails] = useState<{
        amount: string;
        method: 'CASH' | 'UPI' | 'CHEQUE' | 'RETURN_CREDIT';
        date: string;
        reference: string;
    }>({
        amount: '',
        method: 'CASH',
        date: getLocalDateString(),
        reference: '',
    });

    const [isSelectingProduct, setIsSelectingProduct] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const isDirtyRef = useRef(false);

    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const customerDropdownRef = useRef<HTMLDivElement>(null);
    
    const [isDraftsOpen, setIsDraftsOpen] = useState(false);
    
    useOnClickOutside(customerDropdownRef, () => {
        if (isCustomerDropdownOpen) {
            setIsCustomerDropdownOpen(false);
        }
    });

    // --- Auto-Sync Local Form to Global State ---
    // This ensures that if the user navigates away, App.tsx can detect "Active Sale" state
    useEffect(() => {
        const timer = setTimeout(() => {
            dispatch({
                type: 'UPDATE_CURRENT_SALE',
                payload: {
                    customerId,
                    items,
                    discount,
                    date: saleDate,
                    paymentDetails,
                    editId: mode === 'edit' ? saleToEdit?.id : undefined
                }
            });
        }, 300); // Debounce to prevent excessive dispatches
        return () => clearTimeout(timer);
    }, [customerId, items, discount, saleDate, paymentDetails, mode, saleToEdit, dispatch]);

    // Handle External Selection (e.g. "Edit" from Customer Page)
    const loadSaleForEditing = (sale: Sale) => {
        setSaleToEdit(sale);
        setMode('edit');
        setCustomerId(sale.customerId);
        setItems(sale.items.map(item => ({...item}))); // Deep copy
        setDiscount(sale.discount.toString());
        setSaleDate(getLocalDateString(new Date(sale.date)));
        setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    useEffect(() => {
        if (state.selection?.page === 'SALES' && state.selection.action === 'edit') {
            const sale = state.sales.find(s => s.id === state.selection.id);
            if (sale) {
                loadSaleForEditing(sale);
                dispatch({ type: 'CLEAR_SELECTION' });
            }
        }
    }, [state.selection, state.sales, dispatch]);

    // Check if we need to restore saleToEdit object from ID in global state (on page reload/return)
    useEffect(() => {
        if (mode === 'edit' && !saleToEdit && currentSale.editId) {
             const sale = state.sales.find(s => s.id === currentSale.editId);
             if (sale) setSaleToEdit(sale);
             else {
                 // If sale not found (deleted?), revert to add mode
                 setMode('add');
             }
        }
    }, [mode, saleToEdit, currentSale.editId, state.sales]);

    useEffect(() => {
        // We use global state 'currentSale' for dirty checking in App.tsx navigation,
        // but we still need 'isDirty' prop for prompt on window close or back button.
        const dateIsDirty = mode === 'add' && saleDate !== getLocalDateString();
        const formIsDirty = !!customerId || items.length > 0 || discount !== '0' || !!paymentDetails.amount || dateIsDirty;
        const currentlyDirty = formIsDirty || isAddingCustomer;
        
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [customerId, items, discount, paymentDetails.amount, isAddingCustomer, setIsDirty, saleDate, mode]);

    useEffect(() => {
        return () => setIsDirty(false);
    }, [setIsDirty]);

    const resetForm = () => {
        setCustomerId('');
        setItems([]);
        setDiscount('0');
        setSaleDate(getLocalDateString());
        setPaymentDetails({
            amount: '',
            method: 'CASH',
            date: getLocalDateString(),
            reference: '',
        });
        setIsSelectingProduct(false);
        setMode('add');
        setSaleToEdit(null);
        // Also clear global state
        dispatch({ type: 'CLEAR_CURRENT_SALE' });
    };
    
    // --- Park/Draft Functions ---
    const handleParkSale = () => {
        if (items.length === 0 && !customerId) {
            showToast("Cannot park an empty sale.", 'error');
            return;
        }

        dispatch({ type: 'PARK_CURRENT_SALE' });
        showToast("Sale parked successfully.", 'success');
        
        // Reset local UI immediately
        setCustomerId('');
        setItems([]);
        setDiscount('0');
        setSaleDate(getLocalDateString());
        setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
    };

    const handleResumeDraft = (draft: ParkedSale) => {
        dispatch({ type: 'RESUME_PARKED_SALE', payload: draft });
        
        // Populate local state immediately
        setCustomerId(draft.customerId);
        setItems(draft.items);
        setDiscount(draft.discount || '0');
        setSaleDate(draft.date ? getLocalDateString(new Date(draft.date)) : getLocalDateString());
        if (draft.paymentDetails) {
            setPaymentDetails(draft.paymentDetails);
        }
        
        setMode(draft.editId ? 'edit' : 'add');
        if (draft.editId) {
            const sale = state.sales.find(s => s.id === draft.editId);
            if(sale) setSaleToEdit(sale);
        }

        setIsDraftsOpen(false);
        showToast("Draft resumed.", 'success');
    };

    const handleDeleteDraft = (draftId: string) => {
        dispatch({ type: 'DELETE_PARKED_SALE', payload: draftId });
    };

    const handleSelectProduct = (product: Product) => {
        const newItem = {
            productId: product.id,
            productName: product.name,
            price: Number(product.salePrice),
            quantity: 1,
        };

        const existingItem = items.find(i => i.productId === newItem.productId);
        const originalQtyInSale = mode === 'edit' ? saleToEdit?.items.find(i => i.productId === product.id)?.quantity || 0 : 0;
        const availableStock = Number(product.quantity) + originalQtyInSale;

        if (existingItem) {
            if (existingItem.quantity + 1 > availableStock) {
                 showToast(`Not enough stock for ${product.name}. Only ${availableStock} available for this sale.`, 'error');
                 return;
            }
            setItems(items.map(i => i.productId === newItem.productId ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
             if (1 > availableStock) {
                 showToast(`Not enough stock for ${product.name}. Only ${availableStock} available for this sale.`, 'error');
                 return;
            }
            setItems([...items, newItem]);
        }
        setIsSelectingProduct(false);
    };
    
    const handleProductScanned = (decodedText: string) => {
        setIsScanning(false);
        const product = state.products.find(p => p.id.toLowerCase() === decodedText.toLowerCase());
        if (product) {
            handleSelectProduct(product);
        } else {
            showToast("Product not found in inventory.", 'error');
        }
    };

    const handleItemChange = (productId: string, field: 'quantity' | 'price', value: string) => {
        const numValue = parseFloat(value);
        if (isNaN(numValue) && value !== '') return;

        setItems(prevItems => prevItems.map(item => {
            if (item.productId === productId) {
                if (field === 'quantity') {
                    const product = state.products.find(p => p.id === productId);
                    const originalQtyInSale = mode === 'edit' ? saleToEdit?.items.find(i => i.productId === productId)?.quantity || 0 : 0;
                    const availableStock = (Number(product?.quantity) || 0) + originalQtyInSale;
                    if (numValue > availableStock) {
                        showToast(`Not enough stock for ${item.productName}. Only ${availableStock} available.`, 'error');
                        return { ...item, quantity: availableStock };
                    }
                }
                return { ...item, [field]: numValue };
            }
            return item;
        }));
    };

    const handleRemoveItem = (productId: string) => {
        setItems(items.filter(item => item.productId !== productId));
    };

    const calculations = useMemo(() => {
        return calculateTotals(items, parseFloat(discount) || 0, state.products);
    }, [items, discount, state.products]);

    const selectedCustomer = useMemo(() => customerId ? state.customers.find(c => c.id === customerId) : null, [customerId, state.customers]);

    // --- Last Purchase Information for Selected Customer ---
    const lastPurchaseInfo = useMemo(() => {
        if (!customerId) return null;
        const customerSales = state.sales.filter(s => s.customerId === customerId);
        if (customerSales.length === 0) return null;
        
        // Sort by date desc
        const lastSale = customerSales.reduce((latest, current) => {
            return new Date(current.date) > new Date(latest.date) ? current : latest;
        });
        
        return {
            date: new Date(lastSale.date).toLocaleDateString(),
            amount: lastSale.totalAmount
        };
    }, [customerId, state.sales]);

    const filteredCustomers = useMemo(() => 
        state.customers.filter(c => 
            c.name.toLowerCase().includes(customerSearchTerm.toLowerCase()) || 
            c.area.toLowerCase().includes(customerSearchTerm.toLowerCase())
        ).sort((a,b) => a.name.localeCompare(b.name)),
    [state.customers, customerSearchTerm]);

    const customerTotalDue = useMemo(() => {
        if (!customerId) return null;
        const customerSales = state.sales.filter(s => s.customerId === customerId);
        if (customerSales.length === 0) return 0;
        
        const totalBilled = customerSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0);
        const totalPaid = customerSales.reduce((sum, sale) => {
            return sum + (sale.payments || []).reduce((paySum, payment) => paySum + Number(payment.amount), 0);
        }, 0);

        return totalBilled - totalPaid;
    }, [customerId, state.sales]);
    
    const handleAddCustomer = (customer: Customer) => {
        dispatch({ type: 'ADD_CUSTOMER', payload: customer });
        setCustomerId(customer.id);
        setIsAddingCustomer(false);
        showToast("Customer added successfully!");
    };

    const generateAndSharePDF = async (sale: Sale, customer: Customer, paidAmountOnSale: number) => {
      try {
        const doc = await generateA4InvoicePdf(sale, customer, state.profile, state.invoiceTemplate, state.customFonts);
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `Invoice-${sale.id}.pdf`, { type: 'application/pdf' });
        const businessName = state.profile?.name || 'Your Business';
        
        const subTotal = calculations.subTotal;
        const dueAmountOnSale = Number(sale.totalAmount) - paidAmountOnSale;

        const whatsAppText = `Thank you for your purchase from ${businessName}!\n\n*Invoice Summary:*\nInvoice ID: ${sale.id}\nDate: ${new Date(sale.date).toLocaleString()}\n\n*Items:*\n${sale.items.map(i => `- ${i.productName} (x${i.quantity}) - Rs. ${(Number(i.price) * Number(i.quantity)).toLocaleString('en-IN')}`).join('\n')}\n\nSubtotal: Rs. ${subTotal.toLocaleString('en-IN')}\nGST: Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}\nDiscount: Rs. ${Number(sale.discount).toLocaleString('en-IN')}\n*Total: Rs. ${Number(sale.totalAmount).toLocaleString('en-IN')}*\nPaid: Rs. ${paidAmountOnSale.toLocaleString('en-IN')}\nDue: Rs. ${dueAmountOnSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nHave a blessed day!`;
        
        if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
          try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
              await navigator.clipboard.writeText(whatsAppText);
              showToast('Invoice text copied to clipboard!');
            }
          } catch (err) {
            console.warn('Could not copy text to clipboard:', err);
          }
          await navigator.share({
            title: `${businessName} Invoice ${sale.id}`,
            text: whatsAppText,
            files: [pdfFile],
          });
        } else {
          doc.save(`Invoice-${sale.id}.pdf`);
        }
      } catch (error: any) {
        if (error.name === 'AbortError' || (error.message && error.message.includes('Share canceled'))) {
             console.debug('Share canceled by user');
             return;
        }
        console.error("PDF generation or sharing failed:", error);
        showToast(`Sale created, but PDF failed: ${error.message}`, 'error');
      }
    };

    const handleSubmitSale = async () => {
        if (!customerId || items.length === 0) {
            showToast("Please select a customer and add at least one item.", 'info');
            return;
        }

        const customer = state.customers.find(c => c.id === customerId);
        if(!customer) {
            showToast("Could not find the selected customer.", 'error');
            return;
        }
        
        const { totalAmount, gstAmount, discountAmount } = calculations;

        if (mode === 'add') {
            const paidAmount = parseFloat(paymentDetails.amount) || 0;
            if (paidAmount > totalAmount + 0.01) {
                showToast(`Paid amount (₹${paidAmount.toLocaleString('en-IN')}) cannot be greater than the total amount (₹${totalAmount.toLocaleString('en-IN')}).`, 'error');
                return;
            }
            const payments: Payment[] = [];
            if (paidAmount > 0) {
                payments.push({
                    id: `PAY-S-${Date.now()}`, amount: paidAmount, method: paymentDetails.method,
                    date: new Date(paymentDetails.date).toISOString(), reference: paymentDetails.reference.trim() || undefined,
                });
            }
            
            const saleCreationDate = new Date();
            const saleDateWithTime = new Date(`${saleDate}T${saleCreationDate.toTimeString().split(' ')[0]}`);
            const saleId = `SALE-${saleCreationDate.getFullYear()}${(saleCreationDate.getMonth() + 1).toString().padStart(2, '0')}${saleCreationDate.getDate().toString().padStart(2, '0')}-${saleCreationDate.getHours().toString().padStart(2, '0')}${saleCreationDate.getMinutes().toString().padStart(2, '0')}${saleCreationDate.getSeconds().toString().padStart(2, '0')}`;
            
            const newSale: Sale = {
                id: saleId, customerId, items, discount: discountAmount, gstAmount, totalAmount,
                date: saleDateWithTime.toISOString(), payments
            };
            dispatch({ type: 'ADD_SALE', payload: newSale });
            items.forEach(item => {
                dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: item.productId, change: -Number(item.quantity) } });
            });
            showToast('Sale created successfully!');
            await generateAndSharePDF(newSale, customer, paidAmount);

        } else if (mode === 'edit' && saleToEdit) {
            const existingPayments = saleToEdit.payments || [];
            const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            if (totalAmount < totalPaid - 0.01) {
                showToast(`The new total amount (₹${totalAmount.toLocaleString('en-IN')}) cannot be less than the amount already paid (₹${totalPaid.toLocaleString('en-IN')}).`, 'error');
                return;
            }

            const saleCreationDate = new Date();
            const saleDateWithTime = new Date(`${saleDate}T${saleCreationDate.toTimeString().split(' ')[0]}`);
            
            const updatedSale: Sale = {
                ...saleToEdit, items, discount: discountAmount, gstAmount, totalAmount, date: saleDateWithTime.toISOString()
            };
            dispatch({ type: 'UPDATE_SALE', payload: { oldSale: saleToEdit, updatedSale } });
            showToast('Sale updated successfully!');
        }

        resetForm();
    };

    const handleRecordStandalonePayment = () => {
        if (!customerId) {
            showToast('Please select a customer to record a payment for.', 'info');
            return;
        }

        const paidAmount = parseFloat(paymentDetails.amount || '0');
        if (paidAmount <= 0) {
            showToast('Please enter a valid payment amount.', 'error');
            return;
        }

        const outstandingSales = state.sales
            .filter(sale => {
                const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                return sale.customerId === customerId && (Number(sale.totalAmount) - paid) > 0.01;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (outstandingSales.length === 0) {
            showToast('This customer has no outstanding dues.', 'info');
            return;
        }
        
        let remainingPayment = paidAmount;
        for (const sale of outstandingSales) {
            if (remainingPayment <= 0) break;

            const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            const dueAmount = Number(sale.totalAmount) - paid;
            
            const amountToApply = Math.min(remainingPayment, dueAmount);

            const newPayment: Payment = {
                id: `PAY-S-${Date.now()}-${Math.random()}`,
                amount: amountToApply,
                method: paymentDetails.method,
                date: new Date(paymentDetails.date).toISOString(),
                reference: paymentDetails.reference.trim() || undefined,
            };

            dispatch({ type: 'ADD_PAYMENT_TO_SALE', payload: { saleId: sale.id, payment: newPayment } });
            
            remainingPayment -= amountToApply;
        }
        
        showToast(`Payment of ₹${paidAmount.toLocaleString('en-IN')} recorded successfully.`);
        resetForm();
    };

    const handleEditPaymentClick = (saleId: string, payment: Payment) => {
        setTempPaymentDetails({
            amount: payment.amount.toString(),
            method: payment.method,
            date: getLocalDateString(new Date(payment.date)),
            reference: payment.reference || ''
        });
        setEditPaymentModal({ isOpen: true, saleId, payment });
    };

    const handleUpdatePayment = () => {
        if (!editPaymentModal.saleId || !editPaymentModal.payment) return;
        
        const updatedPayment: Payment = {
            ...editPaymentModal.payment,
            amount: parseFloat(tempPaymentDetails.amount) || 0,
            method: tempPaymentDetails.method,
            date: new Date(tempPaymentDetails.date).toISOString(),
            reference: tempPaymentDetails.reference
        };

        dispatch({ 
            type: 'UPDATE_PAYMENT_IN_SALE', 
            payload: { saleId: editPaymentModal.saleId, payment: updatedPayment } 
        });
        
        if (saleToEdit && saleToEdit.id === editPaymentModal.saleId) {
             const updatedPayments = saleToEdit.payments.map(p => p.id === updatedPayment.id ? updatedPayment : p);
             setSaleToEdit({...saleToEdit, payments: updatedPayments});
        }

        setEditPaymentModal({ isOpen: false, saleId: null, payment: null });
        showToast("Payment updated successfully.", 'success');
    };

    const canCreateSale = customerId && items.length > 0 && mode === 'add';
    const canUpdateSale = customerId && items.length > 0 && mode === 'edit';
    const canRecordPayment = customerId && items.length === 0 && parseFloat(paymentDetails.amount || '0') > 0 && customerTotalDue != null && customerTotalDue > 0.01 && mode === 'add';

    return (
        <div className="space-y-4 animate-fade-in-fast relative pb-10">
            {isAddingCustomer && 
                <AddCustomerModal 
                    isOpen={isAddingCustomer}
                    onClose={() => setIsAddingCustomer(false)}
                    onAdd={handleAddCustomer}
                    existingCustomers={state.customers}
                />
            }
            {isSelectingProduct && 
                <ProductSearchModal 
                    products={state.products}
                    onClose={() => setIsSelectingProduct(false)}
                    onSelect={handleSelectProduct}
                />
            }
            {isScanning && 
                <QRScannerModal 
                    onClose={() => setIsScanning(false)}
                    onScanned={handleProductScanned}
                />
            }

            {/* Edit Payment Modal */}
            <PaymentModal
                isOpen={editPaymentModal.isOpen}
                onClose={() => setEditPaymentModal({ isOpen: false, saleId: null, payment: null })}
                onSubmit={handleUpdatePayment}
                totalAmount={0}
                dueAmount={0}
                paymentDetails={tempPaymentDetails}
                setPaymentDetails={setTempPaymentDetails}
            />
            
            {/* Drafts Modal */}
            {isDraftsOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[150] p-4 animate-fade-in-fast backdrop-blur-sm">
                    <Card title="Parked Sales (Drafts)" className="w-full max-w-md animate-scale-in max-h-[80vh] flex flex-col">
                        <div className="flex-grow overflow-y-auto pr-1 space-y-3">
                            {parkedSales.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No parked sales.</p>
                            ) : (
                                parkedSales.map(draft => {
                                    const customer = state.customers.find(c => c.id === draft.customerId);
                                    const total = draft.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
                                    return (
                                        <div key={draft.id} className="bg-gray-50 dark:bg-slate-700/50 p-3 rounded-lg flex justify-between items-center border dark:border-slate-600">
                                            <div>
                                                <p className="font-bold text-sm dark:text-white">{customer?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                                    <Clock size={10} /> {new Date(draft.date).toLocaleString()}
                                                </p>
                                                <p className="text-xs font-semibold mt-1">{draft.items.length} items • ₹{total.toLocaleString()}</p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button onClick={() => handleResumeDraft(draft)} className="h-8 text-xs px-2 bg-emerald-600 hover:bg-emerald-700">
                                                    <PlayCircle size={14} className="mr-1"/> Resume
                                                </Button>
                                                <DeleteButton variant="delete" onClick={() => handleDeleteDraft(draft.id)} />
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                        <div className="pt-4 mt-2 border-t dark:border-slate-700">
                            <Button onClick={() => setIsDraftsOpen(false)} variant="secondary" className="w-full">Close</Button>
                        </div>
                    </Card>
                </div>
            )}
            
            <Card className={isCustomerDropdownOpen || isCalendarOpen ? 'relative z-20' : ''}>
                <div className="space-y-4">
                    <div className="flex gap-2 items-center">
                        <div className="relative w-full" ref={customerDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                                className="w-full p-2.5 border rounded bg-white text-left custom-select dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                disabled={mode === 'edit' || (mode === 'add' && items.length > 0)}
                                aria-haspopup="listbox"
                                aria-expanded={isCustomerDropdownOpen}
                            >
                                {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.area}` : 'Select a Customer'}
                            </button>

                            {isCustomerDropdownOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border dark:border-slate-700 z-40 animate-fade-in-fast">
                                    <div className="p-2 border-b dark:border-slate-700">
                                        <Input
                                            type="text"
                                            placeholder="Search by name or area..."
                                            value={customerSearchTerm}
                                            onChange={e => setCustomerSearchTerm(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <ul className="max-h-60 overflow-y-auto custom-scrollbar" role="listbox">
                                        <li
                                            key="select-customer-placeholder"
                                            onClick={() => {
                                                setCustomerId('');
                                                setIsCustomerDropdownOpen(false);
                                                setCustomerSearchTerm('');
                                            }}
                                            className="px-4 py-2 hover:bg-primary/10 dark:hover:bg-slate-700 cursor-pointer text-gray-500"
                                            role="option"
                                        >
                                            Select a Customer
                                        </li>
                                        {filteredCustomers.map(c => (
                                            <li
                                                key={c.id}
                                                onClick={() => {
                                                    setCustomerId(c.id);
                                                    setIsCustomerDropdownOpen(false);
                                                    setCustomerSearchTerm('');
                                                }}
                                                className={`px-4 py-2 cursor-pointer border-t dark:border-slate-700 transition-colors ${
                                                    customerId === c.id
                                                        ? 'bg-primary text-white'
                                                        : 'hover:bg-primary/10 dark:hover:bg-slate-700'
                                                }`}
                                                role="option"
                                            >
                                                {c.name} - {c.area}
                                            </li>
                                        ))}
                                        {filteredCustomers.length === 0 && (
                                            <li className="px-4 py-2 text-gray-400">No customers found.</li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                        {mode === 'add' && (
                            <Button onClick={() => setIsAddingCustomer(true)} variant="secondary" className="flex-shrink-0">
                                <Plus size={16}/> New Customer
                            </Button>
                        )}
                    </div>
                     <div>
                        <ModernDateInput 
                            label="Sale Date"
                            value={saleDate} 
                            onChange={e => setSaleDate(e.target.value)}
                            isOpen={isCalendarOpen}
                            onToggle={setIsCalendarOpen}
                        />
                    </div>
                    {/* Last Purchase Info Hint */}
                    {lastPurchaseInfo && mode === 'add' && (
                        <div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800 flex items-center justify-between animate-fade-in-fast mt-2">
                            <span>Last Purchase: <strong>{lastPurchaseInfo.date}</strong></span>
                            <span>Amount: <strong>₹{lastPurchaseInfo.amount.toLocaleString('en-IN')}</strong></span>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Sale Items">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => setIsSelectingProduct(true)} className="w-full sm:w-auto flex-grow" disabled={!customerId}>
                        <Search size={16} className="mr-2"/> Select Product
                    </Button>
                    <Button onClick={() => setIsScanning(true)} variant="secondary" className="w-full sm:w-auto flex-grow" disabled={!customerId}>
                        <QrCode size={16} className="mr-2"/> Scan Product
                    </Button>
                </div>
                <div className="mt-4 space-y-2">
                    {items.map(item => (
                        <div key={item.productId} className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded animate-fade-in-fast border dark:border-slate-700">
                            <div className="flex justify-between items-start">
                                <p className="font-semibold flex-grow">{item.productName}</p>
                                <DeleteButton variant="remove" onClick={() => handleRemoveItem(item.productId)} />
                            </div>
                            <div className="flex items-center gap-2 text-sm mt-1">
                                <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.productId, 'quantity', e.target.value)} className="w-20 !p-1 text-center" placeholder="Qty"/>
                                <span>x</span>
                                <Input type="number" value={item.price} onChange={e => handleItemChange(item.productId, 'price', e.target.value)} className="w-24 !p-1 text-center" placeholder="Price"/>
                                <span>= ₹{(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Transaction Details">
                <div className="space-y-6">
                    {/* Section 1: Calculation Details */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                            <span>Subtotal:</span>
                            <span>₹{calculations.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                            <span>Discount:</span>
                            <Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28 !p-1 text-right" />
                        </div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                            <span>GST Included:</span>
                            <span>₹{calculations.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Section 2: Grand Total */}
                    <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Grand Total</p>
                        <p className="text-4xl font-bold text-primary">
                            ₹{calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </p>
                    </div>

                    {/* Section 3: Payment Details */}
                    {mode === 'add' ? (
                        <div className="space-y-4">
                            <Input
                                label="Amount Paid Now"
                                type="number"
                                value={paymentDetails.amount}
                                onChange={e => setPaymentDetails({ ...paymentDetails, amount: e.target.value })}
                                placeholder={`Total is ₹${calculations.totalAmount.toLocaleString('en-IN')}`}
                                className="border-2 border-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-400"
                            />
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                                <Dropdown
                                    options={[
                                        { value: 'CASH', label: 'Cash' },
                                        { value: 'UPI', label: 'UPI' },
                                        { value: 'CHEQUE', label: 'Cheque' }
                                    ]}
                                    value={paymentDetails.method}
                                    onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
                                />
                            </div>
                            <Input
                                label="Payment Reference (Optional)"
                                type="text"
                                placeholder="e.g. UPI ID, Cheque No."
                                value={paymentDetails.reference}
                                onChange={e => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                            />
                        </div>
                    ) : (
                        <div className="pt-4 border-t dark:border-slate-700">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Recorded Payments</h4>
                             {saleToEdit?.payments && saleToEdit.payments.length > 0 ? (
                                <div className="space-y-2">
                                    {saleToEdit.payments.map((p, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                            <div>
                                                <p className="text-sm font-bold">₹{p.amount.toLocaleString()}</p>
                                                <p className="text-xs text-gray-500">{new Date(p.date).toLocaleDateString()} • {p.method}</p>
                                            </div>
                                            {/* Edit Payment Button */}
                                            <button 
                                                onClick={() => handleEditPaymentClick(saleToEdit.id, p)}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                                            >
                                                <Edit size={14} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                 <p className="text-sm text-gray-500 italic">No payments recorded.</p>
                             )}
                        </div>
                    )}
                </div>
            </Card>
            
            {mode === 'add' && items.length === 0 && customerId && customerTotalDue != null && customerTotalDue > 0.01 && (
                <Card title="Record Payment for Dues">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Amount Paid"
                            type="number"
                            value={paymentDetails.amount}
                            onChange={e => setPaymentDetails({ ...paymentDetails, amount: e.target.value })}
                            placeholder={'Enter amount to pay dues'}
                            className="border-2 border-red-300 focus:ring-red-500 focus:border-red-500 dark:border-red-400"
                        />
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                            <Dropdown
                                options={[
                                    { value: 'CASH', label: 'Cash' },
                                    { value: 'UPI', label: 'UPI' },
                                    { value: 'CHEQUE', label: 'Cheque' }
                                ]}
                                value={paymentDetails.method}
                                onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
                            />
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-2">
                {canCreateSale ? (
                    <Button onClick={handleSubmitSale} variant="secondary" className="w-full">
                        <Share2 className="w-4 h-4 mr-2"/>
                        Create Sale & Share Invoice
                    </Button>
                ) : canUpdateSale ? (
                    <Button onClick={handleSubmitSale} className="w-full">
                        <Save className="w-4 h-4 mr-2"/>
                        Save Changes to Sale
                    </Button>
                ) : canRecordPayment ? (
                     <Button onClick={handleRecordStandalonePayment} className="w-full">
                        <IndianRupee className="w-4 h-4 mr-2" />
                        Record Standalone Payment
                    </Button>
                ) : (
                     <Button className="w-full" disabled>
                        {customerId ? (items.length === 0 ? 'Enter payment or add items' : 'Complete billing details') : 'Select a customer'}
                    </Button>
                )}

                <Button onClick={resetForm} variant="secondary" className="w-full bg-teal-200 hover:bg-teal-300 focus:ring-teal-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    {mode === 'edit' ? 'Cancel Edit' : 'Clear Form'}
                </Button>
            </div>
        </div>
    );
};

export default SalesPage;
