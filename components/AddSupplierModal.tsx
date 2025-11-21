
import React, { useState } from 'react';
import { Supplier } from '../types';
import Card from './Card';
import Button from './Button';
import { X } from 'lucide-react';

const newSupplierInitialState = { id: '', name: '', phone: '', location: '', gstNumber: '', reference: '', account1: '', account2: '', upi: '' };

const AddSupplierModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (supplier: Supplier) => void;
    existingSuppliers: Supplier[];
}> = ({ isOpen, onClose, onAdd, existingSuppliers }) => {
    const [newSupplier, setNewSupplier] = useState(newSupplierInitialState);

    const handleSave = () => {
        const trimmedId = newSupplier.id.trim();
        if (!trimmedId) return alert('Supplier ID is required.');
        if (!newSupplier.name || !newSupplier.phone || !newSupplier.location) return alert('Please fill Name, Phone, and Location.');

        const finalId = `SUPP-${trimmedId}`;
        if (existingSuppliers.some(s => s.id.toLowerCase() === finalId.toLowerCase())) {
            return alert(`Supplier ID "${finalId}" is already taken.`);
        }

        const supplierToAdd: Supplier = { ...newSupplier, id: finalId };
        onAdd(supplierToAdd);
        setNewSupplier(newSupplierInitialState);
        onClose();
    };

    if (!isOpen) return null;

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[51] p-4 animate-fade-in-fast">
            <Card title="Add New Supplier" className="w-full max-w-md animate-scale-in max-h-[90vh] overflow-y-auto relative">
                 <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full text-gray-500 hover:bg-gray-100 transition-colors"><X size={20}/></button>
                 <div className="space-y-4 mt-2">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier ID</label>
                        <div className="flex items-center mt-1">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400">SUPP-</span>
                            <input type="text" placeholder="Unique ID" value={newSupplier.id} onChange={e => setNewSupplier({ ...newSupplier, id: e.target.value })} className="w-full p-2 border rounded-r-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" autoFocus />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name *</label>
                        <input type="text" placeholder="Supplier Name" value={newSupplier.name} onChange={e => setNewSupplier({ ...newSupplier, name: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone *</label>
                        <input type="text" placeholder="Phone Number" value={newSupplier.phone} onChange={e => setNewSupplier({ ...newSupplier, phone: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location *</label>
                        <input type="text" placeholder="City / Area" value={newSupplier.location} onChange={e => setNewSupplier({ ...newSupplier, location: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">GST Number</label>
                        <input type="text" placeholder="Optional" value={newSupplier.gstNumber} onChange={e => setNewSupplier({ ...newSupplier, gstNumber: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference</label>
                        <input type="text" placeholder="Optional" value={newSupplier.reference} onChange={e => setNewSupplier({ ...newSupplier, reference: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account 1</label>
                        <input type="text" placeholder="Optional" value={newSupplier.account1} onChange={e => setNewSupplier({ ...newSupplier, account1: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Bank Account 2</label>
                        <input type="text" placeholder="Optional" value={newSupplier.account2} onChange={e => setNewSupplier({ ...newSupplier, account2: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">UPI ID</label>
                        <input type="text" placeholder="Optional" value={newSupplier.upi} onChange={e => setNewSupplier({ ...newSupplier, upi: e.target.value })} className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSave} className="w-full">Save Supplier</Button>
                        <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default AddSupplierModal;
