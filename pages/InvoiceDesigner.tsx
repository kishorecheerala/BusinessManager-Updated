
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Image as ImageIcon, RefreshCw, Eye, Edit3, ExternalLink, ChevronDown, Upload, Trash2, Wand2, Sparkles, Grid, Languages, PenTool, QrCode, Download, FileUp, Stamp, Banknote, TableProperties, EyeOff, GripVertical } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { useAppContext } from '../context/AppContext';
import { InvoiceTemplateConfig, DocumentType, InvoiceLabels } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ColorPickerModal from '../components/ColorPickerModal';
import { generateA4InvoicePdf, generateEstimatePDF, generateDebitNotePDF, generateThermalInvoicePDF } from '../utils/pdfGenerator';
import { extractDominantColor, compressImage } from '../utils/imageUtils';

// --- Dummy Data for Previews ---
const dummyCustomer = {
    id: 'CUST-001',
    name: 'John Doe Enterprises',
    phone: '9876543210',
    address: '123 Business Park, Tech City, Hyderabad',
    area: 'Tech City',
    reference: 'Walk-in'
};

const dummySale = {
    id: 'INV-2023-001',
    customerId: 'CUST-001',
    items: [
        { productId: 'P1', productName: 'Premium Silk Saree', quantity: 2, price: 4500, gstPercent: 5 },
        { productId: 'P2', productName: 'Cotton Kurti', quantity: 5, price: 850, gstPercent: 5 },
        { productId: 'P3', productName: 'Designer Blouse', quantity: 3, price: 1200, gstPercent: 12 }
    ],
    discount: 500,
    gstAmount: 1250,
    totalAmount: 16350,
    date: new Date().toISOString(),
    payments: [{ id: 'PAY-1', amount: 5000, date: new Date().toISOString(), method: 'UPI' as const }]
};

const dummyQuote = {
    ...dummySale,
    id: 'EST-2023-005',
    validUntil: new Date(Date.now() + 7 * 86400000).toISOString(),
    status: 'PENDING' as const
};

const dummyReturn = {
    id: 'DBN-2023-008',
    type: 'SUPPLIER' as const,
    referenceId: 'PUR-ABC-123',
    partyId: 'SUPP-001',
    items: [
        { productId: 'P1', productName: 'Defective Fabric Roll', quantity: 1, price: 3200 }
    ],
    returnDate: new Date().toISOString(),
    amount: 3200,
    reason: 'Damaged goods'
};

const dummySupplier = {
    id: 'SUPP-001',
    name: 'Kanchi Weavers Co.',
    phone: '8887776665',
    location: 'Kanchipuram, Tamil Nadu',
    gstNumber: '33ABCDE1234Z1'
};

type PresetConfig = {
    colors?: Partial<InvoiceTemplateConfig['colors']>;
    fonts?: Partial<InvoiceTemplateConfig['fonts']>;
    layout?: Partial<InvoiceTemplateConfig['layout']> & { tableOptions?: Partial<InvoiceTemplateConfig['layout']['tableOptions']> };
    content?: Partial<InvoiceTemplateConfig['content']>;
}

// --- Templates ---
const PRESETS: Record<string, PresetConfig> = {
    'Modern': {
        colors: { primary: '#0f172a', secondary: '#64748b', text: '#334155', tableHeaderBg: '#f1f5f9', tableHeaderText: '#0f172a', borderColor: '#e2e8f0', alternateRowBg: '#f8fafc' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 24, bodySize: 10 },
        layout: { 
            logoPosition: 'left', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'right', headerStyle: 'minimal', margin: 10, logoSize: 25, showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: true, bordered: false, compact: false }
        }
    },
    'Corporate': {
        colors: { primary: '#1e40af', secondary: '#475569', text: '#1e293b', tableHeaderBg: '#1e40af', tableHeaderText: '#ffffff', bannerBg: '#1e40af', bannerText: '#ffffff' },
        fonts: { titleFont: 'times', bodyFont: 'times', headerSize: 22, bodySize: 11 },
        layout: { 
            logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'banner', margin: 15, logoSize: 30, showWatermark: true, watermarkOpacity: 0.05,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: true, compact: false }
        },
        content: { showAmountInWords: true }
    },
    'Minimal': {
        colors: { primary: '#000000', secondary: '#52525b', text: '#27272a', tableHeaderBg: '#ffffff', tableHeaderText: '#000000', borderColor: '#d4d4d8' },
        fonts: { titleFont: 'courier', bodyFont: 'courier', headerSize: 20, bodySize: 9 },
        layout: { 
            logoPosition: 'right', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'left', headerStyle: 'minimal', margin: 12, logoSize: 20, showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: true }
        }
    },
    'Bold': {
        colors: { primary: '#dc2626', secondary: '#1f2937', text: '#111827', tableHeaderBg: '#dc2626', tableHeaderText: '#ffffff', bannerBg: '#dc2626', bannerText: '#ffffff' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 28, bodySize: 10 },
        layout: { 
            logoPosition: 'left', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'left', headerStyle: 'banner', margin: 10, logoSize: 35, showWatermark: true, watermarkOpacity: 0.15,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: true, bordered: true, compact: false }
        },
        content: { showStatusStamp: true }
    }
};

