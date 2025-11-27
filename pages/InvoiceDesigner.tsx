
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Edit3, ChevronDown, Upload, Trash2, Wand2, Grid, QrCode, Printer, Eye, ArrowLeft, CheckSquare, Square, Type as TypeIcon, AlignLeft, AlignCenter, AlignRight, Move, GripVertical, Layers, ArrowUp, ArrowDown, Table, Monitor, Loader2, ZoomIn, ZoomOut, ExternalLink, Columns } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { InvoiceTemplateConfig, DocumentType, InvoiceLabels, CustomFont, ProfileData } from '../types';
import Button from '../components/Button';
import ColorPickerModal from '../components/ColorPickerModal';
import { generateA4InvoicePdf, generateEstimatePDF, generateDebitNotePDF, generateThermalInvoicePDF } from '../utils/pdfGenerator';
import { extractDominantColor } from '../utils/imageUtils';
import * as pdfjsLib from 'pdfjs-dist';
import { useDialog } from '../context/DialogContext';

// Setup PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;

// --- Dummy Data for Previews ---
const dummyCustomer = {
    id: 'CUST-001',
    name: 'John Doe Enterprises',
    phone: '9876543210',
    address: '123 Business Park, Tech City, Hyderabad, Telangana 500081',
    area: 'Tech City',
    reference: 'Walk-in'
};

const dummySale = {
    id: 'INV-2023-001',
    customerId: 'CUST-001',
    items: [
        { productId: 'P1', productName: 'Premium Silk Saree - Kanchipuram', quantity: 2, price: 4500, gstPercent: 5 },
        { productId: 'P2', productName: 'Cotton Kurti', quantity: 5, price: 850, gstPercent: 5 },
        { productId: 'P3', productName: 'Designer Blouse - Gold', quantity: 3, price: 1200, gstPercent: 12 }
    ],
    discount: 500,
    gstAmount: 1250,
    totalAmount: 16350,
    date: new Date().toISOString(),
    payments: [{ id: 'PAY-1', amount: 5000, date: new Date().toISOString(), method: 'UPI' as const }]
};

// --- Extended Configuration Interface for Local State ---
interface ExtendedLayoutConfig extends InvoiceTemplateConfig {
    layout: InvoiceTemplateConfig['layout'] & {
        sectionOrdering: string[];
        uppercaseHeadings?: boolean;
        boldBorders?: boolean;
        columnWidths?: { qty?: number; rate?: number; amount?: number; }; // Updated to match PDF generator needs
        tablePadding?: number; // mm
        tableHeaderAlign?: 'left' | 'center' | 'right';
        borderRadius?: number; // px
    };
}

