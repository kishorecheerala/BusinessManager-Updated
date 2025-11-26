
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Edit, Save, X, Package, IndianRupee, Percent, PackageCheck, Barcode, Printer, Filter, Grid, List, Camera, Image as ImageIcon, Eye, Trash2, QrCode, Boxes, Maximize2 } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex flex-col items-center justify-center z-[150] p-4 animate-fade-in-fast">
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
    
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0] && editedProduct) {
            try {
                const base64 = await compressImage(e.target.files[0]);
                setEditedProduct({ ...editedProduct, image: base64 });
            } catch (error) {
                showToast("Error processing image.", 'error');
            }
        }
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
            <div className="space-y-4 animate-fade-in-fast">
                <BarcodeModal 
                    isOpen={isDownloadModalOpen} 
                    onClose={() => setIsDownloadModalOpen(false)} 
                    product={selectedProduct} 
                    businessName={state.profile?.name || 'Business Manager'}
                />
                <Button onClick={() => setSelectedProduct(null)}>&larr; Back to List</Button>
                <Card>
                    <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                            <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-gray-200 dark:border-slate-600 bg-gray-100 dark:bg-slate-700">
                                <ProductImage 
                                    src={selectedProduct.image} 
                                    alt={selectedProduct.name} 
                                    className="w-full h-full object-cover cursor-pointer"
                                    onPreview={setPreviewImage}
                                />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-primary">Product Details</h2>
                                <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">{selectedProduct.id}</span>
                            </div>
                        </div>
                        <div className="flex gap-2 items-center">
                             {isEditing ? (
                                <>
                                    <Button onClick={handleUpdateProduct} className="h-9 px-3"><Save size={16} /> Save</Button>
                                    <button onClick={() => setIsEditing(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={20}/></button>
                                </>
                            ) : (
                                <Button onClick={() => setIsEditing(true)}><Edit size={16}/> Edit</Button>
                            )}
                        </div>
                    </div>
                    
                     {isEditing ? (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Product Image</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        ref={fileInputRef} 
                                        className="hidden" 
                                        onChange={handleImageUpload}
                                    />
                                    <Button onClick={() => fileInputRef.current?.click()} variant="secondary" className="w-full">
                                        <Camera size={16} className="mr-2" /> 
                                        {editedProduct.image ? 'Change Photo' : 'Add Photo'}
                                    </Button>
                                    {editedProduct.image && (
                                        <button 
                                            onClick={() => setEditedProduct({...editedProduct, image: undefined})}
                                            className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div><label className="text-sm font-medium">Name</label><input type="text" name="name" value={editedProduct.name} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-sm font-medium">Purchase Price</label><input type="number" name="purchasePrice" value={editedProduct.purchasePrice} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                                <div><label className="text-sm font-medium">Sale Price</label><input type="number" name="salePrice" value={editedProduct.salePrice} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                            </div>
                            <div><label className="text-sm font-medium">GST %</label><input type="number" name="gstPercent" value={editedProduct.gstPercent} onChange={handleInputChange} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" /></div>
                        </div>
                    ) : (
                        <div className="space-y-2 text-gray-700 dark:text-gray-300">
                             <p className="text-lg font-semibold">{selectedProduct.name}</p>
                             <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="flex items-center gap-2"><Package size={16} className="text-gray-400"/> <span>Stock: {selectedProduct.quantity}</span></div>
                                <div className="flex items-center gap-2"><Percent size={16} className="text-gray-400"/> <span>GST: {selectedProduct.gstPercent}%</span></div>
                                {/* Buying Price HIDDEN from view, visible only in Edit mode above */}
                                <div className="flex items-center gap-2"><IndianRupee size={16} className="text-green-600"/> <span className="font-bold text-green-600 dark:text-green-400">Sell: ₹{selectedProduct.salePrice}</span></div>
                             </div>
                        </div>
                    )}
                    
                    <div className="mt-6 pt-4 border-t dark:border-slate-700">
                        <h4 className="font-semibold text-sm mb-2">Stock Adjustment</h4>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="number" 
                                value={newQuantity} 
                                onChange={(e) => setNewQuantity(e.target.value)} 
                                className="p-2 border rounded w-32 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
                                placeholder="New Qty"
                            />
                            <Button onClick={handleStockAdjustment} variant="secondary">Update Stock</Button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use this for manual corrections only. For purchases, use the Purchases page.</p>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t dark:border-slate-700">
                        <Button onClick={() => setIsDownloadModalOpen(true)} className="w-full">
                            <Barcode className="w-4 h-4 mr-2"/> Print / Download Barcode
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {isScanning && <QRScannerModal onClose={() => setIsScanning(false)} onScanned={handleScan} />}
            
            {/* Full Screen Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 bg-black bg-opacity-95 z-[200] flex items-center justify-center p-4 animate-fade-in-fast" onClick={() => setPreviewImage(null)}>
                    <div className="relative max-w-full max-h-full">
                        <button 
                            onClick={() => setPreviewImage(null)} 
                            className="absolute -top-12 right-0 p-2 rounded-full bg-white/20 text-white hover:bg-white/40 transition-colors"
                        >
                            <X size={24} />
                        </button>
                        <img src={previewImage} alt="Full Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
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
                                        enableInteract={false} // Disable click-to-preview on the image directly
                                    />
                                    
                                    {/* Full Screen Button - Visible on Mobile, Hover on Desktop */}
                                    {product.image && (
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setPreviewImage(product.image!); 
                                            }}
                                            className="absolute top-2 right-2 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-200 transform active:scale-95 md:hover:scale-110 z-10"
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
                                            {/* Purchase Price HIDDEN from view */}
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