const defaultLabels: InvoiceLabels = {
    billedTo: "Billed To",
    invoiceNo: "Invoice No",
    date: "Date",
    item: "Item",
    qty: "Qty",
    rate: "Rate",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    gst: "GST",
    grandTotal: "Grand Total",
    paid: "Paid",
    balance: "Balance"
};

// Helper to get API Key
const getApiKey = (): string | undefined => {
  let key: string | undefined;
  try {
    // @ts-ignore
    if (import.meta.env) {
        // @ts-ignore
        if (import.meta.env.VITE_API_KEY) key = import.meta.env.VITE_API_KEY;
        // @ts-ignore
        else if (import.meta.env.API_KEY) key = import.meta.env.API_KEY;
    }
  } catch (e) {}
  if (!key && typeof process !== 'undefined' && process.env) {
    if (process.env.API_KEY) key = process.env.API_KEY;
    else if (process.env.VITE_API_KEY) key = process.env.VITE_API_KEY;
  }
  return key;
};

const InvoiceDesigner: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('INVOICE');

    // Safe defaults
    const defaults: InvoiceTemplateConfig = {
        id: 'invoiceTemplateConfig',
        currencySymbol: '₹',
        dateFormat: 'DD/MM/YYYY',
        colors: { 
            primary: '#0d9488', secondary: '#333333', text: '#000000', 
            tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff',
            bannerBg: '#0d9488', bannerText: '#ffffff',
            footerBg: '#f3f4f6', footerText: '#374151',
            borderColor: '#e5e7eb', alternateRowBg: '#f9fafb'
        },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { 
            margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', 
            headerStyle: 'standard', footerStyle: 'standard',
            showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false }
        },
        content: { 
            titleText: 'TAX INVOICE', 
            showTerms: true, 
            showQr: true, 
            termsText: '', 
            footerText: 'Thank you for your business!',
            showBusinessDetails: true,
            showCustomerDetails: true,
            showSignature: true,
            signatureText: 'Authorized Signatory',
            showAmountInWords: false,
            showStatusStamp: false,
            showTaxBreakdown: false,
            showGst: true,
            labels: defaultLabels,
            qrType: 'INVOICE_ID',
            bankDetails: ''
        }
    };

    const [config, setConfig] = useState<InvoiceTemplateConfig>(defaults);
    const [activeTab, setActiveTab] = useState<'layout' | 'colors' | 'fonts' | 'content' | 'labels'>('layout');
    const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isAiGenerating, setIsAiGenerating] = useState(false);
    const [colorPickerTarget, setColorPickerTarget] = useState<keyof InvoiceTemplateConfig['colors'] | null>(null);
    
    // New States for AI Features
    const [themeDescription, setThemeDescription] = useState('');
    const [targetLanguage, setTargetLanguage] = useState('Telugu');
    
    // Resize Logic States
    const [sidebarWidth, setSidebarWidth] = useState(380);
    const [isResizing, setIsResizing] = useState(false);
    const [isMd, setIsMd] = useState(typeof window !== 'undefined' ? window.innerWidth >= 768 : true);
    
    const fontInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // Detect screen size for conditional rendering of resize logic
    useEffect(() => {
        const handleResize = () => setIsMd(window.innerWidth >= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load correct template from state when doc type changes
    useEffect(() => {
        let sourceConfig = state.invoiceTemplate;
        if (selectedDocType === 'ESTIMATE') sourceConfig = state.estimateTemplate;
        if (selectedDocType === 'DEBIT_NOTE') sourceConfig = state.debitNoteTemplate;
        if (selectedDocType === 'RECEIPT') sourceConfig = state.receiptTemplate;

        // Deep merge with defaults to ensure safety
        setConfig({
            ...defaults,
            ...sourceConfig,
            id: sourceConfig?.id || defaults.id,
            colors: { ...defaults.colors, ...sourceConfig?.colors },
            fonts: { ...defaults.fonts, ...sourceConfig?.fonts },
            layout: { 
                ...defaults.layout, 
                ...sourceConfig?.layout,
                tableOptions: { ...defaults.layout.tableOptions, ...sourceConfig?.layout?.tableOptions }
            },
            content: { 
                ...defaults.content, 
                ...sourceConfig?.content,
                labels: { ...defaultLabels, ...sourceConfig?.content.labels }
            },
            currencySymbol: sourceConfig?.currencySymbol || defaults.currencySymbol,
            dateFormat: sourceConfig?.dateFormat || defaults.dateFormat
        });
    }, [selectedDocType, state.invoiceTemplate, state.estimateTemplate, state.debitNoteTemplate, state.receiptTemplate]);

    // Debounce PDF generation
    useEffect(() => {
        setIsGenerating(true);
        const timer = setTimeout(() => {
            generatePreview();
        }, 800);
        return () => clearTimeout(timer);
    }, [config, selectedDocType, state.customFonts]);

    // Resize Handlers
    const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (e.type === 'mousedown') {
            e.preventDefault(); // Prevent text selection on mouse
        }
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback(
        (e: MouseEvent | TouchEvent) => {
            if (isResizing) {
                let clientX;
                if ('touches' in e) {
                    clientX = e.touches[0].clientX;
                } else {
                    clientX = (e as MouseEvent).clientX;
                }
                
                // Account for typical padding/margins (approx 16px in layout)
                const newWidth = clientX - 16; 
                const constrainedWidth = Math.max(300, Math.min(newWidth, window.innerWidth * 0.7));
                setSidebarWidth(constrainedWidth);
            }
        },
        [isResizing]
    );

    useEffect(() => {
        if (isResizing) {
            window.addEventListener("mousemove", resize);
            window.addEventListener("mouseup", stopResizing);
            window.addEventListener("touchmove", resize);
            window.addEventListener("touchend", stopResizing);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        } else {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
            window.removeEventListener("touchmove", resize);
            window.removeEventListener("touchend", stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
        return () => {
            window.removeEventListener("mousemove", resize);
            window.removeEventListener("mouseup", stopResizing);
            window.removeEventListener("touchmove", resize);
            window.removeEventListener("touchend", stopResizing);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isResizing, resize, stopResizing]);

    const generatePreview = async () => {
        try {
            let doc;
            const fonts = state.customFonts;
            if (selectedDocType === 'INVOICE') {
                doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, config, fonts);
            } else if (selectedDocType === 'ESTIMATE') {
                doc = await generateEstimatePDF(dummyQuote, dummyCustomer, state.profile, config, fonts);
            } else if (selectedDocType === 'DEBIT_NOTE') {
                doc = await generateDebitNotePDF(dummyReturn, dummySupplier, state.profile, config, fonts);
            } else if (selectedDocType === 'RECEIPT') {
                doc = await generateThermalInvoicePDF(dummySale, dummyCustomer, state.profile, config, fonts);
            }
            
            if (doc) {
                const blobUrl = doc.output('bloburl');
                setPdfUrl(blobUrl);
            }
        } catch (e) {
            console.error("Preview generation failed", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        dispatch({ type: 'SET_DOCUMENT_TEMPLATE', payload: { type: selectedDocType, config } });
        showToast(`${selectedDocType} template saved successfully!`);
    };

    const handleReset = () => {
        if (window.confirm("Reset to default settings?")) {
            setConfig({ ...defaults, id: config.id });
        }
    };

    const updateConfig = (section: keyof InvoiceTemplateConfig | 'root', key: string, value: any) => {
        if (section === 'root') {
            setConfig(prev => ({ ...prev, [key]: value }));
        } else {
            setConfig(prev => ({
                ...prev,
                [section]: {
                    ...(prev[section] as any),
                    [key]: value
                }
            }));
        }
    };
    
    const updateTableOption = (key: string, value: boolean) => {
        setConfig(prev => ({
            ...prev,
            layout: {
                ...prev.layout,
                tableOptions: {
                    ...prev.layout.tableOptions,
                    [key]: value
                }
            }
        }));
    };
    
    const updateLabel = (key: keyof InvoiceLabels, value: string) => {
        setConfig(prev => ({
            ...prev,
            content: {
                ...prev.content,
                labels: {
                    ...defaultLabels,
                    ...prev.content.labels,
                    [key]: value
                }
            }
        }));
    };

    const applyPreset = (name: string) => {
        const preset = PRESETS[name];
        if (preset) {
            setConfig(prev => ({
                ...prev,
                colors: { ...prev.colors, ...preset.colors },
                fonts: { ...prev.fonts, ...preset.fonts },
                layout: { ...prev.layout, ...preset.layout, tableOptions: { ...prev.layout.tableOptions, ...preset.layout?.tableOptions } },
                content: { ...prev.content, ...preset.content }
            }));
            showToast(`Applied ${name} style`);
        }
    };

    const extractBrandColor = async () => {
        if (state.profile?.logo) {
            showToast("Analyzing logo colors...", "info");
            try {
                const dominant = await extractDominantColor(state.profile.logo);
                if (dominant) {
                    setConfig(prev => ({
                        ...prev,
                        colors: {
                            ...prev.colors,
                            primary: dominant,
                            tableHeaderBg: dominant,
                            tableHeaderText: '#ffffff',
                            bannerBg: dominant
                        }
                    }));
                    showToast("Brand colors applied from Logo!");
                }
            } catch (e) {
                showToast("Could not extract colors from logo", "error");
            }
        } else {
            showToast("Please upload a logo in Business Profile first.", "info");
        }
    };

    const generateWithAI = async (action: 'terms' | 'footer' | 'theme' | 'translate') => {
        const apiKey = getApiKey();
        if (!apiKey) {
            showToast("API Key not configured for AI features.", "error");
            return;
        }

        setIsAiGenerating(true);
        try {
            const ai = new GoogleGenAI({ apiKey });
            const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
            
            const businessType = state.profile?.name || "Retail Business";
            let prompt = "";
            
            if (action === 'terms') {
                prompt = `Write professional, short Terms & Conditions (max 3 bullet points) for a ${businessType}. Focus on payment due, returns policy, and warranty. Return ONLY the text without markdown.`;
            } else if (action === 'footer') {
                prompt = `Write a short, professional footer note (max 1 sentence) for an invoice for ${businessType}, thanking the customer. Return ONLY the text.`;
            } else if (action === 'theme') {
                prompt = `Generate a JSON object with 3 fields: 'primary' (hex color), 'secondary' (hex color), 'font' (one of 'helvetica', 'times', 'courier') that matches the vibe of this business description: "${themeDescription || businessType}". Return ONLY valid JSON.`;
            } else if (action === 'translate') {
                const currentLabels = JSON.stringify(config.content.labels || defaultLabels);
                prompt = `Translate these invoice labels to ${targetLanguage}. Return ONLY a valid JSON object with the same keys: ${currentLabels}`;
            }

            const result = await model.generateContent(prompt);
            const response = result.text().replace(/```json|```/g, '').trim();

            if (action === 'terms') {
                updateConfig('content', 'termsText', response);
            } else if (action === 'footer') {
                updateConfig('content', 'footerText', response);
            } else if (action === 'theme') {
                try {
                    const theme = JSON.parse(response);
                    setConfig(prev => ({
                        ...prev,
                        colors: { ...prev.colors, primary: theme.primary, tableHeaderBg: theme.primary, secondary: theme.secondary, bannerBg: theme.primary },
                        fonts: { ...prev.fonts, titleFont: theme.font }
                    }));
                    showToast("Theme generated!");
                } catch(e) { console.error(e); showToast("Failed to parse AI Theme", 'error'); }
            } else if (action === 'translate') {
                try {
                    const translated = JSON.parse(response);
                    setConfig(prev => ({
                        ...prev,
                        content: { ...prev.content, labels: { ...defaultLabels, ...translated } }
                    }));
                    showToast("Translation applied!");
                } catch(e) { console.error(e); showToast("Failed to parse translation", 'error'); }
            }
            
            if (['terms', 'footer'].includes(action)) showToast("Generated with AI!");

        } catch (e) {
            console.error("AI Error", e);
            showToast("AI Generation Failed. Check internet/key.", "error");
        } finally {
            setIsAiGenerating(false);
        }
    };

    const handleOpenPdf = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };
    
    const handleFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!file.name.toLowerCase().endsWith('.ttf')) {
            showToast("Only .ttf font files are supported.", 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
            const result = evt.target?.result;
            if (typeof result === 'string') {
                const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, "");
                dispatch({ type: 'ADD_CUSTOM_FONT', payload: { id: `FONT-${Date.now()}`, name: fontName, data: result } });
                showToast(`Font "${fontName}" added!`);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = ''; 
    };

    const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            try {
                const base64 = await compressImage(e.target.files[0], 300, 0.8);
                updateConfig('content', 'signatureImage', base64);
                showToast("Signature uploaded!");
            } catch (e) { showToast("Failed to upload image", 'error'); }
        }
    };

    const handleDeleteFont = (id: string) => {
        if (window.confirm("Delete this custom font?")) {
            dispatch({ type: 'REMOVE_CUSTOM_FONT', payload: id });
        }
    };

    const handleExportTemplate = () => {
        const dataStr = JSON.stringify(config, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedDocType}_Template_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const imported = JSON.parse(evt.target?.result as string);
                // Basic validation
                if (imported && imported.layout && imported.content) {
                    setConfig(prev => ({ ...prev, ...imported, id: prev.id }));
                    showToast("Template imported successfully!");
                } else {
                    showToast("Invalid template file.", 'error');
                }
            } catch (e) {
                showToast("Failed to parse template.", 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };

    return (
        <div className="h-full w-full flex flex-col md:flex-row overflow-hidden relative">
            
            {/* Mobile View Switcher */}
            <div className="md:hidden flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border dark:border-slate-700 mb-2">
                <button onClick={() => setMobileView('editor')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'editor' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Edit3 size={16} /> Editor</button>
                <button onClick={() => setMobileView('preview')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Eye size={16} /> Preview</button>
            </div>

            {/* Left Control Panel */}
            <div 
                style={isMd ? { width: sidebarWidth } : {}}
                className={`flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${mobileView === 'editor' ? 'flex flex-grow w-full' : 'hidden md:flex'} shrink-0`}
            >
                
                {/* Document Type Selector */}
                <div className="p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <div className="mb-3">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Document Type</label>
                        <div className="relative">
                            <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value as DocumentType)} className="w-full p-2 pr-8 border rounded-lg appearance-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold focus:ring-2 focus:ring-primary outline-none">
                                <option value="INVOICE">Sales Invoice</option>
                                <option value="RECEIPT">Thermal Receipt</option>
                                <option value="ESTIMATE">Estimate / Quotation</option>
                                <option value="DEBIT_NOTE">Debit Note (Returns)</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg text-primary">Designer</h2>
                        <div className="flex gap-2">
                            <button onClick={handleReset} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500" title="Reset Default"><RotateCcw size={18} /></button>
                            <Button onClick={handleSave} className="h-8 px-3 text-xs"><Save size={14} className="mr-1" /> Save</Button>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <Button onClick={handleExportTemplate} variant="secondary" className="h-7 px-2 text-[10px] w-1/2"><Download size={12} className="mr-1"/> Export</Button>
                        <Button onClick={() => importInputRef.current?.click()} variant="secondary" className="h-7 px-2 text-[10px] w-1/2"><FileUp size={12} className="mr-1"/> Import</Button>
                        <input type="file" accept=".json" ref={importInputRef} className="hidden" onChange={handleImportTemplate} />
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-slate-700 overflow-x-auto shrink-0 scrollbar-hide">
                    {['layout', 'colors', 'fonts', 'content', 'labels'].map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab as any)} className={`flex-1 py-3 px-4 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 capitalize ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                            {tab === 'labels' ? <Languages size={16}/> : tab === 'layout' ? <Layout size={16}/> : tab === 'colors' ? <Palette size={16}/> : tab === 'fonts' ? <Type size={16}/> : <FileText size={16}/>}
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Controls Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar pb-20 md:pb-4">
                    {activeTab === 'layout' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><Grid size={12}/> Instant Templates</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(PRESETS).map(name => (
                                        <button key={name} onClick={() => applyPreset(name)} className="p-2 border rounded-lg text-xs font-medium hover:bg-primary/5 hover:border-primary transition-colors dark:border-slate-600 dark:text-slate-200">{name}</button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="border-t dark:border-slate-700 pt-4 space-y-3">
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Header Style</label>
                                    <div className="flex rounded-md shadow-sm" role="group">
                                        {['standard', 'banner', 'minimal'].map((style) => (
                                            <button key={style} onClick={() => updateConfig('layout', 'headerStyle', style)} className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.headerStyle === style ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}>{style}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Footer Style</label>
                                    <div className="flex rounded-md shadow-sm" role="group">
                                        {['standard', 'banner'].map((style) => (
                                            <button key={style} onClick={() => updateConfig('layout', 'footerStyle', style)} className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.footerStyle === style ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}>{style}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="border-t dark:border-slate-700 pt-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Page Margin (mm): {config.layout.margin}</label>
                                        <input type="range" min="1" max="30" value={config.layout.margin} onChange={(e) => updateConfig('layout', 'margin', parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Size (mm): {config.layout.logoSize}</label>
                                        <input type="range" min="5" max={60} value={config.layout.logoSize} onChange={(e) => updateConfig('layout', 'logoSize', parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo X Offset (mm): {config.layout.logoOffsetX || 0}</label>
                                        <input type="range" min="-50" max="50" value={config.layout.logoOffsetX || 0} onChange={(e) => updateConfig('layout', 'logoOffsetX', parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Y Offset (mm): {config.layout.logoOffsetY || 0}</label>
                                        <input type="range" min="-20" max="50" value={config.layout.logoOffsetY || 0} onChange={(e) => updateConfig('layout', 'logoOffsetY', parseInt(e.target.value))} className="w-full" />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Header Align</label>
                                    <div className="flex rounded-md shadow-sm" role="group">
                                        {['left', 'center', 'right'].map((align) => (
                                            <button key={align} onClick={() => updateConfig('layout', 'headerAlignment', align)} className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.headerAlignment === align ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}>{align}</button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Position</label>
                                    <div className="flex rounded-md shadow-sm" role="group">
                                        {['left', 'center', 'right'].map((pos) => (
                                            <button key={pos} onClick={() => updateConfig('layout', 'logoPosition', pos)} className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.logoPosition === pos ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}>{pos}</button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="border-t dark:border-slate-700 pt-4">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Table Options</label>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.layout.tableOptions?.hideQty} onChange={(e) => updateTableOption('hideQty', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hide Quantity Column</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.layout.tableOptions?.hideRate} onChange={(e) => updateTableOption('hideRate', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Hide Rate Column</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.layout.tableOptions?.stripedRows} onChange={(e) => updateTableOption('stripedRows', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Striped Table Rows</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.layout.tableOptions?.bordered} onChange={(e) => updateTableOption('bordered', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Table Borders</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={config.layout.tableOptions?.compact} onChange={(e) => updateTableOption('compact', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Compact Padding</span>
                                    </label>
                                </div>
                            </div>

                            <div className="border-t dark:border-slate-700 pt-4">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" checked={config.layout.showWatermark} onChange={(e) => updateConfig('layout', 'showWatermark', e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Watermark</span>
                                </label>
                                {config.layout.showWatermark && (
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Watermark Opacity</label>
                                        <input 
                                            type="range" 
                                            min="0.05" 
                                            max="0.5" 
                                            step="0.05"
                                            value={config.layout.watermarkOpacity || 0.1} 
                                            onChange={(e) => updateConfig('layout', 'watermarkOpacity', parseFloat(e.target.value))} 
                                            className="w-full" 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'colors' && (
                        <div className="space-y-4">
                            <Button onClick={extractBrandColor} variant="secondary" className="w-full mb-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 border-indigo-200 dark:from-indigo-900/20 dark:to-purple-900/20 dark:border-indigo-800">
                                <Wand2 size={16} className="mr-2 text-indigo-600 dark:text-indigo-400" /> <span className="text-indigo-700 dark:text-indigo-300">Auto-Brand from Logo</span>
                            </Button>
                            
                            <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                                <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 mb-1 flex items-center gap-1"><Sparkles size={12}/> AI Magic Theme</label>
                                <div className="flex gap-2">
                                    <input type="text" placeholder="e.g. Luxury Gold Jewelry" value={themeDescription} onChange={(e) => setThemeDescription(e.target.value)} className="flex-grow p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white" />
                                    <button onClick={() => generateWithAI('theme')} disabled={isAiGenerating} className="bg-indigo-600 text-white p-1.5 rounded text-xs hover:bg-indigo-700 disabled:opacity-50">Go</button>
                                </div>
                            </div>

                            {Object.entries({ 
                                primary: "Primary Brand Color", 
                                secondary: "Secondary Text", 
                                text: "Body Text", 
                                tableHeaderBg: "Table Header Background", 
                                tableHeaderText: "Table Header Text",
                                bannerBg: "Banner Background (If Used)",
                                bannerText: "Banner Text (If Used)",
                                footerBg: "Footer Background (If Used)",
                                footerText: "Footer Text (If Used)",
                                borderColor: "Border Color",
                                alternateRowBg: "Alternate Row Background"
                            }).map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                                    <button onClick={() => setColorPickerTarget(key as any)} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: (config.colors as any)[key] }} />
                                </div>
                            ))}
                            <ColorPickerModal isOpen={!!colorPickerTarget} onClose={() => setColorPickerTarget(null)} initialColor={colorPickerTarget ? (config.colors as any)[colorPickerTarget] : '#000000'} onChange={(color) => { if (colorPickerTarget) updateConfig('colors', colorPickerTarget, color); }} />
                        </div>
                    )}

                    {activeTab === 'fonts' && (
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Heading Font</label>
                                    <select value={config.fonts.titleFont} onChange={(e) => updateConfig('fonts', 'titleFont', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                        <option value="helvetica">Helvetica (Clean)</option><option value="times">Times New Roman (Serif)</option><option value="courier">Courier (Monospace)</option>
                                        {state.customFonts.map(font => <option key={font.id} value={font.name}>{font.name} (Custom)</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Body Font</label>
                                    <select value={config.fonts.bodyFont} onChange={(e) => updateConfig('fonts', 'bodyFont', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                        <option value="helvetica">Helvetica (Clean)</option><option value="times">Times New Roman (Serif)</option><option value="courier">Courier (Monospace)</option>
                                        {state.customFonts.map(font => <option key={font.id} value={font.name}>{font.name} (Custom)</option>)}
                                    </select>
                                </div>
                                <div><label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Header Size: {config.fonts.headerSize}pt</label><input type="range" min="10" max="36" value={config.fonts.headerSize} onChange={(e) => updateConfig('fonts', 'headerSize', parseInt(e.target.value))} className="w-full" /></div>
                                <div><label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Body Size: {config.fonts.bodySize}pt</label><input type="range" min="6" max="14" value={config.fonts.bodySize} onChange={(e) => updateConfig('fonts', 'bodySize', parseInt(e.target.value))} className="w-full" /></div>
                            </div>
                            <div className="pt-4 border-t border-gray-200 dark:border-slate-700">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Custom Fonts</label>
                                <div className="space-y-2 mb-3">
                                    {state.customFonts.map(font => (
                                        <div key={font.id} className="flex justify-between items-center bg-gray-50 dark:bg-slate-700/50 p-2 rounded border dark:border-slate-600">
                                            <span className="text-sm font-medium dark:text-gray-200">{font.name}</span>
                                            <button onClick={() => handleDeleteFont(font.id)} className="text-red-500 hover:text-red-700"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                                <input type="file" accept=".ttf" ref={fontInputRef} className="hidden" onChange={handleFontUpload} />
                                <Button onClick={() => fontInputRef.current?.click()} variant="secondary" className="w-full text-xs"><Upload size={14} className="mr-2"/> Upload Font (.ttf)</Button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <div><label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Document Title</label><input type="text" value={config.content.titleText} onChange={(e) => updateConfig('content', 'titleText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" /></div>
                            
                            {/* Localization Settings */}
                            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700 space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-500 mb-1 block">Regional Settings</label>
                                <div className="flex gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500">Currency</label>
                                        <input type="text" value={config.currencySymbol} onChange={(e) => updateConfig('root', 'currencySymbol', e.target.value)} className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="₹" />
                                    </div>
                                    <div className="flex-[2]">
                                        <label className="text-xs text-gray-500">Date Format</label>
                                        <select value={config.dateFormat} onChange={(e) => updateConfig('root', 'dateFormat', e.target.value)} className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white">
                                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                {['showBusinessDetails', 'showCustomerDetails', 'showQr', 'showTerms', 'showSignature'].map(key => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={(config.content as any)[key] ?? true} onChange={(e) => updateConfig('content', key, e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </label>
                                ))}
                            </div>
                            
                            {/* New Toggles */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t dark:border-slate-700">
                                <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <input type="checkbox" checked={config.content.showAmountInWords ?? false} onChange={(e) => updateConfig('content', 'showAmountInWords', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"><Banknote size={16} className="text-green-600"/> Amount In Words</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <input type="checkbox" checked={config.content.showStatusStamp ?? false} onChange={(e) => updateConfig('content', 'showStatusStamp', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"><Stamp size={16} className="text-red-600"/> PAID/DUE Stamp</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <input type="checkbox" checked={config.content.showTaxBreakdown ?? false} onChange={(e) => updateConfig('content', 'showTaxBreakdown', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"><TableProperties size={16} className="text-blue-600"/> Tax Breakdown Table</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer p-2 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <input type="checkbox" checked={config.content.showGst !== false} onChange={(e) => updateConfig('content', 'showGst', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2"><EyeOff size={16} className="text-gray-600"/> Show GST in Totals</span>
                                </label>
                            </div>

                            {/* QR Configuration */}
                            {config.content.showQr && (
                                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-2 block flex items-center gap-1"><QrCode size={12}/> QR Code Type</label>
                                    <div className="flex gap-2 mb-2">
                                        <button 
                                            onClick={() => updateConfig('content', 'qrType', 'INVOICE_ID')}
                                            className={`flex-1 text-xs py-1.5 rounded border ${config.content.qrType === 'INVOICE_ID' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'}`}
                                        >
                                            Invoice ID
                                        </button>
                                        <button 
                                            onClick={() => updateConfig('content', 'qrType', 'UPI_PAYMENT')}
                                            className={`flex-1 text-xs py-1.5 rounded border ${config.content.qrType === 'UPI_PAYMENT' ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600'}`}
                                        >
                                            UPI Payment
                                        </button>
                                    </div>
                                    
                                    {config.content.qrType === 'UPI_PAYMENT' && (
                                        <div className="space-y-2 animate-fade-in-fast">
                                            <div>
                                                <label className="text-xs text-gray-500">UPI ID (VPA)</label>
                                                <input type="text" value={config.content.upiId || ''} onChange={(e) => updateConfig('content', 'upiId', e.target.value)} placeholder="e.g. business@upi" className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500">Payee Name</label>
                                                <input type="text" value={config.content.payeeName || ''} onChange={(e) => updateConfig('content', 'payeeName', e.target.value)} placeholder="Your Name" className="w-full p-1.5 text-sm border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Bank Details */}
                            <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">Bank Details Section</label>
                                <textarea 
                                    rows={3} 
                                    value={config.content.bankDetails || ''} 
                                    onChange={(e) => updateConfig('content', 'bankDetails', e.target.value)} 
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white text-sm" 
                                    placeholder="Bank Name: HDFC&#10;A/C No: 1234567890&#10;IFSC: HDFC0001234" 
                                />
                            </div>

                            {config.content.showSignature && (
                                <div className="p-3 bg-gray-50 dark:bg-slate-800 rounded border dark:border-slate-700">
                                    <label className="text-xs font-bold uppercase text-gray-500 mb-2 block">Signature Options</label>
                                    <input type="text" value={config.content.signatureText || ''} onChange={(e) => updateConfig('content', 'signatureText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white mb-2" placeholder="Authorized Signatory" />
                                    
                                    <div className="flex items-center gap-2">
                                        <input type="file" accept="image/*" ref={signatureInputRef} className="hidden" onChange={handleSignatureUpload} />
                                        <Button onClick={() => signatureInputRef.current?.click()} variant="secondary" className="w-full text-xs"><PenTool size={14} className="mr-2"/> {config.content.signatureImage ? 'Change Signature Image' : 'Upload Signature Image'}</Button>
                                        {config.content.signatureImage && <button onClick={() => updateConfig('content', 'signatureImage', undefined)} className="p-2 text-red-500 bg-white border rounded hover:bg-red-50"><Trash2 size={14}/></button>}
                                    </div>
                                </div>
                            )}

                            {config.content.showTerms && (
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Terms Text</label>
                                        <button onClick={() => generateWithAI('terms')} disabled={isAiGenerating} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"><Sparkles size={12} /> {isAiGenerating ? 'Writing...' : 'Write with AI'}</button>
                                    </div>
                                    <textarea rows={3} value={config.content.termsText} onChange={(e) => updateConfig('content', 'termsText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" placeholder="e.g. No returns..." />
                                </div>
                            )}
                            
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Footer Message</label>
                                    <button onClick={() => generateWithAI('footer')} disabled={isAiGenerating} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"><Sparkles size={12} /> {isAiGenerating ? 'Writing...' : 'Write with AI'}</button>
                                </div>
                                <input type="text" value={config.content.footerText} onChange={(e) => updateConfig('content', 'footerText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                            </div>
                        </div>
                    )}

                    {activeTab === 'labels' && (
                        <div className="space-y-4">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <label className="text-xs font-bold text-blue-800 dark:text-blue-300 mb-1 flex items-center gap-1"><Languages size={12}/> AI Translate Labels</label>
                                <div className="flex gap-2">
                                    <select value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)} className="flex-grow p-1.5 text-xs border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
                                        <option value="Telugu">Telugu</option><option value="Hindi">Hindi</option><option value="Tamil">Tamil</option><option value="Kannada">Kannada</option><option value="Malayalam">Malayalam</option><option value="Marathi">Marathi</option><option value="Gujarati">Gujarati</option><option value="Bengali">Bengali</option><option value="Spanish">Spanish</option><option value="French">French</option>
                                    </select>
                                    <button onClick={() => generateWithAI('translate')} disabled={isAiGenerating} className="bg-blue-600 text-white p-1.5 rounded text-xs hover:bg-blue-700 disabled:opacity-50">Translate</button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(config.content.labels || defaultLabels).map(([key, val]) => (
                                    <div key={key}>
                                        <label className="text-xs text-gray-500 dark:text-gray-400 capitalize block mb-1">{key.replace(/([A-Z])/g, ' $1')}</label>
                                        <input 
                                            type="text" 
                                            value={val} 
                                            onChange={(e) => updateLabel(key as any, e.target.value)} 
                                            className="w-full p-2 border rounded text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Resize Handle - Only Visible on MD+ */}
            <div
                className="hidden md:flex w-4 cursor-col-resize items-center justify-center hover:bg-indigo-500/10 active:bg-indigo-500/20 transition-colors z-20 shrink-0 select-none touch-none"
                onMouseDown={startResizing}
                onTouchStart={startResizing}
            >
                <div className={`w-1 h-12 rounded-full transition-colors ${isResizing ? 'bg-indigo-500' : 'bg-gray-300 dark:bg-slate-600'}`}></div>
            </div>

            {/* Right Preview Panel */}
            <div className={`flex-grow bg-gray-200 dark:bg-slate-900 rounded-xl border border-gray-300 dark:border-slate-700 flex-col relative overflow-hidden ${mobileView === 'preview' ? 'flex' : 'hidden md:flex'} ${isResizing ? 'pointer-events-none' : ''}`}>
                <div className="absolute top-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-2 flex justify-between items-center border-b border-gray-200 dark:border-slate-700 z-10">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview: {selectedDocType.replace('_', ' ')}</span>
                    {isGenerating ? <span className="text-xs text-primary flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Updating...</span> : <span className="text-xs text-green-600 flex items-center gap-1"><Eye size={12} /> Ready</span>}
                </div>
                
                <div className="flex-grow flex flex-col items-center justify-center p-2 sm:p-8 overflow-auto bg-gray-200 dark:bg-slate-900 relative">
                    {/* Desktop: PDF Overlay Button */}
                    <div className="hidden md:block absolute z-20 bottom-4 left-1/2 transform -translate-x-1/2 w-auto">
                        <Button onClick={handleOpenPdf} className="shadow-xl bg-indigo-600 hover:bg-indigo-700 rounded-full px-6"><ExternalLink size={16} className="mr-2" /> Open PDF</Button>
                    </div>

                    {/* Mobile: Dedicated Download Card */}
                    <div className="md:hidden flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-center max-w-[80%]">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4"><FileText size={32} className="text-red-600" /></div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">PDF Ready</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Inline PDF preview is not supported on mobile devices.</p>
                        <Button onClick={handleOpenPdf} className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md"><ExternalLink size={16} className="mr-2" /> Open PDF</Button>
                    </div>

                    {pdfUrl ? (
                        <object data={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} type="application/pdf" className="hidden md:block w-full h-full max-w-[210mm] shadow-2xl rounded-sm bg-white min-h-[400px]">
                            <div className="flex flex-col items-center justify-center h-full bg-white p-4 text-center text-gray-500"><p className="mb-2">Preview not supported.</p></div>
                        </object>
                    ) : (
                        <div className="hidden md:flex text-gray-400 flex-col items-center"><RefreshCw size={40} className="animate-spin mb-2" /><p>Generating Preview...</p></div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoiceDesigner;
