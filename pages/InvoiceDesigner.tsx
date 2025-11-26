
import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Image as ImageIcon, RefreshCw, Eye, Edit3, ExternalLink, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { InvoiceTemplateConfig, DocumentType } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ColorPickerModal from '../components/ColorPickerModal';
import { generateA4InvoicePdf, generateEstimatePDF, generateDebitNotePDF } from '../utils/pdfGenerator';

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

const InvoiceDesigner: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    
    const [selectedDocType, setSelectedDocType] = useState<DocumentType>('INVOICE');

    // Safe defaults
    const defaults: InvoiceTemplateConfig = {
        id: 'invoiceTemplateConfig',
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { margin: 10, logoSize: 25, logoPosition: 'center', headerAlignment: 'center', showWatermark: false },
        content: { titleText: 'TAX INVOICE', showTerms: true, showQr: true, termsText: '', footerText: 'Thank you for your business!' }
    };

    const [config, setConfig] = useState<InvoiceTemplateConfig>(defaults);
    const [activeTab, setActiveTab] = useState<'layout' | 'colors' | 'fonts' | 'content'>('layout');
    const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [colorPickerTarget, setColorPickerTarget] = useState<keyof InvoiceTemplateConfig['colors'] | null>(null);

    // Load correct template from state when doc type changes
    useEffect(() => {
        let sourceConfig = state.invoiceTemplate;
        if (selectedDocType === 'ESTIMATE') sourceConfig = state.estimateTemplate;
        if (selectedDocType === 'DEBIT_NOTE') sourceConfig = state.debitNoteTemplate;

        // Deep merge with defaults to ensure safety
        setConfig({
            ...defaults,
            ...sourceConfig,
            id: sourceConfig?.id || defaults.id,
            colors: { ...defaults.colors, ...sourceConfig?.colors },
            fonts: { ...defaults.fonts, ...sourceConfig?.fonts },
            layout: { ...defaults.layout, ...sourceConfig?.layout },
            content: { ...defaults.content, ...sourceConfig?.content },
        });
    }, [selectedDocType, state.invoiceTemplate, state.estimateTemplate, state.debitNoteTemplate]);

    // Debounce PDF generation
    useEffect(() => {
        setIsGenerating(true);
        const timer = setTimeout(() => {
            generatePreview();
        }, 800);
        return () => clearTimeout(timer);
    }, [config, selectedDocType]);

    const generatePreview = async () => {
        try {
            let doc;
            if (selectedDocType === 'INVOICE') {
                doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, config);
            } else if (selectedDocType === 'ESTIMATE') {
                doc = await generateEstimatePDF(dummyQuote, dummyCustomer, state.profile, config);
            } else if (selectedDocType === 'DEBIT_NOTE') {
                doc = await generateDebitNotePDF(dummyReturn, dummySupplier, state.profile, config);
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
            // We just reset local state to defaults, user must save to persist
            setConfig({ ...defaults, id: config.id }); // Keep ID
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

    const handleOpenPdf = () => {
        if (pdfUrl) {
            window.open(pdfUrl, '_blank');
        }
    };

    return (
        <div className="h-full w-full flex flex-col md:flex-row gap-4 overflow-hidden relative">
            
            {/* Mobile View Switcher - Fixed Top */}
            <div className="md:hidden flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border dark:border-slate-700 mb-2">
                <button 
                    onClick={() => setMobileView('editor')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'editor' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    <Edit3 size={16} /> Editor
                </button>
                <button 
                    onClick={() => setMobileView('preview')}
                    className={`flex-1 py-2 rounded-md text-sm font-bold flex items-center justify-center gap-2 transition-all ${mobileView === 'preview' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    <Eye size={16} /> Preview
                </button>
            </div>

            {/* Left Control Panel - Hidden on Mobile when in Preview mode */}
            <div className={`w-full md:w-1/3 lg:w-1/4 flex-col bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden ${mobileView === 'editor' ? 'flex flex-grow' : 'hidden md:flex'}`}>
                
                {/* Document Type Selector */}
                <div className="p-4 border-b dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <div className="mb-3">
                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Document Type</label>
                        <div className="relative">
                            <select 
                                value={selectedDocType} 
                                onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
                                className="w-full p-2 pr-8 border rounded-lg appearance-none bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold focus:ring-2 focus:ring-primary outline-none"
                            >
                                <option value="INVOICE">Sales Invoice</option>
                                <option value="ESTIMATE">Estimate / Quotation</option>
                                <option value="DEBIT_NOTE">Debit Note (Returns)</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <h2 className="font-bold text-lg text-primary">Designer</h2>
                        <div className="flex gap-2">
                            <button onClick={handleReset} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500" title="Reset Default">
                                <RotateCcw size={18} />
                            </button>
                            <Button onClick={handleSave} className="h-8 px-3 text-xs">
                                <Save size={14} className="mr-1" /> Save
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-slate-700 overflow-x-auto shrink-0 scrollbar-hide">
                    <button onClick={() => setActiveTab('layout')} className={`flex-1 py-3 px-4 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'layout' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                        <Layout size={16} /> Layout
                    </button>
                    <button onClick={() => setActiveTab('colors')} className={`flex-1 py-3 px-4 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'colors' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                        <Palette size={16} /> Colors
                    </button>
                    <button onClick={() => setActiveTab('fonts')} className={`flex-1 py-3 px-4 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'fonts' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                        <Type size={16} /> Fonts
                    </button>
                    <button onClick={() => setActiveTab('content')} className={`flex-1 py-3 px-4 text-sm font-medium whitespace-nowrap flex items-center justify-center gap-2 ${activeTab === 'content' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
                        <FileText size={16} /> Content
                    </button>
                </div>

                {/* Controls Area */}
                <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar pb-20 md:pb-4">
                    {activeTab === 'layout' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Structure</label>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Page Margin (mm)</label>
                                        <input type="range" min="5" max="30" value={config.layout.margin} onChange={(e) => updateConfig('layout', 'margin', parseInt(e.target.value))} className="w-full" />
                                        <div className="text-xs text-right text-gray-500">{config.layout.margin}mm</div>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Size (mm)</label>
                                        <input type="range" min="10" max="60" value={config.layout.logoSize} onChange={(e) => updateConfig('layout', 'logoSize', parseInt(e.target.value))} className="w-full" />
                                        <div className="text-xs text-right text-gray-500">{config.layout.logoSize}mm</div>
                                    </div>
                                </div>
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Alignment</label>
                                <div className="space-y-3">
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Header Text Align</label>
                                        <div className="flex rounded-md shadow-sm" role="group">
                                            {['left', 'center', 'right'].map((align) => (
                                                <button 
                                                    key={align}
                                                    onClick={() => updateConfig('layout', 'headerAlignment', align)}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.headerAlignment === align ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}
                                                >
                                                    {align}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Logo Position</label>
                                        <div className="flex rounded-md shadow-sm" role="group">
                                            {['left', 'center', 'right'].map((pos) => (
                                                <button 
                                                    key={pos}
                                                    onClick={() => updateConfig('layout', 'logoPosition', pos)}
                                                    className={`flex-1 px-3 py-1.5 text-xs font-medium border first:rounded-l-lg last:rounded-r-lg capitalize ${config.layout.logoPosition === pos ? 'bg-primary text-white border-primary' : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-slate-600'}`}
                                                >
                                                    {pos}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={config.layout.showWatermark} 
                                        onChange={(e) => updateConfig('layout', 'showWatermark', e.target.checked)} 
                                        className="rounded text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Watermark</span>
                                </label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'colors' && (
                        <div className="space-y-4">
                            {Object.entries({
                                primary: "Primary Brand Color",
                                secondary: "Secondary Text",
                                text: "Body Text",
                                tableHeaderBg: "Table Header Background",
                                tableHeaderText: "Table Header Text"
                            }).map(([key, label]) => (
                                <div key={key} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                                    <button 
                                        onClick={() => setColorPickerTarget(key as any)}
                                        className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
                                        style={{ backgroundColor: (config.colors as any)[key] }}
                                    />
                                </div>
                            ))}
                            <ColorPickerModal 
                                isOpen={!!colorPickerTarget} 
                                onClose={() => setColorPickerTarget(null)}
                                initialColor={colorPickerTarget ? (config.colors as any)[colorPickerTarget] : '#000000'}
                                onChange={(color) => {
                                    if (colorPickerTarget) updateConfig('colors', colorPickerTarget, color);
                                }}
                            />
                        </div>
                    )}

                    {activeTab === 'fonts' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Heading Font</label>
                                <select 
                                    value={config.fonts.titleFont} 
                                    onChange={(e) => updateConfig('fonts', 'titleFont', e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="helvetica">Helvetica (Clean)</option>
                                    <option value="times">Times New Roman (Serif)</option>
                                    <option value="courier">Courier (Monospace)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Body Font</label>
                                <select 
                                    value={config.fonts.bodyFont} 
                                    onChange={(e) => updateConfig('fonts', 'bodyFont', e.target.value)}
                                    className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                >
                                    <option value="helvetica">Helvetica (Clean)</option>
                                    <option value="times">Times New Roman (Serif)</option>
                                    <option value="courier">Courier (Monospace)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Header Font Size</label>
                                <input type="range" min="14" max="36" value={config.fonts.headerSize} onChange={(e) => updateConfig('fonts', 'headerSize', parseInt(e.target.value))} className="w-full" />
                                <div className="text-xs text-right text-gray-500">{config.fonts.headerSize}pt</div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-700 dark:text-gray-300 block mb-1">Body Font Size</label>
                                <input type="range" min="8" max="14" value={config.fonts.bodySize} onChange={(e) => updateConfig('fonts', 'bodySize', parseInt(e.target.value))} className="w-full" />
                                <div className="text-xs text-right text-gray-500">{config.fonts.bodySize}pt</div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'content' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Document Title</label>
                                <input type="text" value={config.content.titleText} onChange={(e) => updateConfig('content', 'titleText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Footer Message</label>
                                <input type="text" value={config.content.footerText} onChange={(e) => updateConfig('content', 'footerText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                            </div>
                            
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.content.showQr} onChange={(e) => updateConfig('content', 'showQr', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show QR Code</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="checkbox" checked={config.content.showTerms} onChange={(e) => updateConfig('content', 'showTerms', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Show Terms & Conditions</span>
                                </label>
                            </div>

                            {config.content.showTerms && (
                                <div>
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Terms Text</label>
                                    <textarea rows={3} value={config.content.termsText} onChange={(e) => updateConfig('content', 'termsText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" placeholder="e.g. No returns..." />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Right Preview Panel */}
            <div className={`flex-grow bg-gray-200 dark:bg-slate-900 rounded-xl border border-gray-300 dark:border-slate-700 flex-col relative overflow-hidden ${mobileView === 'preview' ? 'flex' : 'hidden md:flex'}`}>
                <div className="absolute top-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-2 flex justify-between items-center border-b border-gray-200 dark:border-slate-700 z-10">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview: {selectedDocType.replace('_', ' ')}</span>
                    {isGenerating ? (
                        <span className="text-xs text-primary flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Updating...</span>
                    ) : (
                        <span className="text-xs text-green-600 flex items-center gap-1"><Eye size={12} /> Ready</span>
                    )}
                </div>
                
                <div className="flex-grow flex flex-col items-center justify-center p-2 sm:p-8 overflow-auto bg-gray-200 dark:bg-slate-900 relative">
                    
                    {/* Desktop: PDF Overlay Button (Floating) */}
                    <div className="hidden md:block absolute z-20 bottom-4 left-1/2 transform -translate-x-1/2 w-auto">
                        <Button onClick={handleOpenPdf} className="shadow-xl bg-indigo-600 hover:bg-indigo-700 rounded-full px-6">
                            <ExternalLink size={16} className="mr-2" /> Open PDF
                        </Button>
                    </div>

                    {/* Mobile: Dedicated Download Card (No inline preview) */}
                    <div className="md:hidden flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-800 rounded-xl shadow-lg text-center max-w-[80%]">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                            <FileText size={32} className="text-red-600" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-2">PDF Ready</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            Inline PDF preview is not supported on mobile devices. Please open the file to view it.
                        </p>
                        <Button onClick={handleOpenPdf} className="w-full bg-indigo-600 hover:bg-indigo-700 shadow-md">
                            <ExternalLink size={16} className="mr-2" /> Open {selectedDocType.replace('_', ' ')} PDF
                        </Button>
                    </div>

                    {pdfUrl ? (
                        <object 
                            data={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
                            type="application/pdf"
                            className="hidden md:block w-full h-full max-w-[210mm] shadow-2xl rounded-sm bg-white min-h-[400px]"
                        >
                            <div className="flex flex-col items-center justify-center h-full bg-white p-4 text-center text-gray-500">
                                <p className="mb-2">Preview not supported.</p>
                            </div>
                        </object>
                    ) : (
                        <div className="hidden md:flex text-gray-400 flex-col items-center">
                            <RefreshCw size={40} className="animate-spin mb-2" />
                            <p>Generating Preview...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoiceDesigner;
