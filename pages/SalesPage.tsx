
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Share2, Search, X, IndianRupee, QrCode, Save, Edit } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem, Customer, Product, Payment } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import { Html5Qrcode } from 'html5-qrcode';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import AddCustomerModal from '../components/AddCustomerModal';
import Dropdown from '../components/Dropdown';
import { useDialog } from '../context/DialogContext';
import { generateInvoicePDF } from '../utils/pdfGenerator';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

interface SalesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const ProductSearchModal: React.FC<{
    products: Product[];
    onClose: () => void;
    onSelect: (product: Product) => void;
}> = ({ products, onClose, onSelect }) => {
    const [productSearchTerm, setProductSearchTerm] = useState('');

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-fast">
          <Card className="w-full max-w-lg animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Select Product</h2>
              <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20}/>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={e => setProductSearchTerm(e.target.value)}
                className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                autoFocus
              />
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
              {products
                .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()))
                .map(p => (
                <div key={p.id} onClick={() => onSelect(p)} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-teal-50 dark:hover:bg-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Code: {p.id}</p>
                  </div>
                  <div className="text-right">
                      <p className="font-semibold">₹{Number(p.salePrice).toLocaleString('en-IN')}</p>
                      <p className="text-sm">Stock: {p.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
    );
};
    
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
                setScanStatus(`Camera Permission Error.`);
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
    const { showAlert } = useDialog();
    
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

    useEffect(() => {
        if (state.selection?.page === 'SALES' && state.selection.action === 'edit') {
            const sale = state.sales.find(s => s.id === state.selection.id);
            if (sale) {
                setSaleToEdit(sale);
                setMode('edit');
                setCustomerId(sale.customerId);
                setItems(sale.items.map(item => ({...item}))); 
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
        setPaymentDetails({ amount: '', method: 'CASH', date: getLocalDateString(), reference: '' });
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
                 showAlert(`Not enough stock for ${product.name}. Only ${availableStock} available.`);
                 return;
            }
            setItems(items.map(i => i.productId === newItem.productId ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
             if (1 > availableStock) {
                 showAlert(`Not enough stock for ${product.name}. Only ${availableStock} available.`);
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
            showAlert("Product not found in inventory.");
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
                        showAlert(`Not enough stock. Only ${availableStock} available.`);
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

    const processAndSharePDF = async (sale: Sale, customer: Customer) => {
        try {
            const doc = await generateInvoicePDF(sale, customer, state.profile);
            const pdfBlob = doc.output('blob');
            const pdfFile = new File([pdfBlob], `Invoice-${sale.id}.pdf`, { type: 'application/pdf' });
            
            if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
                await navigator.share({
                    title: `Invoice ${sale.id}`,
                    files: [pdfFile],
                });
            } else {
                doc.save(`Invoice-${sale.id}.pdf`);
            }
        } catch (e) {
            console.error("PDF Error", e);
            showToast("Could not generate PDF", 'info');
        }
    };

    const handleSubmitSale = async () => {
        if (!customerId || items.length === 0) {
            showAlert("Please select a customer and add items.");
            return;
        }
        const customer = state.customers.find(c => c.id === customerId);
        if(!customer) {
            showAlert("Customer not found.");
            return;
        }
        
        const { totalAmount, gstAmount, discountAmount } = calculations;

        if (mode === 'add') {
            const paidAmount = parseFloat(paymentDetails.amount) || 0;
            if (paidAmount > totalAmount + 0.01) {
                showAlert(`Paid amount cannot exceed total amount.`);
                return;
            }
            const payments: Payment[] = [];
            if (paidAmount > 0) {
                payments.push({
                    id: `PAY-S-${Date.now()}`, amount: paidAmount, method: paymentDetails.method,
                    date: new Date(paymentDetails.date).toISOString(), reference: paymentDetails.reference.trim() || undefined,
                });
            }
            
            const now = new Date();
            const saleId = `SALE-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
            
            const newSale: Sale = {
                id: saleId, customerId, items, discount: discountAmount, gstAmount, totalAmount,
                date: new Date(`${saleDate}T${now.toTimeString().split(' ')[0]}`).toISOString(), payments
            };
            dispatch({ type: 'ADD_SALE', payload: newSale });
            items.forEach(item => {
                dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: item.productId, change: -Number(item.quantity) } });
            });
            showToast('Sale created!');
            await processAndSharePDF(newSale, customer);

        } else if (mode === 'edit' && saleToEdit) {
            const updatedSale: Sale = { ...saleToEdit, items, discount: discountAmount, gstAmount, totalAmount };
            dispatch({ type: 'UPDATE_SALE', payload: { oldSale: saleToEdit, updatedSale } });
            showToast('Sale updated!');
        }
        resetForm();
    };

     const handleRecordStandalonePayment = () => {
        if (!customerId) {
            showAlert('Select a customer first.');
            return;
        }
        const paidAmount = parseFloat(paymentDetails.amount || '0');
        if (paidAmount <= 0) {
            showAlert('Enter a valid amount.');
            return;
        }

        const outstandingSales = state.sales
            .filter(sale => {
                const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                return sale.customerId === customerId && (Number(sale.totalAmount) - paid) > 0.01;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        if (outstandingSales.length === 0) {
            showAlert('No outstanding dues.');
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
        showToast(`Payment recorded.`);
        resetForm();
    };

    const canCreateSale = customerId && items.length > 0 && mode === 'add';
    const canUpdateSale = customerId && items.length > 0 && mode === 'edit';
    const canRecordPayment = customerId && items.length === 0 && parseFloat(paymentDetails.amount || '0') > 0 && customerTotalDue != null && customerTotalDue > 0.01 && mode === 'add';
    const paymentMethodOptions = [{ value: 'CASH', label: 'Cash' }, { value: 'UPI', label: 'UPI' }, { value: 'CHEQUE', label: 'Cheque' }];

    return (
        <div className="space-y-4">
            {isAddingCustomer && <AddCustomerModal isOpen={isAddingCustomer} onClose={() => setIsAddingCustomer(false)} onAdd={handleAddCustomer} existingCustomers={state.customers} />}
            {isSelectingProduct && <ProductSearchModal products={state.products} onClose={() => setIsSelectingProduct(false)} onSelect={handleSelectProduct} />}
            {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleProductScanned} />}
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">{mode === 'edit' ? `Edit Sale: ${saleToEdit?.id}` : 'New Sale / Payment'}</h1>
                    <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-3 py-1 rounded-full shadow-md border border-teal-500/30">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
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
                                >
                                    {selectedCustomer ? `${selectedCustomer.name} - ${selectedCustomer.area}` : 'Select a Customer'}
                                </button>
                                {isCustomerDropdownOpen && (
                                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-900 rounded-md shadow-lg border dark:border-slate-700 z-40 animate-fade-in-fast">
                                        <div className="p-2 border-b dark:border-slate-700">
                                            <input type="text" placeholder="Search..." value={customerSearchTerm} onChange={e => setCustomerSearchTerm(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" autoFocus />
                                        </div>
                                        <ul className="max-h-60 overflow-y-auto">
                                            {filteredCustomers.map(c => (
                                                <li key={c.id} onClick={() => { setCustomerId(c.id); setIsCustomerDropdownOpen(false); }} className="px-4 py-2 hover:bg-teal-50 dark:hover:bg-slate-800 cursor-pointer border-t dark:border-slate-800">
                                                    {c.name} - {c.area}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            {mode === 'add' && <Button onClick={() => setIsAddingCustomer(true)} variant="secondary" className="flex-shrink-0"><Plus size={16}/> New Customer</Button>}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Date</label>
                        <input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" disabled={mode === 'edit'} />
                    </div>
                    {customerId && customerTotalDue !== null && mode === 'add' && (
                        <div className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg text-center border dark:border-slate-700">
                            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Selected Customer's Total Outstanding Due:</p>
                            <p className={`text-xl font-bold ${customerTotalDue > 0.01 ? 'text-red-600' : 'text-green-600'}`}>₹{customerTotalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        </div>
                    )}
                </div>
            </Card>

            <Card title="Sale Items">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Button onClick={() => setIsSelectingProduct(true)} className="w-full sm:w-auto flex-grow" disabled={!customerId}><Search size={16} className="mr-2"/> Select Product</Button>
                    <Button onClick={() => setIsScanning(true)} variant="secondary" className="w-full sm:w-auto flex-grow" disabled={!customerId}><QrCode size={16} className="mr-2"/> Scan Product</Button>
                </div>
                <div className="mt-4 space-y-2">
                    {items.map(item => (
                        <div key={item.productId} className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded animate-slide-in-right border dark:border-slate-700">
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
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300"><span>Subtotal:</span><span>₹{calculations.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300"><span>Discount:</span><input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28 p-1 border rounded text-right dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                        <div className="flex justify-between items-center text-gray-700 dark:text-gray-300"><span>GST Included:</span><span>₹{calculations.gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
                    </div>
                    <div className="text-center">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Grand Total</p>
                        <p className="text-4xl font-bold text-primary">₹{calculations.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                    </div>
                    {mode === 'add' ? (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid Now</label>
                                <input type="number" value={paymentDetails.amount} onChange={e => setPaymentDetails({...paymentDetails, amount: e.target.value })} placeholder={`Total is ₹${calculations.totalAmount.toLocaleString('en-IN')}`} className="w-full p-2 border-2 border-red-300 rounded-lg shadow-inner focus:ring-red-500 focus:border-red-500 mt-1 dark:bg-slate-700 dark:border-red-400 dark:text-slate-200" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                                 <Dropdown options={paymentMethodOptions} value={paymentDetails.method} onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Reference (Optional)</label>
                                <input type="text" placeholder="e.g. UPI ID, Cheque No." value={paymentDetails.reference} onChange={e => setPaymentDetails({...paymentDetails, reference: e.target.value })} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
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
                             <Dropdown options={paymentMethodOptions} value={paymentDetails.method} onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })} />
                        </div>
                    </div>
                </Card>
            )}

            <div className="space-y-2">
                {canCreateSale ? (
                    <Button onClick={handleSubmitSale} variant="secondary" className="w-full"><Share2 className="w-4 h-4 mr-2"/> Create Sale & Share Invoice</Button>
                ) : canUpdateSale ? (
                    <Button onClick={handleSubmitSale} className="w-full"><Save className="w-4 h-4 mr-2"/> Save Changes to Sale</Button>
                ) : canRecordPayment ? (
                     <Button onClick={handleRecordStandalonePayment} className="w-full"><IndianRupee className="w-4 h-4 mr-2" /> Record Standalone Payment</Button>
                ) : (
                     <Button className="w-full" disabled>{customerId ? (items.length === 0 ? 'Enter payment or add items' : 'Complete billing details') : 'Select a customer'}</Button>
                )}
                <Button onClick={resetForm} variant="secondary" className="w-full bg-teal-200 hover:bg-teal-300 focus:ring-teal-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">{mode === 'edit' ? 'Cancel Edit' : 'Clear Form'}</Button>
            </div>
        </div>
    );
};

export default SalesPage;
