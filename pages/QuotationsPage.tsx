import React, { useState, useMemo, useRef, useEffect } from 'react';
import { FileText, Plus, Search, Share2, Trash2, ShoppingCart, QrCode, X, Edit, Calendar, Check, Download } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Customer, Quote, QuoteItem, Product, Sale } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
// fix: Fix import path for DateInput component
import DateInput from '../components/DateInput';
import Dropdown from '../components/Dropdown';
import DeleteButton from '../components/DeleteButton';
import { generateEstimatePDF } from '../utils/pdfGenerator';
import { Html5Qrcode } from 'html5-qrcode';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { useDialog } from '../context/DialogContext';
import { getLocalDateString } from '../utils/dateUtils';
import { calculateTotals } from '../utils/calculations';
import { useHotkeys } from '../hooks/useHotkeys';

// ... (QRScannerModal component remains same) ...
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

    // Auto-open create form if navigated via Quick Action
    useEffect(() => {
        if (state.selection && state.selection.page === 'QUOTATIONS' && state.selection.id === 'new') {
            setView('create');
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection]);

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

    // ... (Handlers for addItem, updateItem, removeItem, saveQuote, deleteQuote, convertToSale) ...
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

    // Hotkey for Save (Ctrl+S)
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
            // Pass custom fonts here
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

    // ... (Render logic remains mostly same) ...
    if (view === 'list') {
        return (
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Estimates</h1>
                    </div>
                    <Button onClick={() => setView('create')}>
                        <Plus size={16} className="mr-2" /> New Estimate
                    </Button>
                </div>

                {state.quotes.length === 0 ? (
                    <div className="text-center py-