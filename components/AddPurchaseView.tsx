import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Purchase, Supplier, Product, PurchaseItem } from '../types';
import { Plus, Info, X } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import DeleteButton from './DeleteButton';
import DateInput from './DateInput';
import Dropdown from './Dropdown';
import QRScannerModal from './QRScannerModal';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [paymentDueDates, setPaymentDueDates] = useState<string[]>(initialData?.paymentDueDates || []);
  
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const isDirtyRef = useRef(false);

  const calculations = useMemo(() => {
    const totalItemValue = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const totalGst = items.reduce((sum, item) => {
        const itemTotal = Number(item.price) * Number(item.quantity);
        const gstPercent = Number.isFinite(item.gstPercent) ? item.gstPercent : 0;
        const itemGst = itemTotal - (itemTotal / (1 + (gstPercent / 100)));
        return sum + itemGst;
    }, 0);
    const subTotal = totalItemValue - totalGst;
    const discountVal = parseFloat(discount) || 0;
    const grandTotal = totalItemValue - discountVal;
    return { subTotal, totalGst, grandTotal };
  }, [items, discount]);

  const handleItemUpdate = (productId: string, field: keyof PurchaseItem, value: string | number) => {
    setItems(items.map(item => item.productId === productId ? { ...item, [field]: value } : item));
  };
  
  const handleItemRemove = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const handleSubmit = () => {
      onSubmit({
          id: initialData?.id || `PUR-${Date.now()}`,
          supplierId,
          items,
          totalAmount: calculations.grandTotal,
          date: new Date(purchaseDate).toISOString(),
          supplierInvoiceId,
          payments: initialData?.payments || [],
          paymentDueDates
      });
  };

  return (
    <div className="space-y-4">
      <Button onClick={onBack}>&larr; Back</Button>
      <Card title={mode === 'add' ? 'Create New Purchase' : `Edit Purchase`}>
         <div className="space-y-4">
            <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Supplier</label>
                <div className="flex gap-3 items-center">
                    <Dropdown
                        options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                        value={supplierId}
                        onChange={setSupplierId}
                        searchable={true}
                    />
                    <Button onClick={() => setIsAddingSupplier(true)} variant="secondary" className="aspect-square"><Plus size={20}/></Button>
                </div>
            </div>
            <DateInput label="Purchase Date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
         </div>
      </Card>

      <Card title="Items">
        <div className="space-y-4">
            <div className="space-y-2">
            {items.map(item => (
                <div key={item.productId} className="bg-gray-50 dark:bg-slate-700/50 rounded border dark:border-slate-700 overflow-hidden">
                    <div className="p-2 flex justify-between items-start">
                        <div>
                            <p className="font-semibold">{item.productName}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{item.productId}</p>
                        </div>
                        <div className="flex gap-2">
                            <DeleteButton variant="remove" onClick={() => handleItemRemove(item.productId)} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm p-2 border-b dark:border-slate-600">
                        <input type="number" value={item.quantity} onChange={e => handleItemUpdate(item.productId, 'quantity', parseFloat(e.target.value))} className="p-1 border rounded" placeholder="Qty" />
                        <input type="number" value={item.price} onChange={e => handleItemUpdate(item.productId, 'price', parseFloat(e.target.value))} className="p-1 border rounded" placeholder="Buy Price" />
                        <input type="number" value={item.saleValue} onChange={e => handleItemUpdate(item.productId, 'saleValue', parseFloat(e.target.value))} className="p-1 border rounded" placeholder="Sale Price" />
                        <input type="number" value={item.gstPercent} onChange={e => handleItemUpdate(item.productId, 'gstPercent', parseFloat(e.target.value))} className="p-1 border rounded" placeholder="GST %" />
                        <div className="p-1 text-right font-bold">₹{(item.quantity * item.price).toLocaleString()}</div>
                    </div>
                </div>
            ))}
            </div>
        </div>
      </Card>
      
      <Card title="Total">
          <div className="text-right text-2xl font-bold">₹{calculations.grandTotal.toLocaleString()}</div>
      </Card>

      <Button onClick={handleSubmit} className="w-full">Complete Purchase</Button>
    </div>
  );
};