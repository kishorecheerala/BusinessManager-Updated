
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Edit, Save, X, Package, IndianRupee, Percent, PackageCheck, Barcode, Printer, Filter, Grid, List, Camera, Image as ImageIcon, Eye, Trash2, QrCode, Boxes, Maximize2, Minimize2, ArrowLeft, CheckSquare, Square, Plus, Clock, AlertTriangle, Share2, MoreHorizontal, LayoutGrid, Check, Wand2, Loader2, Sparkles, MessageCircle, CheckCircle, Copy, Share } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product, PurchaseItem } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import { BarcodeModal } from '../components/BarcodeModal';
import BatchBarcodeModal from '../components/BatchBarcodeModal';
import DatePill from '../components/DatePill';
import { compressImage } from '../utils/imageUtils'; 
import { Html5Qrcode } from 'html5-qrcode';
import EmptyState from '../components/EmptyState';
import { useDialog } from '../context/DialogContext';
import ImageCropperModal from '../components/ImageCropperModal';
import { GoogleGenAI } from "@google/genai";

interface ProductsPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

// Helper to convert base64 to File object for sharing
const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
};

const QRScannerModal: React.FC<{
    onClose: () => void;
    onScanned: (decodedText: string) => void;
}> = ({ onClose, onScanned }) => {
    const [scanStatus, setScanStatus] = useState<string>("Initializing camera...");
    const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

    useEffect(() => {
        html5QrCodeRef.current = new Html5Qrcode("qr-reader-products");
        setScanStatus("Requesting camera permissions...");

        const qrCodeSuccessCallback = (decodedText: string) => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().then(() => {
                    onScanned(decodedText);
                }).catch(err => {
                    console.error("Error stopping scanner", err);
                    onScanned(decodedText);
                });
            }
        };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCodeRef.current.start({ facingMode: "environment" }, config, qrCodeSuccessCallback, undefined)
            .then(() => setScanStatus("Scanning for QR Code..."))
            .catch(err => {
                setScanStatus(`Camera Permission Error. Please allow camera access.`);
                console.error("Camera start failed.", err);
            });
            
        return () => {
            if (html5QrCodeRef.current?.isScanning) {
                html5QrCodeRef.current.stop().catch(err => console.error("Cleanup stop scan failed.", err));
            }
        };
    }, [onScanned]);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-[200] p-4 animate-fade-in-fast">
            <Card title="Scan Product QR Code" className="w-full max-w-md relative animate-scale-in">
                 <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={20}/>
                 </button>
                <div id="qr-reader-products" className="w-full mt-4 rounded-lg overflow-hidden border"></div>
                <p className="text-center text-sm my-2 text-gray-600 dark:text-gray-400">{scanStatus}</p>
            </Card>
        </div>
    );
};

