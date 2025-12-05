
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Share2, Search, X, IndianRupee, QrCode, Save, Edit, ScanLine, PauseCircle, PlayCircle, Clock, Calendar, FileSpreadsheet } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem, Customer, Product, Payment } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { logoBase64 } from '../utils/logo';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateTotals } from '../utils/calculations';
import { useHotkeys } from '../hooks/useHotkeys';
import AddCustomerModal from '../components/AddCustomerModal';
import ProductSearchModal from '../components/ProductSearchModal';
import QRScannerModal from '../components/QRScannerModal';
import DateInput from '../components/DateInput';
import { generateA4InvoicePdf, generateReceiptPDF } from '../utils/pdfGenerator';
import { createCalendarEvent } from '../utils/googleCalendar';

const fetchImageAsBase64 = (url: string): Promise<string> =>
  fetch(url)
    .then(response => response.blob())
    .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    }));

// Interface for Draft/Parked Sales
interface ParkedSale {
    id: string;
    customerId: string;
    items: SaleItem[];
    date: number;
}

interface SalesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const SalesPage: React.FC<SalesPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    
    const [mode, setMode] = useState<'add' | 'edit'>('add');
    const [saleToEdit, setSaleToEdit] = useState<Sale | null>(null);

    const [customerId, setCustomerId] = useState('');
    const [items, setItems] = useState<SaleItem[]>([]);
    const [discount, setDiscount] = useState('0');
    const [saleDate, setSaleDate] = useState(getLocalDateString());
    
    const [paymentDetails, setPaymentDetails] = useState({
        amount: '',
        method: 'CASH' as 'CASH' | 'UPI' | 'CHEQUE',
        date: getLocalDateString(),
        reference: '',
    });

    const [isSelectingProduct, setIsSelectingProduct] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    
    const [isAddingCustomer, setIsAddingCustomer] = useState(false);
    const isDirtyRef = useRef(false);

    const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    const customerDropdownRef = useRef<HTMLDivElement>(null);
    
    // Parked Sales State
    const [parkedSales, setParkedSales] = useState<ParkedSale[]>([]);
    const [isDraftsOpen, setIsDraftsOpen] = useState(false);
    
    useOnClickOutside(customerDropdownRef, () => {
        if (isCustomerDropdownOpen) {
            setIsCustomerDropdownOpen(false);
        }
    });

    // Load Parked Sales from LocalStorage on mount
    useEffect(() => {
        const savedDrafts = localStorage.getItem('parked_sales');
        if (savedDrafts) {
            try {
                setParkedSales(JSON.parse(savedDrafts));
            } catch(e) {
                console.error("Failed to load drafts");
            }
        }
    }, []);

    // Effect to handle switching to edit mode from another page
    useEffect(() => {
        if (state.selection?.page === 'SALES' && state.selection.action === 'edit') {
            const sale = state.sales.find(s => s.id === state.selection.id);
            if (sale) {
                setSaleToEdit(sale);
                setMode('edit');
                setCustomerId(sale.customerId);
                setItems(sale.items.map(item => ({...item}))); // Deep copy
                setDiscount(sale.discount.toString());
                setSaleDate(getLocalDateString(new Date(sale.date)));
                setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
                dispatch({ type: 'CLEAR_SELECTION' });
            }
        }
    }, [state.selection, state.sales, dispatch]);

    useEffect(() => {
        const dateIsDirty = mode === 'add' && saleDate !== getLocalDateString();
        const formIsDirty = !!customerId || items.length > 0 || discount !== '0' || !!paymentDetails.amount || dateIsDirty;
        const currentlyDirty = formIsDirty || isAddingCustomer;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [customerId, items, discount, paymentDetails.amount, isAddingCustomer, setIsDirty, saleDate, mode]);


    // On unmount, we must always clean up.
    useEffect(() => {
        return () => {
            setIsDirty(false);
        };
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
    };
    
    // --- Park/Draft Functions ---
    const handleParkSale = () => {
        if (items.length === 0 && !customerId) {
            showToast("Cannot park an empty sale.", 'error');
            return;
        }

        const newDraft: ParkedSale = {
            id: `DRAFT-${Date.now()}`,
            customerId,
            items,
            date: Date.now()
        };

        const updatedDrafts = [newDraft, ...parkedSales];
        setParkedSales(updatedDrafts);
        localStorage.setItem('parked_sales', JSON.stringify(updatedDrafts));
        
        showToast("Sale parked successfully.", 'success');
        resetForm();
    };

    const handleResumeDraft = (draft: ParkedSale) => {
        setCustomerId(draft.customerId);
        setItems(draft.items);
        
        // Remove from drafts
        const updatedDrafts = parkedSales.filter(d => d.id !== draft.id);
        setParkedSales(updatedDrafts);
        localStorage.setItem('parked_sales', JSON.stringify(updatedDrafts));
        
        setIsDraftsOpen(false);
        showToast("Draft resumed.", 'success');
    };

    const handleDeleteDraft = (draftId: string) => {
        const updatedDrafts = parkedSales.filter(d => d.id !== draftId);
        setParkedSales(updatedDrafts);
        localStorage.setItem('parked_sales', JSON.stringify(updatedDrafts));
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
      } catch (error) {
        console.error("PDF generation or sharing failed:", error);
        showToast(`Sale created, but PDF failed: ${(error as Error).message}`, 'error');
      }
    };

    const handleAddToCalendar = async (sale: Sale, customerName: string) => {
        if (!state.googleUser?.accessToken) {
            showToast("Please sign in to Google to use Calendar integration.", 'info');
            return;
        }

        try {
            const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const dueAmount = Number(sale.totalAmount) - amountPaid;
            
            // Set reminder for tomorrow at 10 AM
            const startTime = new Date();
            startTime.setDate(startTime.getDate() + 1);
            startTime.setHours(10, 0, 0, 0);

            await createCalendarEvent(state.googleUser.accessToken, {
                summary: `Payment Follow-up: ${customerName}`,
                description: `Invoice ID: ${sale.id}\nDue Amount: ₹${dueAmount.toLocaleString('en-IN')}\nReminder created from Business Manager.`,
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

    const handleExportCSV = () => {
        const headers = ['Sale ID', 'Date', 'Customer Name', 'Items', 'Total Amount', 'Paid', 'Due'];
        const rows = state.sales.map(sale => {
            const customer = state.customers.find(c => c.id === sale.customerId);
            const amountPaid = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
            const due = Number(sale.totalAmount) - amountPaid;
            const itemsList = sale.items.map(i => `${i.productName} (x${i.quantity})`).join('; ');
            
            return `"${sale.id}","${new Date(sale.date).toLocaleDateString()}","${customer?.name || 'Unknown'}","${itemsList}",${sale.totalAmount},${amountPaid},${due}`;
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `sales_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

            const updatedSale: Sale = {
                ...saleToEdit, items, discount: discountAmount, gstAmount, totalAmount,
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

    const canCreateSale = customerId && items.length > 0 && mode === 'add';
    const canUpdateSale = customerId && items.length > 0 && mode === 'edit';
    const canRecordPayment = customerId && items.length === 0 && parseFloat(paymentDetails.amount || '0') > 0 && customerTotalDue != null && customerTotalDue > 0.01 && mode === 'add';
    const pageTitle = mode === 'edit' ? `Edit Sale: ${saleToEdit?.id}` : 'New Sale / Payment';

    return (
        <div className="space-y-4 animate-fade-in-fast relative">
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

            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-primary">{pageTitle}</h1>
                
                <div className="flex gap-2">
                    <Button onClick={handleExportCSV} variant="secondary" className="px-3" title="Export CSV">
                        <FileSpreadsheet size={18} />
                    </Button>
                    {mode === 'add' && (items.length > 0 || customerId) && (
                        <Button onClick={handleParkSale} variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                            <PauseCircle size={16} className="mr-1 sm:mr-2" /> <span className="hidden sm:inline">Park</span>
                        </Button>
                    )}
                    <Button onClick={() => setIsDraftsOpen(true)} variant="secondary" className="relative">
                        <Clock size={16} className="mr-1 sm:mr-2" /> 
                        <span className="hidden sm:inline">Drafts</span>
                        {parkedSales.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">
                                {parkedSales.length}
                            </span>
                        )}
                    </Button>
                </div>
            </div>
            
            <Card>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                        <div className="flex gap-2 items-center">
                            <div className="relative w-full" ref={customerDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setIsCustomerDropdownOpen(prev => !prev)}
                                    className="w-full p-2 border rounded bg-white text-left custom-select dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                    disabled={mode === 'edit' || (mode === 'add' && items.length > 0)}
                                    aria-haspopup="listbox"
                                    aria-expanded={isCustomerDropdownOpen}
                                >
                                    {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.area}` : 'Select a Customer'}
                                </button>

                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border dark:border-slate-700 z-40 animate-fade-in-fast">
                                        <div className="p-2 border-b dark:border-slate-700">
                                            <input
                                                type="text"
                                                placeholder="Search by name or area..."
                                                value={customerSearchTerm}
                                                onChange={e => setCustomerSearchTerm(e.target.value)}
                                                className="w-full p-2 border border-gray-300 rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white"
                                                autoFocus
                                            />
                                        </div>
                                        <ul className="max-h-60 overflow-y-auto" role="listbox">
                                            <li
                                                key="select-customer-placeholder"
                                                onClick={() => {
                                                    setCustomerId('');
                                                    setIsCustomerDropdownOpen(false);
                                                    setCustomerSearchTerm('');
                                                }}
                                                className="px-4 py-2 hover:bg-teal-50 dark:hover:bg-slate-800 cursor-pointer text-gray-500"
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
                                                    className="px-4 py-2 hover:bg-teal-50 dark:hover:bg-slate-800 cursor-pointer border-t dark:border-slate-800"
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
                    </div>
                    
                    <DateInput 
                        label="Sale Date"
                        value={saleDate} 
                        onChange={e => setSaleDate(e.target.value)}
                        disabled={mode === 'edit'}
                    />

                    {/* Customer Last Purchase Context */}
                    {lastPurchaseInfo && mode === 'add' && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md border border-blue-100 dark:border-blue-800 flex items-center justify-between">
                            <span>Last Order: <strong>{lastPurchaseInfo.date}</strong></span>
                            <span>Amount: <strong>₹{lastPurchaseInfo.amount.toLocaleString('en-IN')}</strong></span>
                        </div>
                    )}

                    {customerId && customerTotalDue !== null && mode === 'add' && (
                        <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-center border dark:border-slate-700">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                Selected Customer's Total Outstanding Due:
                            </p>
                            <p className={`text-xl font-bold ${customerTotalDue > 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                                ₹{customerTotalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </p>
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
                                <input type="number" value={item.quantity} onChange={e => handleItemChange(item.productId, 'quantity', e.target.value)} className="w-20 p-1 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="Qty"/>
                                <span>x</span>
                                <input type="number" value={item.price} onChange={e => handleItemChange(item.productId, 'price', e.target.value)} className="w-24 p-1 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="Price"/>
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
                            <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28 p-1 border rounded text-right dark:bg-slate-700 dark:border-slate-600" />
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
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid Now</label>
                                <input type="number" value={paymentDetails.amount} onChange={e => setPaymentDetails({...paymentDetails, amount: e.target.value })} placeholder={`Total is ₹${calculations.totalAmount.toLocaleString('en-IN')}`} className="w-full p-2 border-2 border-red-300 rounded-lg shadow-inner focus:ring-red-500 focus:border-red-500 mt-1 dark:bg-slate-700 dark:border-red-400 dark:text-slate-200" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                                <select value={paymentDetails.method} onChange={e => setPaymentDetails({ ...paymentDetails, method: e.target.value as any})} className="w-full p-2 border rounded custom-select mt-1 dark:bg-slate-700 dark:border-slate-600">
                                    <option value="CASH">Cash</option>
                                    <option value="UPI">UPI</option>
                                    <option value="CHEQUE">Cheque</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Reference (Optional)</label>
                                <input type="text" placeholder="e.g. UPI ID, Cheque No." value={paymentDetails.reference} onChange={e => setPaymentDetails({...paymentDetails, reference: e.target.value })} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600" />
                            </div>
                        </div>
                    ) : (
                        <div className="pt-4 border-t dark:border-slate-700 text-center">
                            <p className="text-sm text-gray-600 dark:text-gray-400">Payments for this invoice must be managed from the customer's details page.</p>
                        </div>
                    )}
                </div>
            </Card>
            
            {mode === 'add' && items.length === 0 && customerId && customerTotalDue != null && customerTotalDue > 0.01 && (
                <Card title="Record Payment for Dues">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid</label>
                            <input type="number" value={paymentDetails.amount} onChange={e => setPaymentDetails({...paymentDetails, amount: e.target.value })} placeholder={'Enter amount to pay dues'} className="w-full p-2 border-2 border-red-300 rounded-lg shadow-inner focus:ring-red-500 focus:border-red-500 dark:bg-slate-700 dark:border-red-400" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                            <select value={paymentDetails.method} onChange={e => setPaymentDetails({ ...paymentDetails, method: e.target.value as any})} className="w-full p-2 border rounded custom-select dark:bg-slate-700 dark:border-slate-600">
                                <option value="CASH">Cash</option>
                                <option value="UPI">UPI</option>
                                <option value="CHEQUE">Cheque</option>
                            </select>
                        </div>
                    </div>
                </Card>
            )}

            {saleToEdit && selectedCustomer && (
                <div className="mt-2 text-right">
                    <button 
                        onClick={() => handleAddToCalendar(saleToEdit, selectedCustomer.name)}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 flex items-center justify-end gap-1 ml-auto"
                    >
                        <Calendar size={14} /> Add to Calendar
                    </button>
                </div>
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
