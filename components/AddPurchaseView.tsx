







import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Purchase, Supplier, Product, PurchaseItem, Payment } from '../types';
import { Plus, Info, X, Camera, Image as ImageIcon, IndianRupee, Save, Sparkles, Loader2, ScanLine, Download, Trash2 } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import DeleteButton from './DeleteButton';
import DateInput from './DateInput';
import Dropdown from './Dropdown';
import Input from './Input';
import { compressImage } from '../utils/imageUtils';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateTotals } from '../utils/calculations';
import { useHotkeys } from '../hooks/useHotkeys';
import AddSupplierModal from './AddSupplierModal';
import { GoogleGenAI } from "@google/genai";
import { generateImagesToPDF } from '../utils/pdfGenerator';

interface PurchaseFormProps {
  mode: 'add' | 'edit';
  initialData?: Purchase | null;
  suppliers: Supplier[];
  products: Product[];
  onSubmit: (purchase: Purchase) => void;
  onBack: () => void;
  setIsDirty: (isDirty: boolean) => void;
  dispatch: React.Dispatch<any>;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' }
];

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
  const [discount, setDiscount] = useState(initialData?.discount?.toString() || '0');
  const [paymentDueDates, setPaymentDueDates] = useState<string[]>(initialData?.paymentDueDates || []);
  
  // Initialize images from either new array or legacy single url field
  const [invoiceImages, setInvoiceImages] = useState<string[]>(
      initialData?.invoiceImages || (initialData?.invoiceUrl ? [initialData.invoiceUrl] : [])
  );
  
  const [isAddingSupplier, setIsAddingSupplier] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  
  // Payment Details for New Purchase
  const [paymentDetails, setPaymentDetails] = useState({
      amount: '',
      method: 'CASH' as 'CASH' | 'UPI' | 'CHEQUE',
      date: getLocalDateString(),
      reference: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Use consolidated calculations.
  const calculations = useMemo(() => {
      return calculateTotals(items, parseFloat(discount) || 0);
  }, [items, discount]);

  const handleItemUpdate = (productId: string, field: keyof PurchaseItem, value: string | number) => {
    setItems(items.map(item => item.productId === productId ? { ...item, [field]: value } : item));
  };
  
  const handleItemRemove = (productId: string) => {
    setItems(items.filter(item => item.productId !== productId));
  };

  const handleAttachInvoice = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
          const newImages: string[] = [];
          for (let i = 0; i < e.target.files.length; i++) {
              try {
                  const file = e.target.files[i];
                  // Simple compression for storage
                  const base64Full = await compressImage(file, 1024, 0.8);
                  newImages.push(base64Full);
              } catch (error) {
                  console.error("Image attach failed", error);
                  showToast("Failed to attach image.", 'error');
              }
          }
          if (newImages.length > 0) {
              setInvoiceImages(prev => [...prev, ...newImages]);
              showToast(`${newImages.length} image(s) attached.`, 'success');
          }
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  const handleRemoveImage = (index: number) => {
      setInvoiceImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleDownloadPDF = () => {
      if (invoiceImages.length === 0) return;
      const fileName = `Invoices_${supplierInvoiceId || 'Purchase'}_${getLocalDateString()}.pdf`;
      generateImagesToPDF(invoiceImages, fileName);
  };

  const handleAddNewSupplier = (newSupplier: Supplier) => {
      dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
      setSupplierId(newSupplier.id); // Auto-select new supplier
      setIsAddingSupplier(false);
      showToast(`Supplier ${newSupplier.name} added!`, 'success');
  };

  // --- Payment Schedule Handlers ---
  const handleAddDueDate = () => {
      setPaymentDueDates([...paymentDueDates, '']);
  };

  const handleDueDateChange = (index: number, value: string) => {
      const newDates = [...paymentDueDates];
      newDates[index] = value;
      setPaymentDueDates(newDates);
  };

  const handleRemoveDueDate = (index: number) => {
      setPaymentDueDates(paymentDueDates.filter((_, i) => i !== index));
  };

  // --- AI Scan Logic ---
  const handleScanClick = () => {
      // Check for API key (User preference first, then Env)
      const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
      if (!apiKey) {
          showToast("API Key missing. Please set it in Menu > API Configuration.", 'error');
          return;
      }
      scanInputRef.current?.click();
  };

  const handleScanFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          setIsScanning(true);
          try {
              const file = e.target.files[0];
              const base64 = await compressImage(file, 1024, 0.8);
              
              // Automatically add scanned image to attachments
              setInvoiceImages(prev => [...prev, base64]);

              const apiKey = localStorage.getItem('gemini_api_key') || process.env.API_KEY;
              if (!apiKey) throw new Error("API Key not found");

              const ai = new GoogleGenAI({ apiKey });
              // Updated prompt to ask for supplier contact details
              const prompt = `Analyze this invoice image. Return a valid JSON object with these fields:
              {
                "supplierName": string,
                "supplierAddress": string,
                "supplierPhone": string,
                "supplierGst": string,
                "invoiceNumber": string,
                "date": string (YYYY-MM-DD),
                "items": [{ "name": string, "qty": number, "price": number, "gst": number }],
                "total": number,
                "discount": number
              }
              If a value is not found, use null or 0.`;

              const response = await ai.models.generateContent({
                  model: 'gemini-2.5-flash',
                  contents: [
                      { inlineData: { mimeType: 'image/jpeg', data: base64.split(',')[1] } },
                      { text: prompt }
                  ],
                  config: { responseMimeType: "application/json" }
              });

              const text = response.text;
              if (!text) throw new Error("No data returned from AI");

              // Robust JSON parsing
              let jsonStr = text;
              const jsonMatch = text.match(/\{[\s\S]*\}/);
              if (jsonMatch) jsonStr = jsonMatch[0];
              
              const data = JSON.parse(jsonStr);

              // 1. Populate Basic Fields
              if (data.invoiceNumber) setSupplierInvoiceId(data.invoiceNumber);
              if (data.date) setPurchaseDate(data.date);
              if (data.discount) setDiscount(data.discount.toString());

              // 2. Try to match Supplier OR Create New
              if (data.supplierName) {
                  const normalizedScanned = data.supplierName.toLowerCase();
                  const matchedSupplier = suppliers.find(s => 
                      s.name.toLowerCase().includes(normalizedScanned) || 
                      normalizedScanned.includes(s.name.toLowerCase())
                  );
                  
                  if (matchedSupplier) {
                      setSupplierId(matchedSupplier.id);
                      showToast(`Matched existing supplier: ${matchedSupplier.name}`, 'success');
                  } else {
                      // Create new supplier
                      const newSupplierId = `SUPP-${Date.now()}`;
                      const newSupplier: Supplier = {
                          id: newSupplierId,
                          name: data.supplierName,
                          // Use extracted details or defaults
                          location: data.supplierAddress || 'Unknown Location',
                          phone: data.supplierPhone || '',
                          gstNumber: data.supplierGst || '',
                          reference: 'Auto-created from Scan'
                      };
                      
                      dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
                      setSupplierId(newSupplierId);
                      showToast(`Created new supplier: ${newSupplier.name}`, 'success');
                  }
              }

              // 3. Populate Items
              if (data.items && Array.isArray(data.items)) {
                  const newItems: PurchaseItem[] = data.items.map((item: any) => {
                      // Try to match existing product
                      const existingProd = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
                      
                      return {
                          productId: existingProd ? existingProd.id : `NEW-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                          productName: item.name || 'Unknown Item',
                          quantity: Number(item.qty) || 1,
                          price: Number(item.price) || 0,
                          saleValue: existingProd ? existingProd.salePrice : (Number(item.price) * 1.2), // Default 20% margin
                          gstPercent: Number(item.gst) || 0
                      };
                  });
                  setItems(newItems);
              }

              showToast("Invoice scanned successfully!", 'success');

          } catch (error) {
              console.error("Scan failed", error);
              showToast("Failed to scan invoice. Please enter details manually.", 'error');
          } finally {
              setIsScanning(false);
              if (scanInputRef.current) scanInputRef.current.value = '';
          }
      }
  };

  const handleSubmit = () => {
      if (!supplierId) {
          showToast("Please select a supplier", "info");
          return;
      }
      if (items.length === 0) {
          showToast("Please add at least one item", "info");
          return;
      }

      // Handle Initial Payment for New Purchase
      let finalPayments = initialData?.payments || [];
      
      if (mode === 'add') {
          const paidAmount = parseFloat(paymentDetails.amount) || 0;
          if (paidAmount > calculations.totalAmount + 0.01) {
              showToast(`Paid amount (₹${paidAmount.toLocaleString('en-IN')}) cannot be greater than the total amount (₹${calculations.totalAmount.toLocaleString('en-IN')}).`, 'error');
              return;
          }
          if (paidAmount > 0) {
              const newPayment: Payment = {
                  id: `PAY-P-${Date.now()}`,
                  amount: paidAmount,
                  method: paymentDetails.method,
                  date: new Date(`${paymentDetails.date}T${new Date().toTimeString().split(' ')[0]}`).toISOString(),
                  reference: paymentDetails.reference.trim() || undefined,
              };
              finalPayments = [newPayment];
          }
      }

      onSubmit({
          id: initialData?.id || `PUR-${Date.now()}`,
          supplierId,
          items,
          totalAmount: calculations.totalAmount,
          discount: calculations.discountAmount,
          gstAmount: calculations.gstAmount,
          date: new Date(purchaseDate).toISOString(),
          supplierInvoiceId,
          invoiceImages,
          invoiceUrl: invoiceImages.length > 0 ? invoiceImages[0] : undefined, // Legacy support
          payments: finalPayments,
          paymentDueDates: paymentDueDates.filter(d => d).sort()
      });
  };

  // Hotkey for Save (Ctrl+S)
  useHotkeys('s', handleSubmit, { ctrl: true });

  return (
    <div className="space-y-4">
      <AddSupplierModal 
        isOpen={isAddingSupplier} 
        onClose={() => setIsAddingSupplier(false)} 
        onSave={handleAddNewSupplier}
        existingSuppliers={suppliers}
      />

      {/* Hidden File Input for AI Scan */}
      <input 
          type="file" 
          accept="image/*" 
          ref={scanInputRef} 
          className="hidden" 
          onChange={handleScanFileChange} 
      />

      <Button onClick={onBack}>&larr; Back</Button>
      
      <Card title={mode === 'add' ? 'Create New Purchase' : `Edit Purchase`}>
         {/* AI Auto-Fill Button - Prominent */}
         <div className="mb-6">
            <button
                onClick={handleScanClick}
                disabled={isScanning}
                className="w-full relative overflow-hidden group bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white p-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
            >
                <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700 ease-out skew-x-12 -ml-4 w-[120%]"></div>
                {isScanning ? (
                    <>
                        <Loader2 className="animate-spin" size={24} />
                        <span className="font-bold">Analyzing Invoice...</span>
                    </>
                ) : (
                    <>
                        <Sparkles className="animate-pulse" size={24} />
                        <span className="font-bold text-lg">Auto-fill with AI</span>
                    </>
                )}
            </button>
            <p className="text-center text-xs text-gray-500 mt-2">
                Scans image to extract Supplier, Items, and Totals automatically.
            </p>
         </div>

         <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1.5">Select Supplier</label>
                    <div className="flex gap-2 items-center">
                        <div className="flex-grow">
                            <Dropdown
                                options={suppliers.map(s => ({ value: s.id, label: s.name }))}
                                value={supplierId}
                                onChange={setSupplierId}
                                searchable={true}
                                placeholder="Select Supplier"
                            />
                        </div>
                        <Button 
                            onClick={() => setIsAddingSupplier(true)} 
                            variant="secondary" 
                            className="h-[42px] w-[42px] flex items-center justify-center p-0 flex-shrink-0"
                            title="Add New Supplier"
                        >
                            <Plus size={20}/>
                        </Button>
                    </div>
                </div>
                <div>
                    <Input 
                        label="Supplier Invoice No."
                        type="text" 
                        value={supplierInvoiceId} 
                        onChange={e => setSupplierInvoiceId(e.target.value)} 
                        placeholder="e.g. INV-9928"
                    />
                </div>
            </div>
            <DateInput label="Purchase Date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
         </div>
      </Card>

      <Card title="Items">
        <div className="space-y-4">
            {/* Offline Attachment Bar */}
            <div className="bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border border-gray-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                        <ImageIcon className="text-gray-500 dark:text-gray-300" size={20} />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            Attached Invoices ({invoiceImages.length})
                        </span>
                    </div>
                    <div className="flex gap-2">
                        {invoiceImages.length > 0 && (
                            <Button onClick={handleDownloadPDF} variant="secondary" className="h-8 text-xs px-2">
                                <Download size={14} className="mr-1" /> PDF
                            </Button>
                        )}
                        <button 
                            onClick={() => fileInputRef.current?.click()} 
                            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded shadow-sm transition-colors dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        >
                            <Camera size={14} />
                            Add Photo
                        </button>
                    </div>
                </div>
                
                {invoiceImages.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                        {invoiceImages.map((img, idx) => (
                            <div key={idx} className="relative flex-shrink-0 group w-24 h-24 rounded-lg overflow-hidden border dark:border-slate-600">
                                <img src={img} alt={`Invoice ${idx + 1}`} className="w-full h-full object-cover" />
                                <button 
                                    onClick={() => handleRemoveImage(idx)}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    title="Remove"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-4 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg">
                        <p className="text-xs text-gray-500">No invoices attached. Click 'Add Photo' to attach physical copies.</p>
                    </div>
                )}
                
                <input 
                    type="file" 
                    multiple
                    accept="image/*" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleAttachInvoice} 
                />
            </div>

            <div className="space-y-2">
            {items.map(item => (
                <div key={item.productId} className="bg-gray-50 dark:bg-slate-700/50 rounded border dark:border-slate-700 overflow-hidden animate-slide-up-fade">
                    <div className="p-2 flex justify-between items-start">
                        <div className="flex-grow">
                            <input 
                                type="text" 
                                value={item.productName} 
                                onChange={e => handleItemUpdate(item.productId, 'productName', e.target.value)}
                                className="font-semibold bg-transparent border-none p-0 focus:ring-0 w-full dark:text-white placeholder-gray-400"
                                placeholder="Product Name"
                            />
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">{item.productId}</p>
                        </div>
                        <div className="flex gap-2">
                            <DeleteButton variant="remove" onClick={() => handleItemRemove(item.productId)} />
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm p-2 border-t dark:border-slate-600">
                        <div>
                            <Input label="Quantity" type="number" value={item.quantity} onChange={e => handleItemUpdate(item.productId, 'quantity', parseFloat(e.target.value))} placeholder="Qty" />
                        </div>
                        <div>
                            <Input label="Buy Price" type="number" value={item.price} onChange={e => handleItemUpdate(item.productId, 'price', parseFloat(e.target.value))} placeholder="Buy Price" />
                        </div>
                        <div>
                            <Input label="Sale Price" type="number" value={item.saleValue} onChange={e => handleItemUpdate(item.productId, 'saleValue', parseFloat(e.target.value))} placeholder="Sale Price" />
                        </div>
                        <div>
                            <Input label="GST %" type="number" value={item.gstPercent} onChange={e => handleItemUpdate(item.productId, 'gstPercent', parseFloat(e.target.value))} placeholder="GST %" />
                        </div>
                        <div className="flex flex-col justify-end">
                            <div className="p-1 text-right font-bold dark:text-white">₹{(item.quantity * item.price).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            ))}
            
            <Button onClick={() => setItems([...items, { productId: `NEW-${Date.now()}`, productName: '', quantity: 1, price: 0, saleValue: 0, gstPercent: 0 }])} variant="secondary" className="w-full border-dashed border-2">
                <Plus size={16} className="mr-2" /> Add Item Manually
            </Button>
            </div>
        </div>
      </Card>
      
      <Card title="Transaction Details">
          <div className="space-y-6">
              {/* Section 1: Breakdown */}
              <div className="space-y-3">
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                      <span>Subtotal:</span>
                      <span>₹{calculations.subTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-700 dark:text-gray-300">
                      <span>Discount:</span>
                      <Input 
                          type="number" 
                          value={discount} 
                          onChange={e => setDiscount(e.target.value)} 
                          className="text-right" 
                          containerClassName="w-28"
                      />
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
                  <div className="space-y-4 pt-4 border-t dark:border-slate-700">
                      <h4 className="font-bold text-gray-700 dark:text-gray-300">Initial Payment</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount Paid Now</label>
                              <div className="relative mt-1">
                                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"><IndianRupee size={14}/></span>
                                  <Input 
                                      type="number" 
                                      value={paymentDetails.amount} 
                                      onChange={e => setPaymentDetails({...paymentDetails, amount: e.target.value })} 
                                      placeholder={`Total is ₹${calculations.totalAmount.toLocaleString('en-IN')}`} 
                                      className="pl-8 border-2 border-green-300 focus:ring-green-500 focus:border-green-500 dark:border-green-800" 
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                              <Dropdown 
                                  options={PAYMENT_METHODS}
                                  value={paymentDetails.method}
                                  onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
                              />
                          </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <DateInput 
                              label="Payment Date"
                              value={paymentDetails.date} 
                              onChange={e => setPaymentDetails({ ...paymentDetails, date: e.target.value })} 
                          />
                          <div>
                              <Input label="Reference (Optional)" type="text" placeholder="e.g. UPI ID, Cheque No." value={paymentDetails.reference} onChange={e => setPaymentDetails({...paymentDetails, reference: e.target.value })} />
                          </div>
                      </div>
                  </div>
              ) : (
                  <div className="pt-4 border-t dark:border-slate-700 text-center">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Payments for this purchase must be managed from the supplier's details page.</p>
                  </div>
              )}

              {/* Section 4: Payment Schedule */}
              <div className="pt-4 border-t dark:border-slate-700">
                  <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">Payment Schedule (Optional)</label>
                      <button onClick={handleAddDueDate} className="text-xs text-primary flex items-center gap-1 hover:underline font-semibold">
                          <Plus size={12} /> Add Due Date
                      </button>
                  </div>
                  {paymentDueDates.map((date, index) => (
                      <div key={index} className="flex gap-2 mb-2 animate-fade-in-fast">
                          <DateInput 
                              value={date} 
                              onChange={(e) => handleDueDateChange(index, e.target.value)} 
                              containerClassName="flex-grow"
                          />
                          <DeleteButton variant="remove" onClick={() => handleRemoveDueDate(index)} className="mt-1" />
                      </div>
                  ))}
                  {paymentDueDates.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No specific future due dates added.</p>
                  )}
              </div>
          </div>
      </Card>

      <Button onClick={handleSubmit} className="w-full py-3 text-lg font-bold shadow-lg">
          <Save size={20} className="mr-2" />
          {mode === 'add' ? 'Complete Purchase' : 'Update Purchase'}
      </Button>
    </div>
  );
};