const ProductsPage: React.FC<ProductsPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [searchTerm, setSearchTerm] = useState('');
    
    // View Modes
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Selected Product for Details
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedProduct, setEditedProduct] = useState<Product | null>(null);
    
    // Share Selection Mode
    const [isShareSelectMode, setIsShareSelectMode] = useState(false);
    const [selectedShareImages, setSelectedShareImages] = useState<Set<string>>(new Set());
    
    // Modals
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [isBatchBarcodeModalOpen, setIsBatchBarcodeModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [cropImage, setCropImage] = useState<string | null>(null);
    
    const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
    const [isSuggestingPrice, setIsSuggestingPrice] = useState(false);

    const isDirtyRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initial load from navigation
    useEffect(() => {
        if (state.selection && state.selection.page === 'PRODUCTS') {
            const prod = state.products.find(p => p.id === state.selection.id);
            if (prod) {
                setSelectedProduct(prod);
                setEditedProduct(prod);
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.products, dispatch]);

    useEffect(() => {
        const currentlyDirty = isEditing;
        if (currentlyDirty !== isDirtyRef.current) {
            isDirtyRef.current = currentlyDirty;
            setIsDirty(currentlyDirty);
        }
    }, [isEditing, setIsDirty]);

    const filteredProducts = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return state.products.filter(p => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.id.toLowerCase().includes(lowerTerm) ||
            p.category?.toLowerCase().includes(lowerTerm)
        );
    }, [state.products, searchTerm]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredProducts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProducts.map(p => p.id)));
        }
    };

    const handleBulkDelete = async () => {
        if (await showConfirm(`Delete ${selectedIds.size} selected products? This cannot be undone.`)) {
            const newProducts = state.products.filter(p => !selectedIds.has(p.id));
            dispatch({ type: 'REPLACE_COLLECTION', payload: { storeName: 'products', data: newProducts } });
            
            showToast(`${selectedIds.size} products deleted.`);
            setSelectedIds(new Set());
            setIsSelectionMode(false);
        }
    };

    const handleBulkBarcode = () => {
        if (selectedIds.size > 0) {
            setIsBatchBarcodeModalOpen(true);
        }
    };

    const handleBulkShare = async () => {
        const selectedProducts = filteredProducts.filter(p => selectedIds.has(p.id));
        if (selectedProducts.length === 0) return;

        // 1. Try Native Share with Images (Mobile WhatsApp support)
        if (navigator.canShare && navigator.share) {
            const files: File[] = [];
            for (const p of selectedProducts) {
                if (p.image) {
                    try {
                        const file = dataURLtoFile(p.image, `${p.name.replace(/[^a-z0-9]/gi, '_')}.jpg`);
                        files.push(file);
                    } catch (e) { console.error(e); }
                }
            }

            const text = `*Product Catalog*\n\n` + selectedProducts.map(p => `*${p.name}* - ₹${p.salePrice}`).join('\n');

            try {
                // Check if we can share files
                if (files.length > 0 && navigator.canShare({ files })) {
                     await navigator.share({
                        files: files,
                        // Note: Some platforms ignore text when sharing multiple files
                        // But we send it anyway
                        text: text, 
                        title: 'Catalog'
                    });
                    return; // Success
                }
            } catch (e) {
                console.warn("Share with files failed, trying text fallback", e);
            }
        }

        // 2. Fallback: WhatsApp Text Link
        const combinedText = `*Product Catalog*\n\n` + selectedProducts.map(p =>
            `*${p.name}*\nPrice: ₹${p.salePrice.toLocaleString('en-IN')}${p.description ? '\n' + p.description : ''}`
        ).join('\n\n----------------\n\n');

        const url = `https://wa.me/?text=${encodeURIComponent(combinedText)}`;
        window.open(url, '_blank');
    };

    const handleSaveProduct = () => {
        if (!editedProduct) return;
        dispatch({ type: 'BATCH_UPDATE_PRODUCTS', payload: [editedProduct] });
        setSelectedProduct(editedProduct);
        setIsEditing(false);
        showToast("Product updated successfully.");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && editedProduct) {
            const newImages: string[] = [];
            const files = e.target.files;
            
            for (let i = 0; i < files.length; i++) {
                try {
                    const file = files[i];
                    const base64 = await compressImage(file, 800, 0.8);
                    newImages.push(base64);
                } catch (err: any) {
                    console.error("Image upload failed", err);
                }
            }
            
            // If primary image is empty, use first new image
            let updatedProduct = { ...editedProduct };
            
            if (!updatedProduct.image && newImages.length > 0) {
                updatedProduct.image = newImages[0];
                // Add rest to additional
                if (newImages.length > 1) {
                    const currentAdditional: string[] = updatedProduct.additionalImages || [];
                    updatedProduct.additionalImages = [...currentAdditional, ...newImages.slice(1)];
                }
            } else {
                const currentAdditional: string[] = updatedProduct.additionalImages || [];
                updatedProduct.additionalImages = [...currentAdditional, ...newImages];
            }
            
            setEditedProduct(updatedProduct);
        }
    };

    const setMainImage = (img: string) => {
        if (!editedProduct) return;
        const currentMain = editedProduct.image;
        const otherImages = editedProduct.additionalImages?.filter(i => i !== img) || [];
        
        if (currentMain && currentMain !== img) otherImages.push(currentMain);
        
        setEditedProduct({
            ...editedProduct,
            image: img,
            additionalImages: otherImages
        });
    };

    const removeImage = (img: string) => {
        if (!editedProduct) return;
        if (editedProduct.image === img) {
            // Removing main image
            const nextImage = editedProduct.additionalImages?.[0];
            setEditedProduct({
                ...editedProduct,
                image: nextImage, // might be undefined, which is fine
                additionalImages: editedProduct.additionalImages?.slice(1) || []
            });
        } else {
            setEditedProduct({
                ...editedProduct,
                additionalImages: editedProduct.additionalImages?.filter(i => i !== img)
            });
        }
    };

    const toggleShareSelection = (img: string) => {
        const newSet = new Set(selectedShareImages);
        if (newSet.has(img)) newSet.delete(img);
        else newSet.add(img);
        setSelectedShareImages(newSet);
    };

    const handleMultiShare = async () => {
        if (!editedProduct) return;
        
        const imagesToShare = selectedShareImages.size > 0 
            ? Array.from(selectedShareImages) 
            : [editedProduct.image].filter(Boolean) as string[];

        if (imagesToShare.length === 0) {
            showToast("No images to share.", 'error');
            return;
        }

        const shareData: any = {
            title: editedProduct.name,
            text: `*${editedProduct.name}*\nPrice: ₹${editedProduct.salePrice.toLocaleString('en-IN')}\n${editedProduct.description || ''}`,
        };

        if (navigator.canShare && navigator.share) {
            try {
                const files = imagesToShare.map((img, idx) => 
                    dataURLtoFile(img, `prod_${editedProduct.id}_${idx}.jpg`)
                );
                
                if (navigator.canShare({ files })) {
                    shareData.files = files;
                }
                
                await navigator.share(shareData);
                // Exit select mode on success
                setIsShareSelectMode(false);
                setSelectedShareImages(new Set());
            } catch (e) {
                console.warn("Share failed or cancelled", e);
                // Fallback to text only if file share fails is redundant as `share` usually throws on cancel too
            }
        } else {
            // Desktop/Fallback to Text
            handleWhatsAppShare(editedProduct);
        }
    };

    const handleWhatsAppShare = (product: Product) => {
        const text = `*${product.name}*\nPrice: ₹${product.salePrice.toLocaleString('en-IN')}\n${product.description || ''}`;
        const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(url, '_blank');
    };
    
    // AI Description Generation
    const handleAIGenerateDescription = async () => {
        if (!editedProduct || !editedProduct.name) {
            showToast("Product Name is required to generate description.", 'error');
            return;
        }
        
        setIsGeneratingDesc(true);
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API Key not available");
            
            const ai = new GoogleGenAI({ apiKey });
            const prompt = `Write a professional and catchy 2-sentence sales description for a product named "${editedProduct.name}" in category "${editedProduct.category || 'General'}". The description should highlight quality and value. Keep it under 50 words.`;
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });
            
            const text = response.text;
            if (text) {
                setEditedProduct(prev => prev ? ({ ...prev, description: text }) : null);
                showToast("Description generated!");
            }
        } catch (error) {
            console.error("AI Gen Error", error);
            showToast("Failed to generate description. Check network/API key.", 'error');
        } finally {
            setIsGeneratingDesc(false);
        }
    };

    // AI Price Suggestion
    const handleAIGeneratePrice = async () => {
        if (!editedProduct || !editedProduct.purchasePrice) {
            showToast("Need a valid Purchase Price to suggest selling price.", 'error');
            return;
        }

        setIsSuggestingPrice(true);
        try {
            const apiKey = process.env.API_KEY;
            if (!apiKey) throw new Error("API Key not available");

            const ai = new GoogleGenAI({ apiKey });
            const prompt = `I bought a product named "${editedProduct.name}" (${editedProduct.category || 'General'}) for ${editedProduct.purchasePrice}. 
            Suggest a competitive selling price with a 25-45% profit margin range. 
            Return ONLY the suggested price number (e.g. 500).`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            const text = response.text;
            const priceText = text ? text.trim() : '';
            const suggestedPrice = parseFloat(priceText.replace(/[^0-9.]/g, ''));

            if (!isNaN(suggestedPrice)) {
                setEditedProduct(prev => prev ? ({ ...prev, salePrice: suggestedPrice }) : null);
                showToast(`Suggested Price: ${suggestedPrice} (Based on standard margins)`, 'success');
            } else {
                throw new Error("AI returned invalid number");
            }
        } catch (error) {
            console.error("AI Price Error", error);
            showToast("Failed to suggest price.", 'error');
        } finally {
            setIsSuggestingPrice(false);
        }
    };

    // Render Logic for Detail View
    if (selectedProduct && editedProduct) {
        return (
            <div className="fixed inset-0 w-full h-full z-[5000] bg-white dark:bg-slate-900 flex flex-col md:flex-row overflow-hidden animate-fade-in-fast">
                {isBarcodeModalOpen && (
                    <BarcodeModal 
                        isOpen={isBarcodeModalOpen} 
                        onClose={() => setIsBarcodeModalOpen(false)} 
                        product={selectedProduct} 
                        businessName={state.profile?.name || ''} 
                    />
                )}
                {/* Close Button */}
                <button 
                    onClick={() => { setSelectedProduct(null); setIsEditing(false); setIsShareSelectMode(false); }} 
                    className="absolute top-4 left-4 z-[5010] p-2 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all shadow-lg"
                >
                    <ArrowLeft size={24} />
                </button>

                {/* Edit / Save Actions */}
                <div className="absolute top-4 right-4 z-[5010] flex gap-2">
                    {isEditing ? (
                        <Button onClick={handleSaveProduct} className="shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white border-none">
                            <Save size={18} className="mr-2" /> Save
                        </Button>
                    ) : (
                        <button 
                            onClick={() => setIsEditing(true)} 
                            className="p-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-full shadow-lg hover:scale-105 transition-transform"
                        >
                            <Edit size={20} />
                        </button>
                    )}
                </div>

                {/* Left Side (Image Gallery) */}
                <div className="h-[40%] sm:h-[50%] md:h-full w-full md:w-1/2 bg-gray-100 dark:bg-slate-950 relative flex flex-col shrink-0 transition-all duration-300">
                    <div className="flex-1 relative w-full h-full flex items-center justify-center p-4 overflow-hidden">
                        {editedProduct.image ? (
                            <img 
                                src={editedProduct.image} 
                                alt={editedProduct.name} 
                                className="max-w-full max-h-full object-contain drop-shadow-xl"
                            />
                        ) : (
                            <div className="text-gray-400 flex flex-col items-center">
                                <ImageIcon size={64} />
                                <span className="mt-2 text-sm">No Image</span>
                            </div>
                        )}
                        
                        {/* Share Overlay */}
                        {!isEditing && (
                            <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                                {isShareSelectMode ? (
                                    <button 
                                        onClick={handleMultiShare}
                                        disabled={selectedShareImages.size === 0}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 disabled:bg-gray-400 text-white rounded-full shadow-lg hover:scale-105 transition-all font-bold text-sm"
                                    >
                                        <Share2 size={16} /> Share ({selectedShareImages.size})
                                    </button>
                                ) : (
                                    <>
                                        <button onClick={() => setIsShareSelectMode(true)} className="p-3 bg-white dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-full shadow-lg hover:scale-110 transition-transform border border-gray-200 dark:border-slate-600" title="Select Images">
                                            <CheckSquare size={20} />
                                        </button>
                                        <button onClick={() => handleWhatsAppShare(editedProduct)} className="p-3 bg-green-500 text-white rounded-full shadow-lg hover:scale-110 transition-transform" title="Share Text on WhatsApp">
                                            <MessageCircle size={20} />
                                        </button>
                                        <button onClick={handleMultiShare} className="p-3 bg-blue-600 text-white rounded-full shadow-lg hover:scale-110 transition-transform" title="Share Main Image & Text">
                                            <Share2 size={20} />
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                        
                        {/* Cancel Selection Mode */}
                        {isShareSelectMode && (
                            <button 
                                onClick={() => { setIsShareSelectMode(false); setSelectedShareImages(new Set()); }}
                                className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-md hover:bg-black/70 transition-colors z-20"
                            >
                                Cancel Selection
                            </button>
                        )}
                    </div>

                    {/* Thumbnails */}
                    <div className="h-20 sm:h-24 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm p-2 flex gap-2 overflow-x-auto border-t dark:border-slate-800 shrink-0 custom-scrollbar">
                        {isEditing && (
                            <div 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800"
                            >
                                <Camera size={20} />
                                <span className="text-[10px] mt-1">Add</span>
                                <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
                            </div>
                        )}
                        {[editedProduct.image, ...(editedProduct.additionalImages || [])].filter(Boolean).map((img, idx) => {
                            const isSelected = selectedShareImages.has(img!);
                            const isMain = editedProduct.image === img;
                            return (
                                <div key={idx} className="relative group w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 cursor-pointer transition-transform active:scale-95">
                                    <img 
                                        src={img} 
                                        className={`w-full h-full object-cover rounded-lg border-2 ${
                                            isShareSelectMode 
                                                ? (isSelected ? 'border-blue-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100')
                                                : (isMain ? 'border-primary' : 'border-transparent')
                                        }`} 
                                        onClick={() => isShareSelectMode ? toggleShareSelection(img!) : setMainImage(img!)}
                                    />
                                    
                                    {isShareSelectMode && (
                                        <div 
                                            className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center border shadow-sm ${isSelected ? 'bg-blue-500 border-blue-500' : 'bg-white/50 border-gray-400'}`}
                                            onClick={(e) => { e.stopPropagation(); toggleShareSelection(img!); }}
                                        >
                                            {isSelected && <Check size={12} className="text-white" />}
                                        </div>
                                    )}

                                    {isEditing && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); removeImage(img!); }}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Side (Details) */}
                <div className="flex-1 h-full w-full md:w-1/2 bg-white dark:bg-slate-800 flex flex-col border-l dark:border-slate-700 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {isEditing ? (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase">Product Name</label>
                                    <input 
                                        type="text" 
                                        value={editedProduct.name} 
                                        onChange={e => setEditedProduct({...editedProduct, name: e.target.value})}
                                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-xs font-bold text-gray-500 uppercase">Sale Price</label>
                                            <button 
                                                onClick={handleAIGeneratePrice}
                                                disabled={isSuggestingPrice || !editedProduct.purchasePrice}
                                                className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                                                title="Suggest price based on purchase cost"
                                            >
                                                {isSuggestingPrice ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                                Magic Price
                                            </button>
                                        </div>
                                        <input 
                                            type="number" 
                                            value={editedProduct.salePrice} 
                                            onChange={e => setEditedProduct({...editedProduct, salePrice: parseFloat(e.target.value) || 0})}
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Stock Qty</label>
                                        <input 
                                            type="number" 
                                            value={editedProduct.quantity} 
                                            onChange={e => setEditedProduct({...editedProduct, quantity: parseFloat(e.target.value) || 0})}
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white font-bold"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                                        <button 
                                            onClick={handleAIGenerateDescription}
                                            disabled={isGeneratingDesc}
                                            className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 hover:underline disabled:opacity-50"
                                        >
                                            {isGeneratingDesc ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                            {isGeneratingDesc ? 'Writing...' : 'Magic Write'}
                                        </button>
                                    </div>
                                    <textarea 
                                        rows={4}
                                        value={editedProduct.description || ''} 
                                        onChange={e => setEditedProduct({...editedProduct, description: e.target.value})}
                                        placeholder="Add product details, material, size..."
                                        className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white resize-none"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                                        <input 
                                            type="text" 
                                            value={editedProduct.category || ''} 
                                            onChange={e => setEditedProduct({...editedProduct, category: e.target.value})}
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Purchase Price</label>
                                        <input 
                                            type="number" 
                                            value={editedProduct.purchasePrice} 
                                            onChange={e => setEditedProduct({...editedProduct, purchasePrice: parseFloat(e.target.value) || 0})}
                                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1">{editedProduct.name}</h1>
                                    <div className="flex items-center gap-2">
                                        <span className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded text-xs font-mono">{editedProduct.id}</span>
                                        {editedProduct.category && <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold uppercase">{editedProduct.category}</span>}
                                    </div>
                                </div>

                                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-slate-700/50 rounded-xl border dark:border-slate-700">
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Price</p>
                                        <p className="text-2xl font-bold text-primary">₹{editedProduct.salePrice.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="w-px bg-gray-300 dark:bg-slate-600"></div>
                                    <div className="flex-1">
                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Stock</p>
                                        <p className={`text-2xl font-bold ${editedProduct.quantity < 5 ? 'text-red-500' : 'text-gray-800 dark:text-white'}`}>
                                            {editedProduct.quantity}
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-2">Description</h3>
                                    <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                                        {editedProduct.description || "No description available."}
                                    </p>
                                </div>

                                <div className="pt-6 border-t dark:border-slate-700">
                                    <h3 className="font-bold text-gray-900 dark:text-white mb-3">Actions</h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Button onClick={() => setIsBarcodeModalOpen(true)} variant="secondary" className="justify-center">
                                            <Barcode size={18} className="mr-2" /> Print Label
                                        </Button>
                                        <Button onClick={() => {
                                            // Handle manual stock adjustment logic
                                            const newQty = prompt("Enter new total quantity:", String(editedProduct.quantity));
                                            if (newQty && !isNaN(Number(newQty))) {
                                                setEditedProduct({ ...editedProduct, quantity: Number(newQty) });
                                                // Ideally save immediately or flag as dirty, but here we rely on Save button in edit mode or direct dispatch
                                                dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: editedProduct.id, change: Number(newQty) - editedProduct.quantity } });
                                                showToast("Stock updated");
                                            }
                                        }} variant="secondary" className="justify-center">
                                            <PackageCheck size={18} className="mr-2" /> Adjust Stock
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Main List View
    return (
        <div className="space-y-4 animate-fade-in-fast pb-20">
            {isBatchBarcodeModalOpen && (
                <BatchBarcodeModal 
                    isOpen={isBatchBarcodeModalOpen} 
                    onClose={() => { setIsBatchBarcodeModalOpen(false); setIsSelectionMode(false); setSelectedIds(new Set()); }} 
                    purchaseItems={filteredProducts.filter(p => selectedIds.has(p.id)).map(p => ({ productId: p.id, productName: p.name, quantity: 1, price: p.purchasePrice, saleValue: p.salePrice, gstPercent: p.gstPercent }))} 
                    businessName={state.profile?.name || ''}
                    title="Bulk Barcode Print"
                />
            )}
            
            {isScannerOpen && (
                <QRScannerModal 
                    onClose={() => setIsScannerOpen(false)} 
                    onScanned={(code: string) => {
                        setIsScannerOpen(false);
                        const prod = state.products.find(p => p.id === code);
                        if (prod) {
                            setSelectedProduct(prod);
                            setEditedProduct(prod);
                        } else {
                            showToast("Product not found", 'error');
                        }
                    }} 
                />
            )}

            {/* Header Toolbar */}
            <div className="flex flex-col gap-3 sticky top-0 bg-gray-50 dark:bg-slate-900 z-10 pb-2">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold text-primary">Products</h1>
                        <DatePill />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={() => setIsScannerOpen(true)} variant="secondary" className="p-2 h-auto"><QrCode size={20}/></Button>
                        <Button onClick={() => setIsSelectionMode(!isSelectionMode)} variant={isSelectionMode ? 'primary' : 'secondary'} className="p-2 h-auto">
                            {isSelectionMode ? <CheckSquare size={20} /> : <List size={20} />}
                        </Button>
                    </div>
                </div>

                <div className="flex gap-2 items-center">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search product name, ID, category..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-800 dark:border-slate-700 dark:text-white shadow-sm"
                        />
                    </div>
                    <div className="flex bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-1">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-100 dark:bg-slate-700 text-primary' : 'text-gray-400'}`}
                        >
                            <List size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-100 dark:bg-slate-700 text-primary' : 'text-gray-400'}`}
                        >
                            <LayoutGrid size={18} />
                        </button>
                    </div>
                </div>
                
                {/* Bulk Actions Bar */}
                {isSelectionMode && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-2 rounded-lg border border-indigo-100 dark:border-slate-700 shadow-sm animate-slide-down-fade">
                        <div className="flex items-center gap-2">
                            <button onClick={handleSelectAll} className="flex items-center gap-1 text-xs font-bold text-indigo-600 px-2 py-1 hover:bg-indigo-50 rounded">
                                {selectedIds.size === filteredProducts.length ? 'Deselect All' : 'Select All'}
                            </button>
                            <span className="text-xs text-gray-500">{selectedIds.size} selected</span>
                        </div>
                        <div className="flex gap-2">
                            <button 
                                onClick={handleBulkShare}
                                disabled={selectedIds.size === 0}
                                className="p-2 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                title="Share on WhatsApp (Images)"
                            >
                                <MessageCircle size={18} />
                            </button>
                            <button 
                                onClick={handleBulkBarcode}
                                disabled={selectedIds.size === 0}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded disabled:opacity-50"
                                title="Print Labels"
                            >
                                <Barcode size={18} />
                            </button>
                            <button 
                                onClick={handleBulkDelete}
                                disabled={selectedIds.size === 0}
                                className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                                title="Delete Selected"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Product List */}
            {filteredProducts.length === 0 ? (
                <EmptyState icon={Package} title="No Products Found" description="Try a different search term or scan a barcode." />
            ) : (
                <div className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-3"}>
                    {filteredProducts.map(product => (
                        <div 
                            key={product.id} 
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(product.id);
                                else {
                                    setSelectedProduct(product);
                                    setEditedProduct(product);
                                }
                            }}
                            className={`
                                relative bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer overflow-hidden
                                ${isSelectionMode && selectedIds.has(product.id) ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-200 dark:border-slate-700 hover:shadow-md'}
                                ${viewMode === 'list' ? 'flex items-center p-3 gap-4' : 'flex flex-col p-0'}
                            `}
                        >
                            {/* Selection Checkbox Overlay */}
                            {isSelectionMode && (
                                <div className="absolute top-2 left-2 z-10">
                                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${selectedIds.has(product.id) ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'}`}>
                                        {selectedIds.has(product.id) && <Check size={12} className="text-white" />}
                                    </div>
                                </div>
                            )}

                            {/* Image - Updated to contain + white bg */}
                            <div className={`flex-shrink-0 ${viewMode === 'list' ? 'w-16 h-16' : 'w-full aspect-square'} bg-white dark:bg-slate-800 overflow-hidden flex items-center justify-center p-1`}>
                                {product.image ? (
                                    <img src={product.image} alt={product.name} className="max-w-full max-h-full object-contain" loading="lazy" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-slate-700 rounded-lg">
                                        <Package size={24} />
                                    </div>
                                )}
                            </div>

                            {/* Content */}
                            <div className={`flex-grow ${viewMode === 'grid' ? 'p-3' : ''}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className={`font-bold text-gray-800 dark:text-gray-100 ${viewMode === 'grid' ? 'text-sm line-clamp-2' : 'text-base'}`}>{product.name}</h3>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">{product.id}</p>
                                    </div>
                                    {viewMode === 'list' && (
                                        <div className="text-right">
                                            <p className="font-bold text-primary">₹{product.salePrice.toLocaleString('en-IN')}</p>
                                            <p className={`text-xs font-bold ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                                {product.quantity} Stock
                                            </p>
                                        </div>
                                    )}
                                </div>
                                {viewMode === 'grid' && (
                                    <div className="mt-2 flex justify-between items-end">
                                        <p className={`text-xs font-bold ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                            {product.quantity} Left
                                        </p>
                                        <p className="font-bold text-primary">₹{product.salePrice}</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Quick Actions (List View Only) */}
                            {viewMode === 'list' && !isSelectionMode && (
                                <div className="flex gap-2 pl-2 border-l dark:border-slate-700 ml-2">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleWhatsAppShare(product); }}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-green-500"
                                        title="Share on WhatsApp"
                                    >
                                        <MessageCircle size={18} />
                                    </button>
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleMultiShare(); }}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-blue-500"
                                        title="Share"
                                    >
                                        <Share2 size={18} />
                                    </button>
                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedProduct(product);
                                            setIsBarcodeModalOpen(true);
                                        }}
                                        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500"
                                        title="Barcode"
                                    >
                                        <Barcode size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductsPage;
