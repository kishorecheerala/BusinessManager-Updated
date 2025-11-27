
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Edit, Save, X, Package, IndianRupee, Percent, PackageCheck, Barcode, Printer, Filter, Grid, List, Camera, Image as ImageIcon, Eye, Trash2, QrCode, Boxes, Maximize2, Minimize2, ArrowLeft } from 'lucide-react';
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

interface ProductsPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

// --- Helper Component for Image Interaction ---
interface ProductImageProps {
    src?: string;
    alt: string;
    className?: string;
    onPreview: (src: string) => void;
    enableInteract?: boolean;
}

const ProductImage: React.FC<ProductImageProps> = ({ src, alt, className, onPreview, enableInteract = true }) => {
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLongPress = useRef(false);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!enableInteract) return;
        if (e.pointerType === 'touch') {
            isLongPress.current = false;
            timerRef.current = setTimeout(() => {
                isLongPress.current = true;
                if (src) {
                    if (navigator.vibrate) navigator.vibrate(50);
                    onPreview(src);
                }
            }, 500); // 500ms for long press
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        if (!enableInteract) return;
        
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }

        if (e.pointerType === 'mouse') {
            e.stopPropagation(); // Stop row selection on desktop click
            if (src) onPreview(src);
        } else if (e.pointerType === 'touch' && isLongPress.current) {
            e.stopPropagation(); // Stop row selection if it was a long press
        }
        // If touch and NOT long press, let it bubble to select the row
    };

    const handlePointerCancel = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    if (!src) {
        return (
            <div className={`${className} flex items-center justify-center text-gray-300 dark:text-gray-600 bg-gray-100 dark:bg-slate-700`}>
                <ImageIcon size={20} />
            </div>
        );
    }

    return (
        <img 
            src={src} 
            alt={alt} 
            className={className}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onContextMenu={(e) => e.preventDefault()} // Prevent context menu on long press
            draggable={false}
        />
    );
};

