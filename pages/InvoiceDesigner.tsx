
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Image as ImageIcon, RefreshCw, Eye, Edit3, ExternalLink, ChevronDown, Upload, Trash2, Wand2, Sparkles, Grid, Languages, PenTool } from 'lucide-react';
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
        { productId: 'P1', productName: 'Premium Silk Saree', quantity: 2, price: 4500 },
        { productId: 'P2', productName: 'Cotton Kurti', quantity: 5, price: 850 },
        { productId: 'P3', productName: 'Designer Blouse', quantity: 3, price: 1200 }
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

// --- Templates ---
const PRESETS: Record<string, Partial<InvoiceTemplateConfig>> = {
    'Modern': {
        colors: { primary: '#0f172a', secondary: '#64748b', text: '#334155', tableHeaderBg: '#f1f5f9', tableHeaderText: '#0f172a' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 24, bodySize: 10 },
        layout: { logoPosition: 'left', headerAlignment: 'right', margin: 10, logoSize: 25, showWatermark: false }
    },
    'Corporate': {
        colors: { primary: '#1e40af', secondary: '#475569', text: '#1e293b', tableHeaderBg: '#1e40af', tableHeaderText: '#ffffff' },
        fonts: { titleFont: 'times', bodyFont: 'times', headerSize: 22, bodySize: 11 },
        layout: { logoPosition: 'center', headerAlignment: 'center', margin: 15, logoSize: 30, showWatermark: true }
    },
    'Minimal': {
        colors: { primary: '#000000', secondary: '#52525b', text: '#27272a', tableHeaderBg: '#ffffff', tableHeaderText: '#000000' },
        fonts: { titleFont: 'courier', bodyFont: 'courier', headerSize: 20, bodySize: 9 },
        layout: { logoPosition: 'right', headerAlignment: 'left', margin: 12, logoSize: 20, showWatermark: false }
    },
    'Bold': {
        colors: { primary: '#dc2626', secondary: '#1f2937', text: '#111827', tableHeaderBg: '#dc2626', tableHeaderText: '#ffffff' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 28, bodySize: 10 },
        layout: { logoPosition: 'left', headerAlignment: 'left', margin: 10, logoSize: 35, showWatermark: true }
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
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { margin: 10, logoSize: 25, logoPosition: 'center', headerAlignment: 'center', showWatermark: false },
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
            labels: defaultLabels
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
    
    const fontInputRef = useRef<HTMLInputElement>(null);
    const signatureInputRef = useRef<HTMLInputElement>(null);

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
            layout: { ...defaults.layout, ...sourceConfig?.layout },
            content: { 
                ...defaults.content, 
                ...sourceConfig?.content,
                labels: { ...defaultLabels, ...sourceConfig?.content.labels }
            },
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

    const updateConfig = (section: keyof InvoiceTemplateConfig, key: string, value: any) => {
        setConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
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
                layout: { ...prev.layout, ...preset.layout }
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
                            tableHeaderText: '#ffffff'
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
                        colors: { ...prev.colors, primary: theme.primary, tableHeaderBg: theme.primary, secondary: theme.secondary },
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

    return (
        <div className="h-full w-full flex flex-col md:flex-row gap-4 overflow-hidden relative">
            
            {/* Mobile View Switcher */}
            <div className="md:hidden flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border dark:border-slate-700 mb-2">
                <button onClick={() => setMobileView('editor')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'editor' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Edit3 size={16} /> Editor</button>
                <button onClick={() => setMobileView('preview')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Eye size={16} /> Preview</button>
            </div>

            {/* Left Control Panel */}
            <div className={`w-full md:w-1/3 lg:w-1/4 flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${mobileView === 'editor' ? 'flex flex-grow' : 'hidden md:flex'}`}>
                
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
                            <div className="border-t dark:border-slate-700 pt-4">
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Page Margin (mm): {config.layout.margin}</label>
                                        <input type="range" min="1" max={30} value={config.layout.margin} onChange={(e) => updateConfig('layout', 'margin', parseInt(e.target.value))} className="w-full" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Size (mm): {config.layout.logoSize}</label>
                                        <input type="range" min="5" max={60} value={config.layout.logoSize} onChange={(e) => updateConfig('layout', 'logoSize', parseInt(e.target.value))} className="w-full" />
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
                            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={config.layout.showWatermark} onChange={(e) => updateConfig('layout', 'showWatermark', e.target.checked)} className="rounded text-primary focus:ring-primary"/><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Watermark</span></label>
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

                            {Object.entries({ primary: "Primary Brand Color", secondary: "Secondary Text", text: "Body Text", tableHeaderBg: "Table Header Background", tableHeaderText: "Table Header Text" }).map(([key, label]) => (
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
                            
                            <div className="space-y-2">
                                {['showBusinessDetails', 'showCustomerDetails', 'showQr', 'showTerms', 'showSignature'].map(key => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={(config.content as any)[key] ?? true} onChange={(e) => updateConfig('content', key, e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{key.replace('show', '').replace(/([A-Z])/g, ' $1').trim()}</span>
                                    </label>
                                ))}
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

            {/* Right Preview Panel */}
            <div className={`flex-grow bg-gray-200 dark:bg-slate-900 rounded-xl border border-gray-300 dark:border-slate-700 flex-col relative overflow-hidden ${mobileView === 'preview' ? 'flex' : 'hidden md:flex'}`}>
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
