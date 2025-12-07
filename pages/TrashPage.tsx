
import React, { useState, useMemo } from 'react';
import { Trash2, RotateCcw, X, Search, Filter } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import Input from '../components/Input';
import Dropdown from '../components/Dropdown';
import { useDialog } from '../context/DialogContext';
import { TrashItem, Page } from '../types';

interface TrashPageProps {
  setCurrentPage: (page: Page) => void;
}

const TrashPage: React.FC<TrashPageProps> = ({ setCurrentPage }) => {
  const { state, dispatch, showToast } = useAppContext();
  const { showConfirm } = useDialog();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const trashItems = state.trash || [];

  const filteredItems = useMemo(() => {
    return trashItems.filter(item => {
      const matchesSearch = JSON.stringify(item.data).toLowerCase().includes(searchTerm.toLowerCase()) || item.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || item.originalStore === filterType;
      return matchesSearch && matchesType;
    }).sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());
  }, [trashItems, searchTerm, filterType]);

  const handleRestore = async (item: TrashItem) => {
    const confirmed = await showConfirm(`Restore ${item.originalStore.slice(0, -1)} "${item.id}"?`, {
      title: "Restore Item",
      confirmText: "Restore",
      variant: "primary"
    });

    if (confirmed) {
      dispatch({ type: 'RESTORE_FROM_TRASH', payload: item });
      showToast("Item restored successfully.", 'success');
    }
  };

  const handleDeletePermanently = async (id: string) => {
    const confirmed = await showConfirm("Delete this item permanently? This cannot be undone.", {
      title: "Permanent Delete",
      confirmText: "Delete Forever",
      variant: "danger"
    });

    if (confirmed) {
      dispatch({ type: 'PERMANENTLY_DELETE_FROM_TRASH', payload: id });
      showToast("Item deleted permanently.");
    }
  };

  const renderItemDetails = (item: TrashItem) => {
    const data = item.data;
    let title = item.id;
    let sub = '';

    switch (item.originalStore) {
        case 'sales':
            title = `Sale Invoice #${data.id}`;
            sub = `Total: ₹${data.totalAmount} | Date: ${new Date(data.date).toLocaleDateString()}`;
            break;
        case 'purchases':
            title = `Purchase #${data.id}`;
            sub = `Total: ₹${data.totalAmount} | Date: ${new Date(data.date).toLocaleDateString()}`;
            break;
        case 'expenses':
            title = `Expense: ${data.category}`;
            sub = `Amount: ₹${data.amount} | Note: ${data.note || '-'}`;
            break;
        case 'quotes':
            title = `Estimate #${data.id}`;
            sub = `Total: ₹${data.totalAmount}`;
            break;
        case 'customers':
            title = `Customer: ${data.name}`;
            sub = `Phone: ${data.phone}`;
            break;
        default:
            title = `${item.originalStore} #${item.id}`;
            break;
    }

    return (
        <div className="flex-grow min-w-0">
            <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400">
                    {item.originalStore}
                </span>
                <h3 className="font-bold text-gray-800 dark:text-white truncate">{title}</h3>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{sub}</p>
            <p className="text-xs text-red-400 mt-1">Deleted: {new Date(item.deletedAt).toLocaleString()}</p>
        </div>
    );
  };

  const filterOptions = [
      { value: 'all', label: 'All Types' },
      { value: 'sales', label: 'Sales' },
      { value: 'purchases', label: 'Purchases' },
      { value: 'expenses', label: 'Expenses' },
      { value: 'quotes', label: 'Estimates' },
      { value: 'customers', label: 'Customers' }
  ];

  return (
    <div className="space-y-6 animate-fade-in-fast pb-20">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
          <Trash2 size={24} className="text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Recycle Bin</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Restore deleted items or remove them forever</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input 
                type="text" 
                placeholder="Search deleted items..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 focus:ring-red-500"
            />
        </div>
        <div className="relative min-w-[150px]">
            <Dropdown 
                options={filterOptions}
                value={filterType}
                onChange={setFilterType}
                icon="chevron"
            />
        </div>
      </div>

      {filteredItems.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-slate-700">
              <Trash2 size={48} className="mx-auto text-gray-300 dark:text-slate-600 mb-4" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">Bin is empty</p>
              <p className="text-sm text-gray-400">No deleted items found matching your criteria.</p>
          </div>
      ) : (
          <div className="grid gap-3">
              {filteredItems.map(item => (
                  <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border dark:border-slate-700 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                      <div className="flex items-start gap-3 overflow-hidden">
                          <div className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg shrink-0 text-gray-500">
                             <Trash2 size={20} />
                          </div>
                          {renderItemDetails(item)}
                      </div>
                      <div className="flex gap-2 shrink-0 self-end sm:self-center">
                          <Button onClick={() => handleRestore(item)} className="h-9 text-xs bg-emerald-600 hover:bg-emerald-700">
                              <RotateCcw size={14} className="mr-1.5" /> Restore
                          </Button>
                          <Button onClick={() => handleDeletePermanently(item.id)} variant="secondary" className="h-9 text-xs text-red-600 hover:bg-red-50 border-red-100">
                              <X size={14} className="mr-1.5" /> Delete Forever
                          </Button>
                      </div>
                  </div>
              ))}
          </div>
      )}
    </div>
  );
};

export default TrashPage;
