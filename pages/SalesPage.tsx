import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Share2, Search, X, IndianRupee, QrCode, Save, Edit } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem, Customer, Product, Payment } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import { Html5Qrcode } from 'html5-qrcode';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { generateThermalInvoicePDF, generateInvoicePDF } from '../utils/pdfGenerator';
import AddCustomerModal from '../components/AddCustomerModal';
import Dropdown from '../components/Dropdown';
import ProductSearchModal from '../components/ProductSearchModal';
import QuantityInputModal from '../components/QuantityInputModal';

// Inline modal components if they were not properly exported or to keep file self-contained as per previous structure
// Note: Ideally these should be separate files, but respecting the prompt's single file update constraints where possible or inline if needed.
// Given the context, I will assume ProductSearchModal and others are available or I'll inline minimal versions if imports fail in previous context.
// For this response, I will assume imports work if components exist, otherwise I will use the inline versions from the previous SalesPage content.

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface SalesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const QRScannerModal: React.FC<{
    onClose: () => void;
    onScanned: (decodedText: string) => void;
}> = ({ onClose, onScanned }) => {
    const [scanStatus, setScanStatus] = useState<string>("Initializing camera...");
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-sales");
        setScanStatus("Requesting camera permissions...");

        const qrCodeSuccessCallback = (decodedText: string) => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    onScanned(decodedText);
                }).catch(err => {
                    console.error("Error stopping scanner", err);
                    onScanned(decodedText);
                });
            }
        };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCodeRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .then(() => setScanStatus("Scanning for QR Code..."))
            .catch(err => {
                setScanStatus(`Camera Permission Error. Please allow camera access.`);
                console.error("Camera start failed.", err);
            });
            
        return () => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error("Cleanup stop scan failed.", err));
            }
        };
    }, [onScanned]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card title="Scan Product QR Code" className="w-full max-w-md relative animate-scale-in">
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={20}/>
                 </button>
                <div id="qr-reader-sales" className="w-full mt-4 rounded-lg overflow-hidden border"></div>
                <p className="text-center text-sm my-2 text-gray-600 dark:text-gray-400">{scanStatus}</p>
            </Card>
        </div>
    );
};

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
    
    useOnClickOutside(customerDropdownRef, () => {
        if (isCustomerDropdownOpen) {
            setIsCustomerDropdownOpen(false);
        }
    });

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
        const newCustomerFormIsDirty = isAddingCustomer;
        const currentlyDirty = formIsDirty || newCustomerFormIsDirty;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [customerId, items, discount, paymentDetails.amount, isAddingCustomer, setIsDirty, saleDate, mode]);


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
                 alert(`Not enough stock for ${product.name}. Only ${availableStock} available for this sale.`);
                 return;
            }
            setItems(items.map(i => i.productId === newItem.productId ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
             if (1 > availableStock) {
                 alert(`Not enough stock for ${product.name}. Only ${availableStock} available for this sale.`);
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
            alert("Product not found in inventory.");
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
                        alert(`Not enough stock for ${item.productName}. Only ${availableStock} available for this sale.`);
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
        const subTotal = items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
        const discountAmount = parseFloat(discount) || 0;
        
        const gstAmount = items.reduce((sum, item) => {
            const product = state.products.find(p => p.id === item.productId);
            const itemGstPercent = product ? Number(product.gstPercent) : 0;
            const itemTotalWithGst = Number(item.price) * Number(item.quantity);
            const itemGst = itemTotalWithGst - (itemTotalWithGst / (1 + (itemGstPercent / 100)));
            return sum + itemGst;
        }, 0);

        const totalAmount = subTotal - discountAmount;
        const roundedGstAmount = Math.round(gstAmount * 100) / 100;

        return { subTotal, discountAmount, gstAmount: roundedGstAmount, totalAmount };
    }, [items, discount, state.products]);

    const selectedCustomer = useMemo(() => customerId ? state.customers.find(c => c.id === customerId) : null, [customerId, state.customers]);

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

    const handleAddCustomer = useCallback((customer: Customer) => {
        dispatch({ type: 'ADD_CUSTOMER', payload: customer });
        setIsAddingCustomer(false);
        setCustomerId(customer.id);
        showToast("Customer added successfully!");
    }, [dispatch, showToast]);

    const handleGenerateThermalPDF = async (sale: Sale, customer: Customer) => {
        try {
            // Default to Thermal PDF for new sales as requested
            const doc = await generateThermalInvoicePDF(sale, customer, state.profile);
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `Receipt-${sale.id}.pdf`, { type: 'application/pdf' });
            const businessName = state.profile?.name || 'Invoice';
            
            // Helper for sharing/opening
            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `${businessName} Receipt ${sale.id}`,
                    text: `Receipt from ${businessName} for Rs. ${Number(sale.totalAmount).toLocaleString()}`,
                    files: [pdfFile],
                });
            } else {
                // Fallback to download/open
                const pdfUrl = URL.createObjectURL(pdfBlob);
                window.open(pdfUrl, '_blank');
            }
        } catch (error) {
            console.error("PDF Gen Error", error);
            showToast("Could not generate receipt.", 'info');
        }
    };

    const handleSubmitSale = async () => {
        if (!customerId || items.length === 0) {
            alert("Please select a customer and add at least one item.");
            return;
        }

        const customer = state.customers.find(c => c.id === customerId);
        if(!customer) {
            alert("Could not find the selected customer.");
            return;
        }
        
        const { totalAmount, gstAmount, discountAmount } = calculations;

        if (mode === 'add') {
            const paidAmount = parseFloat(paymentDetails.amount) || 0;
            if (paidAmount > totalAmount + 0.01) {
                alert(`Paid amount (₹${paidAmount.toLocaleString('en-IN')}) cannot be greater than the total amount (₹${totalAmount.toLocaleString('en-IN')}).`);
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
            
            // Generate Thermal Receipt by default for new sale
            await handleGenerateThermalPDF(newSale, customer);

        } else if (mode === 'edit' && saleToEdit) {
            const existingPayments = saleToEdit.payments || [];
            const totalPaid = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

            if (totalAmount < totalPaid - 0.01) {
                alert(`The new total amount (₹${totalAmount.toLocaleString('en-IN')}) cannot be less than the amount already paid (₹${totalPaid.toLocaleString('en-IN')}).`);
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
            alert('Please select a customer to record a payment for.');
            return;
        }

        const paidAmount = parseFloat(paymentDetails.amount || '0');
        if (paidAmount <= 0) {
            alert('Please enter a valid payment amount.');
            return;
        }

        const outstandingSales = state.sales
            .filter(sale => {
                const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                return sale.customerId === customerId && (Number(sale.totalAmount) - paid) > 0.01;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (outstandingSales.length === 0) {
            alert('This customer has no outstanding dues.');
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
    const paymentMethodOptions = [
        { value: 'CASH', label: 'Cash' },
        { value: 'UPI', label: 'UPI' },
        { value: 'CHEQUE', label: 'Cheque' }
    ];

    // Inline Modal Components for this file to avoid imports if not available
    // Reusing previous structure
    const ProductSearchModalInline: React.FC<{ products: Product[], onClose: () => void, onSelect: (p: Product) => void }> = ({ products, onClose, onSelect }) => {
        const [term, setTerm] = useState('');
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <Card className="w-full max-w-lg h-[60vh] flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                        <h3 className="font-bold">Select Product</h3>
                        <button onClick={onClose}><X/></button>
                    </div>
                    <input autoFocus type="text" placeholder="Search..." className="p-2 border rounded mb-2 w-full" value={term} onChange={e => setTerm(e.target.value)} />
                    <div className="overflow-y-auto flex-grow">
                        {products.filter(p => p.name.toLowerCase().includes(term.toLowerCase())).map(p => (
                            <div key={p.id} onClick={() => onSelect(p)} className="p-2 border-b cursor-pointer hover:bg-gray-100">
                                <div className="font-bold">{p.name}</div>
                                <div className="text-xs text-gray-500">Stock: {p.quantity} | Price: {p.salePrice}</div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        );
    };

    return (
        <div className="space-y-4">
            {isAddingCustomer && 
                <AddCustomerModal 
                    isOpen={isAddingCustomer}
                    onClose={() => setIsAddingCustomer(false)}
                    onAdd={handleAddCustomer}
                    existingCustomers={state.customers}
                />
            }
            {isSelectingProduct && 
                <ProductSearchModalInline
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
            <h1 className="text-2xl font-bold text-primary">{pageTitle}</h1>
            
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
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Date</label>
                        <input 
                            type="date" 
                            value={saleDate} 
                            onChange={e => setSaleDate(e.target.value)} 
                            className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                            disabled={mode === 'edit'}
                        />
                    </div>

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
                                 <Dropdown 
                                    options={paymentMethodOptions}
                                    value={paymentDetails.method}
                                    onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any})}
                                />
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
                            <Dropdown 
                                options={paymentMethodOptions}
                                value={paymentDetails.method}
                                onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any})}
                            />
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-2">
                {canCreateSale ? (
                    <Button onClick={handleSubmitSale} variant="secondary" className="w-full">
                        <Share2 className="w-4 h-4 mr-2"/>
                        Create Sale & Share Receipt (Thermal)
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