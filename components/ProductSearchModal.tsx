import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
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
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in-fast">
          <Card className="w-full max-w-lg animate-scale-in">
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
            <div className="mt-4 max-h-80 overflow-y-auto space-y-2">
              {products
                .filter(p => p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()))
                .map(p => (
                <div key={p.id} onClick={() => onSelect(p)} className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-teal-50 dark:hover:bg-slate-700 flex justify-between items-center">
                  <div>
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Code: {p.id}</p>
                  </div>
                  <div className="text-right">
                      <p className="font-semibold">₹{Number(p.salePrice).toLocaleString('en-IN')}</p>
                      <p className="text-sm">Stock: {p.quantity}</p>
                  </div>
                </div>
              ))}
              {products.length === 0 && <p className="text-center text-gray-500">No products found.</p>}
            </div>
          </Card>
        </div>
    );
};

export default ProductSearchModal;