
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, User, Package, Boxes, ShoppingCart, QrCode, Mic } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Page } from '../types';
import { Customer, Supplier, Product, Sale, Purchase } from '../types';
import QRScannerModal from './QRScannerModal';

interface SearchResults {
    customers: Customer[];
    suppliers: Supplier[];
    products: Product[];
    sales: Sale[];
    purchases: Purchase[];
}

interface UniversalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    onNavigate: (page: Page, id: string) => void;
}

const UniversalSearch: React.FC<UniversalSearchProps> = ({ isOpen, onClose, onNavigate }) => {
    const { state, showToast } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [results, setResults] = useState<SearchResults>({ customers: [], suppliers: [], products: [], sales: [], purchases: [] });
    const [isScanning, setIsScanning] = useState(false);
    const [isListening, setIsListening] = useState(false);

    useEffect(() => {
        const handler = setTimeout(() => {
            if (searchTerm.length < 2) {
                setResults({ customers: [], suppliers: [], products: [], sales: [], purchases: [] });
                return;
            }

            const term = searchTerm.toLowerCase();

            const customers = state.customers.filter(c =>
                c.name.toLowerCase().includes(term) ||
                c.phone.includes(term) ||
                c.address.toLowerCase().includes(term) ||
                c.area.toLowerCase().includes(term) ||
                c.id.toLowerCase().includes(term)
            );

            const suppliers = state.suppliers.filter(s =>
                s.name.toLowerCase().includes(term) ||
                s.phone.includes(term) ||
                s.location.toLowerCase().includes(term) ||
                s.id.toLowerCase().includes(term)
            );

            const products = state.products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.id.toLowerCase().includes(term)
            );

            const sales = state.sales.filter(s =>
                s.id.toLowerCase().includes(term)
            );

            const purchases = state.purchases.filter(p =>
                p.id.toLowerCase().includes(term) ||
                p.supplierInvoiceId?.toLowerCase().includes(term)
            );

            setResults({ customers, suppliers, products, sales, purchases });

        }, 250); // Debounce search

        return () => clearTimeout(handler);
    }, [searchTerm, state]);
    
    useEffect(() => {
        // Reset search term when modal is closed
        if (!isOpen) {
            setSearchTerm('');
            setIsScanning(false);
            setIsListening(false);
        }
    }, [isOpen]);
    
    const handleScan = (scannedText: string) => {
        setIsScanning(false);
        const text = scannedText.toLowerCase();

        // Check for product
        const product = state.products.find(p => p.id.toLowerCase() === text);
        if (product) {
            onNavigate('PRODUCTS', product.id);
            return;
        }

        // Check for sale
        const sale = state.sales.find(s => s.id.toLowerCase() === text);
        if (sale) {
            onNavigate('CUSTOMERS', sale.customerId);
            return;
        }
        
        // Check for purchase
        const purchase = state.purchases.find(p => p.id.toLowerCase() === text);
        if (purchase) {
            onNavigate('PURCHASES', purchase.supplierId);
            return;
        }

        showToast(`QR Code content "${scannedText}" not recognized.`, 'info');
    };

    const handleVoiceSearch = () => {
        if (!('webkitSpeechRecognition' in window)) {
            showToast("Voice search not supported in this browser.", 'error');
            return;
        }

        const recognition = new (window as any).webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        recognition.onstart = () => setIsListening(true);
        
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            
            // Simple Command Parsing
            const lowerTranscript = transcript.toLowerCase();
            if (lowerTranscript.includes("go to sales") || lowerTranscript.includes("open sales")) {
                onNavigate('SALES', 'new'); // Using 'new' loosely, layout handles page switch
            } else if (lowerTranscript.includes("new customer")) {
                onNavigate('CUSTOMERS', 'new');
            } else {
                setSearchTerm(transcript);
            }
            setIsListening(false);
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            if (event.error === 'not-allowed') {
                // Show more helpful error for permission issues
                showToast("Microphone denied. Check browser permission settings.", 'error');
            } else if (event.error === 'no-speech') {
                // Ignore no-speech errors (common if user didn't say anything)
            } else {
                showToast("Voice input failed. Try again.", 'error');
            }
        };

        recognition.onend = () => setIsListening(false);

        recognition.start();
    };


    const hasResults = useMemo(() => Object.values(results).some(arr => Array.isArray(arr) && arr.length > 0), [results]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background dark:bg-slate-900 z-[100] flex flex-col p-4 animate-fade-in-fast" role="dialog" aria-modal="true">
            {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScan} />}
            <div className="flex items-center gap-2 mb-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                     <input
                        type="text"
                        placeholder={isListening ? "Listening..." : "Search..."}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full p-3 pl-10 border rounded-full dark:bg-slate-800 dark:border-slate-700 dark:text-white transition-all ${isListening ? 'ring-2 ring-red-500 border-red-500' : ''}`}
                        autoFocus
                    />
                </div>
                <button 
                    onClick={handleVoiceSearch} 
                    className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'text-primary hover:bg-primary/5 dark:hover:bg-slate-800'}`}
                    aria-label="Voice Search"
                >
                    <Mic size={20} />
                </button>
                 <button onClick={() => setIsScanning(true)} className="p-3 rounded-full text-primary hover:bg-primary/5 dark:hover:bg-slate-800" aria-label="Scan QR Code">
                    <QrCode size={20} />
                </button>
                <button onClick={onClose} className="text-lg font-semibold text-primary dark:text-teal-400">Cancel</button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2">
                 {searchTerm.length > 1 && !hasResults && (
                    <div className="text-center py-10 text-gray-500 dark:text-gray-400">
                        <p>No results found for "{searchTerm}"</p>
                    </div>
                )}
                {results.customers.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Customers</h3>
                        {results.customers.map(c => (
                            <div key={c.id} onClick={() => onNavigate('CUSTOMERS', c.id)} className="p-3 flex items-center gap-3 hover:bg-primary/5 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                <User className="w-5 h-5 text-primary"/>
                                <div>
                                    <p className="font-semibold">{c.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{c.area}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {results.suppliers.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Suppliers</h3>
                        {results.suppliers.map(s => (
                            <div key={s.id} onClick={() => onNavigate('PURCHASES', s.id)} className="p-3 flex items-center gap-3 hover:bg-primary/5 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                <Package className="w-5 h-5 text-primary"/>
                                <div>
                                    <p className="font-semibold">{s.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{s.location}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {results.products.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Products</h3>
                        {results.products.map(p => (
                            <div key={p.id} onClick={() => onNavigate('PRODUCTS', p.id)} className="p-3 flex items-center gap-3 hover:bg-primary/5 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                <Boxes className="w-5 h-5 text-primary"/>
                                <div>
                                    <p className="font-semibold">{p.name}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">ID: {p.id}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 {results.sales.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Sales Invoices</h3>
                        {results.sales.map(s => {
                            const customer = state.customers.find(c => c.id === s.customerId);
                            return (
                                <div key={s.id} onClick={() => onNavigate('CUSTOMERS', s.customerId)} className="p-3 flex items-center gap-3 hover:bg-primary/5 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                    <ShoppingCart className="w-5 h-5 text-primary"/>
                                    <div>
                                        <p className="font-semibold">{s.id}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">To: {customer?.name || 'Unknown'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {results.purchases.length > 0 && (
                    <div className="mb-4">
                        <h3 className="font-bold text-sm text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Purchase Invoices</h3>
                        {results.purchases.map(p => {
                            const supplier = state.suppliers.find(s => s.id === p.supplierId);
                            return (
                                <div key={p.id} onClick={() => onNavigate('PURCHASES', p.supplierId)} className="p-3 flex items-center gap-3 hover:bg-primary/5 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                                    <Package className="w-5 h-5 text-primary"/>
                                    <div>
                                        <p className="font-semibold">{p.id}</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">From: {supplier?.name || 'Unknown'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UniversalSearch;