
import React, { useState, useEffect } from 'react';
import { Supplier } from '../types';
import Button from './Button';
import Card from './Card';
import Input from './Input';
import { X, User, Phone, MapPin, CreditCard, FileText, Hash } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const defaultSupplierState = { id: '', name: '', phone: '', location: '', gstNumber: '', reference: '', account1: '', account2: '', upi: '' };

interface AddSupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: Supplier) => void;
    existingSuppliers: Supplier[];
    initialData?: Supplier | null;
    inline?: boolean;
}

const AddSupplierModal: React.FC<AddSupplierModalProps> = ({ isOpen, onClose, onSave, existingSuppliers, initialData, inline = false }) => {
    const { showToast } = useAppContext();
    const [formData, setFormData] = useState(defaultSupplierState);
    const isEditMode = !!initialData;

    useEffect(() => {
        if (isOpen || inline) {
            if (initialData) {
                setFormData({ ...defaultSupplierState, ...initialData });
            } else {
                setFormData(defaultSupplierState);
            }
        }
    }, [isOpen, inline, initialData]);

    const handleSave = () => {
        const trimmedId = formData.id.trim();
        if (!trimmedId) {
            showToast('Supplier ID is required.', 'error');
            return;
        }
        if (!formData.name || !formData.phone || !formData.location) {
            showToast('Please fill Name, Phone, and Location.', 'error');
            return;
        }

        if (!isEditMode) {
            const finalId = `SUPP-${trimmedId}`;
            if (existingSuppliers.some(s => s.id.toLowerCase() === finalId.toLowerCase())) {
                showToast(`Supplier ID "${finalId}" is already taken.`, 'error');
                return;
            }
            onSave({ ...formData, id: finalId });
        } else {
            onSave(formData);
        }
        
        if (!inline) onClose();
    };

    const handleChange = (field: keyof Supplier, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen && !inline) return null;

    const formContent = (
        <div className="space-y-6">
            {/* ID Section */}
            <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-1">Unique ID</label>
                {isEditMode ? (
                        <div className="w-full p-3 bg-gray-100 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-xl text-gray-600 dark:text-gray-300 font-mono font-bold">
                        {formData.id}
                        </div>
                ) : (
                    <div className="flex items-center">
                        <span className="bg-gray-100 dark:bg-slate-700/50 border border-r-0 border-gray-200 dark:border-slate-600 px-3 py-3 rounded-l-xl text-sm text-gray-500 font-mono">SUPP-</span>
                        <Input 
                            type="text" 
                            placeholder="unique id" 
                            value={formData.id} 
                            onChange={e => handleChange('id', e.target.value)}
                            className="rounded-l-none font-mono"
                            autoFocus={!isEditMode}
                        />
                    </div>
                )}
            </div>

            {/* Basic Info */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900/30 rounded-md text-purple-600 dark:text-purple-400"><User size={16}/></div>
                    Basic Information
                </h3>
                
                <div>
                    <Input 
                        label="Supplier Name *"
                        type="text" 
                        placeholder="Enter Supplier Name" 
                        value={formData.name} 
                        onChange={e => handleChange('name', e.target.value)} 
                    />
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                    <div className="relative">
                        <Input 
                            type="tel" 
                            placeholder="Enter Phone Number" 
                            value={formData.phone} 
                            onChange={e => handleChange('phone', e.target.value)} 
                            className="pl-10"
                        />
                        <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location *</label>
                    <div className="relative">
                        <Input 
                            type="text"
                            value={formData.location} 
                            onChange={(e) => handleChange('location', e.target.value)}
                            placeholder="City / Area"
                            className="pl-10"
                        />
                        <MapPin size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>
            </div>

            {/* Official Details */}
            <div className="space-y-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400"><FileText size={16}/></div>
                    Official Details
                </h3>
                <div>
                    <Input 
                        label="GST Number"
                        type="text" 
                        placeholder="Optional" 
                        value={formData.gstNumber} 
                        onChange={e => handleChange('gstNumber', e.target.value)} 
                        className="uppercase"
                    />
                </div>
                <div>
                    <Input 
                        label="Reference"
                        type="text" 
                        placeholder="Optional" 
                        value={formData.reference} 
                        onChange={e => handleChange('reference', e.target.value)} 
                    />
                </div>
            </div>

            {/* Banking (Collapsible or Compact) */}
            <div className="space-y-4 pt-2">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                    <div className="p-1.5 bg-teal-100 dark:bg-teal-900/30 rounded-md text-teal-600 dark:text-teal-400"><CreditCard size={16}/></div>
                    Banking (Optional)
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Input label="Account 1" type="text" value={formData.account1} onChange={e => handleChange('account1', e.target.value)} placeholder="Acc No."/>
                    </div>
                    <div>
                        <Input label="Account 2" type="text" value={formData.account2} onChange={e => handleChange('account2', e.target.value)} placeholder="Acc No."/>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UPI ID</label>
                    <div className="relative">
                        <Input type="text" value={formData.upi} onChange={e => handleChange('upi', e.target.value)} className="pl-9" placeholder="user@upi"/>
                        <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                    </div>
                </div>
            </div>
        </div>
    );

    const footerButtons = (
        <div className={`flex gap-3 ${inline ? 'mt-6' : 'p-4 border-t dark:border-slate-700 flex gap-3 bg-white dark:bg-slate-800 shrink-0 pb-6 sm:pb-4'}`}>
            <Button onClick={handleSave} className={inline ? "w-full py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none" : "flex-[2] font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none"}>
                {isEditMode ? 'Save Changes' : 'Save Supplier'}
            </Button>
            <button 
                onClick={onClose} 
                className={inline ? "w-full py-3.5 rounded-xl font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600" : "flex-1 py-3.5 rounded-xl font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30 dark:border-red-800/50 transition-all"}
            >
                Cancel
            </button>
        </div>
    );

    if (inline) {
        return (
            <Card title={isEditMode ? 'Edit Supplier' : 'Add New Supplier'} className="animate-slide-up-fade">
                {formContent}
                {footerButtons}
            </Card>
        );
    }

    return (
         <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-[100] sm:p-4 backdrop-blur-sm transition-all" role="dialog" aria-modal="true">
            {/* Modal Container - Bottom Sheet on Mobile, Centered Card on Desktop */}
            <div className="w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col h-[85vh] sm:h-auto sm:max-h-[90vh] animate-slide-up-fade sm:animate-scale-in overflow-hidden border-t sm:border border-gray-200 dark:border-slate-700">
                 
                 {/* Header */}
                 <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0 relative">
                    {/* Drag Handle for Mobile aesthetics */}
                    <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-300 dark:bg-slate-600 rounded-full sm:hidden"></div>
                    
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mt-2 sm:mt-0">{isEditMode ? 'Edit Supplier' : 'Add New Supplier'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors mt-2 sm:mt-0">
                        <X size={20}/>
                    </button>
                 </div>

                 {/* Scrollable Body */}
                 <div className="p-5 overflow-y-auto custom-scrollbar flex-grow">
                    {formContent}
                 </div>

                 {/* Footer */}
                 {footerButtons}
            </div>
        </div>
    );
};

export default AddSupplierModal;
