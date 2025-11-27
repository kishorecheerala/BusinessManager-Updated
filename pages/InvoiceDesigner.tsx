
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Edit3, ChevronDown, Upload, Trash2, Wand2, Grid, QrCode, Printer, Eye, ArrowLeft, CheckSquare, Square, Type as TypeIcon, AlignLeft, AlignCenter, AlignRight, Move, GripVertical, Layers, ArrowUp, ArrowDown, Table, Monitor, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { InvoiceTemplateConfig, DocumentType, InvoiceLabels, CustomFont, ProfileData } from '../types';
import Button from '../components/Button';
import ColorPickerModal from '../components/ColorPickerModal';
import { generateA4InvoicePdf, generateEstimatePDF, generateDebitNotePDF, generateThermalInvoicePDF } from '../utils/pdfGenerator';
import { extractDominantColor } from '../utils/imageUtils';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker source for PDF.js (CDN version matching the library)
// Using explicit version to match package if possible, or fallback to latest compatible
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
        columnWidths?: { item: number; qty: number; rate: number }; // Percentages
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
            columnWidths: { item: 45, qty: 15, rate: 20 },
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
            columnWidths: { item: 40, qty: 15, rate: 20 },
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
            columnWidths: { item: 50, qty: 10, rate: 20 },
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
            columnWidths: { item: 40, qty: 15, rate: 20 },
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

    // Debounced Render Logic
    useEffect(() => {
        let active = true;
        let timeoutId: ReturnType<typeof setTimeout>;

        const render = async () => {
            if (!containerRef.current || !canvasRef.current) return;
            setLoading(true);
            setError(null);

            try {
                // 1. Generate PDF Blob using jsPDF (simulating real output)
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

                // 2. Load PDF with PDF.js
                const loadingTask = pdfjsLib.getDocument(url);
                const pdf = await loadingTask.promise;
                const page = await pdf.getPage(1);

                if (!active) { URL.revokeObjectURL(url); return; }

                // 3. Calculate Scale to fit container
                const containerWidth = containerRef.current.clientWidth;
                const baseViewport = page.getViewport({ scale: 1 });
                // Add padding (32px total for margins)
                const fitScale = (containerWidth - 32) / baseViewport.width;
                const finalScale = fitScale * zoomLevel;
                
                const viewport = page.getViewport({ scale: finalScale });

                // 4. Render to Canvas (High DPI support)
                const canvas = canvasRef.current;
                const context = canvas.getContext('2d');
                const outputScale = window.devicePixelRatio || 1;

                canvas.width = Math.floor(viewport.width * outputScale);
                canvas.height = Math.floor(viewport.height * outputScale);
                canvas.style.width = Math.floor(viewport.width) + "px";
                canvas.style.height = Math.floor(viewport.height) + "px";

                const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

                // Cancel previous render if any
                if (renderTaskRef.current) {
                    renderTaskRef.current.cancel();
                }

                const renderContext = {
                    canvasContext: context as any,
                    viewport: viewport,
                    transform: transform as any
                };
                
                renderTaskRef.current = page.render(renderContext);
                await renderTaskRef.current.promise;

                URL.revokeObjectURL(url);
                setLoading(false);

            } catch (err: any) {
                if (err.name !== 'RenderingCancelledException') {
                    console.error("Preview Render Error", err);
                    setError("Preview generation failed.");
                    setLoading(false);
                }
            }
        };

        // Debounce by 500ms to avoid jank during sliders movement
        timeoutId = setTimeout(render, 500);

        return () => {
            active = false;
            clearTimeout(timeoutId);
            if (renderTaskRef.current) {
                renderTaskRef.current.cancel();
            }
        };
    }, [config, profile, docType, customFonts, zoomLevel]);

    return (
        <div ref={containerRef} className="relative w-full h-full flex flex-col items-center justify-start pt-8 pb-20 overflow-auto bg-gray-200 dark:bg-slate-950">
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-20 flex bg-white dark:bg-slate-800 rounded-lg shadow-md border dark:border-slate-700">
                <button onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-l-lg border-r dark:border-slate-700" title="Zoom Out"><ZoomOut size={16} /></button>
                <span className="px-2 py-2 text-xs font-mono w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
                <button onClick={() => setZoomLevel(z => Math.min(2, z + 0.1))} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-r-lg border-l dark:border-slate-700" title="Zoom In"><ZoomIn size={16} /></button>
            </div>

            {/* Canvas Container */}
            <div className={`shadow-2xl transition-all duration-300 ${loading ? 'opacity-50 blur-[1px]' : 'opacity-100'}`}>
                <canvas ref={canvasRef} className="bg-white" />
            </div>

            {/* Loading Overlay */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className="bg-white/80 dark:bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                        <Loader2 className="animate-spin text-primary" size={20} />
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-200">Rendering...</span>
                    </div>
                </div>
            )}
            
            {error && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="bg-red-100 text-red-800 px-4 py-3 rounded-lg shadow-lg border border-red-200">
                        <p className="font-bold">Error</p>
                        <p className="text-sm">{error}</p>
                        <button onClick={() => window.location.reload()} className="text-xs underline mt-2">Retry</button>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Editor Components ---
const DraggableSectionItem: React.FC<{ 
    id: string; 
    label: string; 
    index: number; 
    moveSection: (dragIndex: number, hoverIndex: number) => void 
}> = ({ id, label, index, moveSection }) => {
    const ref = useRef<HTMLDivElement>(null);
    const handleDragStart = (e: React.DragEvent) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
        if (ref.current) ref.current.style.opacity = '0.5';
    };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (dragIndex !== index) moveSection(dragIndex, index);
        if (ref.current) ref.current.style.opacity = '1';
    };
    const handleDragEnd = () => { if (ref.current) ref.current.style.opacity = '1'; };

    return (
        <div 
            ref={ref}
            draggable
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 shadow-sm cursor-move hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors group"
        >
            <GripVertical className="text-gray-400 group-hover:text-primary" size={18} />
            <span className="text-sm font-medium dark:text-gray-200 capitalize">{label}</span>
        </div>
    );
};

