import React, { useState, useMemo, useRef, useEffect } from 'react';
// fix: Import Save icon from lucide-react
import { FileText, Plus, Search, Share2, Trash2, ShoppingCart, QrCode, X, Edit, Calendar, Check, Download, Save } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Quote, QuoteItem, Product, Sale, Page } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ModernDateInput from '../components/ModernDateInput';
import Dropdown from '../components/Dropdown';
import DeleteButton from '../components/DeleteButton';
import { generateEstimatePDF } from '../utils/pdfGenerator';
import { Html5Qrcode } from 'html5-qrcode';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { useDialog } from '../context/DialogContext';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateTotals } from '../utils/calculations';
import { useHotkeys } from '../hooks/useHotkeys';
import Input from '../components/Input';
import QRScannerModal from '../components/QRScannerModal';


const QuotationsPage: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    
    // Form State
    const [customerId, setCustomerId] = useState('');
    const [quoteDate, setQuoteDate] = useState(getLocalDateString());
    const [validUntil, setValidUntil] = useState(getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
    const [items, setItems] = useState<QuoteItem[]>([]);
    const [discount, setDiscount] = useState('0');
    
    // Product Selection
    const [productSearch, setProductSearch] = useState('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const [isScanning, setIsScanning] = useState(false);

    useOnClickOutside(searchRef, () => setShowProductDropdown(false));

    // Auto-open create form if navigated via Quick Action
    useEffect(() => {
        if (state.selection && state.selection.page === 'QUOTATIONS' && state.selection.id === 'new') {
            setView('create');
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, dispatch]);

    const customerOptions = useMemo(() => state.customers.map(c => ({
        value: c.id,
        label: `${c.name} - ${c.area}`,
        searchText: `${c.name} ${c.area}`
    })), [state.customers]);

    const filteredProducts = useMemo(() => state.products.filter(p => 
        p.name.toLowerCase().includes(productSearch.toLowerCase()) || 
        p.id.toLowerCase().includes(productSearch.toLowerCase())
    ), [state.products, productSearch]);

    // Use consolidated calculations
    const calculations = useMemo(() => {
        return calculateTotals(items, parseFloat(discount) || 0, state.products);
    }, [items, discount, state.products]);

    // --- Effects ---
    useEffect(() => {
        if (view === 'edit' && editingQuote) {
            setCustomerId(editingQuote.customerId);
            setQuoteDate(getLocalDateString(new Date(editingQuote.date)));
            setValidUntil(editingQuote.validUntil ? getLocalDateString(new Date(editingQuote.validUntil)) : '');
            setItems(editingQuote.items.map(i => ({...i})));
            setDiscount(editingQuote.discount.toString());
        } else if (view === 'create') {
            setCustomerId('');
            setQuoteDate(getLocalDateString());
            setValidUntil(getLocalDateString(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)));
            setItems([]);
            setDiscount('0');
        }
    }, [view, editingQuote]);

    const handleAddItem = (product: Product) => {
        const existingItem = items.find(i => i.productId === product.id);
        if (existingItem) {
            setItems(items.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i));
        } else {
            setItems([...items, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                price: product.salePrice
            }]);
        }
        setProductSearch('');
        setShowProductDropdown(false);
    };

    const handleUpdateItem = (productId: string, field: 'quantity' | 'price', value: string) => {
        const numVal = parseFloat(value) || 0;
        setItems(items.map(i => i.productId === productId ? { ...i, [field]: numVal } : i));
    };

    const handleRemoveItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId));
    };

    const handleSaveQuote = () => {
        if (!customerId || items.length === 0) {
            showToast("Please select a customer and add items.", 'error');
            return;
        }

        const quoteData: Quote = {
            id: view === 'edit' && editingQuote ? editingQuote.id : `EST-${Date.now()}`,
            customerId,
            items,
            totalAmount: calculations.totalAmount,
            discount: parseFloat(discount) || 0,
            gstAmount: calculations.gstAmount,
            date: new Date(quoteDate).toISOString(),
            validUntil: validUntil ? new Date(validUntil).toISOString() : undefined,
            status: view === 'edit' && editingQuote ? editingQuote.status : 'PENDING'
        };

        if (view === 'edit') {
            dispatch({ type: 'UPDATE_QUOTE', payload: quoteData });
            showToast("Estimate updated successfully.");
        } else {
            dispatch({ type: 'ADD_QUOTE', payload: quoteData });
            showToast("Estimate created successfully.");
        }
        setView('list');
    };

    useHotkeys('s', handleSaveQuote, { ctrl: true });

    const handleDeleteQuote = async (id: string) => {
        if (await showConfirm("Delete this estimate?")) {
            dispatch({ type: 'DELETE_QUOTE', payload: id });
            showToast("Estimate deleted.");
        }
    };

    const handleConvertToSale = async (quote: Quote) => {
        if (await showConfirm("Convert this estimate to a confirmed sale? This will deduct stock.")) {
            const saleId = `SALE-${Date.now()}`;
            const sale: Sale = {
                id: saleId,
                customerId: quote.customerId,
                items: quote.items,
                discount: quote.discount,
                gstAmount: quote.gstAmount,
                totalAmount: quote.totalAmount,
                date: new Date().toISOString(),
                payments: []
            };
            
            const outOfStockItems = [];
            for (const item of quote.items) {
                const product = state.products.find(p => p.id === item.productId);
                if (!product || product.quantity < item.quantity) {
                    outOfStockItems.push(item.productName);
                }
            }

            if (outOfStockItems.length > 0) {
                showToast(`Cannot convert: Insufficient stock for ${outOfStockItems.join(', ')}`, 'error');
                return;
            }

            dispatch({ type: 'ADD_SALE', payload: sale });
            
            quote.items.forEach(item => {
                dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: item.productId, change: -item.quantity } });
            });

            const updatedQuote: Quote = { ...quote, status: 'CONVERTED', convertedSaleId: saleId };
            dispatch({ type: 'UPDATE_QUOTE', payload: updatedQuote });
            
            showToast("Converted to Sale successfully!");
        }
    };

    const handleSharePDF = async (quote: Quote) => {
        const customer = state.customers.find(c => c.id === quote.customerId);
        if (!customer) return;
        try {
            const doc = await generateEstimatePDF(quote, customer, state.profile, state.estimateTemplate, state.customFonts);
            const pdfBlob = doc.output('blob');
            const file = new File([pdfBlob], `Estimate-${quote.id}.pdf`, { type: 'application/pdf' });
            
            if (navigator.share && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: `Estimate ${quote.id}` });
            } else {
                doc.save(`Estimate-${quote.id}.pdf`);
            }
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    if (view === 'list') {
        return (
            <div className="space-y-4 animate-fade-in-fast">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Estimates</h1>
                    </div>
                    <Button onClick={() => setView('create')}>
                        <Plus size={16} className="mr-2" /> New Estimate
                    </Button>
                </div>

                {state.quotes.length === 0 ? (
                    <div className="text-center py-10 bg-gray-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
                        <FileText size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No estimates created yet.</p>
                        <p className="text-sm text-gray-400 mt-1">Click "New Estimate" to get started.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {state.quotes.slice().reverse().map(quote => {
                            const customer = state.customers.find(c => c.id === quote.customerId);
                            const statusColors: Record<Quote['status'], string> = {
                                PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                                ACCEPTED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                                REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
                                CONVERTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                            };

                            return (
                                <Card key={quote.id} className="p-4 transition-shadow hover:shadow-lg">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-gray-800 dark:text-white">{customer?.name || 'Unknown Customer'}</p>
                                            <p className="text-xs text-gray-500 font-mono">{quote.id}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-lg text-primary">₹{quote.totalAmount.toLocaleString('en-IN')}</p>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColors[quote.status]}`}>{quote.status}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t dark:border-slate-700 flex justify-between items-center">
                                        <p className="text-xs text-gray-500">
                                            Created: {new Date(quote.date).toLocaleDateString()}
                                            {quote.validUntil && ` | Valid Until: ${new Date(quote.validUntil).toLocaleDateString()}`}
                                        </p>
                                        <div className="flex gap-2">
                                            {quote.status === 'PENDING' && (
                                                <Button onClick={() => handleConvertToSale(quote)} className="h-8 text-xs bg-green-600 hover:bg-green-700">
                                                    <ShoppingCart size={14} className="mr-1"/> Convert
                                                </Button>
                                            )}
                                            <Button onClick={() => handleSharePDF(quote)} variant="secondary" className="h-8 w-8 p-0"><Share2 size={16}/></Button>
                                            <Button onClick={() => { setEditingQuote(quote); setView('edit'); }} variant="secondary" className="h-8 w-8 p-0"><Edit size={16}/></Button>
                                            <DeleteButton onClick={() => handleDeleteQuote(quote.id)} />
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
    
    // Create/Edit View
    return (
        <div className="space-y-4 animate-fade-in-fast">
            {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={(code) => {
                const product = state.products.find(p => p.id === code);
                if (product) handleAddItem(product);
                else showToast("Product not found", 'error');
                setIsScanning(false);
            }} />}

            <Button onClick={() => setView('list')}>&larr; Back to List</Button>
            <Card title={view === 'create' ? 'New Estimate' : `Edit Estimate #${editingQuote?.id}`}>
                <div className="space-y-4">
                    <Dropdown options={customerOptions} value={customerId} onChange={setCustomerId} placeholder="Select Customer" searchable />
                    <div className="grid grid-cols-2 gap-4">
                        <ModernDateInput label="Estimate Date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                        <ModernDateInput label="Valid Until" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card title="Items">
                <div ref={searchRef}>
                    <div className="flex gap-2 mb-2">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <Input 
                                type="text" 
                                placeholder="Search products..." 
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                onFocus={() => setShowProductDropdown(true)}
                                className="pl-10"
                            />
                            {showProductDropdown && filteredProducts.length > 0 && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 rounded-md shadow-lg border dark:border-slate-700 z-10 max-h-60 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <div key={p.id} onClick={() => handleAddItem(p)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer text-sm">
                                            {p.name} - ₹{p.salePrice}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button onClick={() => setIsScanning(true)} variant="secondary" className="px-3"><QrCode size={18}/></Button>
                    </div>
                </div>
                <div className="space-y-2 mt-4">
                    {items.map(item => (
                        <div key={item.productId} className="flex gap-2 items-center p-2 bg-gray-50 dark:bg-slate-700/50 rounded">
                            <span className="flex-grow">{item.productName}</span>
                            <Input type="number" value={item.quantity} onChange={e => handleUpdateItem(item.productId, 'quantity', e.target.value)} className="w-20 text-center !p-1.5" />
                            <Input type="number" value={item.price} onChange={e => handleUpdateItem(item.productId, 'price', e.target.value)} className="w-24 text-center !p-1.5" />
                            <DeleteButton variant="remove" onClick={() => handleRemoveItem(item.productId)} />
                        </div>
                    ))}
                </div>
            </Card>

            <Card title="Totals">
                <div className="space-y-2">
                    <div className="flex justify-between"><span>Subtotal:</span> <span>₹{calculations.subTotal.toLocaleString()}</span></div>
                    <div className="flex justify-between items-center">
                        <span>Discount:</span>
                        <Input type="number" value={discount} onChange={e => setDiscount(e.target.value)} className="w-24 text-right !p-1.5" />
                    </div>
                    <div className="flex justify-between"><span>GST:</span> <span>₹{calculations.gstAmount.toLocaleString()}</span></div>
                    <div className="flex justify-between font-bold text-lg pt-2 border-t mt-2"><span>Grand Total:</span> <span>₹{calculations.totalAmount.toLocaleString()}</span></div>
                </div>
            </Card>

            <Button onClick={handleSaveQuote} className="w-full">
                <Save size={16} className="mr-2"/> {view === 'create' ? 'Save Estimate' : 'Update Estimate'}
            </Button>
        </div>
    );
};

export default QuotationsPage;