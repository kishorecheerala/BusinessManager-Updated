
import React, { useState } from 'react';
import { Search, X, Image as ImageIcon } from 'lucide-react';
import { Product } from '../types';
import Card from './Card';

interface ProductSearchModalProps {
    products: Product[];
    onClose: () => void;
    onSelect: (product: Product) => void;
}

const ProductSearchModal: React.FC<ProductSearchModalProps> = ({ products, onClose, onSelect }) => {
    const [productSearchTerm, setProductSearchTerm] = useState('');

    return (
        <div 
            style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0, 
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            className="p-4"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
          <Card className="relative z-10 w-full max-w-lg animate-scale-in">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Select Product</h2>
              <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
                <X size={20}/>
              </button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search products..."
                value={productSearchTerm}
                onChange={e => setProductSearchTerm(e.target.value)}
                className="w-full p-2 pl-10 border rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                autoFocus
              />
            </div>
            <div className="mt-4 max-h-80 overflow-y-auto space-y-2 custom-scrollbar">
              {products
                .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()))
                .map(p => (
                <div key={p.id} onClick={() => onSelect(p)} className="p-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-teal-50 dark:hover:bg-slate-700 flex items-center gap-3 transition-colors">
                  <div className="w-10 h-10 rounded bg-white dark:bg-slate-600 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-slate-600 shrink-0">
                      {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                          <ImageIcon size={16} className="text-gray-400" />
                      )}
                  </div>
                  <div className="flex-grow min-w-0">
                    <p className="font-semibold truncate">{p.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono truncate">{p.id}</p>
                  </div>
                  <div className="text-right shrink-0">
                      <p className="font-semibold text-primary">₹{Number(p.salePrice).toLocaleString('en-IN')}</p>
                      <p className={`text-xs ${p.quantity < 5 ? 'text-red-500 font-bold' : 'text-gray-500'}`}>Stock: {p.quantity}</p>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-center text-gray-500 py-4">No products found.</p>}
            </div>
          </Card>
        </div>
    );
};

export default ProductSearchModal;