const QRScannerModal: React.FC<{
    onClose: () => void;
    onScanned: (decodedText: string) => void;
}> = ({ onClose, onScanned }) => {
    const [scanStatus, setScanStatus] = useState<string>("Initializing camera...");
    const scannerId = "qr-reader-products";

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
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-[600] p-4 animate-fade-in-fast">
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

const ProductsPage: React.FC<ProductsPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [searchTerm, setSearchTerm] = useState('');
    
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedProduct, setEditedProduct] = useState<Product | null>(null);
    const [newQuantity, setNewQuantity] = useState<string>('');
    const isDirtyRef = useRef(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // State for multi-select
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [isBatchBarcodeModalOpen, setIsBatchBarcodeModalOpen] = useState(false);
    
    // State for Showcase Mode - Default to TRUE
    const [isShowcaseMode, setIsShowcaseMode] = useState(true);
    
    const [isScanning, setIsScanning] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    // Cropper State
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
    
    useEffect(() => {
        if (state.selection && state.selection.page === 'PRODUCTS') {
            const productToSelect = state.products.find(p => p.id === state.selection.id);
            if (productToSelect) {
                setSelectedProduct(productToSelect);
                setIsShowcaseMode(false); // Switch to details view if navigated to specific ID
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.products, dispatch]);
    
    useEffect(() => {
        let formIsDirty = false;
        if (selectedProduct) {
            const quantityChanged = newQuantity !== '' && parseInt(newQuantity, 10) !== selectedProduct.quantity;
            const imageChanged = editedProduct?.image !== selectedProduct.image;
            formIsDirty = isEditing || quantityChanged || imageChanged;
        } else if (isSelectMode) {
            formIsDirty = selectedProductIds.length > 0;
        }
        
        if (formIsDirty !== isDirtyRef.current) {
            isDirtyRef.current = formIsDirty;
            setIsDirty(formIsDirty);
        }
    }, [selectedProduct, isEditing, newQuantity, editedProduct, setIsDirty, isSelectMode, selectedProductIds]);

    // On unmount, we must always clean up.
    useEffect(() => {
        return () => {
            setIsDirty(false);
        };
    }, [setIsDirty]);

    useEffect(() => {
        if (selectedProduct) {
            const currentProduct = state.products.find(p => p.id === selectedProduct.id);
            setSelectedProduct(currentProduct || null);
            setEditedProduct(currentProduct || null);
            setNewQuantity(currentProduct ? currentProduct.quantity.toString() : '');
        } else {
            setEditedProduct(null);
        }
        setIsEditing(false);
    }, [selectedProduct?.id, state.products]); // Depend on ID to avoid loop
    
    const toggleSelectMode = () => {
        setIsSelectMode(!isSelectMode);
        setSelectedProductIds([]); // Reset selections when toggling
    };

    const handleProductClick = (product: Product) => {
        if (isSelectMode) {
            setSelectedProductIds(prev => 
                prev.includes(product.id)
                    ? prev.filter(id => id !== product.id)
                    : [...prev, product.id]
            );
        } else {
            setSelectedProduct(product);
        }
    };

    const handleUpdateProduct = async () => {
        if (editedProduct) {
             const confirmed = await showConfirm('Are you sure you want to update this product\'s details?');
             if (confirmed) {
                dispatch({ type: 'UPDATE_PRODUCT', payload: editedProduct });
                setIsEditing(false);
                showToast("Product details updated successfully.");
            }
        }
    };

    const handleStockAdjustment = async () => {
        if (selectedProduct && newQuantity !== '') {
            const newQty = parseInt(newQuantity, 10);
            if (!isNaN(newQty)) {
                const change = newQty - selectedProduct.quantity;
                if (change === 0) return;

                const confirmed = await showConfirm(`Confirm stock adjustment? New quantity will be ${newQty}.`);
                if (confirmed) {
                    dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: selectedProduct.id, change } });
                    showToast("Stock updated successfully.");
                }
            }
        }
    };
    
    // Updated Image Upload Handler
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editedProduct) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (evt) => {
                if (evt.target?.result) {
                    setTempImageSrc(evt.target.result as string);
                    setCropModalOpen(true);
                }
            };
            reader.readAsDataURL(file);
            // Reset input to allow re-selecting same file if needed
            e.target.value = '';
        }
    };
    
    const handleCropSave = (croppedBase64: string) => {
        if (editedProduct) {
            setEditedProduct({ ...editedProduct, image: croppedBase64 });
        }
        setCropModalOpen(false);
        setTempImageSrc(null);
    };
    
    const handleScan = (scannedText: string) => {
        setIsScanning(false);
        const product = state.products.find(p => p.id.toLowerCase() === scannedText.toLowerCase());
        if (product) {
            setSelectedProduct(product);
            setSearchTerm(''); // Clear search so we see the selected item logic take over
        } else {
            // If not found exactly, put it in search term to filter
            setSearchTerm(scannedText);
            showToast("Product not found. Filtered list by scanned code.", 'info');
        }
    };

    // Optimized Filtering
    const filteredProducts = useMemo(() => {
        const lowerTerm = searchTerm.toLowerCase();
        return state.products.filter(p => 
            p.name.toLowerCase().includes(lowerTerm) || 
            p.id.toLowerCase().includes(lowerTerm)
        );
    }, [state.products, searchTerm]);

    const handleSelectAll = () => {
        if (selectedProductIds.length === filteredProducts.length) {
            setSelectedProductIds([]);
        } else {
            setSelectedProductIds(filteredProducts.map(p => p.id));
        }
    };

    // Prepare items for batch barcode printing
    const batchBarcodeItems: PurchaseItem[] = useMemo(() => {
        return state.products
            .filter(p => selectedProductIds.includes(p.id))
            .map(p => ({
                productId: p.id,
                productName: p.name,
                quantity: p.quantity > 0 ? p.quantity : 1, // Default to 1 for printing if 0 stock, or use current stock
                price: p.purchasePrice,
                saleValue: p.salePrice,
                gstPercent: p.gstPercent
            }));
    }, [selectedProductIds, state.products]);

    if (selectedProduct && editedProduct) {
        const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const { name, value } = e.target;
            setEditedProduct({ ...editedProduct, [name]: name === 'name' ? value : parseFloat(value) || 0 });
        };

        return (
            <div className="fixed inset-0 top-0 left-0 w-full h-full z-[500] bg-white dark:bg-slate-900 flex flex-col md:flex-row animate-fade-in-fast overflow-hidden">
                {/* REQUIRED MODALS INJECTED INTO DETAILS VIEW */}
                <BarcodeModal 
                    isOpen={isDownloadModalOpen} 
                    onClose={() => setIsDownloadModalOpen(false)} 
                    product={selectedProduct} 
                    businessName={state.profile?.name || 'Business Manager'}
                />
                {cropModalOpen && (
                    <ImageCropperModal 
                        isOpen={cropModalOpen} 
                        imageSrc={tempImageSrc} 
                        onClose={() => { setCropModalOpen(false); setTempImageSrc(null); }} 
                        onCrop={handleCropSave} 
                    />
                )}
                {isScanning && (
                    <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScan} />
                )}
                
                {/* Lightbox Overlay for Details View */}
                {previewImage && (
                    <div className="fixed inset-0 bg-black bg-opacity-95 z-[700] flex items-center justify-center p-4 animate-fade-in-fast" onClick={() => setPreviewImage(null)}>
                        <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center">
                             <button 
                                onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                                className="absolute top-4 right-4 p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors z-50"
                            >
                                <X size={24} />
                            </button>
                            <img src={previewImage} alt="Full View" className="max-w-full max-h-full object-contain" />
                        </div>
                    </div>
                )}
                
                {/* Floating Back Button - Visible always on top left, z-index above everything */}
                <button 
                    onClick={() => setSelectedProduct(null)} 
                    className="absolute top-4 left-4 z-[510] p-3 bg-black/30 hover:bg-black/50 backdrop-blur-md text-white rounded-full transition-all shadow-lg transform active:scale-90"
                    aria-label="Back to Inventory"
                >
                    <ArrowLeft size={24} strokeWidth={2.5} />
                </button>
                
                {/* LEFT: IMAGE SECTION */}
                {/* Mobile: 62% height. Tablet/Desktop: 50% width, full height */}
                <div className="h-[62%] w-full md:h-full md:w-1/2 bg-gray-100 dark:bg-slate-900 relative group flex-shrink-0 transition-all duration-500">
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-slate-900">
                            <ProductImage 
                                src={isEditing ? editedProduct.image : selectedProduct.image} 
                                alt={selectedProduct.name} 
                                className="w-full h-full object-contain p-4 md:p-8"
                                onPreview={() => setPreviewImage(isEditing ? (editedProduct.image || '') : (selectedProduct.image || ''))}
                                enableInteract={!isEditing}
                            />
                        </div>
                    </div>

                    {/* Floating Toggle on Image (Top Right) */}
                    <div className="absolute top-4 right-4 flex flex-col gap-2 z-[510]">
                        <button 
                            onClick={() => setPreviewImage(isEditing ? (editedProduct.image || '') : (selectedProduct.image || ''))}
                            className="p-2 bg-white/90 dark:bg-slate-800/90 text-gray-700 dark:text-white rounded-full shadow-lg hover:bg-white dark:hover:bg-slate-700 transition-all"
                            title="Open Full Screen Viewer"
                        >
                            <Maximize2 size={20} />
                        </button>
                    </div>

                    {/* Edit Overlay */}
                    {isEditing && (
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent pt-20 flex justify-center gap-3 pb-10 md:pb-4 z-20">
                            <input 
                                type="file" 
                                accept="image/*" 
                                ref={fileInputRef} 
                                className="hidden" 
                                onChange={handleImageUpload}
                            />
                            <Button onClick={() => fileInputRef.current?.click()} className="shadow-xl h-10 text-xs">
                                <Camera size={16} className="mr-2" /> 
                                {editedProduct.image ? 'Change' : 'Add Photo'}
                            </Button>
                            {editedProduct.image && (
                                <Button 
                                    onClick={() => setEditedProduct({...editedProduct, image: undefined})} 
                                    variant="danger"
                                    className="shadow-xl h-10"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            )}
                        </div>
                    )}
                </div>

                {/* RIGHT: DETAILS SECTION */}
                {/* Mobile: Bottom ~40%, overlaps with negative margin */}
                {/* Tablet/Desktop: Right 50%, Full Height */}
                <div className="flex-1 h-full w-full md:w-1/2 bg-white dark:bg-slate-800 flex flex-col border-t md:border-t-0 md:border-l dark:border-slate-700 shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.15)] md:shadow-none relative z-10 rounded-t-3xl md:rounded-none -mt-6 md:mt-0 overflow-hidden animate-slide-up-fade">
                    
                    {/* Scrollable Form Content */}
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-5 pt-6 space-y-4">
                        {isEditing ? (
                            <div className="space-y-4 animate-fade-in-fast">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Product Name</label>
                                    <input type="text" name="name" value={editedProduct.name} onChange={handleInputChange} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Purchase Price</label>
                                        <input type="number" name="purchasePrice" value={editedProduct.purchasePrice} onChange={handleInputChange} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sale Price</label>
                                        <input type="number" name="salePrice" value={editedProduct.salePrice} onChange={handleInputChange} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">GST %</label>
                                    <input type="number" name="gstPercent" value={editedProduct.gstPercent} onChange={handleInputChange} className="w-full p-3 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200 focus:ring-2 focus:ring-primary outline-none" />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-in-fast">
                                <div className="flex justify-between items-start">
                                    <h1 className="text-lg font-bold text-gray-800 dark:text-white leading-tight line-clamp-2">
                                        {selectedProduct.name}
                                    </h1>
                                    <span className="text-[10px] font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded text-gray-600 dark:text-gray-300 shrink-0 ml-2">
                                        {selectedProduct.id}
                                    </span>
                                </div>
                                
                                <div className="flex items-end gap-4 border-b dark:border-slate-700 pb-3">
                                    <div>
                                        <p className="text-[10px] text-gray-500 mb-0.5">Selling Price</p>
                                        <p className="text-2xl font-extrabold text-primary">
                                            ₹{selectedProduct.salePrice.toLocaleString('en-IN')}
                                        </p>
                                    </div>
                                    <div className="pl-4 border-l dark:border-slate-700">
                                        <p className="text-[10px] text-gray-500 mb-0.5">Stock Status</p>
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${selectedProduct.quantity > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                            <Package size={14} />
                                            {selectedProduct.quantity > 0 ? `${selectedProduct.quantity} Units` : 'Out of Stock'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">Purchase Price</p>
                                        <p className="text-sm font-semibold dark:text-gray-200">₹{selectedProduct.purchasePrice.toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="p-2.5 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-0.5">GST Rate</p>
                                        <p className="text-sm font-semibold dark:text-gray-200">{selectedProduct.gstPercent}%</p>
                                    </div>
                                </div>
                                
                                {/* Stock Correction */}
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1.5">Quick Stock Correction</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            value={newQuantity} 
                                            onChange={(e) => setNewQuantity(e.target.value)} 
                                            className="flex-grow p-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white focus:ring-2 focus:ring-primary outline-none text-sm" 
                                            placeholder="New Qty"
                                        />
                                        <Button onClick={handleStockAdjustment} variant="secondary" className="whitespace-nowrap h-auto text-xs px-3">Update</Button>
                                    </div>
                                </div>
                                
                                <Button onClick={() => setIsDownloadModalOpen(true)} className="w-full py-2.5 bg-gray-800 text-white hover:bg-gray-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-sm">
                                    <Barcode className="w-4 h-4 mr-2"/> Print Barcode
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Sticky Actions Footer inside Details */}
                    <div className="p-3 bg-white dark:bg-slate-800 border-t dark:border-slate-700 shrink-0 pb-6 sm:pb-3">
                        <div className="flex gap-3">
                            {isEditing ? (
                                <>
                                    <button onClick={() => setIsEditing(false)} className="flex-1 py-2.5 rounded-xl font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-white dark:hover:bg-slate-600 transition-colors text-sm">
                                        Cancel
                                    </button>
                                    <Button onClick={handleUpdateProduct} className="flex-[2] py-2.5 rounded-xl text-sm shadow-lg">
                                        <Save size={16} className="mr-2"/> Save Changes
                                    </Button>
                                </>
                            ) : (
                                <Button onClick={() => setIsEditing(true)} variant="secondary" className="w-full py-2.5 rounded-xl text-sm bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-300 border-indigo-200">
                                    <Edit size={16} className="mr-2"/> Edit Details
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScan} />}
            
            {/* Image Cropper */}
            {cropModalOpen && (
                <ImageCropperModal 
                    isOpen={cropModalOpen} 
                    imageSrc={tempImageSrc} 
                    onClose={() => {
                        setCropModalOpen(false);
                        setTempImageSrc(null);
                    }} 
                    onCrop={handleCropSave} 
                />
            )}
            
            {/* Full Screen Image Preview Modal - Use for Grid Mode Only & Details View */}
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-95 z-[700] flex items-center justify-center p-4 animate-fade-in-fast" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-full max-h-full w-full h-full flex items-center justify-center">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                            className="absolute top-4 right-4 p-3 bg-white/20 text-white rounded-full hover:bg-white/40 transition-colors z-50"
                        >
                            <X size={24} />
                        </button>
                        <img src={previewImage} alt="Full Preview" className="max-w-full max-h-full object-contain" />
                    </div>
                </div>
            )}
            
            {isBatchBarcodeModalOpen && (
                <BatchBarcodeModal
                    isOpen={isBatchBarcodeModalOpen}
                    onClose={() => setIsBatchBarcodeModalOpen(false)}
                    purchaseItems={batchBarcodeItems}
                    businessName={state.profile?.name || 'Business Manager'}
                    title="Batch Barcode Print"
                />
            )}

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">Inventory</h1>
                    <DatePill />
                </div>
                
                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsShowcaseMode(!isShowcaseMode)} 
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${isShowcaseMode ? 'bg-indigo-600 text-white shadow-md' : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border dark:border-slate-700'}`}
                    >
                        {isShowcaseMode ? <Grid size={16} /> : <List size={16} />}
                        {isShowcaseMode ? 'Showcase Mode' : 'Admin View'}
                    </button>
                    
                    {!isShowcaseMode && (
                        <>
                            {isSelectMode && (
                                <Button 
                                    onClick={() => setIsBatchBarcodeModalOpen(true)} 
                                    disabled={selectedProductIds.length === 0}
                                    variant="secondary"
                                >
                                    <Printer className="w-4 h-4 mr-2" /> Print ({selectedProductIds.length})
                                </Button>
                            )}
                            <Button onClick={toggleSelectMode} variant={isSelectMode ? "secondary" : "primary"}>
                                {isSelectMode ? 'Cancel' : 'Select'}
                            </Button>
                        </>
                    )}
                </div>
            </div>
            
            {/* Search Bar with Scan */}
            <div className="flex items-center gap-2">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search products by name or ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                    />
                </div>
                <button 
                    onClick={() => setIsScanning(true)}
                    className="p-2 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                    title="Scan QR Code"
                >
                    <QrCode size={20} />
                </button>
            </div>
            
            {/* Selection Tool (Admin Mode only) */}
            {isSelectMode && !isShowcaseMode && (
                 <div className="flex items-center gap-2 mb-2">
                    <input 
                        type="checkbox" 
                        checked={selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={handleSelectAll}
                        className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                        id="select-all"
                    />
                    <label htmlFor="select-all" className="text-sm text-gray-700 dark:text-gray-300">Select All ({filteredProducts.length})</label>
                </div>
            )}

            {/* SHOWCASE MODE (GRID) */}
            {isShowcaseMode ? (
                filteredProducts.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 animate-fade-in-up">
                        {filteredProducts.map((product) => (
                            <div key={product.id} onClick={() => handleProductClick(product)} className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-md border border-gray-100 dark:border-slate-700 hover:shadow-xl transition-shadow flex flex-col h-full cursor-pointer group relative">
                                <div className="aspect-square w-full bg-gray-100 dark:bg-slate-700 relative overflow-hidden">
                                    <ProductImage 
                                        src={product.image} 
                                        alt={product.name} 
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                        onPreview={setPreviewImage}
                                        enableInteract={false} // Disable click-to-preview on the image directly in grid
                                    />
                                    
                                    {/* Full Screen Button - Visible Always on All Devices */}
                                    {product.image && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setPreviewImage(product.image!); 
                                            }}
                                            className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-100 transition-all duration-200 transform active:scale-95 hover:scale-110 z-10"
                                            title="View Full Screen"
                                        >
                                            <Maximize2 size={16} />
                                        </button>
                                    )}

                                    {product.quantity < 1 && (
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                                            <span className="bg-red-600 text-white px-3 py-1 text-xs font-bold uppercase tracking-widest rounded-sm">Out of Stock</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-3 flex flex-col flex-grow">
                                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 text-sm line-clamp-2 mb-1 flex-grow">{product.name}</h3>
                                    <div className="flex justify-between items-end mt-2">
                                        <span className="text-lg font-bold text-primary">₹{product.salePrice.toLocaleString('en-IN')}</span>
                                        {product.quantity > 0 && (
                                            <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">In Stock</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState 
                        icon={Boxes}
                        title="No Products Found"
                        description={searchTerm ? `No products match "${searchTerm}"` : "Your inventory is empty. Add products to get started."}
                    />
                )
            ) : (
            /* ADMIN MODE (LIST) */
            filteredProducts.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 animate-fade-in-up">
                    {filteredProducts.map((product, index) => (
                        <div 
                            key={product.id} 
                            className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border transition-all flex items-center gap-3 ${isSelectMode && selectedProductIds.includes(product.id) ? 'border-primary ring-1 ring-primary bg-primary/10 dark:bg-primary/20' : 'border-gray-100 dark:border-slate-700 hover:shadow-md cursor-pointer'}`}
                            style={{ animationDelay: `${index * 30}ms` }}
                            onClick={() => handleProductClick(product)}
                        >
                            {isSelectMode && (
                                 <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selectedProductIds.includes(product.id) ? 'bg-primary border-primary' : 'border-gray-400 bg-white dark:bg-slate-700'}`}>
                                    {selectedProductIds.includes(product.id) && <PackageCheck size={14} className="text-white" />}
                                </div>
                            )}
                            
                            <div className="w-12 h-12 rounded bg-gray-100 dark:bg-slate-700 overflow-hidden flex-shrink-0 border border-gray-200 dark:border-slate-600 relative">
                                <ProductImage 
                                    src={product.image} 
                                    alt={product.name} 
                                    className="w-full h-full object-cover"
                                    onPreview={setPreviewImage}
                                />
                            </div>

                            <div className="flex-grow min-w-0">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{product.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{product.id}</span>
                                        </div>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="font-bold text-primary">₹{product.salePrice.toLocaleString('en-IN')}</p>
                                        <div className="flex justify-end gap-2 text-xs">
                                            <span className={`font-medium ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                                Stock: {product.quantity}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState 
                    icon={Boxes}
                    title="No Products Found"
                    description={searchTerm ? `No products match "${searchTerm}"` : "Your inventory is empty. Add products via Purchase page or CSV import."}
                />
            )
            )}
        </div>
    );
};

export default ProductsPage;
