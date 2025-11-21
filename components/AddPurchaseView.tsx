
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, Upload, IndianRupee, Search, QrCode, Info, CheckCircle, XCircle, X } from 'lucide-react';
import { Supplier, Product, PurchaseItem, Purchase } from '../types';
import Card from './Card';
import Button from './Button';
import { Html5Qrcode } from 'html5-qrcode';
import DeleteButton from './DeleteButton';
import QuantityInputModal from './QuantityInputModal';
import Dropdown, { DropdownOption } from './Dropdown';
import AddSupplierModal from './AddSupplierModal';

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

// --- Modals defined outside the main component to prevent re-creation on render ---

const QRScannerModal: React.FC<{ onClose: () => void; onScanned: (text: string) => void }> = ({ onClose, onScanned }) => {
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-purchase");
        
        const qrCodeSuccessCallback = (decodedText: string) => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    onScanned(decodedText);
                }).catch(err => console.error("Error stopping scanner", err));
            }
        };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        html5QrCodeRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .catch(err => alert("Camera permission is required. Please allow and try again."));
        
        return () => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.log("Failed to stop scanner on cleanup.", err));
            }
        };
    }, [onScanned]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card title="Scan Product" className="w-full max-w-md relative animate-scale-in">
                <button onClick={onClose} className="absolute top-4 right-4 p-2"><X size={20}/></button>
                <div id="qr-reader-purchase" className="w-full mt-4"></div>
            </Card>
        </div>
    );
};

const ProductSearchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: Product) => void;
    products: Product[];
}> = ({ isOpen, onClose, onSelect, products }) => {
    const [searchTerm, setSearchTerm] = useState('');
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card className="w-full max-w-lg animate-scale-in">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">Select Existing Product</h2>
                <button onClick={onClose}><X size={20}/></button>
            </div>
            <input type="text" placeholder="Search products..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 border rounded-lg mb-4 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" autoFocus/>
            <div className="max-h-80 overflow-y-auto space-y-2">
                {products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())).map(p => (
                <div key={p.id} onClick={() => onSelect(p)} className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-teal-50 dark:bg-slate-700/50 dark:hover:bg-slate-700">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Code: {p.id} | Stock: {p.quantity}</p>
                </div>
                ))}
            </div>
            </Card>
        </div>
    );
};

const NewProductModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (item: PurchaseItem) => void;
    initialId?: string;
    existingProducts: Product[];
    currentPurchaseItems: PurchaseItem[];
    mode: 'add' | 'edit';
}> = ({ isOpen, onClose, onAdd, initialId = '', existingProducts, currentPurchaseItems, mode }) => {
    const [newProduct, setNewProduct] = useState({ id: initialId, name: '', purchasePrice: '', salePrice: '', gstPercent: '5', quantity: '' });
    
    useEffect(() => {
        setNewProduct(prev => ({ ...prev, id: initialId }));
    }, [initialId]);

    const handleAddItemManually = () => {
        const { id, name, purchasePrice, salePrice, gstPercent, quantity } = newProduct;
        if (!id || !name || !purchasePrice || !salePrice || !quantity) return alert('All fields are required.');
        
        const trimmedId = id.trim();
        if(currentPurchaseItems.some(item => item.productId.toLowerCase() === trimmedId.toLowerCase())) return alert(`Product with ID "${trimmedId}" is already in this purchase.`);
        // In edit mode for a purchase, we don't need to check against existing stock, as we might be adding a new product line to an old invoice.
        if(mode === 'add' && existingProducts.some(p => p.id.toLowerCase() === trimmedId.toLowerCase())) return alert(`Product with ID "${trimmedId}" already exists in stock. Please select it from the search instead.`);

        onAdd({
            productId: trimmedId,
            productName: name,
            quantity: parseFloat(quantity),
            price: parseFloat(purchasePrice),
            saleValue: parseFloat(salePrice),
            gstPercent: parseFloat(gstPercent),
        });
        onClose();
    };
    
    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[51] p-4 animate-fade-in-fast">
            <Card title="Add New Product to Purchase" className="w-full max-w-md animate-scale-in">
                 <div className="space-y-4">
                    <input type="text" placeholder="Product ID / Code (Unique)" value={newProduct.id} onChange={e => setNewProduct({...newProduct, id: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" autoFocus />
                    <input type="text" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    <input type="number" placeholder="Quantity" value={newProduct.quantity} onChange={e => setNewProduct({...newProduct, quantity: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    <input type="number" placeholder="Purchase Price" value={newProduct.purchasePrice} onChange={e => setNewProduct({...newProduct, purchasePrice: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    <input type="number" placeholder="Sale Value" value={newProduct.salePrice} onChange={e => setNewProduct({...newProduct, salePrice: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    <input type="number" placeholder="GST %" value={newProduct.gstPercent} onChange={e => setNewProduct({...newProduct, gstPercent: e.target.value})} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    <div className="flex gap-2">
                        <Button onClick={handleAddItemManually} className="w-full">Add Product</Button>
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

  const supplierOptions = useMemo((): DropdownOption[] => 
    suppliers
        .sort((a,b) => a.name.localeCompare(b.name))
        .map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  );
  
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
      date: new Date(purchaseDate).toISOString(),
      supplierInvoiceId: supplierInvoiceId || undefined,
      payments,
      paymentDueDates: paymentDueDates.filter(d => d).length > 0 ? paymentDueDates.filter(d => d).sort() : undefined,
    };

    onSubmit(purchaseData);
  };

  const paymentMethodOptions = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' }
  ];
  
  return (
    <div className="space-y-4">
      {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScannedId} />}
      {isNewProductModalOpen && <NewProductModal isOpen={isNewProductModalOpen} onClose={() => setIsNewProductModalOpen(false)} onAdd={(item) => setItems([...items, item])} initialId={newProductInitialId} existingProducts={products} currentPurchaseItems={items} mode={mode} />}
      {isExistingProductModalOpen && <ProductSearchModal isOpen={isExistingProductModalOpen} onClose={() => setIsExistingProductModalOpen(false)} onSelect={handleSelectExistingProduct} products={products} />}
      {isQtyModalOpen && <QuantityInputModal isOpen={isQtyModalOpen} onClose={() => { setIsQtyModalOpen(false); setProductForQty(null); }} onSubmit={handleQtySubmit} product={productForQty} />}
      
      {isAddingSupplier && <AddSupplierModal isOpen={isAddingSupplier} onClose={() => setIsAddingSupplier(false)} onAdd={handleAddSupplier} existingSuppliers={suppliers} />}

      <Button onClick={onBack}>&larr; Back</Button>
      <Card title={mode === 'add' ? 'Create New Purchase' : `Edit Purchase ${initialData?.id}`}>
        <div className="space-y-4">
            <div className="flex gap-2 items-center">
                <Dropdown 
                    options={supplierOptions}
                    value={supplierId}
                    onChange={setSupplierId}
                    placeholder="Select a Supplier"
                    disabled={mode === 'edit'}
                />
                {mode === 'add' && (
                    <Button onClick={() => setIsAddingSupplier(true)} variant="secondary" className="flex-shrink-0">
                        <Plus size={16}/> New Supplier
                    </Button>
                )}
            </div>
          <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
          <input type="text" placeholder="Supplier Invoice ID (Optional)" value={supplierInvoiceId} onChange={e => setSupplierInvoiceId(e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
        </div>
      </Card>

      <Card title="Add Items">
        <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Button onClick={() => setIsNewProductModalOpen(true)} className="w-full"><Plus size={16}/> New Product</Button>
                <Button onClick={() => setIsExistingProductModalOpen(true)} variant="secondary" className="w-full"><Search size={16}/> Existing Product</Button>
                <Button onClick={() => setIsScanning(true)} variant="secondary" className="w-full"><QrCode size={16}/> Scan</Button>
                <label htmlFor="csv-upload" className="px-4 py-2 rounded-md font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm flex items-center justify-center gap-2 bg-secondary hover:bg-teal-500 focus:ring-secondary cursor-pointer">
                    <Upload size={16}/> From CSV
                </label>
                <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileImport} />
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm mt-1">
                    <input type="number" value={item.quantity} onChange={e => handleItemUpdate(item.productId, 'quantity', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Qty" />
                    <input type="number" value={item.price} onChange={e => handleItemUpdate(item.productId, 'price', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Purch Price" />
                    <input type="number" value={item.saleValue} onChange={e => handleItemUpdate(item.productId, 'saleValue', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="Sale Value" />
                    <input type="number" value={item.gstPercent} onChange={e => handleItemUpdate(item.productId, 'gstPercent', parseFloat(e.target.value))} className="w-full p-1 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" placeholder="GST %" />
                    <div className="p-1 flex items-center justify-end font-semibold text-gray-700 dark:text-gray-300">₹{(Number(item.quantity) * Number(item.price)).toLocaleString('en-IN')}</div>
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
                                className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                            />
                        </div>
                    </div>
                )}
                
                <div className="space-y-2 pt-4 border-t dark:border-slate-700">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Due Dates (Optional)</label>
                    {paymentDueDates.map((date, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input 
                                type="date" 
                                value={date} 
                                onChange={(e) => {
                                    const newDates = [...paymentDueDates];
                                    newDates[index] = e.target.value;
                                    setPaymentDueDates(newDates);
                                }} 
                                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
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