interface InvoiceDesignerProps {
    setIsDirty?: (dirty: boolean) => void;
}

const InvoiceDesigner: React.FC<InvoiceDesignerProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('INVOICE');

    const defaults: ExtendedLayoutConfig = {
        id: 'invoiceTemplateConfig', currencySymbol: '₹', dateFormat: 'DD/MM/YYYY',
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', bannerBg: '#0d9488', bannerText: '#ffffff', footerBg: '#f3f4f6', footerText: '#374151', borderColor: '#e5e7eb', alternateRowBg: '#f9fafb' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { 
            margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard',
            showWatermark: false, watermarkOpacity: 0.1, tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false },
            sectionOrdering: ['header', 'title', 'details', 'table', 'totals', 'terms', 'signature', 'footer'], uppercaseHeadings: true, boldBorders: false,
            columnWidths: { item: 45, qty: 15, rate: 20 }, tablePadding: 3, tableHeaderAlign: 'left', borderRadius: 4
        },
        content: { titleText: 'TAX INVOICE', showTerms: true, showQr: true, termsText: '', footerText: 'Thank you for your business!', showBusinessDetails: true, showCustomerDetails: true, showSignature: true, signatureText: 'Authorized Signatory', showAmountInWords: false, showStatusStamp: false, showTaxBreakdown: false, showGst: true, labels: defaultLabels, qrType: 'INVOICE_ID', bankDetails: '' }
    };

    const [config, setConfig] = useState<ExtendedLayoutConfig>(defaults);
    const [activeTab, setActiveTab] = useState<'structure' | 'layout' | 'table' | 'colors' | 'fonts' | 'content' | 'labels'>('layout');
    const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
    const [colorPickerTarget, setColorPickerTarget] = useState<keyof InvoiceTemplateConfig['colors'] | null>(null);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const [isMd, setIsMd] = useState(typeof window !== 'undefined' ? window.innerWidth >= 640 : true);
    
    const isDirtyRef = useRef(false);

    useEffect(() => {
        const handleResize = () => setIsMd(window.innerWidth >= 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        let sourceConfig = state.invoiceTemplate;
        if (selectedDocType === 'ESTIMATE') sourceConfig = state.estimateTemplate;
        if (selectedDocType === 'DEBIT_NOTE') sourceConfig = state.debitNoteTemplate;
        if (selectedDocType === 'RECEIPT') sourceConfig = state.receiptTemplate;

        const newConfig = {
            ...defaults, ...sourceConfig,
            layout: { 
                ...defaults.layout, ...sourceConfig?.layout,
                sectionOrdering: (sourceConfig?.layout as any)?.sectionOrdering || defaults.layout.sectionOrdering,
                uppercaseHeadings: (sourceConfig?.layout as any)?.uppercaseHeadings ?? defaults.layout.uppercaseHeadings,
                boldBorders: (sourceConfig?.layout as any)?.boldBorders ?? defaults.layout.boldBorders,
                columnWidths: (sourceConfig?.layout as any)?.columnWidths ?? defaults.layout.columnWidths,
                tablePadding: (sourceConfig?.layout as any)?.tablePadding ?? defaults.layout.tablePadding,
                tableHeaderAlign: (sourceConfig?.layout as any)?.tableHeaderAlign ?? defaults.layout.tableHeaderAlign,
                borderRadius: (sourceConfig?.layout as any)?.borderRadius ?? defaults.layout.borderRadius,
            },
            content: { ...defaults.content, ...sourceConfig?.content }
        };
        setConfig(newConfig);
        isDirtyRef.current = false;
        if (setIsDirty) setIsDirty(false);
    }, [selectedDocType, state.invoiceTemplate, setIsDirty]);

    const updateConfig = (section: keyof ExtendedLayoutConfig | 'root', key: string, value: any) => {
        if (section === 'root') setConfig(prev => ({ ...prev, [key]: value }));
        else setConfig(prev => ({ ...prev, [section]: { ...(prev[section] as any), [key]: value } }));
        if (!isDirtyRef.current) { isDirtyRef.current = true; if (setIsDirty) setIsDirty(true); }
    };

    const startResizing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); 
        e.stopPropagation(); 
        setIsResizing(true);
    }, []);
    
    const stopResizing = useCallback(() => setIsResizing(false), []);
    
    const resize = useCallback((e: MouseEvent | TouchEvent) => {
        if (isResizing) {
            let clientX;
            if ('touches' in e) {
                clientX = e.touches[0].clientX;
            } else {
                clientX = (e as MouseEvent).clientX;
            }
            
            // Ensure we have a valid coordinate
            if (typeof clientX === 'number') {
                setSidebarWidth(Math.max(200, Math.min(clientX, window.innerWidth * 0.9)));
            }
        }
    }, [isResizing]);

    useEffect(() => {
        const handleTouchMove = (e: TouchEvent) => {
             if (isResizing) {
                 e.preventDefault(); // Prevent scrolling on touch devices
                 resize(e);
             }
        };

        if (isResizing) {
            window.addEventListener("mousemove", resize); 
            window.addEventListener("mouseup", stopResizing);
            window.addEventListener("touchmove", handleTouchMove, { passive: false }); 
            window.addEventListener("touchend", stopResizing);
            
            document.body.style.cursor = 'col-resize'; 
            document.body.style.userSelect = 'none';
        }

        return () => { 
            window.removeEventListener("mousemove", resize); 
            window.removeEventListener("mouseup", stopResizing);
            window.removeEventListener("touchmove", handleTouchMove); 
            window.removeEventListener("touchend", stopResizing);
            document.body.style.cursor = ''; 
            document.body.style.userSelect = '';
        };
    }, [isResizing, resize, stopResizing]);

    const handleSave = () => {
        dispatch({ type: 'SET_DOCUMENT_TEMPLATE', payload: { type: selectedDocType, config } });
        showToast(`${selectedDocType} template saved!`);
        isDirtyRef.current = false;
        if (setIsDirty) setIsDirty(false);
    };

    const handleExportPdf = async () => {
        try {
            showToast("Generating PDF...");
            let doc;
            const fonts = state.customFonts;
            if (selectedDocType === 'INVOICE') doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, config, fonts);
            else if (selectedDocType === 'ESTIMATE') doc = await generateEstimatePDF(dummySale as any, dummyCustomer, state.profile, config, fonts);
            else if (selectedDocType === 'DEBIT_NOTE') doc = await generateDebitNotePDF(dummySale as any, dummyCustomer as any, state.profile, config, fonts);
            else if (selectedDocType === 'RECEIPT') doc = await generateThermalInvoicePDF(dummySale, dummyCustomer, state.profile, config, fonts);
            if (doc) doc.save(`${selectedDocType}_Preview.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const moveSection = (dragIndex: number, hoverIndex: number) => {
        const newOrder = [...config.layout.sectionOrdering];
        const draggedItem = newOrder[dragIndex];
        newOrder.splice(dragIndex, 1);
        newOrder.splice(hoverIndex, 0, draggedItem);
        updateConfig('layout', 'sectionOrdering', newOrder);
    };

    const moveSectionArrow = (index: number, direction: 'up' | 'down') => {
        const newOrder = [...config.layout.sectionOrdering];
        if (direction === 'up' && index > 0) { [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]]; }
        else if (direction === 'down' && index < newOrder.length - 1) { [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]]; }
        updateConfig('layout', 'sectionOrdering', newOrder);
    };

    const tabs = [{ id: 'layout', icon: Layout, label: 'Layout' }, { id: 'table', icon: Table, label: 'Table' }, { id: 'structure', icon: Layers, label: 'Structure' }, { id: 'colors', icon: Palette, label: 'Colors' }, { id: 'fonts', icon: TypeIcon, label: 'Fonts' }, { id: 'content', icon: FileText, label: 'Content' }, { id: 'labels', icon: Edit3, label: 'Labels' }];

    return (
        <div className="h-full w-full flex flex-col sm:flex-row overflow-hidden relative">
            <div className="sm:hidden flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border dark:border-slate-700 mb-2 mx-2 mt-2">
                <button onClick={() => setMobileView('editor')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'editor' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Edit3 size={16} /> Editor</button>
                <button onClick={() => setMobileView('preview')} className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}><Eye size={16} /> Preview</button>
            </div>

            <div style={isMd ? { width: sidebarWidth } : {}} className={`flex-col bg-white dark:bg-slate-800 sm:rounded-r-xl shadow-lg border-r border-gray-200 dark:border-slate-700 overflow-hidden ${mobileView === 'editor' ? 'flex flex-grow w-full' : 'hidden sm:flex'} shrink-0 z-10`}>
                <div className="p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <div className="flex items-center gap-2 mb-4">
                        <button onClick={() => window.history.back()} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"><ArrowLeft size={20} /></button>
                        <h2 className="font-bold text-lg text-primary">Invoice Designer</h2>
                        <div className="flex-grow"></div>
                        <button onClick={() => window.history.back()} className="text-sm text-red-500 font-bold hover:bg-red-50 px-3 py-1 rounded">Exit</button>
                    </div>
                    <select value={selectedDocType} onChange={(e) => setSelectedDocType(e.target.value as any)} className="w-full p-2 pr-8 border rounded-lg bg-white dark:bg-slate-700 font-bold outline-none mb-3">
                        <option value="INVOICE">Sales Invoice</option>
                        <option value="RECEIPT">Thermal Receipt</option>
                        <option value="ESTIMATE">Estimate</option>
                        <option value="DEBIT_NOTE">Debit Note</option>
                    </select>
                    <div className="flex gap-2">
                        <button onClick={() => setConfig(defaults)} className="p-2 rounded-full hover:bg-gray-200 text-gray-500"><RotateCcw size={18} /></button>
                        <Button onClick={handleSave} className="h-8 px-4 text-xs flex-grow"><Save size={14} className="mr-1" /> Save</Button>
                    </div>
                </div>

                <div className="flex border-b dark:border-slate-700 overflow-x-auto shrink-0 scrollbar-hide">
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 py-3 px-4 text-sm font-medium flex flex-col items-center justify-center gap-1 ${activeTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50'}`}>
                            <tab.icon size={18}/> <span className="text-[10px]">{tab.label}</span>
                        </button>
                    ))}
                </div>

                <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar pb-20 md:pb-4">
                    {activeTab === 'structure' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 mb-4">
                                Drag items to reorder them on the document. Use arrows if touch dragging is difficult.
                            </div>
                            <div className="space-y-2">
                                {config.layout.sectionOrdering.map((section, index) => (
                                    <div key={section} className="flex items-center gap-2">
                                        <div className="flex-grow"><DraggableSectionItem id={section} label={section} index={index} moveSection={moveSection} /></div>
                                        <div className="flex flex-col gap-1">
                                            <button onClick={() => moveSectionArrow(index, 'up')} disabled={index === 0} className="p-1 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 disabled:opacity-30"><ArrowUp size={14}/></button>
                                            <button onClick={() => moveSectionArrow(index, 'down')} disabled={index === config.layout.sectionOrdering.length - 1} className="p-1 bg-gray-100 dark:bg-slate-700 rounded hover:bg-gray-200 disabled:opacity-30"><ArrowDown size={14}/></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'layout' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 mb-4">
                                {Object.keys(PRESETS).map(name => (
                                    <button key={name} onClick={() => { const preset = PRESETS[name]; if(preset) setConfig(prev => ({ ...prev, ...preset, layout: { ...prev.layout, ...preset.layout, tableOptions: { ...prev.layout.tableOptions, ...preset.layout?.tableOptions } }, content: { ...prev.content, ...preset.content } })); updateConfig('root', 'id', config.id); }} className="p-2 border rounded-lg text-xs font-medium hover:bg-primary/5 hover:border-primary dark:text-white">{name}</button>
                                ))}
                            </div>
                            <div className="space-y-4 border-t pt-4">
                                <div><label className="text-xs font-bold">Logo Size</label><input type="range" min="5" max="60" value={config.layout.logoSize} onChange={(e) => updateConfig('layout', 'logoSize', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                                <div><label className="text-xs font-bold">Vertical Margin</label><input type="range" min="5" max="50" value={config.layout.margin} onChange={(e) => updateConfig('layout', 'margin', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-xs font-bold">Logo X</label><input type="range" min="-50" max="50" value={config.layout.logoOffsetX || 0} onChange={(e) => updateConfig('layout', 'logoOffsetX', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                                    <div><label className="text-xs font-bold">Logo Y</label><input type="range" min="-50" max="50" value={config.layout.logoOffsetY || 0} onChange={(e) => updateConfig('layout', 'logoOffsetY', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                                </div>
                                <div><label className="text-xs font-bold">Corner Radius</label><input type="range" min="0" max="20" value={config.layout.borderRadius || 0} onChange={(e) => updateConfig('layout', 'borderRadius', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                                <div className="space-y-2 border-t pt-4">
                                    <label className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={config.layout.tableOptions.bordered} onChange={(e) => updateConfig('layout', 'tableOptions', { ...config.layout.tableOptions, bordered: e.target.checked })} /> Content Borders</label>
                                    <label className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={config.layout.boldBorders} onChange={(e) => updateConfig('layout', 'boldBorders', e.target.checked)} /> Bold Section Borders</label>
                                    <label className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded"><input type="checkbox" checked={config.layout.uppercaseHeadings} onChange={(e) => updateConfig('layout', 'uppercaseHeadings', e.target.checked)} /> Uppercase Headings</label>
                                </div>
                            </div>
                        </div>
                    )}
                    {activeTab === 'table' && (
                        <div className="space-y-4">
                            <div className="space-y-4">
                                <div><label className="text-xs flex justify-between"><span>Item Description</span> <span>{config.layout.columnWidths?.item}%</span></label><input type="range" min="20" max="70" value={config.layout.columnWidths?.item} onChange={(e) => updateConfig('layout', 'columnWidths', { ...config.layout.columnWidths, item: parseInt(e.target.value) })} className="w-full accent-primary" /></div>
                                <div><label className="text-xs flex justify-between"><span>Quantity</span> <span>{config.layout.columnWidths?.qty}%</span></label><input type="range" min="5" max="20" value={config.layout.columnWidths?.qty} onChange={(e) => updateConfig('layout', 'columnWidths', { ...config.layout.columnWidths, qty: parseInt(e.target.value) })} className="w-full accent-primary" /></div>
                                <div><label className="text-xs flex justify-between"><span>Rate</span> <span>{config.layout.columnWidths?.rate}%</span></label><input type="range" min="10" max="30" value={config.layout.columnWidths?.rate} onChange={(e) => updateConfig('layout', 'columnWidths', { ...config.layout.columnWidths, rate: parseInt(e.target.value) })} className="w-full accent-primary" /></div>
                            </div>
                            <div className="border-t pt-4 space-y-4">
                                <div><label className="text-xs font-bold mb-2 block">Cell Padding</label><input type="range" min="1" max="8" step="0.5" value={config.layout.tablePadding || 3} onChange={(e) => updateConfig('layout', 'tablePadding', parseFloat(e.target.value))} className="w-full accent-primary" /></div>
                                <div><label className="text-xs font-bold mb-2 block">Header Alignment</label><div className="flex bg-gray-100 dark:bg-slate-700 rounded-lg p-1"><button onClick={() => updateConfig('layout', 'tableHeaderAlign', 'left')} className={`flex-1 p-1 rounded ${config.layout.tableHeaderAlign === 'left' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}><AlignLeft size={16}/></button><button onClick={() => updateConfig('layout', 'tableHeaderAlign', 'center')} className={`flex-1 p-1 rounded ${config.layout.tableHeaderAlign === 'center' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}><AlignCenter size={16}/></button><button onClick={() => updateConfig('layout', 'tableHeaderAlign', 'right')} className={`flex-1 p-1 rounded ${config.layout.tableHeaderAlign === 'right' ? 'bg-white shadow text-primary' : 'text-gray-500'}`}><AlignRight size={16}/></button></div></div>
                                <label className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded bg-gray-50 dark:bg-slate-700/50 mt-2"><input type="checkbox" checked={config.layout.tableOptions.stripedRows} onChange={(e) => updateConfig('layout', 'tableOptions', { ...config.layout.tableOptions, stripedRows: e.target.checked })} /> Zebra Stripes</label>
                                <label className="flex items-center gap-2 text-sm p-2 hover:bg-gray-50 rounded bg-gray-50 dark:bg-slate-700/50"><input type="checkbox" checked={config.layout.tableOptions.compact} onChange={(e) => updateConfig('layout', 'tableOptions', { ...config.layout.tableOptions, compact: e.target.checked })} /> Remove Inner Borders</label>
                            </div>
                        </div>
                    )}
                    {activeTab === 'colors' && (
                        <div className="space-y-4">
                            <Button onClick={async () => { if (state.profile?.logo) { const c = await extractDominantColor(state.profile.logo); updateConfig('colors', 'primary', c); updateConfig('colors', 'tableHeaderBg', c); updateConfig('colors', 'bannerBg', c); } }} variant="secondary" className="w-full mb-2 text-xs"><Wand2 size={14} className="mr-2"/> Auto-Brand from Logo</Button>
                            {Object.entries({ primary: "Brand Color", secondary: "Secondary Text", text: "Body Text", tableHeaderBg: "Table Header Bg", tableHeaderText: "Table Header Text", bannerBg: "Banner Bg", bannerText: "Banner Text", borderColor: "Lines & Borders", alternateRowBg: "Striped Rows" }).map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between p-2 border rounded-lg bg-white dark:bg-slate-700"><span className="text-sm font-medium">{label}</span><button onClick={() => setColorPickerTarget(key as any)} className="w-8 h-8 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: (config.colors as any)[key] }} /></div>
                            ))}
                            <ColorPickerModal isOpen={!!colorPickerTarget} onClose={() => setColorPickerTarget(null)} initialColor={colorPickerTarget ? (config.colors as any)[colorPickerTarget] : '#000000'} onChange={(color) => { if (colorPickerTarget) updateConfig('colors', colorPickerTarget, color); }} />
                        </div>
                    )}
                    {activeTab === 'fonts' && (
                        <div className="space-y-4">
                             <div><label className="text-xs font-bold block mb-1">Title Font</label><select value={config.fonts.titleFont} onChange={(e) => updateConfig('fonts', 'titleFont', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700"><option value="helvetica">Helvetica</option><option value="times">Times New Roman</option><option value="courier">Courier New</option>{state.customFonts.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
                             <div><label className="text-xs font-bold block mb-1">Body Font</label><select value={config.fonts.bodyFont} onChange={(e) => updateConfig('fonts', 'bodyFont', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700"><option value="helvetica">Helvetica</option><option value="times">Times New Roman</option><option value="courier">Courier New</option>{state.customFonts.map(f => <option key={f.id} value={f.name}>{f.name}</option>)}</select></div>
                             <div><label className="text-xs">Header Size</label><input type="range" min="10" max="40" value={config.fonts.headerSize} onChange={(e) => updateConfig('fonts', 'headerSize', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                             <div><label className="text-xs">Body Size</label><input type="range" min="6" max="16" value={config.fonts.bodySize} onChange={(e) => updateConfig('fonts', 'bodySize', parseInt(e.target.value))} className="w-full accent-primary" /></div>
                        </div>
                    )}
                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <div><label className="text-xs font-bold block mb-1">Title Text</label><input type="text" value={config.content.titleText} onChange={(e) => updateConfig('content', 'titleText', e.target.value)} className="w-full p-2 border rounded" /></div>
                            <div className="space-y-2 border-t pt-4">
                                {[{ k: 'showBusinessDetails', l: 'Show Business Info' }, { k: 'showCustomerDetails', l: 'Show Customer Info' }, { k: 'showQr', l: 'Show QR Code' }, { k: 'showTerms', l: 'Show Terms' }, { k: 'showSignature', l: 'Show Signature Line' }, { k: 'showAmountInWords', l: 'Total In Words' }, { k: 'showStatusStamp', l: 'Paid/Due Stamp' }, { k: 'showGst', l: 'Show GST Column' }].map(({k, l}) => (
                                    <label key={k} className="flex items-center justify-between text-sm p-2 bg-gray-50 dark:bg-slate-700 rounded">{l}<input type="checkbox" checked={(config.content as any)[k]} onChange={(e) => updateConfig('content', k, e.target.checked)} className="w-4 h-4 text-primary rounded" /></label>
                                ))}
                            </div>
                            <div><label className="text-xs font-bold block mb-1">Terms</label><textarea value={config.content.termsText} onChange={(e) => updateConfig('content', 'termsText', e.target.value)} className="w-full p-2 border rounded h-20 text-xs" /></div>
                            <div><label className="text-xs font-bold block mb-1">Footer</label><input type="text" value={config.content.footerText} onChange={(e) => updateConfig('content', 'footerText', e.target.value)} className="w-full p-2 border rounded" /></div>
                        </div>
                    )}
                    {activeTab === 'labels' && (
                        <div className="space-y-3">
                            {Object.keys(defaultLabels).map((key) => (
                                <div key={key}><label className="text-xs font-bold block mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label><input type="text" value={(config.content.labels as any)?.[key] || (defaultLabels as any)[key]} onChange={(e) => updateConfig('content', 'labels', { ...config.content.labels, [key]: e.target.value })} className="w-full p-2 border rounded text-sm" /></div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div 
                className="hidden sm:flex w-4 cursor-col-resize items-center justify-center hover:bg-blue-500/10 transition-colors z-20 -ml-2 mr-[-2px] touch-none select-none" 
                onMouseDown={startResizing}
                onTouchStart={startResizing}
            >
                <div className="w-1 h-12 bg-gray-300 dark:bg-slate-600 rounded-full shadow-sm pointer-events-none"></div>
            </div>

            <div className={`flex-grow min-w-0 bg-gray-100 dark:bg-slate-900 relative overflow-hidden flex flex-col ${mobileView === 'preview' ? 'flex' : 'hidden sm:flex'}`}>
                <div className="h-12 bg-white dark:bg-slate-800 border-b dark:border-slate-700 flex justify-between items-center px-4 shrink-0">
                     <h3 className="font-bold text-sm text-gray-500 uppercase">Live PDF Preview</h3>
                     <button onClick={handleExportPdf} className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded text-primary flex items-center gap-1 font-bold text-sm"><Printer size={16} /> Print / PDF</button>
                </div>
                <div className="flex-grow relative bg-slate-200/50 dark:bg-slate-950/50 overflow-hidden">
                     {/* Replace LiveInvoicePreview with PDFCanvasPreview */}
                     <PDFCanvasPreview config={config} profile={state.profile} docType={selectedDocType} customFonts={state.customFonts} />
                </div>
            </div>
        </div>
    );
};

export default InvoiceDesigner;
