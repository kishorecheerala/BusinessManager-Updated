
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, Plus, Search, Share2, Trash2, ShoppingCart, QrCode, X, Edit, Calendar, Check, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Quote, QuoteItem, Product, Sale } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import DateInput from '../components/DateInput';
import Dropdown from '../components/Dropdown';
import DeleteButton from '../components/DeleteButton';
import { generateEstimatePDF } from '../utils/pdfGenerator';
import DatePill from '../components/DatePill';
import { Html5Qrcode } from 'html5-qrcode';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { useDialog } from '../context/DialogContext';

const getLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const QRScannerModal: React.FC<{
    onClose: () => void;
    onScanned: (decodedText: string) => void;
}> = ({ onClose, onScanned }) => {
    const [scanStatus, setScanStatus] = useState<string>("Initializing camera...");
    const scannerId = "qr-reader-quotes";

    useEffect(() => {
        if (!document.getElementById(scannerId)) return;

        const html5QrCode = new Html5Qrcode(scannerId);
        setScanStatus("Requesting camera permissions...");

        const qrCodeSuccessCallback = (decodedText: string) => {
            html5QrCode.pause(true);
            onScanned(decodedText);
        };
        
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .then(() => setScanStatus("Scanning for QR Code..."))
            .catch(err => {
                setScanStatus(`Camera Permission Error. Please allow camera access.`);
                console.error("Camera start failed.", err);
            });
            
        return () => {
            try {
                if (html5QrCode.isScanning) {
                    html5QrCode.stop().then(() => html5QrCode.clear()).catch(e => console.warn("Scanner stop error", e));
                } else {
                    html5QrCode.clear();
                }
            } catch (e) {
                console.warn("Scanner cleanup error", e);
            }
        };
    }, [onScanned]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card title="Scan Product QR Code" className="w-full max-w-md relative animate-scale-in">
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={20}/>
                 </button>
                <div id={scannerId} className="w-full mt-4 rounded-lg overflow-hidden border"></div>
                <p className="text-center text-sm my-2 text-gray-600 dark:text-gray-400">{scanStatus}</p>
            </Card>
        </div>
    );
};

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

    // --- Handlers ---
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

    const handleUpdateItem = (productId: string, field: keyof QuoteItem, value: string) => {
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
            
            // Check stock
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
            
            // Update stock
            quote.items.forEach(item => {
                dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: item.productId, change: -item.quantity } });
            });

            // Update quote status
            const updatedQuote: Quote = { ...quote, status: 'CONVERTED', convertedSaleId: saleId };
            dispatch({ type: 'UPDATE_QUOTE', payload: updatedQuote });
            
            showToast("Converted to Sale successfully!");
        }
    };

    const handleSharePDF = async (quote: Quote) => {
        const customer = state.customers.find(c => c.id === quote.customerId);
        if (!customer) return;
        try {
            const doc = await generateEstimatePDF(quote, customer, state.profile);
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
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Estimates</h1>
                        <DatePill />
                    </div>
                    <Button onClick={() => setView('create')}>
                        <Plus size={16} className="mr-2" /> New Estimate
                    </Button>
                </div>

                {state.quotes.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 dark:text-gray-400 bg-white dark:bg-slate-800 rounded-xl border border-dashed border-gray-300 dark:border-slate-700">
                        <FileText size={48} className="mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-semibold">No estimates yet</p>
                        <p className="text-sm">Create quotation for your customers.</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {state.quotes.slice().reverse().map(quote => {
                            const customer = state.customers.find(c => c.id === quote.customerId);
                            const isConverted = quote.status === 'CONVERTED';
                            return (
                                <Card key={quote.id} className={`relative ${isConverted ? 'opacity-75' : ''}`}>
                                    {isConverted && (
                                        <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                            <Check size={12} /> Converted
                                        </div>
                                    )}
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="font-bold text-lg text-gray-800 dark:text-white">{customer?.name || 'Unknown Customer'}</h3>
                                            <p className="text-xs text-gray-500">{new Date(quote.date).toLocaleDateString()} • {quote.id}</p>
                                        </div>
                                        <p className="font-bold text-xl text-primary">₹{quote.totalAmount.toLocaleString('en-IN')}</p>
                                    </div>
                                    
                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t dark:border-slate-700">
                                        {!isConverted && (
                                            <>
                                                <Button onClick={() => { setEditingQuote(quote); setView('edit'); }} variant="secondary" className="text-xs h-8">
                                                    <Edit size={14} className="mr-1" /> Edit
                                                </Button>
                                                <Button onClick={() => handleConvertToSale(quote)} className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700">
                                                    <ShoppingCart size={14} className="mr-1" /> Convert to Sale
                                                </Button>
                                            </>
                                        )}
                                        <Button onClick={() => handleSharePDF(quote)} variant="secondary" className="text-xs h-8">
                                            <Share2 size={14} className="mr-1" /> Share
                                        </Button>
                                        <Button onClick={() => handleDeleteQuote(quote.id)} variant="secondary" className="text-xs h-8 text-red-600 hover:bg-red-50">
                                            <Trash2 size={14} />
                                        </Button>
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
            {isScanning && (
                <QRScannerModal 
                    onClose={() => setIsScanning(false)} 
                    onScanned={(text) => {
                        setIsScanning(false);
                        const prod = state.products.find(p => p.id === text);
                        if (prod) handleAddItem(prod);
                        else showToast("Product not found", 'error');
                    }} 
                />
            )}
            
            <div className="flex items-center gap-2 mb-4">
                <Button onClick={() => setView('list')} variant="secondary">&larr; Back</Button>
                <h1 className="text-xl font-bold text-primary">{view === 'edit' ? 'Edit Estimate' : 'New Estimate'}</h1>
            </div>

            <Card>
                <div className="space-y-4">
                    <Dropdown 
                        options={customerOptions}
                        value={customerId}
                        onChange={setCustomerId}
                        placeholder="Select Customer"
                        searchable={true}
                        icon="search"
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <DateInput label="Date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                        <DateInput label="Valid Until" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                    </div>
                </div>
            </Card>

            <Card title="Items">
                <div className="space-y-4">
                    <div className="flex gap-2 relative" ref={searchRef}>
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search products..." 
                                className="w-full pl-10 p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                value={productSearch}
                                onChange={(e) => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                                onFocus={() => setShowProductDropdown(true)}
                            />
                            {showProductDropdown && productSearch && (
                                <div className="absolute top-full left-0 w-full bg-white dark:bg-slate-800 shadow-xl border dark:border-slate-700 rounded-lg mt-1 z-20 max-h-60 overflow-y-auto">
                                    {filteredProducts.map(p => (
                                        <div 
                                            key={p.id} 
                                            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 cursor-pointer border-b dark:border-slate-700 last:border-0"
                                            onClick={() => handleAddItem(p)}
                                        >
                                            <p className="font-semibold text-sm">{p.name}</p>
                                            <p className="text-xs text-gray-500 flex justify-between">
                                                <span>Stock: {p.quantity}</span>
                                                <span>₹{p.salePrice}</span>
                                            </p>
                                        </div>
                                    ))}
                                    {filteredProducts.length === 0 && <p className="p-2 text-sm text-gray-500 text-center">No products found</p>}
                                </div>
                            )}
                        </div>
                        <Button onClick={() => setIsScanning(true)} variant="secondary" className="px-3">
                            <QrCode size={20} />
                        </Button>
                    </div>

                    <div className="space-y-2">
                        {items.map(item => (
                            <div key={item.productId} className="p-2 border rounded-lg bg-gray-50 dark:bg-slate-700/50 dark:border-slate-600 flex justify-between items-center">
                                <div className="flex-grow">
                                    <p className="font-medium text-sm dark:text-white">{item.productName}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={(e) => handleUpdateItem(item.productId, 'quantity', e.target.value)}
                                            className="w-16 p-1 text-xs border rounded text-center dark:bg-slate-800 dark:border-slate-600"
                                        />
                                        <span className="text-xs text-gray-500">x</span>
                                        <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={(e) => handleUpdateItem(item.productId, 'price', e.target.value)}
                                            className="w-20 p-1 text-xs border rounded text-center dark:bg-slate-800 dark:border-slate-600"
                                        />
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1">
                                    <span className="font-bold text-sm">₹{(item.price * item.quantity).toLocaleString()}</span>
                                    <DeleteButton variant="remove" onClick={() => handleRemoveItem(item.productId)} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </Card>

            <Card>
                <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                        <span>₹{calculations.subTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600 dark:text-gray-400">Discount</span>
                        <input 
                            type="number" 
                            value={discount} 
                            onChange={(e) => setDiscount(e.target.value)}
                            className="w-24 p-1 text-right border rounded dark:bg-slate-700 dark:border-slate-600"
                        />
                    </div>
                    <div className="flex justify-between border-t pt-2 font-bold text-lg">
                        <span>Total</span>
                        <span className="text-primary">₹{calculations.totalAmount.toLocaleString()}</span>
                    </div>
                </div>
                <Button onClick={handleSaveQuote} className="w-full mt-4">
                    <FileText size={16} className="mr-2" />
                    {view === 'edit' ? 'Update Estimate' : 'Create Estimate'}
                </Button>
            </Card>
        </div>
    );
};

export default QuotationsPage;
