import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Plus, Trash2, Share2, Search, X, IndianRupee, QrCode, Save, Edit } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Sale, SaleItem, Customer, Product, Payment } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Html5Qrcode } from 'html5-qrcode';
import DeleteButton from '../components/DeleteButton';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { logoBase64 } from '../utils/logo';
import Dropdown from '../components/Dropdown';
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

interface SalesPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const newCustomerInitialState = { id: '', name: '', phone: '', address: '', area: '', reference: '' };

const AddCustomerModal: React.FC<{
    newCustomer: typeof newCustomerInitialState;
    onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCancel: () => void;
}> = React.memo(({ newCustomer, onInputChange, onSave, onCancel }) => (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-fast">
        <Card title="Add New Customer" className="w-full max-w-md animate-scale-in">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer ID</label>
                    <div className="flex items-center mt-1">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400">
                            CUST-
                        </span>
                        <input
                            type="text"
                            name="id"
                            placeholder="Enter unique ID"
                            value={newCustomer.id}
                            onChange={onInputChange}
                            className="w-full p-2 border rounded-r-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                    <input type="text" placeholder="Full Name" name="name" value={newCustomer.name} onChange={onInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                    <input type="text" placeholder="Phone Number" name="phone" value={newCustomer.phone} onChange={onInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                    <input type="text" placeholder="Full Address" name="address" value={newCustomer.address} onChange={onInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Area/Location</label>
                    <input type="text" placeholder="e.g. Ameerpet" name="area" value={newCustomer.area} onChange={onInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference (Optional)</label>
                    <input type="text" placeholder="Referred by..." name="reference" value={newCustomer.reference} onChange={onInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                </div>
                <div className="flex gap-2">
                    <Button onClick={onSave} className="w-full">Save Customer</Button>
                    <Button onClick={onCancel} variant="secondary" className="w-full">Cancel</Button>
                </div>
            </div>
        </Card>
    </div>
));

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
                <div key={p.id} onClick={() => onSelect(p)} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-primary/5 dark:hover:bg-slate-700 flex justify-between items-center">
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
                    // Still call onScanned even if stopping fails, to proceed with logic
                    onScanned(decodedText);
                });
            }
        };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCodeRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .then(() => setScanStatus("Scanning for QR Code..."))
            .catch(err => {
                setScanStatus(`Camera Permission Error. Please allow camera access for this site in your browser's settings.`);
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
    const [newCustomer, setNewCustomer] = useState(newCustomerInitialState);
    const isDirtyRef = useRef(false);

    const [customerSearchTerm, setCustomerSearchTerm] = useState('');
    
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
        const newCustomerFormIsDirty = isAddingCustomer && !!(newCustomer.id || newCustomer.name || newCustomer.phone || newCustomer.address || newCustomer.area);
        const currentlyDirty = formIsDirty || newCustomerFormIsDirty;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [customerId, items, discount, paymentDetails.amount, isAddingCustomer, newCustomer, setIsDirty, saleDate, mode]);


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

    const customerOptions = useMemo(() => state.customers.map(c => ({
        value: c.id,
        label: `${c.name} - ${c.area}`,
        searchText: `${c.name} ${c.area}`
    })), [state.customers]);

    const paymentMethodOptions = useMemo(() => [
        { value: 'CASH', label: 'Cash' },
        { value: 'UPI', label: 'UPI' },
        { value: 'CHEQUE', label: 'Cheque' }
    ], []);

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

    const handleNewCustomerChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({...prev, [name]: value}));
    }, []);

    const handleCancelAddCustomer = useCallback(() => {
        setIsAddingCustomer(false);
        setNewCustomer(newCustomerInitialState);
    }, []);

    const handleAddCustomer = useCallback(() => {
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
        setNewCustomer(newCustomerInitialState);
        setIsAddingCustomer(false);
        setCustomerId(customerWithId.id);
        showToast("Customer added successfully!");
    }, [newCustomer, state.customers, dispatch, showToast]);


    const generateAndSharePDF = async (sale: Sale, customer: Customer, paidAmountOnSale: number) => {
      try {
        const doc = new jsPDF();
        const profile = state.profile;
        let currentY = 15;

        // FIX: Change image format to PNG
        doc.addImage(logoBase64, 'PNG', 14, 10, 25, 25);

        if (profile) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(24);
            doc.setTextColor('#0d9488');
            doc.text(profile.name, 105, currentY, { align: 'center' });
            currentY += 8;
            doc.setFontSize(10);
            doc.setTextColor('#333333');
            const addressLines = doc.splitTextToSize(profile.address, 180);
            doc.text(addressLines, 105, currentY, { align: 'center' });
            currentY += (addressLines.length * 5);
            doc.text(`Phone: ${profile.phone} | GSTIN: ${profile.gstNumber}`, 105, currentY, { align: 'center' });
        }
        
        currentY = Math.max(currentY, 10 + 25) + 5;

        doc.setDrawColor('#cccccc');
        doc.line(14, currentY, 196, currentY);
        currentY += 10;
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('TAX INVOICE', 105, currentY, { align: 'center' });
        currentY += 10;
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Billed To:', 14, currentY);
        doc.text('Invoice Details:', 120, currentY);
        currentY += 5;

        doc.setFont('helvetica', 'normal');
        doc.text(customer.name, 14, currentY);
        doc.text(`Invoice ID: ${sale.id}`, 120, currentY);
        currentY += 5;
        
        const customerAddressLines = doc.splitTextToSize(customer.address, 80);
        doc.text(customerAddressLines, 14, currentY);
        doc.text(`Date: ${new Date(sale.date).toLocaleString()}`, 120, currentY);
        currentY += (customerAddressLines.length * 5) + 5;
        
        autoTable(doc, {
            startY: currentY,
            head: [['#', 'Item Description', 'Qty', 'Rate', 'Amount']],
            body: sale.items.map((item, index) => [
                index + 1,
                item.productName,
                item.quantity,
                `Rs. ${Number(item.price).toLocaleString('en-IN')}`,
                `Rs. ${(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [13, 148, 136] },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
        
        // FIX: Calculate values from the `sale` object, not stale component state. This also fixes the scope issue.
        const subTotal = sale.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const dueAmountOnSale = Number(sale.totalAmount) - paidAmountOnSale;
        
        const totalsX = 196;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('Subtotal:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`Rs. ${subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        currentY += 7;

        doc.text('Discount:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`- Rs. ${Number(sale.discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        currentY += 7;

        doc.text('GST Included:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`Rs. ${Number(sale.gstAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        currentY += 7;
        
        doc.setFont('helvetica', 'bold');
        doc.text('Grand Total:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`Rs. ${Number(sale.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        currentY += 7;

        doc.setFont('helvetica', 'normal');
        doc.text('Paid:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`Rs. ${paidAmountOnSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        currentY += 7;

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(dueAmountOnSale > 0.01 ? '#dc2626' : '#16a34a');
        doc.text('Amount Due:', totalsX - 30, currentY, { align: 'right' });
        doc.text(`Rs. ${dueAmountOnSale.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, totalsX, currentY, { align: 'right' });
        
        currentY = doc.internal.pageSize.height - 20;
        doc.setFontSize(10);
        doc.setTextColor('#888888');
        doc.text('Thank you for your business!', 105, currentY, { align: 'center' });
        
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `Invoice-${sale.id}.pdf`, { type: 'application/pdf' });
        const businessName = state.profile?.name || 'Your Business';
        
        // FIX: Use locally scoped variables for whatsAppText instead of calculations from component state to ensure data consistency.
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
        alert(`Sale created successfully, but the PDF invoice could not be generated or shared. Error: ${(error as Error).message}`);
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
            await generateAndSharePDF(newSale, customer, paidAmount);

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

    return (
        <div className="space-y-4">
            {isAddingCustomer && 
                <AddCustomerModal 
                    newCustomer={newCustomer}
                    onInputChange={handleNewCustomerChange}
                    onSave={handleAddCustomer}
                    onCancel={handleCancelAddCustomer}
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">{pageTitle}</h1>
                    <DatePill />
                </div>
            </div>
            
            <Card>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                        <div className="flex gap-2 items-center">
                            <Dropdown
                                options={customerOptions}
                                value={customerId}
                                onChange={(val) => setCustomerId(val)}
                                placeholder="Search or Select Customer"
                                searchable={true}
                                searchPlaceholder="Search customers..."
                                disabled={mode === 'edit' || (mode === 'add' && items.length > 0)}
                                icon="search"
                            />
                            {mode === 'add' && (
                                <Button 
                                    onClick={() => setIsAddingCustomer(true)} 
                                    variant="secondary" 
                                    className="aspect-square !p-0 w-[42px] h-[42px] flex items-center justify-center flex-shrink-0"
                                    aria-label="Add New Customer"
                                >
                                    <Plus size={24}/>
                                </Button>
                            )}
                        </div>
                    </div>
                    
                    <DateInput
                        label="Sale Date"
                        value={saleDate} 
                        onChange={e => setSaleDate(e.target.value)} 
                        className={mode === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}
                        disabled={mode === 'edit'}
                    />

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
                <div className="grid grid-cols-2 gap-3">
                    <Button onClick={() => setIsSelectingProduct(true)} className="w-full" disabled={!customerId}>
                        <Search size={16} className="mr-2"/> Select Product
                    </Button>
                    <Button onClick={() => setIsScanning(true)} className="w-full" disabled={!customerId}>
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
                                    onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
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
                <Button onClick={resetForm} variant="secondary" className="w-full bg-primary/20 hover:bg-primary/30 focus:ring-primary/20 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                    {mode === 'edit' ? 'Cancel Edit' : 'Clear Form'}
                </Button>
            </div>
        </div>
    );
};

export default SalesPage;