import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Edit, Save, X, Package, IndianRupee, Percent, PackageCheck, Barcode, AlertTriangle, Printer, QrCode } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Product, PurchaseItem } from '../types';
import Card from '../components/Card';
import Button from '../components/Button';
import { BarcodeModal } from '../components/BarcodeModal';
import BatchBarcodeModal from '../components/BatchBarcodeModal';

interface ProductsPageProps {
  setIsDirty: (isDirty: boolean) => void;
}

const ProductsPage: React.FC<ProductsPageProps> = ({ setIsDirty }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editedProduct, setEditedProduct] = useState<Product | null>(null);
    const [newQuantity, setNewQuantity] = useState<string>('');
    const isDirtyRef = useRef(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    
    // State for multi-select
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
    const [isBatchBarcodeModalOpen, setIsBatchBarcodeModalOpen] = useState(false);
    
    useEffect(() => {
        if (state.selection && state.selection.page === 'PRODUCTS') {
            const productToSelect = state.products.find(p => p.id === state.selection.id);
            if (productToSelect) {
                setSelectedProduct(productToSelect);
            }
            dispatch({ type: 'CLEAR_SELECTION' });
        }
    }, [state.selection, state.products, dispatch]);
    
    useEffect(() => {
        let formIsDirty = false;
        if (selectedProduct) {
            const quantityChanged = newQuantity !== '' && parseInt(newQuantity, 10) !== selectedProduct.quantity;
            formIsDirty = isEditing || quantityChanged;
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

    const handleUpdateProduct = () => {
        if (editedProduct) {
             if (window.confirm('Are you sure you want to update this product\'s details?')) {
                dispatch({ type: 'UPDATE_PRODUCT', payload: editedProduct });
                setIsEditing(false);
                showToast("Product details updated successfully.");
            }
        }
    };

    const handleStockAdjustment = () => {
        if (selectedProduct && newQuantity !== '') {
            const newQty = parseInt(newQuantity, 10);
            if (!isNaN(newQty)) {
                const change = newQty - selectedProduct.quantity;
                if (change === 0) return;

                if (window.confirm(`Confirm stock adjustment? New quantity will be ${newQty}.`)) {
                    dispatch({ type: 'UPDATE_PRODUCT_STOCK', payload: { productId: selectedProduct.id, change } });
                    showToast("Stock updated successfully.");
                }
            }
        }
    };

    const filteredProducts = state.products.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            <div className="space-y-4">
                <BarcodeModal 
                    isOpen={isDownloadModalOpen} 
                    onClose={() => setIsDownloadModalOpen(false)} 
                    product={selectedProduct} 
                    businessName={state.profile?.name || 'Business Manager'}
                />
                <Button onClick={() => setSelectedProduct(null)}>&larr; Back to List</Button>
                <Card>
                    <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-2">
                            <h2 className="text-lg font-bold text-primary">Product Details</h2>
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">{selectedProduct.id}</span>
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
                                <div className="flex items-center gap-2"><IndianRupee size={16} className="text-gray-400"/> <span>Buy: ₹{selectedProduct.purchasePrice}</span></div>
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
                    <h1 className="text-2xl font-bold text-primary">Products Inventory</h1>
                    <span className="text-xs sm:text-sm font-bold bg-gradient-to-r from-teal-600 to-emerald-600 text-white px-3 py-1 rounded-full shadow-md border border-teal-500/30">
                        {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                </div>
                <div className="flex gap-2">
                    {isSelectMode && (
                         <Button 
                            onClick={() => setIsBatchBarcodeModalOpen(true)} 
                            disabled={selectedProductIds.length === 0}
                            variant="secondary"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Print Selected ({selectedProductIds.length})
                        </Button>
                    )}
                    <Button onClick={toggleSelectMode} variant={isSelectMode ? "secondary" : "primary"}>
                        {isSelectMode ? 'Cancel Selection' : 'Select Multiple'}
                    </Button>
                </div>
            </div>
            
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Search products by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                />
            </div>
            
            {isSelectMode && (
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

            <div className="grid grid-cols-1 gap-3">
                {filteredProducts.map((product, index) => (
                    <div 
                        key={product.id} 
                        className={`bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border transition-all animate-slide-up-fade flex items-center gap-3 ${isSelectMode && selectedProductIds.includes(product.id) ? 'border-primary ring-1 ring-primary bg-teal-50 dark:bg-teal-900/20' : 'border-gray-100 dark:border-slate-700 hover:shadow-md cursor-pointer'}`}
                        style={{ animationDelay: `${index * 30}ms` }}
                        onClick={() => handleProductClick(product)}
                    >
                        {isSelectMode && (
                             <div className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 ${selectedProductIds.includes(product.id) ? 'bg-primary border-primary' : 'border-gray-400 bg-white dark:bg-slate-700'}`}>
                                {selectedProductIds.includes(product.id) && <PackageCheck size={14} className="text-white" />}
                            </div>
                        )}
                        <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200 truncate">{product.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">{product.id}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                    <p className="font-bold text-primary">₹{product.salePrice.toLocaleString('en-IN')}</p>
                                    <p className={`text-xs font-medium ${product.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>
                                        Stock: {product.quantity}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                {filteredProducts.length === 0 && (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8">No products found.</p>
                )}
            </div>
        </div>
    );
};

export default ProductsPage;