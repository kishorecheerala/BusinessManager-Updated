
import React, { useState } from 'react';
import { X, Download, Upload, Info, CheckCircle, XCircle, Users, Package as PackageIcon, Boxes } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { StoreName } from '../utils/db';
import { Customer, Supplier, Product } from '../types';
import Card from './Card';
import Button from './Button';

type Tab = 'customers' | 'suppliers' | 'products';

const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const StatusNotification: React.FC<{ status: { type: 'info' | 'success' | 'error', message: string } | null; onClose: () => void; }> = ({ status, onClose }) => {
    if (!status) return null;

    const variants = {
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
        error: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300',
    };
    const icons = {
        info: <Info className="w-5 h-5 mr-3 flex-shrink-0" />,
        success: <CheckCircle className="w-5 h-5 mr-3 flex-shrink-0" />,
        error: <XCircle className="w-5 h-5 mr-3 flex-shrink-0" />,
    };

    return (
        <div className={`p-3 rounded-md my-4 text-sm flex justify-between items-start ${variants[status.type]}`}>
            <div className="flex items-start">{icons[status.type]}<span>{status.message}</span></div>
            <button onClick={onClose} className="font-bold text-lg leading-none ml-4">&times;</button>
        </div>
    );
};


interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({ isOpen, onClose }) => {
  const { dispatch, showToast } = useAppContext();
  const [activeTab, setActiveTab] = useState<Tab>('customers');
  const [importStatus, setImportStatus] = useState<{ type: 'info' | 'success' | 'error', message: string } | null>(null);

  const templates = {
    customers: {
        fileName: 'customers-template.csv',
        headers: ['id', 'name', 'phone', 'address', 'area', 'reference'],
        example: ['CUST-UNIQUE-1', 'Test Customer', '9876543210', '123 Main St', 'Test Area', 'Friend'],
    },
    suppliers: {
        fileName: 'suppliers-template.csv',
        headers: ['id', 'name', 'phone', 'location', 'gstNumber', 'reference', 'account1', 'account2', 'upi'],
        example: ['SUPP-UNIQUE-1', 'Test Supplier', '1234567890', 'Test City', 'GSTIN123', 'Ref', '12345', '', 'test@upi'],
    },
    products: {
        fileName: 'products-template.csv',
        headers: ['id', 'name', 'quantity', 'purchasePrice', 'salePrice', 'gstPercent'],
        example: ['PROD-UNIQUE-1', 'Test Product', '10', '100', '200', '5'],
    }
  };

  const handleDownloadTemplate = (type: Tab) => {
    const { fileName, headers, example } = templates[type];
    const csvContent = "data:text/csv;charset=utf-8," 
        + [headers.join(','), example.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>, storeName: StoreName) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm(`Are you sure you want to import ${storeName}? This will REPLACE all existing ${storeName} data.`)) {
      if (event.target) (event.target as HTMLInputElement).value = '';
      return;
    }

    const reader = new FileReader();
    setImportStatus({ type: 'info', message: 'Reading file...' });

    reader.onload = (e) => {
        try {
            const text = e.target?.result as string;
            if (!text) throw new Error("Could not read file content.");

            const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
            if (lines.length < 2) throw new Error("CSV must have a header and at least one data row.");

            const headers = parseCsvLine(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
            const template = templates[storeName as Tab];
            const requiredHeaders = template.headers;
            
            if (requiredHeaders.some(rh => !headers.includes(rh))) {
                throw new Error(`CSV is missing required columns. Header must contain: ${requiredHeaders.join(', ')}.`);
            }

            const data: any[] = [];
            for (let i = 1; i < lines.length; i++) {
                const values = parseCsvLine(lines[i]);
                const row = headers.reduce((obj, header, index) => ({...obj, [header]: values[index]?.trim() || ''}), {} as any);
                if (!row.id) continue; // Skip rows without an ID

                let newItem: any = { id: row.id };
                if (storeName === 'customers') {
                    newItem = { id: row.id, name: row.name, phone: row.phone, address: row.address, area: row.area, reference: row.reference } as Customer;
                } else if (storeName === 'suppliers') {
                    newItem = { id: row.id, name: row.name, phone: row.phone, location: row.location, gstNumber: row.gstnumber, reference: row.reference, account1: row.account1, account2: row.account2, upi: row.upi } as Supplier;
                } else if (storeName === 'products') {
                    newItem = { 
                        id: row.id, name: row.name, 
                        quantity: parseInt(row.quantity, 10) || 0,
                        purchasePrice: parseFloat(row.purchaseprice) || 0,
                        salePrice: parseFloat(row.saleprice) || 0,
                        gstPercent: parseFloat(row.gstpercent) || 0
                    } as Product;
                }
                data.push(newItem);
            }

            dispatch({ type: 'REPLACE_COLLECTION', payload: { storeName, data }});
            setImportStatus({ type: 'success', message: `Successfully imported ${data.length} ${storeName}.`});
            showToast(`Import successful! ${data.length} ${storeName} loaded.`);

        } catch (error) {
             setImportStatus({ type: 'error', message: `Import error: ${(error as Error).message}`});
        } finally {
            if (event.target) (event.target as HTMLInputElement).value = '';
        }
    };
    reader.readAsText(file);
  };
  
  if (!isOpen) return null;

  const tabConfig = {
    customers: { label: "Customers", icon: Users, storeName: 'customers' as StoreName },
    suppliers: { label: "Suppliers", icon: PackageIcon, storeName: 'suppliers' as StoreName },
    products: { label: "Products", icon: Boxes, storeName: 'products' as StoreName },
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast" aria-modal="true" role="dialog">
      <Card className="w-full max-w-4xl animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-primary">Import Data from CSV</h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"><X size={24} /></button>
        </div>
        
        <div className="flex flex-col md:flex-row md:gap-8 mt-4">
            {/* Nav (Top on mobile, Left on desktop) */}
            <nav className="flex flex-row md:flex-col md:space-y-2 md:border-r md:pr-6 dark:border-slate-700 space-x-2 md:space-x-0 overflow-x-auto border-b md:border-b-0 pb-2 md:pb-0 mb-4 md:mb-0" aria-label="Tabs">
                {Object.entries(tabConfig).map(([key, { label, icon: Icon }]) => {
                    const isActive = activeTab === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key as Tab)}
                            className={`flex items-center gap-3 p-3 rounded-md text-left w-full transition-colors ${
                                isActive
                                    ? 'bg-primary text-white'
                                    : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-slate-700'
                            }`}
                            aria-current={isActive ? 'page' : undefined}
                        >
                            <Icon className="w-5 h-5" />
                            <span className="font-semibold">{label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Content */}
            <div className="flex-1">
                <div className="bg-blue-50 dark:bg-slate-700/50 border-l-4 border-blue-400 p-4 rounded-r-lg">
                    <h3 className="font-semibold text-blue-800 dark:text-blue-300">Instructions:</h3>
                    <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300/90 mt-2 space-y-1">
                        <li>Download the template CSV file.</li>
                        <li>Fill it with your data. <strong>Do not change the header row.</strong></li>
                        <li>Make sure each <strong>ID is unique</strong>. The import will fail if an ID already exists.</li>
                        <li>Upload the file. This will <strong>replace</strong> all existing data for this category.</li>
                    </ol>
                </div>

                <StatusNotification status={importStatus} onClose={() => setImportStatus(null)} />

                <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <Button onClick={() => handleDownloadTemplate(activeTab)} className="w-full">
                        <Download className="w-4 h-4 mr-2" /> Download Template
                    </Button>
                    <label htmlFor={`csv-import-${activeTab}`} className="px-4 py-2 rounded-md font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm flex items-center justify-center gap-2 transform hover:shadow-md hover:-translate-y-px active:shadow-sm active:translate-y-0 bg-secondary hover:bg-teal-500 focus:ring-secondary cursor-pointer w-full">
                        <Upload className="w-4 h-4 mr-2" /> Upload & Replace
                    </label>
                    <input
                        id={`csv-import-${activeTab}`}
                        type="file"
                        accept=".csv, text/csv, application/vnd.ms-excel, text/plain"
                        className="absolute opacity-0 w-0 h-0 pointer-events-none"
                        onChange={(e) => handleFileImport(e, tabConfig[activeTab].storeName)}
                        onClick={(event) => { (event.target as HTMLInputElement).value = '' }} // Reset file input
                    />
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
};
