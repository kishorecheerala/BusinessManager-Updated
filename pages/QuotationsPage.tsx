
import React, { useState, useMemo } from 'react';
import { FileText, Plus, Search, Share2, Trash2, ShoppingCart } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Quote, QuoteItem, Product } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import DateInput from '../components/DateInput';
import Dropdown from '../components/Dropdown';
import DeleteButton from '../components/DeleteButton';
import { generateEstimatePDF } from '../utils/pdfGenerator';
import DatePill from '../components/DatePill';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const QuotationsPage: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    const [isCreating, setIsCreating] = useState(false);
    
    // Form State
    const [customerId, setCustomerId] = useState('');
    const [quoteDate, setQuoteDate] = useState(getLocalDateString());
    const [validUntil, setValidUntil] = useState(getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))); // +7 days
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [discount, setDiscount] = useState('0');
    
    // Helper state for product selection
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);

    const customerOptions = useMemo(() => state.customers.map(c => ({
        value: c.id,
        label: `${c.name} - ${c.area}`,
        searchText: `${c.name} ${c.area}`
    })), [state.customers]);

    const filteredProducts = useMemo(() => state.products.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.id.toLowerCase().includes(productSearch.toLowerCase())
    ), [state.products, productSearch]);

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
        return { subTotal, discountAmount, gstAmount, totalAmount };
    }, [items, discount, state.products]);

    const handleAddItem = (product: Product) => {
        setItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { productId: product.id, productName: product.name, price: product.salePrice, quantity: 1 }];
        });
        setProductSearch('');
        setShowProductDropdown(false);
    };

    const handleUpdateItem = (id: string, field: keyof QuoteItem, val: number) => {
        setItems(prev => prev.map(i => i.productId === id ? { ...i, [field]: val } : i));
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.productId !== id));
    };

    const handleSaveQuote = async () => {
        if (!customerId || items.length === 0) return alert("Please select customer and items.");
        
        const newQuote: Quote = {
            id: `QT-${Date.now()}`,
            customerId,
            date: new Date(quoteDate).toISOString(),
            validUntil: new Date(validUntil).toISOString(),
            items,
            discount: calculations.discountAmount,
            gstAmount: calculations.gstAmount,
            totalAmount: calculations.totalAmount,
            status: 'PENDING'
        };

        dispatch({ type: 'ADD_QUOTE', payload: newQuote });
        showToast("Quote created successfully.");
        
        // Reset
        setIsCreating(false);
        setItems([]);
        setCustomerId('');
        setDiscount('0');
        
        // Generate PDF
        const customer = state.customers.find(c => c.id === customerId);
        if (customer) {
            const doc = await generateEstimatePDF(newQuote, customer, state.profile);
            doc.save(`Quote-${newQuote.id}.pdf`);
        }
    };

    const handleConvertToSale = (quote: Quote) => {
        if (window.confirm("Convert this quote to a confirmed Sale? This will take you to the Sales page to finalize payment.")) {
            dispatch({ type: 'UPDATE_QUOTE', payload: { ...quote, status: 'CONVERTED' } });
            
            // Pass data to sales page via selection state
            dispatch({ 
                type: 'SET_SELECTION', 
                payload: { 
                    page: 'SALES', 
                    id: 'new',
                    data: {
                        customerId: quote.customerId,
                        items: quote.items,
                        discount: quote.discount
                    }
                } 
            });
        }
    };

    const handleDeleteQuote = (id: string) => {
        if (window.confirm("Delete this quote?")) {
            dispatch({ type: 'DELETE_QUOTE', payload: id });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
                        <FileText /> Quotations / Estimates
                    </h1>
                    <DatePill />
                </div>
                <Button onClick={() => setIsCreating(!isCreating)}>
                    {isCreating ? 'Cancel' : <><Plus size={16} className="mr-2" /> New Estimate</>}
                </Button>
            </div>

            {isCreating && (
                <Card title="Create New Estimate" className="border-l-4 border-l-indigo-500 animate-slide-down-fade">
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Customer</label>
                                <Dropdown 
                                    options={customerOptions}
                                    value={customerId}
                                    onChange={setCustomerId}
                                    placeholder="Select Customer"
                                    searchable
                                />
                            </div>
                            <div className="flex gap-4">
                                <DateInput label="Date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                                <DateInput label="Valid Until" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                            </div>
                        </div>

                        {/* Product Search */}
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Items</label>
                            <div className="flex items-center border rounded-lg bg-white dark:bg-slate-700 dark:border-slate-600 overflow-hidden">
                                <div className="p-2 text-gray-400"><Search size={18}/></div>
                                <input 
                                    type="text" 
                                    className="w-full p-2 outline-none bg-transparent dark:text-white" 
                                    placeholder="Search products..."
                                    value={productSearch}
                                    onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                                    onFocus={() => setShowProductDropdown(true)}
                                />
                            </div>
                            {showProductDropdown && productSearch && (
                                <div className="absolute z-10 w-full bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 rounded-lg mt-1 max-h-60 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleAddItem(p)}
                                            className="p-3 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer border-b dark:border-slate-700 last:border-0"
                                        >
                                            <p className="font-medium text-sm dark:text-white">{p.name}</p>
                                            <p className="text-xs text-gray-500">Price: ₹{p.salePrice}</p>
                                        </div>
                                    ))}
                                    {filteredProducts.length === 0 && <div className="p-3 text-sm text-gray-500">No products found.</div>}
                                </div>
                            )}
                        </div>

                        {/* Items List */}
                        <div className="space-y-2 bg-gray-50 dark:bg-slate-700/30 p-3 rounded-lg">
                            {items.map(item => (
                                <div key={item.productId} className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded border dark:border-slate-700 shadow-sm">
                                    <div className="flex-1">
                                        <p className="font-medium text-sm dark:text-white">{item.productName}</p>
                                        <p className="text-xs text-gray-500">₹{item.price}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={e => handleUpdateItem(item.productId, 'quantity', parseFloat(e.target.value))}
                                            className="w-16 p-1 border rounded text-center text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white" 
                                        />
                                        <span className="text-sm font-bold w-20 text-right">₹{(item.price * item.quantity).toLocaleString()}</span>
                                        <DeleteButton variant="remove" onClick={() => handleRemoveItem(item.productId)} />
                                    </div>
                                </div>
                            ))}
                            {items.length === 0 && <p className="text-sm text-center text-gray-500 italic">No items added.</p>}
                        </div>

                        {/* Totals */}
                        <div className="flex flex-col items-end gap-1 border-t pt-2 dark:border-slate-700">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                                <span className="font-medium dark:text-white">₹{calculations.subTotal.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                                <input 
                                    type="number" 
                                    value={discount} 
                                    onChange={e => setDiscount(e.target.value)} 
                                    className="w-20 p-1 border rounded text-right dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                />
                            </div>
                            <div className="flex items-center gap-2 text-lg font-bold text-primary mt-1">
                                <span>Total:</span>
                                <span>₹{calculations.totalAmount.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button onClick={handleSaveQuote} className="flex-1 bg-indigo-600 hover:bg-indigo-700">Save Quote</Button>
                        </div>
                    </div>
                </Card>
            )}

            <Card title="Recent Quotes">
                <div className="space-y-3">
                    {state.quotes.slice().reverse().map(quote => {
                        const customer = state.customers.find(c => c.id === quote.customerId);
                        const isExpired = new Date(quote.validUntil || '') < new Date() && quote.status === 'PENDING';
                        
                        return (
                            <div key={quote.id} className="border dark:border-slate-700 rounded-lg p-4 bg-white dark:bg-slate-800 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <h3 className="font-bold text-gray-800 dark:text-white">{customer?.name || 'Unknown'}</h3>
                                        <p className="text-xs text-gray-500">{new Date(quote.date).toLocaleDateString()} • ID: {quote.id}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-primary text-lg">₹{quote.totalAmount.toLocaleString()}</p>
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                            quote.status === 'CONVERTED' ? 'bg-green-100 text-green-700' :
                                            isExpired ? 'bg-red-100 text-red-700' :
                                            'bg-yellow-100 text-yellow-700'
                                        }`}>
                                            {quote.status === 'CONVERTED' ? 'CONVERTED' : isExpired ? 'EXPIRED' : 'PENDING'}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="flex justify-between items-center pt-3 border-t dark:border-slate-700 mt-3 gap-2">
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="secondary" 
                                            className="h-8 text-xs px-2"
                                            onClick={async () => {
                                                if(customer) {
                                                    const doc = await generateEstimatePDF(quote, customer, state.profile);
                                                    doc.save(`Quote-${quote.id}.pdf`);
                                                }
                                            }}
                                        >
                                            <Share2 size={14} className="mr-1" /> PDF
                                        </Button>
                                        <Button 
                                            variant="secondary" 
                                            className="h-8 text-xs px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            onClick={() => handleDeleteQuote(quote.id)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                    
                                    {quote.status === 'PENDING' && !isExpired && (
                                        <Button 
                                            className="h-8 text-xs px-3 bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => handleConvertToSale(quote)}
                                        >
                                            <ShoppingCart size={14} className="mr-1" /> Convert to Sale
                                        </Button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {state.quotes.length === 0 && <p className="text-center text-gray-500 py-4">No quotes created yet.</p>}
                </div>
            </Card>
        </div>
    );
};

export default QuotationsPage;