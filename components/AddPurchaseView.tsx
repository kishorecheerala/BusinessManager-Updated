import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Purchase, Supplier, Product, PurchaseItem } from '../types';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { Plus, Search, QrCode, FileSpreadsheet, Download, Upload, CheckCircle, XCircle, Info, X } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import DeleteButton from './DeleteButton';
import DateInput from './DateInput';
import Dropdown from './Dropdown';
import AddSupplierModal from './AddSupplierModal';
import QuantityInputModal from './QuantityInputModal';
import { Html5Qrcode } from 'html5-qrcode';

// Helper functions
const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

// Local Modals

const ProductSearchModal: React.FC<{
    products: Product[];
    onClose: () => void;
    onSelect: (product: Product) => void;
    isOpen: boolean;
}> = ({ products, onClose, onSelect, isOpen }) => {
    const [productSearchTerm, setProductSearchTerm] = useState('');

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
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
                      <p className="font-semibold">₹{Number(p.purchasePrice).toLocaleString('en-IN')}</p>
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
    const scannerId = "qr-reader-purchase";

    useEffect(() => {
        // Cleanup element to ensure fresh start
        const container = document.getElementById(scannerId);
        if (container) container.innerHTML = "";

        html5QrCodeRef.current = new Html5Qrcode(scannerId);
        setScanStatus("Requesting camera permissions...");

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCodeRef.current.start(
            { facingMode: "environment" }, 
            config, 
            (decodedText) => {
                onScanned(decodedText);
                if (html5QrCodeRef.current?.isScanning) {
                    html5QrCodeRef.current.stop().catch(console.error);
                }
            }, 
            (errorMessage) => {}
        ).then(() => {
            setScanStatus("Scanning for QR Code...");
        }).catch(err => {
            setScanStatus(`Camera Error: ${err}. Please allow camera access.`);
            console.error("Camera start failed.", err);
        });
            
        return () => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    html5QrCodeRef.current?.clear();
                }).catch(console.error);
            }
        };
    }, [onScanned]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex flex-col items-center justify-center z-[110] p-4 animate-fade-in-fast">
            <Card title="Scan Product QR Code" className="w-full max-w-md relative animate-scale-in">
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors z-10">
                    <X size={20}/>
                 </button>
                <div id={scannerId} className="w-full mt-4 rounded-lg overflow-hidden border bg-black min-h-[250px]"></div>
                <p className="text-center text-sm my-2 text-gray-600 dark:text-gray-400">{scanStatus}</p>
            </Card>
        </div>
    );
};

const NewProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: PurchaseItem) => void;
    initialId: string;
    existingProducts: Product[];
    currentPurchaseItems: PurchaseItem[];
    mode: 'add' | 'edit';
}> = ({ isOpen, onClose, onAdd, initialId, existingProducts, currentPurchaseItems, mode }) => {
    const [newItem, setNewItem] = useState<PurchaseItem>({
        productId: initialId,
        productName: '',
        quantity: 1,
        price: 0,
        saleValue: 0,
        gstPercent: 0
    });

    useEffect(() => {
        setNewItem(prev => ({ ...prev, productId: initialId }));
    }, [initialId]);

    const handleChange = (field: keyof PurchaseItem, value: string | number) => {
        setNewItem(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = () => {
        if (!newItem.productId || !newItem.productName) {
            alert("Product ID and Name are required.");
            return;
        }
        
        // Check for duplicates
        if (existingProducts.some(p => p.id.toLowerCase() === newItem.productId.toLowerCase())) {
             alert("Product ID already exists in inventory. Please use 'Existing Product' or choose a different ID.");
             return;
        }
        if (currentPurchaseItems.some(i => i.productId.toLowerCase() === newItem.productId.toLowerCase())) {
             alert("Product ID already added to this purchase.");
             return;
        }

        onAdd(newItem);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
            <Card title="Add New Product" className="w-full max-w-md animate-scale-in">
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium">Product ID / Barcode</label>
                        <input type="text" value={newItem.productId} onChange={e => handleChange('productId', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="Scan or Type ID" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Product Name</label>
                        <input type="text" value={newItem.productName} onChange={e => handleChange('productName', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="Product Name" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Quantity</label>
                            <input type="number" value={newItem.quantity} onChange={e => handleChange('quantity', parseFloat(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">GST %</label>
                            <input type="number" value={newItem.gstPercent} onChange={e => handleChange('gstPercent', parseFloat(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-medium">Purchase Price</label>
                            <input type="number" value={newItem.price} onChange={e => handleChange('price', parseFloat(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium">Sale Price</label>
                            <input type="number" value={newItem.saleValue} onChange={e => handleChange('saleValue', parseFloat(e.target.value))} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
                        </div>
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSubmit} className="w-full">Add Item</Button>
                        <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

interface PurchaseFormProps {
  mode: 'add' | 'edit';
  initialData?: Purchase | null;
  suppliers: Supplier[];
  products: Product[];
  onSubmit: (purchase: Purchase) => void;
  onBack: () => void;
  setIsDirty: (isDirty: boolean) => void;
  dispatch: React.Dispatch<any>;
  showToast: (message: string, type?: 'success' | 'info') => void;
}

export const PurchaseForm: React.FC<PurchaseFormProps> = ({
  mode,
  initialData,
  suppliers,
  products,
  onSubmit,
  onBack,
  setIsDirty,
  dispatch,
  showToast
}) => {
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || '');
  const [items, setItems] = useState<PurchaseItem[]>(initialData?.items || []);
  const [purchaseDate, setPurchaseDate] = useState(initialData ? getLocalDateString(new Date(initialData.date)) : getLocalDateString());
  const [supplierInvoiceId, setSupplierInvoiceId] = useState(initialData?.supplierInvoiceId || '');
  const [discount, setDiscount] = useState('0');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CHEQUE'>('CASH');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentDueDates, setPaymentDueDates] = useState<string[]>(initialData?.paymentDueDates || []);

  const [isScanning, setIsScanning] = useState(false);
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [newProductInitialId, setNewProductInitialId] = useState('');
  const [isExistingProductModalOpen, setIsExistingProductModalOpen] = useState(false);
  const [isQtyModalOpen, setIsQtyModalOpen] = useState(false);
  const [productForQty, setProductForQty] = useState<Product | null>(null);
  
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  
  const [csvStatus, setCsvStatus] = useState<{ type: 'info' | 'success' | 'error', message: string } | null>(null);

  const isDirtyRef = useRef(false);
  
  // Initialize discount when editing based on total discrepancy if any
  useEffect(() => {
    if (initialData) {
        setSupplierId(initialData.supplierId);
        setItems([...initialData.items]);
        setPurchaseDate(getLocalDateString(new Date(initialData.date)));
        setSupplierInvoiceId(initialData.supplierInvoiceId || '');
        setPaymentDueDates(initialData.paymentDueDates || []);

        // Calculate items total to infer discount
        const itemsTotal = initialData.items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
        const savedTotal = Number(initialData.totalAmount);
        const impliedDiscount = itemsTotal - savedTotal;
        
        if (Math.abs(impliedDiscount) > 0.01) {
            setDiscount(impliedDiscount.toString());
        } else {
            setDiscount('0');
        }
    }
  }, [initialData]);

  // Calculate totals
  const calculations = useMemo(() => {
    const totalItemValue = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const totalGst = items.reduce((sum, item) => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        const gstPercent = Number.isFinite(item.gstPercent) ? item.gstPercent : 0;
        // Assuming price includes GST as per previous logic, extract GST component
        const itemGst = itemTotal - (itemTotal / (1 + (gstPercent / 100)));
        return sum + itemGst;
    }, 0);
    
    // Subtotal is total value minus GST component
    const subTotal = totalItemValue - totalGst;
    const discountVal = parseFloat(discount) || 0;
    const grandTotal = totalItemValue - discountVal;
    
    return { subTotal, totalGst, grandTotal };
  }, [items, discount]);

  useEffect(() => {
    const dirty = !!supplierId || items.length > 0 || discount !== '0';
    if (dirty !== isDirtyRef.current) {
      isDirtyRef.current = dirty;
      setIsDirty(dirty);
    }
  }, [supplierId, items, discount, setIsDirty]);

  const supplierOptions = useMemo(() => suppliers.map(s => ({
      value: s.id,
      label: s.name,
      searchText: `${s.name} ${s.location} ${s.phone}`
  })).sort((a, b) => a.label.localeCompare(b.label)), [suppliers]);
  
  const handleItemUpdate = (productId: string, field: keyof PurchaseItem, value: string | number) => {
    setItems(items.map(item => item.productId === productId ? { ...item, [field]: value } : item));
  };
  
  const handleItemRemove = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const handleScannedId = (id: string) => {
    setIsScanning(false);
    const existingItem = items.find(i => i.productId.toLowerCase() === id.toLowerCase());
    if (existingItem) {
      handleItemUpdate(existingItem.productId, 'quantity', Number(existingItem.quantity) + 1);
      return;
    }
    const existingProduct = products.find(p => p.id.toLowerCase() === id.toLowerCase());
    if (existingProduct) {
      setProductForQty(existingProduct);
      setIsQtyModalOpen(true);
    } else {
      setNewProductInitialId(id);
      setIsNewProductModalOpen(true);
    }
  };

  const handleSelectExistingProduct = (product: Product) => {
    setIsExistingProductModalOpen(false);
    const existingItem = items.find(i => i.productId === product.id);
    if (existingItem) {
        handleItemUpdate(existingItem.productId, 'quantity', Number(existingItem.quantity) + 1);
        return;
    }
    setProductForQty(product);
    setIsQtyModalOpen(true);
  };
  
  const handleQtySubmit = (quantity: number) => {
    if (productForQty) {
      setItems([
        ...items,
        {
          productId: productForQty.id,
          productName: productForQty.name,
          quantity: quantity,
          price: productForQty.purchasePrice,
          gstPercent: productForQty.gstPercent,
          saleValue: productForQty.salePrice,
        },
      ]);
    }
    setIsQtyModalOpen(false);
    setProductForQty(null);
  };

  const handleDownloadTemplate = () => {
    const headers = ['id', 'name', 'quantity', 'purchasePrice', 'salePrice', 'gstPercent'];
    const example = ['PROD-001', 'Sample Product', '10', '100', '150', '5'];
    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), example.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "purchase_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    setCsvStatus({type: 'info', message: 'Reading file...'});

    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            if (!text) throw new Error("Could not read file content.");

            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");

            const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
            const requiredHeaders = ['id', 'name', 'quantity', 'purchaseprice', 'saleprice', 'gstpercent'];
            if (requiredHeaders.some(rh => !headers.includes(rh))) {
                throw new Error(`CSV is missing columns. Header must be: ${requiredHeaders.join(', ')}`);
            }

            const newItems: PurchaseItem[] = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseCsvLine(lines[i]);
                const row = headers.reduce((obj, header, index) => ({...obj, [header]: values[index] || ''}), {} as any);
                if (!row.id) continue;
                
                const trimmedId = row.id.trim();
                if (items.some(item => item.productId.toLowerCase() === trimmedId.toLowerCase()) || newItems.some(item => item.productId.toLowerCase() === trimmedId.toLowerCase())) {
                    console.warn(`Skipping duplicate product ID from CSV: ${trimmedId}`);
                    continue;
                }
                if (mode === 'add' && products.some(p => p.id.toLowerCase() === trimmedId.toLowerCase())) {
                    console.warn(`Skipping existing product from CSV: ${trimmedId}`);
                    continue;
                }

                newItems.push({
                    productId: trimmedId,
                    productName: row.name,
                    quantity: parseFloat(row.quantity),
                    price: parseFloat(row.purchaseprice),
                    saleValue: parseFloat(row.saleprice),
                    gstPercent: parseFloat(row.gstpercent),
                });
            }

            setItems([...items, ...newItems]);
            setCsvStatus({type: 'success', message: `Successfully imported ${newItems.length} items from CSV.`});
        } catch (error) {
             setCsvStatus({type: 'error', message: `Import error: ${(error as Error).message}`});
        } finally {
            if (event.target) (event.target as HTMLInputElement).value = ''; // Reset file input
        }
    };
    reader.readAsText(file);
  };
  
  const handleAddSupplier = (newSupplier: Supplier) => {
      dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
      setSupplierId(newSupplier.id);
      showToast("Supplier added successfully!");
      setIsAddingSupplier(false);
  };

  const resetForm = () => {
    setSupplierId('');
    setItems([]);
    setPurchaseDate(getLocalDateString());
    setSupplierInvoiceId('');
    setDiscount('0');
    setAmountPaid('');
    setPaymentMethod('CASH');
    setPaymentReference('');
    setPaymentDueDates([]);
  };

  const handleSubmit = () => {
    const total = calculations.grandTotal;
    
    if (!supplierId || items.length === 0) {
      alert('Please select a supplier and add items.');
      return;
    }
    if (total < 0) {
        alert('Total amount cannot be negative.');
        return;
    }

    let purchaseId;
    let payments: Purchase['payments'] = [];

    if (mode === 'add') {
        const now = new Date();
        purchaseId = `PUR-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
        
        const paid = parseFloat(amountPaid);
        if (!isNaN(paid) && paid > 0) {
            if (paid > total + 0.01) {
                 alert(`Paid amount (₹${paid}) cannot exceed total amount (₹${total}).`);
                 return;
            }
            payments.push({
                id: `PAY-${purchaseId}`,
                amount: paid,
                method: paymentMethod,
                date: new Date().toISOString(),
                reference: paymentReference.trim() || undefined
            });
        }
    } else { // edit mode
        if (!initialData) return;
        purchaseId = initialData.id;
        payments = initialData.payments || []; // Keep existing payments
    }

    const purchaseData: Purchase = {
      id: purchaseId,
      supplierId,
      items,
      totalAmount: total,
      date: new Date(`${purchaseDate}T${new Date().toTimeString().split(' ')[0]}`).toISOString(),
      supplierInvoiceId: supplierInvoiceId || undefined,
      payments,
      paymentDueDates: paymentDueDates.filter(d => d).length > 0 ? paymentDueDates.filter(d => d).sort() : undefined,
    };

    onSubmit(purchaseData);

    if (mode === 'add') {
        resetForm();
    }
  };

  const paymentMethodOptions = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' }
  ];
  
  if (isAddingSupplier) {
      return (
          <div className="space-y-4 animate-fade-in-fast">
              <Button onClick={() => setIsAddingSupplier(false)} variant="secondary">
                  &larr; Back to Purchase
              </Button>
              <AddSupplierModal 
                  isOpen={true} 
                  onClose={() => setIsAddingSupplier(false)} 
                  onSave={handleAddSupplier} 
                  existingSuppliers={suppliers}
                  inline={true}
              />
          </div>
      );
  }

  return (
    <div className="space-y-4">
      {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScannedId} />}
      {isNewProductModalOpen && <NewProductModal isOpen={isNewProductModalOpen} onClose={() => setIsNewProductModalOpen(false)} onAdd={(item) => setItems([...items, item])} initialId={newProductInitialId} existingProducts={products} currentPurchaseItems={items} mode={mode} />}
      {isExistingProductModalOpen && <ProductSearchModal isOpen={isExistingProductModalOpen} onClose={() => setIsExistingProductModalOpen(false)} onSelect={handleSelectExistingProduct} products={products} />}
      {isQtyModalOpen && <QuantityInputModal isOpen={isQtyModalOpen} onClose={() => { setIsQtyModalOpen(false); setProductForQty(null); }} onSubmit={handleQtySubmit} product={productForQty} />}
      
      <Button onClick={onBack}>&larr; Back</Button>
      <Card title={mode === 'add' ? 'Create New Purchase' : `Edit Purchase ${initialData?.id}`}>
        <div className="space-y-4">
            
            {/* Enhanced Supplier Selection */}
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Supplier</label>
                <div className="flex gap-3 items-center">
                    <Dropdown
                        options={supplierOptions}
                        value={supplierId}
                        onChange={(val) => setSupplierId(val)}
                        placeholder="Search or Select Supplier"
                        searchable={true}
                        searchPlaceholder="Search suppliers..."
                        disabled={mode === 'edit'}
                        icon="search"
                    />
                    {mode === 'add' && (
                        <Button 
                            onClick={() => setIsAddingSupplier(true)} 
                            variant="secondary"
                            className="aspect-square !p-0 w-[42px] h-[42px] flex items-center justify-center flex-shrink-0"
                            aria-label="Add New Supplier"
                        >
                            <Plus size={24} />
                        </Button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <DateInput
                    label="Purchase Date"
                    value={purchaseDate}
                    onChange={e => setPurchaseDate(e.target.value)}
                />
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Supplier Invoice ID (Optional)</label>
                    <input type="text" placeholder="Enter Invoice No." value={supplierInvoiceId} onChange={e => setSupplierInvoiceId(e.target.value)} className="w-full p-2.5 border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>
        </div>
      </Card>

      <Card title="Add Items">
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button onClick={() => setIsNewProductModalOpen(true)} className="w-full"><Plus size={16} className="mr-2"/> New Product</Button>
                <Button onClick={() => setIsExistingProductModalOpen(true)} variant="secondary" className="w-full"><Search size={16} className="mr-2"/> Existing Product</Button>
                <Button onClick={() => setIsScanning(true)} variant="secondary" className="w-full"><QrCode size={16} className="mr-2"/> Scan</Button>
            </div>
            
            <div className="border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-800/50 text-center transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                        <FileSpreadsheet size={18} className="text-green-600" />
                        Bulk Import Items
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Upload a CSV file to add multiple items at once.</p>
                    <div className="flex gap-3">
                        <button onClick={handleDownloadTemplate} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1 py-2 px-3 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                            <Download size={14} /> Download Template
                        </button>
                        <label htmlFor="csv-upload" className="text-xs bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-slate-600 font-medium hover:bg-gray-50 dark:hover:bg-slate-600 flex items-center gap-1 py-2 px-3 rounded-lg transition-colors cursor-pointer shadow-sm">
                            <Upload size={14} /> Upload CSV
                        </label>
                        <input 
                            id="csv-upload" 
                            type="file" 
                            accept=".csv, text/csv, application/vnd.ms-excel, text/plain" 
                            className="absolute opacity-0 w-0 h-0 pointer-events-none" 
                            onChange={handleFileImport} 
                        />
                    </div>
                </div>
            </div>

            {csvStatus && (
                <div className={`p-2 rounded text-sm flex items-center gap-2 ${csvStatus.type === 'success' ? 'bg-green-100 text-green-800' : csvStatus.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                    {csvStatus.type === 'success' ? <CheckCircle size={16}/> : csvStatus.type === 'error' ? <XCircle size={16}/> : <Info size={16}/>}
                    {csvStatus.message}
                    <button onClick={() => setCsvStatus(null)} className="ml-auto font-bold">&times;</button>
                </div>
            )}
            
            <div className="space-y-2">
            {items.map(item => (
                <div key={item.productId} className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded border dark:border-slate-700 animate-fade-in-fast">
                <div className="flex justify-between items-start">
                    <div>
                    <p className="font-semibold">{item.productName}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.productId}</p>
                    </div>
                    <DeleteButton variant="remove" onClick={() => handleItemRemove(item.productId)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mt-2">
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Qty</label>
                        <input type="number" value={item.quantity} onChange={e => handleItemUpdate(item.productId, 'quantity', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Qty" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Buy Price</label>
                        <input type="number" value={item.price} onChange={e => handleItemUpdate(item.productId, 'price', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Purch Price" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">Sale Price</label>
                        <input type="number" value={item.saleValue} onChange={e => handleItemUpdate(item.productId, 'saleValue', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Sale Value" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">GST %</label>
                        <input type="number" value={item.gstPercent} onChange={e => handleItemUpdate(item.productId, 'gstPercent', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="GST %" />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5 text-right">Total</label>
                        <div className="p-1 flex items-center justify-end font-semibold text-gray-700 dark:text-gray-300 h-full">₹{(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}</div>
                    </div>
                </div>
                </div>
            ))}
            </div>
        </div>
      </Card>
      
       <Card title="Transaction Details">
            <div className="space-y-6">
                <div className="space-y-3">
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                        <span>Subtotal (excl. GST):</span>
                        <span>₹{calculations.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                        <span>Total GST:</span>
                        <span>₹{calculations.totalGst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                        <span>Discount / Adjustment:</span>
                        <input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-28 p-1 border rounded text-right dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                </div>

                <div className="text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">Grand Total</p>
                    <p className="text-4xl font-bold text-primary">
                        ₹{calculations.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {mode === 'add' && (
                    <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid Now</label>
                            <input 
                                type="number" 
                                value={amountPaid} 
                                onChange={e => setAmountPaid(e.target.value)} 
                                placeholder={`Total is ₹${calculations.grandTotal.toLocaleString('en-IN')}`} 
                                className="w-full p-2 border-2 border-red-300 rounded-lg shadow-inner focus:ring-red-500 focus:border-red-500 mt-1 dark:bg-slate-700 dark:border-red-400 dark:text-slate-200" 
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Method</label>
                            <Dropdown
                                options={paymentMethodOptions}
                                value={paymentMethod}
                                onChange={(val) => setPaymentMethod(val as any)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Reference (Optional)</label>
                            <input 
                                type="text" 
                                placeholder="e.g. UPI ID, Cheque No." 
                                value={paymentReference}
                                onChange={e => setPaymentReference(e.target.value)}
                                className="w-full p-2.5 border bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 rounded-lg text-gray-800 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                )}
                
                <div className="space-y-2 pt-4 border-t dark:border-slate-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Due Dates (Optional)</label>
                    {paymentDueDates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <DateInput 
                                value={date} 
                                onChange={(e) => {
                                    const newDates = [...paymentDueDates];
                                    newDates[index] = e.target.value;
                                    setPaymentDueDates(newDates);
                                }} 
                            />
                            <DeleteButton variant="remove" onClick={() => setPaymentDueDates(paymentDueDates.filter((_, i) => i !== index))} />
                        </div>
                    ))}
                    <Button onClick={() => setPaymentDueDates([...paymentDueDates, getLocalDateString()])} variant="secondary" className="w-full">
                        <Plus size={16} className="mr-2" /> Add Due Date
                    </Button>
                </div>
            </div>
       </Card>
      
      <Button onClick={handleSubmit} className="w-full">{mode === 'add' ? 'Complete Purchase' : 'Update Purchase'}</Button>
    </div>
  );
};