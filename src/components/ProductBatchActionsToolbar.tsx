
import React from 'react';
import { Trash2, Download, Printer, X, BookOpen, CheckSquare } from 'lucide-react';
import { Product } from '../types';
import { generateProductCatalogPDF } from '../utils/pdfGenerator';
import { useAppContext } from '../context/AppContext';

interface ProductBatchActionsToolbarProps {
    batchOps: any;
    allProducts: Product[];
    onPrintLabels: (selectedProducts: Product[]) => void;
    onDelete: (selectedIds: string[]) => void;
}

export const ProductBatchActionsToolbar: React.FC<ProductBatchActionsToolbarProps> = ({ batchOps, allProducts, onPrintLabels, onDelete }) => {
  const { state, showToast } = useAppContext();
  const { selectionCount, clearSelection, selectedItems } = batchOps;

  if (selectionCount === 0) return null;
  
  const getSelectedProducts = () => {
      return allProducts.filter(p => selectedItems.has(p.id));
  };

  const handleCatalog = async () => {
      const selected = getSelectedProducts();
      if (selected.length === 0) return;
      
      const includePrice = window.confirm("Include prices in the catalog?");
      
      try {
          const doc = await generateProductCatalogPDF(selected, state.profile, includePrice);
          const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
          doc.save(`Catalog_${dateStr}.pdf`);
          showToast("Catalog downloaded successfully!", "success");
          clearSelection();
      } catch (e) {
          console.error("Catalog error", e);
          showToast("Failed to generate catalog.", "error");
      }
  };

  const handlePrint = () => {
      const selected = getSelectedProducts();
      onPrintLabels(selected);
  };
  
  const handleDelete = () => {
      if (window.confirm(`Delete ${selectionCount} products? This cannot be undone.`)) {
          onDelete(Array.from(selectedItems));
          clearSelection();
      }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 animate-slide-up-fade min-w-[320px] justify-between border border-slate-700">
      <div className="flex items-center gap-3 pl-2">
        <span className="bg-white text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">{selectionCount}</span>
        <span className="text-sm font-medium hidden sm:inline">Selected</span>
        <button onClick={clearSelection} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleCatalog}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-blue-400 flex flex-col items-center gap-0.5"
          title="Create PDF Catalog"
        >
          <BookOpen size={18} />
        </button>
        <button
          onClick={handlePrint}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-yellow-400 flex flex-col items-center gap-0.5"
          title="Print Labels"
        >
          <Printer size={18} />
        </button>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button
          onClick={handleDelete}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-red-400 flex flex-col items-center gap-0.5"
          title="Delete Products"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};
