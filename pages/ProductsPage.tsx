
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Edit, Save, X, Package, IndianRupee, Percent, PackageCheck, Barcode, Printer, Filter, Grid, List, Camera, Image as ImageIcon, Eye, Trash2, QrCode, Boxes, Maximize2, Minimize2, ArrowLeft, CheckSquare, Square, Plus, Clock, AlertTriangle, Share2, MoreHorizontal, LayoutGrid, Check, MessageCircle, CheckCircle, Copy, Share, GripVertical, GripHorizontal } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product, PurchaseItem } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import BarcodeModal from '../components/BarcodeModal';
import BatchBarcodeModal from '../components/BatchBarcodeModal';
import DatePill from '../components/DatePill';
import { compressImage } from '../utils/imageUtils'; 
import { Html5Qrcode } from 'html5-qrcode';
import EmptyState from '../components/EmptyState';
import { useDialog } from '../context/DialogContext';
import ImageCropperModal from '../components/ImageCropperModal';

interface ProductsPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

// Helper to convert base64 to File object for sharing
const dataURLtoFile = (dataurl: string, filename: string) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
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
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Selected Product for Details
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedProduct, setEditedProduct] = useState<Product | null>(null);
    
    // Resizable Split Pane State
    const [detailSplitRatio, setDetailSplitRatio] = useState(0.75); // 75% for image default
    const [isResizing, setIsResizing] = useState(false);
    const detailContainerRef = useRef<HTMLDivElement>(null);
    
    // Share Selection Mode
    const [isShareSelectMode, setIsShareSelectMode] = useState(false);
    const [selectedShareImages, setSelectedShareImages] = useState<Set<string>>(new Set());
    
    // Modals
    const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
    const [isBatchBarcodeModalOpen, setIsBatchBarcodeModalOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    
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

    // Split Pane Resizing Logic
    const startDetailResize = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault(); // Prevent text selection
        setIsResizing(true);
        document.body.style.userSelect = 'none';
        document.body.style.cursor = window.innerWidth >= 768 ? 'col-resize' : 'row-resize';
    }, []);

    const stopDetailResize = useCallback(() => {
        setIsResizing(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
    }, []);

    const doDetailResize = useCallback((e: MouseEvent | TouchEvent) => {
        if (!isResizing || !detailContainerRef.current) return;
        
        const containerRect = detailContainerRef.current.getBoundingClientRect();
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;
        
        let newRatio;
        if (isDesktop) {
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            newRatio = (clientX - containerRect.left) / containerRect.width;
        } else {
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            newRatio = (clientY - containerRect.top) / containerRect.height;
        }
        
        // Clamp to keep both sides visible (min 20%, max 85%)
        newRatio = Math.max(0.2, Math.min(0.85, newRatio));
        
        setDetailSplitRatio(newRatio);
    }, [isResizing]);

    useEffect(() => {
        if (isResizing) {
            window.addEventListener('mousemove', doDetailResize);
            window.addEventListener('touchmove', doDetailResize, { passive: false });
            window.addEventListener('mouseup', stopDetailResize);
            window.addEventListener('touchend', stopDetailResize);
        }
        return () => {
            window.removeEventListener('mousemove', doDetailResize);
            window.removeEventListener('touchmove', doDetailResize);
            window.removeEventListener('mouseup', stopDetailResize);
            window.removeEventListener('touchend', stopDetailResize);
        };
    }, [isResizing, doDetailResize, stopDetailResize]);

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
                    } catch (e: any) { console.error(e); }
                }
            }

            const text = `*Product Catalog*\n\n` + selectedProducts.map(p => `*${p.name}* - ₹${p.salePrice}`).join('\n');

            try {
                // Check if we can share files
                if (files.length > 0 && navigator.canShare({ files })) {
                     await navigator.share({
                        files: files,
                        text: text, 
                        title: 'Catalog'
                    });
                    return; // Success
                }
            } catch (e: any) {
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

    const handleDuplicateProduct = () => {
        if (!editedProduct) return;
        const newId = `PROD-${Date.now()}`;
        const newProduct: Product = {
            ...editedProduct,
            id: newId,
            name: `${editedProduct.name} (Copy)`,
            quantity: 0 // Reset stock for duplicate
        };
        dispatch({ type: 'ADD_PRODUCT', payload: newProduct });
        setSelectedProduct(newProduct);
        setEditedProduct(newProduct);
        setIsEditing(true);
        showToast("Product duplicated. Update details and save.");
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && editedProduct) {
            const newImages: string[] = [];
            const files = e.target.files;
            
            for (let i = 0; i < files.length; i++) {
                try {
                    const file = files[i];
                    const base64 = await compressImage(file, 800, 0.8);
                    if (typeof base64 === 'string') {
                        newImages.push(base64);
                    }
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
                    dataURLtoFile(img as string, `prod_${editedProduct.id}_${idx}.jpg`)
                );
                
                if (navigator.canShare({ files })) {
                    shareData.files = files;
                }
                
                await navigator.share(shareData);
                // Exit select mode on success
                setIsShareSelectMode(false);
                setSelectedShareImages(new Set());
            } catch (e: any) {
                console.warn("Share failed or cancelled", e);
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
    
    // Render Logic for Detail View
    if (selectedProduct && editedProduct) {
        return (
            <div 
                ref={detailContainerRef}
                className="fixed inset-0 w-full h-full z-[5000] bg-white dark:bg-slate-900 flex flex-col md:flex-row overflow-hidden animate-fade-in-fast"
            >
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

                {/* Left Side (Image Gallery) - Resizable */}
                <div 
                    className={`relative flex flex-col shrink-0 shadow-xl z-10 bg-gray-100 dark:bg-slate-950 ${isResizing ? '' : 'transition-[flex-basis] duration-200 ease-out'}`}
                    style={{ flexBasis: `${detailSplitRatio * 100}%` }}
                >
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
                    <div className="h-20 sm:h-24 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-2 flex gap-2 overflow-x-auto border-t dark:border-slate-800 shrink-0 custom-scrollbar z-20">
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

                {/* Resizer Handle */}
                <div
                    className="z-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 active:bg-indigo-100 transition-colors touch-none select-none cursor-row-resize md:cursor-col-resize shrink-0 border-y-4 md:border-y-0 md:border-x-4 border-transparent bg-clip-padding"
                    style={{ flexBasis: '24px' }}
                    onMouseDown={startDetailResize}
                    onTouchStart={startDetailResize}
                >
                     <div className="w-12 h-1 md:w-1 md:h-12 bg-slate-300 dark:bg-slate-600 rounded-full" />
                     <div className="absolute flex items-center justify-center pointer-events-none text-slate-400 opacity-50">
                        {window.innerWidth >= 768 ? <GripVertical size={16} /> : <GripHorizontal size={16} />}
                     </div>
                </div>

                {/* Right Side (Details) - Flex-1 */}
                <div className="flex-1 min-w-0 min-h-0 bg-white dark:bg-slate-800 flex flex-col border-l dark:border-slate-700 overflow-y-auto">
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
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Price</p>
                                        <p className="text-2xl font-bold text-primary">₹{editedProduct.salePrice.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="w-px bg-gray-300 dark:bg-slate-600"></div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase mb-1">Stock</p>
                                        <p className={`text-2xl font-bold ${editedProduct.quantity < 5 ? 'text-red-500' : 'text-gray-700 dark:text-white'}`}>
                                            {editedProduct.quantity}
                                        </p>
                                    </div>
                                </div>

                                <div className="prose dark:prose-invert text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700/30 p-4 rounded-xl border dark:border-slate-700">
                                    {editedProduct.description || "No description available."}
                                </div>

                                <div className="pt-4 border-t dark:border-slate-700">
                                    <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Actions</h3>
                                    <div className="flex gap-2 flex-wrap">
                                        <button onClick={() => setIsBarcodeModalOpen(true)} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                                            <Barcode size={16} /> Print Barcode
                                        </button>
                                        <button onClick={handleDuplicateProduct} className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium text-primary">
                                            <Copy size={16} /> Duplicate
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4 animate-fade-in-fast h-full flex flex-col">
            {isBarcodeModalOpen && selectedProduct && (
                <BarcodeModal 
                    isOpen={isBarcodeModalOpen} 
                    onClose={() => setIsBarcodeModalOpen(false)} 
                    product={selectedProduct} 
                    businessName={state.profile?.name || ''} 
                />
            )}
            
            {isBatchBarcodeModalOpen && (
                <BatchBarcodeModal
                    isOpen={isBatchBarcodeModalOpen}
                    onClose={() => setIsBatchBarcodeModalOpen(false)}
                    purchaseItems={filteredProducts.filter(p => selectedIds.has(p.id)).map(p => ({
                        productId: p.id,
                        productName: p.name,
                        quantity: p.quantity,
                        price: p.purchasePrice,
                        saleValue: p.salePrice,
                        gstPercent: p.gstPercent
                    }))}
                    businessName={state.profile?.name || ''}
                    title="Bulk Barcode Print"
                />
            )}

            {isScannerOpen && (
                <QRScannerModal 
                    onClose={() => setIsScannerOpen(false)} 
                    onScanned={(code) => {
                        setIsScannerOpen(false);
                        const prod = state.products.find(p => p.id === code);
                        if (prod) {
                            setSelectedProduct(prod);
                            setEditedProduct(prod);
                        } else {
                            showToast("Product not found.", "error");
                        }
                    }} 
                />
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">Products</h1>
                    <DatePill />
                </div>
                
                <div className="flex gap-2 w-full sm:w-auto">
                    {/* View Toggle */}
                    <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
                        <button 
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow text-primary' : 'text-gray-500'}`}
                        >
                            <List size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow text-primary' : 'text-gray-500'}`}
                        >
                            <Grid size={18} />
                        </button>
                    </div>

                    <Button onClick={() => {
                        const newProd: Product = {
                            id: `PROD-${Date.now()}`,
                            name: '',
                            quantity: 0,
                            purchasePrice: 0,
                            salePrice: 0,
                            gstPercent: 0
                        };
                        setSelectedProduct(newProd);
                        setEditedProduct(newProd);
                        setIsEditing(true);
                    }}>
                        <Plus size={18} className="mr-2" /> Add Product
                    </Button>
                </div>
            </div>

            {/* Selection Toolbar */}
            {selectedIds.size > 0 && (
                <div className="bg-indigo-600 text-white p-3 rounded-xl flex items-center justify-between shadow-lg animate-slide-down-fade sticky top-2 z-30">
                    <div className="flex items-center gap-3">
                        <span className="font-bold px-3 py-1 bg-white/20 rounded-lg">{selectedIds.size} Selected</span>
                        <button onClick={() => setSelectedIds(new Set())} className="text-xs hover:underline opacity-80">Clear</button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleBulkShare} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Share Catalog">
                            <Share2 size={18} />
                        </button>
                        <button onClick={handleBulkBarcode} className="p-2 hover:bg-white/20 rounded-lg transition-colors" title="Print Barcodes">
                            <Barcode size={18} />
                        </button>
                        <button onClick={handleBulkDelete} className="p-2 hover:bg-red-500 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="flex gap-2 flex-shrink-0">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                    />
                </div>
                <Button onClick={() => setIsScannerOpen(true)} variant="secondary" className="px-3">
                    <QrCode size={20} />
                </Button>
                <Button 
                    onClick={() => setIsSelectionMode(!isSelectionMode)} 
                    variant="secondary" 
                    className={`px-3 ${isSelectionMode ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' : ''}`}
                >
                    <CheckSquare size={20} />
                </Button>
            </div>

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-3 pb-20">
                    {filteredProducts.map((product, index) => (
                        <div 
                            key={product.id}
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(product.id);
                                else {
                                    setSelectedProduct(product);
                                    setEditedProduct(product);
                                }
                            }}
                            className={`flex items-center gap-4 p-3 bg-white dark:bg-slate-800 rounded-xl border transition-all cursor-pointer group ${
                                selectedIds.has(product.id) 
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                                    : 'border-transparent hover:border-gray-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md'
                            }`}
                        >
                            {/* Checkbox (Visible in Selection Mode) */}
                            {isSelectionMode && (
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.has(product.id) ? 'bg-indigo-500 border-indigo-500' : 'border-gray-400'}`}>
                                    {selectedIds.has(product.id) && <Check size={12} className="text-white" />}
                                </div>
                            )}

                            {/* Image Thumbnail */}
                            <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 relative">
                                {product.image ? (
                                    <img src={product.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon size={20} />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <div className="flex-grow min-w-0">
                                <h3 className="font-bold text-gray-800 dark:text-white truncate">{product.name}</h3>
                                <p className="text-xs text-gray-500 font-mono truncate">{product.id}</p>
                            </div>

                            {/* Price & Stock */}
                            <div className="text-right flex-shrink-0">
                                <p className="font-bold text-primary">₹{product.salePrice.toLocaleString('en-IN')}</p>
                                <p className={`text-xs font-medium ${product.quantity < 5 ? 'text-red-500' : 'text-gray-500'}`}>
                                    {product.quantity} in stock
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pb-20">
                    {filteredProducts.map((product) => (
                        <div 
                            key={product.id}
                            onClick={() => {
                                if (isSelectionMode) toggleSelection(product.id);
                                else {
                                    setSelectedProduct(product);
                                    setEditedProduct(product);
                                }
                            }}
                            className={`bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border transition-all cursor-pointer relative group ${
                                selectedIds.has(product.id) 
                                    ? 'ring-2 ring-indigo-500' 
                                    : 'hover:shadow-md hover:-translate-y-1'
                            }`}
                        >
                            {/* Selection Overlay */}
                            {isSelectionMode && (
                                <div className="absolute top-2 right-2 z-10">
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${selectedIds.has(product.id) ? 'border-indigo-500' : 'border-gray-300'}`}>
                                        {selectedIds.has(product.id) && <div className="w-3 h-3 bg-indigo-500 rounded-full" />}
                                    </div>
                                </div>
                            )}

                            {/* Image */}
                            <div className="aspect-square bg-gray-100 dark:bg-slate-700 relative">
                                {product.image ? (
                                    <img src={product.image} alt="" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                                        <ImageIcon size={32} />
                                    </div>
                                )}
                                {product.quantity < 5 && (
                                    <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 text-white text-[10px] font-bold text-center py-1">
                                        LOW STOCK
                                    </div>
                                )}
                            </div>

                            {/* Info */}
                            <div className="p-3">
                                <h3 className="font-bold text-sm text-gray-800 dark:text-white truncate mb-1">{product.name}</h3>
                                <div className="flex justify-between items-center">
                                    <span className="text-primary font-bold text-sm">₹{product.salePrice}</span>
                                    <span className="text-xs text-gray-500">{product.quantity} left</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {filteredProducts.length === 0 && (
                <EmptyState 
                    icon={Package} 
                    title="No Products Found" 
                    description={searchTerm ? "Try adjusting your search terms." : "Start by adding your first product."}
                    action={!searchTerm && (
                        <Button onClick={() => {
                            const newProd: Product = { id: `PROD-${Date.now()}`, name: '', quantity: 0, purchasePrice: 0, salePrice: 0, gstPercent: 0 };
                            setSelectedProduct(newProd);
                            setEditedProduct(newProd);
                            setIsEditing(true);
                        }}>
                            Add Product
                        </Button>
                    )}
                />
            )}
        </div>
    );
};

export default ProductsPage;