// --- Templates Presets ---
const PRESETS: Record<string, any> = {
    'Modern': {
        colors: { primary: '#0f172a', secondary: '#64748b', text: '#334155', tableHeaderBg: '#f1f5f9', tableHeaderText: '#0f172a', borderColor: '#e2e8f0', alternateRowBg: '#f8fafc' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 24, bodySize: 10 },
        layout: { 
            logoPosition: 'left', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'right', headerStyle: 'minimal', margin: 10, logoSize: 25, showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: true, bordered: false, compact: false },
            sectionOrdering: ['header', 'title', 'details', 'table', 'totals', 'terms', 'signature', 'footer'],
            uppercaseHeadings: true,
            columnWidths: { qty: 15, rate: 20, amount: 35 },
            tablePadding: 3,
            borderRadius: 4
        } as any
    },
    'Corporate': {
        colors: { primary: '#1e40af', secondary: '#475569', text: '#1e293b', tableHeaderBg: '#1e40af', tableHeaderText: '#ffffff', bannerBg: '#1e40af', bannerText: '#ffffff' },
        fonts: { titleFont: 'times', bodyFont: 'times', headerSize: 22, bodySize: 11 },
        layout: { 
            logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'banner', margin: 15, logoSize: 30, showWatermark: true, watermarkOpacity: 0.05,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: true, compact: false },
            sectionOrdering: ['header', 'title', 'details', 'table', 'totals', 'terms', 'signature', 'footer'],
            uppercaseHeadings: true,
            columnWidths: { qty: 15, rate: 20, amount: 35 },
            tablePadding: 4,
            borderRadius: 0
        } as any,
        content: { showAmountInWords: true }
    },
    'Minimal': {
        colors: { primary: '#000000', secondary: '#52525b', text: '#27272a', tableHeaderBg: '#ffffff', tableHeaderText: '#000000', borderColor: '#d4d4d8' },
        fonts: { titleFont: 'courier', bodyFont: 'courier', headerSize: 20, bodySize: 9 },
        layout: { 
            logoPosition: 'right', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'left', headerStyle: 'minimal', margin: 12, logoSize: 20, showWatermark: false, watermarkOpacity: 0.1,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: true },
            sectionOrdering: ['header', 'details', 'title', 'table', 'totals', 'footer'],
            uppercaseHeadings: false,
            columnWidths: { qty: 10, rate: 20, amount: 35 },
            tablePadding: 2,
            borderRadius: 0
        } as any
    },
    'Bold': {
        colors: { primary: '#dc2626', secondary: '#1f2937', text: '#111827', tableHeaderBg: '#dc2626', tableHeaderText: '#ffffff', bannerBg: '#dc2626', bannerText: '#ffffff' },
        fonts: { titleFont: 'helvetica', bodyFont: 'helvetica', headerSize: 28, bodySize: 10 },
        layout: { 
            logoPosition: 'left', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'left', headerStyle: 'banner', margin: 10, logoSize: 35, showWatermark: true, watermarkOpacity: 0.15,
            tableOptions: { hideQty: false, hideRate: false, stripedRows: true, bordered: true, compact: false },
            sectionOrdering: ['header', 'title', 'details', 'table', 'totals', 'signature', 'footer'],
            uppercaseHeadings: true,
            columnWidths: { qty: 15, rate: 20, amount: 35 },
            tablePadding: 4,
            borderRadius: 8
        } as any,
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

// --- PDF Canvas Preview Component (PDF.js Based) ---
const PDFCanvasPreview: React.FC<{ 
    config: ExtendedLayoutConfig; 
    profile: ProfileData | null;
    docType: DocumentType;
    customFonts: CustomFont[];
}> = ({ config, profile, docType, customFonts }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const renderTaskRef = useRef<any>(null);
    const [zoomLevel, setZoomLevel] = useState(1.0);

    useEffect(() => {
        let active = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const render = async () => {
            if (!containerRef.current || !canvasRef.current) return;
            setLoading(true);
            setError(null);

            try {
                let doc;
                switch (docType) {
                    case 'INVOICE': doc = await generateA4InvoicePdf(dummySale, dummyCustomer, profile, config, customFonts); break;
                    case 'ESTIMATE': doc = await generateEstimatePDF(dummySale as any, dummyCustomer, profile, config, customFonts); break;
                    case 'DEBIT_NOTE': doc = await generateDebitNotePDF(dummySale as any, dummyCustomer as any, profile, config, customFonts); break;
                    case 'RECEIPT': doc = await generateThermalInvoicePDF(dummySale, dummyCustomer, profile, config, customFonts); break;
                    default: doc = await generateA4InvoicePdf(dummySale, dummyCustomer, profile, config, customFonts);
                }

                if (!active) return;

                const blob = doc.output('blob');
                const url = URL.createObjectURL(blob);

                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                if (!active) { URL.revokeObjectURL(url); return; }

                const containerWidth = containerRef.current.clientWidth;
                const baseViewport = page.getViewport({ scale: 1 });
                const fitScale = (containerWidth - 40) / baseViewport.width; 
                const scale = fitScale * zoomLevel;
                const viewport = page.getViewport({ scale });

                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                if (renderTaskRef.current) {
                    await renderTaskRef.current.cancel();
                }

                const renderContext = {
                    canvasContext: context!,
                    viewport: viewport,
                };
                
                renderTaskRef.current = page.render(renderContext);
                await renderTaskRef.current.promise;

                URL.revokeObjectURL(url);
            } catch (e: any) {
                if (e.name !== 'RenderingCancelledException') {
                    console.error("Preview Render Error:", e);
                    setError("Failed to render preview.");
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        timeoutId = setTimeout(render, 500); // Debounce render
        return () => {
            active = false;
            clearTimeout(timeoutId);
            if (renderTaskRef.current) renderTaskRef.current.cancel();
        };
    }, [config, profile, docType, customFonts, zoomLevel]);

    return (
        <div className="flex-1 relative h-full flex flex-col overflow-hidden min-h-0">
            <div className="flex-1 bg-gray-100 dark:bg-slate-900 p-4 md:p-8 overflow-auto flex justify-center items-start" ref={containerRef}>
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-black/50 z-10 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                )}
                {error ? (
                    <div className="text-red-500">{error}</div>
                ) : (
                    <div className="relative shadow-2xl rounded-sm overflow-hidden transition-transform duration-200 ease-out">
                        <canvas ref={canvasRef} className="bg-white block" />
                    </div>
                )}
            </div>
            {/* Fixed Zoom Controls outside scroll area */}
            <div className="absolute bottom-6 right-6 flex gap-2 bg-white/90 dark:bg-slate-800/90 p-2 rounded-full shadow-lg backdrop-blur-sm border border-gray-200 dark:border-slate-700 z-50">
                <button onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ZoomOut size={18}/></button>
                <span className="text-xs font-mono self-center w-12 text-center text-gray-700 dark:text-gray-200">{(zoomLevel * 100).toFixed(0)}%</span>
                <button onClick={() => setZoomLevel(prev => Math.min(2.0, prev + 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"><ZoomIn size={18}/></button>
            </div>
        </div>
    );
};

// --- Main Editor Component ---
interface InvoiceDesignerProps {
    setIsDirty: (isDirty: boolean) => void;
}

const InvoiceDesigner: React.FC<InvoiceDesignerProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    
    const [docType, setDocType] = useState<DocumentType>('INVOICE');
    const [activeTab, setActiveTab] = useState<'layout' | 'content' | 'branding' | 'fonts'>('layout');
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [activeColorKey, setActiveColorKey] = useState<keyof InvoiceTemplateConfig['colors'] | null>(null);
    
    // Sidebar Resizing Logic
    const [sidebarWidth, setSidebarWidth] = useState(350);
    const sidebarRef = useRef<HTMLDivElement>(null);
    const isResizing = useRef(false);

    const startResizing = (e: React.MouseEvent | React.TouchEvent) => {
        // Stop scrolling while resizing
        document.body.style.overflow = 'hidden';
        
        if ('touches' in e && e.touches.length > 0) {
            // Only start touch resize if touching the handle specifically
            const target = e.target as HTMLElement;
            if(target.closest('.resize-handle')) {
                isResizing.current = true;
            }
        } else {
            isResizing.current = true;
        }
    };

    const stopResizing = useCallback(() => {
        isResizing.current = false;
        document.body.style.overflow = '';
    }, []);

    const resize = useCallback((e: MouseEvent | TouchEvent) => {
        if (isResizing.current) {
            e.preventDefault(); // Prevent scrolling/selection
            let clientX = 0;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
            } else {
                clientX = (e as MouseEvent).clientX;
            }
            
            // Limit width
            const newWidth = Math.max(280, Math.min(clientX, 600));
            setSidebarWidth(newWidth);
        }
    }, []);

    useEffect(() => {
        // Attach global listeners for smoother drag
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        window.addEventListener('touchmove', resize, { passive: false }); // passive:false to allow preventDefault
        window.addEventListener('touchend', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
            window.removeEventListener('touchmove', resize);
            window.removeEventListener('touchend', stopResizing);
        };
    }, [resize, stopResizing]);

    const getInitialConfig = (type: DocumentType): ExtendedLayoutConfig => {
        let baseConfig: InvoiceTemplateConfig;
        switch (type) {
            case 'ESTIMATE': baseConfig = state.estimateTemplate; break;
            case 'DEBIT_NOTE': baseConfig = state.debitNoteTemplate; break;
            case 'RECEIPT': baseConfig = state.receiptTemplate; break;
            default: baseConfig = state.invoiceTemplate; break;
        }
        return {
            ...baseConfig,
            layout: {
                ...baseConfig.layout,
                sectionOrdering: ['header', 'title', 'details', 'table', 'totals', 'terms', 'signature', 'footer'],
                columnWidths: baseConfig.layout.columnWidths || { qty: 15, rate: 20, amount: 35 },
                tablePadding: 3,
                borderRadius: 4,
                uppercaseHeadings: true
            }
        };
    };

    const [localConfig, setLocalConfig] = useState<ExtendedLayoutConfig>(getInitialConfig('INVOICE'));
    
    useEffect(() => {
        setLocalConfig(getInitialConfig(docType));
    }, [docType]);

    useEffect(() => {
        // Simple dirty check (could be improved with deep compare)
        setIsDirty(true);
        return () => setIsDirty(false);
    }, [localConfig, setIsDirty]);

    const handleConfigChange = (section: keyof ExtendedLayoutConfig, key: string, value: any) => {
        setLocalConfig(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [key]: value
            }
        }));
    };

    const applyPreset = (presetName: string) => {
        const preset = PRESETS[presetName];
        if (preset) {
            setLocalConfig(prev => ({
                ...prev,
                colors: { ...prev.colors, ...preset.colors },
                fonts: { ...prev.fonts, ...preset.fonts },
                layout: { ...prev.layout, ...preset.layout },
                content: { ...prev.content, ...preset.content }
            }));
        }
    };

    const handleSave = () => {
        dispatch({ 
            type: 'SET_DOCUMENT_TEMPLATE', 
            payload: { type: docType, config: localConfig } 
        });
        showToast(`${docType} template saved successfully!`);
        setIsDirty(false);
    };

    const handleOpenPdf = async () => {
        try {
            let doc;
            switch (docType) {
                case 'INVOICE': doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                case 'ESTIMATE': doc = await generateEstimatePDF(dummySale as any, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                case 'DEBIT_NOTE': doc = await generateDebitNotePDF(dummySale as any, dummyCustomer as any, state.profile, localConfig, state.customFonts); break;
                case 'RECEIPT': doc = await generateThermalInvoicePDF(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                default: doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts);
            }
            const blob = doc.output('blob');
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error(e);
            showToast("Failed to open PDF.", "error");
        }
    };

    const handleDownloadTestPdf = async () => {
        try {
            let doc;
            switch (docType) {
                case 'INVOICE': doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                case 'ESTIMATE': doc = await generateEstimatePDF(dummySale as any, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                case 'DEBIT_NOTE': doc = await generateDebitNotePDF(dummySale as any, dummyCustomer as any, state.profile, localConfig, state.customFonts); break;
                case 'RECEIPT': doc = await generateThermalInvoicePDF(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts); break;
                default: doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, localConfig, state.customFonts);
            }
            doc.save(`Test_${docType}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF.", "error");
        }
    };

    const handleColorPick = (key: keyof InvoiceTemplateConfig['colors']) => {
        setActiveColorKey(key);
        setShowColorPicker(true);
    };

    return (
        <div className="flex h-full bg-gray-50 dark:bg-slate-950 overflow-hidden font-sans relative">
            {/* Color Picker Modal */}
            <ColorPickerModal
                isOpen={showColorPicker}
                onClose={() => setShowColorPicker(false)}
                initialColor={activeColorKey ? localConfig.colors[activeColorKey] : '#000000'}
                onChange={(color) => {
                    if (activeColorKey) {
                        handleConfigChange('colors', activeColorKey, color);
                    }
                }}
            />

            {/* Sidebar */}
            <aside 
                ref={sidebarRef}
                style={{ width: sidebarWidth }}
                className="relative bg-white dark:bg-slate-900 border-r dark:border-slate-800 flex flex-col h-full shadow-xl z-20 flex-shrink-0 transition-width duration-75 ease-out"
            >
                {/* Header */}
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-gray-50 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg">
                            <Wand2 size={18} />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-slate-800 dark:text-white">Invoice Designer</h2>
                            <p className="text-[10px] text-slate-500">Visual Editor</p>
                        </div>
                    </div>
                    <div className="flex gap-1">
                        <Button onClick={handleSave} className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 shadow-md">
                            <Save size={14} className="mr-1.5" /> Save
                        </Button>
                    </div>
                </div>

                {/* Document Type Selector */}
                <div className="px-4 py-3 border-b dark:border-slate-800">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">Document Type</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['INVOICE', 'ESTIMATE', 'DEBIT_NOTE', 'RECEIPT'].map(t => (
                            <button
                                key={t}
                                onClick={() => setDocType(t as DocumentType)}
                                className={`px-2 py-1.5 rounded text-xs font-semibold transition-all border ${docType === t ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50'}`}
                            >
                                {t.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
                    {[
                        { id: 'layout', icon: Layout, label: 'Layout' },
                        { id: 'branding', icon: Palette, label: 'Style' },
                        { id: 'content', icon: FileText, label: 'Content' },
                        { id: 'fonts', icon: Type, label: 'Text' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex-1 py-3 flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors border-b-2 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-slate-800' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-20">
                    
                    {/* LAYOUT TAB */}
                    {activeTab === 'layout' && (
                        <div className="space-y-6 animate-fade-in-fast">
                            {/* Presets */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Quick Presets</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {Object.keys(PRESETS).map(name => (
                                        <button key={name} onClick={() => applyPreset(name)} className="px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-sm transition-all text-left">
                                            {name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Header Style */}
                            <div className="space-y-3">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Header Layout</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                                    {['standard', 'banner', 'minimal'].map(s => (
                                        <button 
                                            key={s} 
                                            onClick={() => handleConfigChange('layout', 'headerStyle', s)}
                                            className={`flex-1 py-1.5 text-xs font-medium rounded capitalize ${localConfig.layout.headerStyle === s ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">Alignment</span>
                                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded">
                                        {[
                                            { v: 'left', i: AlignLeft }, 
                                            { v: 'center', i: AlignCenter }, 
                                            { v: 'right', i: AlignRight }
                                        ].map(({v, i: Icon}) => (
                                            <button 
                                                key={v} 
                                                onClick={() => handleConfigChange('layout', 'headerAlignment', v)}
                                                className={`p-1.5 rounded ${localConfig.layout.headerAlignment === v ? 'bg-white dark:bg-slate-600 shadow-sm text-indigo-600 dark:text-white' : 'text-slate-400'}`}
                                            >
                                                <Icon size={14} />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Logo Config */}
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Logo Settings</label>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-1">Size (mm)</span>
                                        <input 
                                            type="range" min="10" max="60" 
                                            value={localConfig.layout.logoSize} 
                                            onChange={e => handleConfigChange('layout', 'logoSize', parseInt(e.target.value))} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-1">Position</span>
                                        <div className="flex gap-1">
                                            {['left', 'center', 'right'].map(p => (
                                                <button 
                                                    key={p} 
                                                    onClick={() => handleConfigChange('layout', 'logoPosition', p)}
                                                    className={`flex-1 py-1 text-[10px] uppercase font-bold border rounded ${localConfig.layout.logoPosition === p ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'border-slate-200 text-slate-500'}`}
                                                >
                                                    {p[0]}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* QR Code Position */}
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase block flex items-center gap-2">
                                    <QrCode size={14} /> QR Code Position
                                </label>
                                <select 
                                    value={localConfig.layout.qrPosition || 'details-right'} 
                                    onChange={e => handleConfigChange('layout', 'qrPosition', e.target.value)}
                                    className="w-full p-2 text-xs border rounded bg-white dark:bg-slate-800 dark:border-slate-700"
                                >
                                    <option value="header-right">Header Right (Near Logo)</option>
                                    <option value="details-right">Details Section (Right)</option>
                                    <option value="footer-left">Footer Left</option>
                                    <option value="footer-right">Footer Right</option>
                                </select>
                            </div>

                            {/* Table Column Sizes (New Separate Section) */}
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase block flex items-center gap-2">
                                    <Columns size={14} /> Table Dimensions
                                </label>
                                <div className="space-y-4 bg-gray-50 dark:bg-slate-800 p-3 rounded-lg border dark:border-slate-700">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-slate-500">Qty Column Width</span>
                                            <span className="text-[10px] font-mono text-indigo-600">{localConfig.layout.columnWidths?.qty || 15}mm</span>
                                        </div>
                                        <input 
                                            type="range" min="10" max="30" 
                                            value={localConfig.layout.columnWidths?.qty || 15} 
                                            onChange={e => handleConfigChange('layout', 'columnWidths', { ...localConfig.layout.columnWidths, qty: parseInt(e.target.value) })} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-slate-500">Rate Column Width</span>
                                            <span className="text-[10px] font-mono text-indigo-600">{localConfig.layout.columnWidths?.rate || 20}mm</span>
                                        </div>
                                        <input 
                                            type="range" min="15" max="40" 
                                            value={localConfig.layout.columnWidths?.rate || 20} 
                                            onChange={e => handleConfigChange('layout', 'columnWidths', { ...localConfig.layout.columnWidths, rate: parseInt(e.target.value) })} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-slate-500">Amount Column Width</span>
                                            <span className="text-[10px] font-mono text-indigo-600">{localConfig.layout.columnWidths?.amount || 35}mm</span>
                                        </div>
                                        <input 
                                            type="range" min="20" max="50" 
                                            value={localConfig.layout.columnWidths?.amount || 35} 
                                            onChange={e => handleConfigChange('layout', 'columnWidths', { ...localConfig.layout.columnWidths, amount: parseInt(e.target.value) })} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 italic mt-2 text-center">Note: Item Name column automatically takes remaining width.</p>
                                </div>
                            </div>

                            {/* Table Options */}
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Table Options</label>
                                <div className="space-y-2">
                                    <div className="flex gap-2">
                                        <button onClick={() => handleConfigChange('layout', 'tableOptions', { ...localConfig.layout.tableOptions, hideQty: !localConfig.layout.tableOptions.hideQty })} className={`flex-1 py-1.5 text-xs border rounded ${!localConfig.layout.tableOptions.hideQty ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-400'}`}>
                                            Show Qty
                                        </button>
                                        <button onClick={() => handleConfigChange('layout', 'tableOptions', { ...localConfig.layout.tableOptions, hideRate: !localConfig.layout.tableOptions.hideRate })} className={`flex-1 py-1.5 text-xs border rounded ${!localConfig.layout.tableOptions.hideRate ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-400'}`}>
                                            Show Rate
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleConfigChange('layout', 'tableOptions', { ...localConfig.layout.tableOptions, compact: !localConfig.layout.tableOptions.compact })} className={`flex-1 py-1.5 text-xs border rounded ${localConfig.layout.tableOptions.compact ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-400'}`}>
                                            Compact Padding
                                        </button>
                                        <button onClick={() => handleConfigChange('layout', 'tableOptions', { ...localConfig.layout.tableOptions, stripedRows: !localConfig.layout.tableOptions.stripedRows })} className={`flex-1 py-1.5 text-xs border rounded ${localConfig.layout.tableOptions.stripedRows ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-slate-200 text-slate-400'}`}>
                                            Striped Rows
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* BRANDING TAB */}
                    {activeTab === 'branding' && (
                        <div className="space-y-6 animate-fade-in-fast">
                            {/* Colors */}
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-3 block">Theme Colors</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { k: 'primary', l: 'Primary Brand' },
                                        { k: 'secondary', l: 'Secondary Text' },
                                        { k: 'tableHeaderBg', l: 'Table Header' },
                                        { k: 'tableHeaderText', l: 'Header Text' },
                                        { k: 'borderColor', l: 'Borders' },
                                        { k: 'alternateRowBg', l: 'Striped Rows' },
                                    ].map(({k, l}) => (
                                        <button 
                                            key={k}
                                            onClick={() => handleColorPick(k as any)}
                                            className="flex items-center gap-3 p-2 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                                        >
                                            <div className="w-8 h-8 rounded-full shadow-sm border border-black/10" style={{ background: localConfig.colors[k as keyof typeof localConfig.colors] || '#fff' }}></div>
                                            <div>
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 block">{l}</span>
                                                <span className="text-[10px] text-slate-400 font-mono uppercase">{localConfig.colors[k as keyof typeof localConfig.colors]}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Watermark */}
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Watermark</label>
                                    <input 
                                        type="checkbox" 
                                        checked={localConfig.layout.showWatermark} 
                                        onChange={e => handleConfigChange('layout', 'showWatermark', e.target.checked)}
                                        className="toggle-checkbox"
                                    />
                                </div>
                                {localConfig.layout.showWatermark && (
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-1">Opacity</span>
                                        <input 
                                            type="range" min="0" max="100" 
                                            value={(localConfig.layout.watermarkOpacity || 0.1) * 100} 
                                            onChange={e => handleConfigChange('layout', 'watermarkOpacity', parseInt(e.target.value) / 100)} 
                                            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* CONTENT TAB */}
                    {activeTab === 'content' && (
                        <div className="space-y-6 animate-fade-in-fast">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Labels & Titles</label>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[10px] text-slate-500 block mb-1">Document Title</span>
                                        <input 
                                            type="text" value={localConfig.content.titleText} 
                                            onChange={e => handleConfigChange('content', 'titleText', e.target.value)}
                                            className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <span className="text-[10px] text-slate-500 block mb-1">Total Label</span>
                                            <input 
                                                type="text" value={localConfig.content.labels?.grandTotal} 
                                                onChange={e => handleConfigChange('content', 'labels', { ...localConfig.content.labels, grandTotal: e.target.value })}
                                                className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[10px] text-slate-500 block mb-1">Balance Label</span>
                                            <input 
                                                type="text" value={localConfig.content.labels?.balance} 
                                                onChange={e => handleConfigChange('content', 'labels', { ...localConfig.content.labels, balance: e.target.value })}
                                                className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Show / Hide</label>
                                {[
                                    { k: 'showTerms', l: 'Terms & Conditions' },
                                    { k: 'showSignature', l: 'Signature Line' },
                                    { k: 'showQr', l: 'QR Code' },
                                    { k: 'showAmountInWords', l: 'Amount In Words' },
                                    { k: 'showStatusStamp', l: 'Status Stamp (PAID/DUE)' },
                                    { k: 'showTaxBreakdown', l: 'Tax Breakdown Table' },
                                    { k: 'showGst', l: 'GST Line in Totals' }
                                ].map(({k, l}) => (
                                    <div key={k} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{l}</span>
                                        <input 
                                            type="checkbox" 
                                            checked={(localConfig.content as any)[k] !== false} // default true check
                                            onChange={e => handleConfigChange('content', k, e.target.checked)}
                                            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                                        />
                                    </div>
                                ))}
                            </div>
                            
                            <div className="space-y-3 border-t dark:border-slate-800 pt-4">
                                <label className="text-xs font-bold text-slate-500 uppercase block">Footer Text</label>
                                <textarea 
                                    value={localConfig.content.footerText} 
                                    onChange={e => handleConfigChange('content', 'footerText', e.target.value)}
                                    rows={2}
                                    className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white resize-none"
                                />
                            </div>
                        </div>
                    )}

                    {/* FONTS TAB */}
                    {activeTab === 'fonts' && (
                        <div className="space-y-6 animate-fade-in-fast">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Header Font</label>
                                    <select 
                                        value={localConfig.fonts.titleFont} 
                                        onChange={e => handleConfigChange('fonts', 'titleFont', e.target.value)}
                                        className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="helvetica">Helvetica (Clean)</option>
                                        <option value="times">Times New Roman (Serif)</option>
                                        <option value="courier">Courier (Mono)</option>
                                        {state.customFonts.map(f => <option key={f.id} value={f.name}>{f.name} (Custom)</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase mb-2 block">Body Font</label>
                                    <select 
                                        value={localConfig.fonts.bodyFont} 
                                        onChange={e => handleConfigChange('fonts', 'bodyFont', e.target.value)}
                                        className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                    >
                                        <option value="helvetica">Helvetica (Clean)</option>
                                        <option value="times">Times New Roman (Serif)</option>
                                        <option value="courier">Courier (Mono)</option>
                                        {state.customFonts.map(f => <option key={f.id} value={f.name}>{f.name} (Custom)</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Header Size</label>
                                        <input 
                                            type="number" value={localConfig.fonts.headerSize} 
                                            onChange={e => handleConfigChange('fonts', 'headerSize', parseInt(e.target.value))}
                                            className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Body Size</label>
                                        <input 
                                            type="number" value={localConfig.fonts.bodySize} 
                                            onChange={e => handleConfigChange('fonts', 'bodySize', parseInt(e.target.value))}
                                            className="w-full p-2 text-xs border rounded dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Resize Handle */}
                <div 
                    className="resize-handle absolute top-0 right-0 w-4 h-full cursor-col-resize z-30 transition-colors flex flex-col justify-center items-center group -mr-2"
                    onMouseDown={startResizing}
                    onTouchStart={startResizing}
                >
                    <div className="w-1 h-8 bg-gray-300 dark:bg-slate-600 rounded-full group-hover:bg-indigo-50 transition-colors"></div>
                </div>
            </aside>

            {/* Main Preview Area */}
            <main className="flex-1 flex flex-col h-full relative bg-gray-100 dark:bg-slate-900/50">
                {/* Top Action Bar */}
                <div className="bg-white dark:bg-slate-900 border-b dark:border-slate-800 p-3 flex justify-between items-center shadow-sm z-10 shrink-0">
                    <div className="flex gap-2">
                        <Button onClick={() => window.history.back()} variant="secondary" className="h-8 w-8 p-0 rounded-full flex items-center justify-center"><ArrowLeft size={16}/></Button>
                        <span className="text-sm font-semibold text-gray-500 self-center px-2 border-l ml-2">Live Preview</span>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleOpenPdf} variant="secondary" className="h-8 text-xs">
                            <ExternalLink size={14} className="mr-1.5" /> Open PDF
                        </Button>
                        <Button onClick={handleDownloadTestPdf} className="h-8 text-xs">
                            <Printer size={14} className="mr-1.5" /> Test Print
                        </Button>
                    </div>
                </div>

                {/* Canvas */}
                <PDFCanvasPreview 
                    config={localConfig} 
                    profile={state.profile} 
                    docType={docType}
                    customFonts={state.customFonts}
                />
            </main>
        </div>
    );
};

export default InvoiceDesigner;
