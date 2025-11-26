
import React, { useState, useEffect, useMemo } from 'react';
import { Save, RotateCcw, Type, Layout, Palette, FileText, Image as ImageIcon, RefreshCw, Eye, Edit3 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { InvoiceTemplateConfig } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import ColorPickerModal from '../components/ColorPickerModal';
import { generateA4InvoicePdf } from '../utils/pdfGenerator';

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

const InvoiceDesigner: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    
    // Safe defaults
    const defaults: InvoiceTemplateConfig = {
        id: 'invoiceTemplateConfig',
        colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff' },
        fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
        layout: { margin: 10, logoSize: 25, logoPosition: 'center', headerAlignment: 'center', showWatermark: false },
        content: { titleText: 'TAX INVOICE', showTerms: true, showQr: true, termsText: '', footerText: 'Thank you for your business!' }
    };

    // Deep merge to safely handle potential missing properties from saved state
    const [config, setConfig] = useState<InvoiceTemplateConfig>({
        ...defaults,
        ...state.invoiceTemplate,
        colors: { ...defaults.colors, ...state.invoiceTemplate?.colors },
        fonts: { ...defaults.fonts, ...state.invoiceTemplate?.fonts },
        layout: { ...defaults.layout, ...state.invoiceTemplate?.layout },
        content: { ...defaults.content, ...state.invoiceTemplate?.content },
    });

    const [activeTab, setActiveTab] = useState<'layout' | 'colors' | 'fonts' | 'content'>('layout');
    const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
    const [pdfUrl, setPdfUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [colorPickerTarget, setColorPickerTarget] = useState<keyof InvoiceTemplateConfig['colors'] | null>(null);

    // Debounce PDF generation
    useEffect(() => {
        const timer = setTimeout(() => {
            generatePreview();
        }, 500);
        return () => clearTimeout(timer);
    }, [config]);

    // Initial generation
    useEffect(() => {
        generatePreview();
    }, []);

    const generatePreview = async () => {
        setIsGenerating(true);
        try {
            const doc = await generateA4InvoicePdf(dummySale, dummyCustomer, state.profile, config);
            const blobUrl = doc.output('bloburl');
            setPdfUrl(blobUrl);
        } catch (e) {
            console.error("Preview generation failed", e);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = () => {
        dispatch({ type: 'SET_INVOICE_TEMPLATE', payload: config });
        showToast("Invoice template saved successfully!");
    };

    const handleReset = () => {
        if (window.confirm("Reset to default settings?")) {
            setConfig(defaults);
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

    return (
        <div className="flex flex-col h-full w-full md:flex-row gap-4 overflow-hidden">
            
            {/* Mobile View Switcher */}
            <div className="md:hidden flex bg-gray-100 dark:bg-slate-800 p-1 rounded-lg shrink-0 border dark:border-slate-700">
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
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                    <h2 className="font-bold text-lg text-primary">Invoice Designer</h2>
                    <div className="flex gap-2">
                        <button onClick={handleReset} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-500" title="Reset Default">
                            <RotateCcw size={18} />
                        </button>
                        <Button onClick={handleSave} className="h-8 px-3 text-xs">
                            <Save size={14} className="mr-1" /> Save
                        </Button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b dark:border-slate-700 overflow-x-auto">
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
                <div className="flex-grow overflow-y-auto p-4 space-y-6 custom-scrollbar">
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
                                <input type="text" value={config.content.titleText} onChange={(e) => updateConfig('content', 'titleText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Footer Message</label>
                                <input type="text" value={config.content.footerText} onChange={(e) => updateConfig('content', 'footerText', e.target.value)} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" />
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

            {/* Right Preview Panel - Hidden on Mobile when in Editor mode */}
            <div className={`flex-grow bg-gray-200 dark:bg-slate-900 rounded-xl border border-gray-300 dark:border-slate-700 flex-col relative overflow-hidden ${mobileView === 'preview' ? 'flex' : 'hidden md:flex'}`}>
                <div className="absolute top-0 left-0 right-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur p-2 flex justify-between items-center border-b border-gray-200 dark:border-slate-700 z-10">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Live Preview</span>
                    {isGenerating && <span className="text-xs text-primary flex items-center gap-1"><RefreshCw size={12} className="animate-spin" /> Updating...</span>}
                </div>
                <div className="flex-grow flex items-center justify-center p-4 sm:p-8 overflow-auto">
                    {pdfUrl ? (
                        <iframe src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full max-w-[210mm] aspect-[210/297] shadow-2xl rounded-sm bg-white" title="PDF Preview" />
                    ) : (
                        <div className="text-gray-400 flex flex-col items-center">
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