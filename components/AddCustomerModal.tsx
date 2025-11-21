
import React, { useState } from 'react';
import Card from './Card';
import Button from './Button';
import { Customer } from '../types';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (customer: Customer) => void;
    existingCustomers: Customer[];
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onAdd, existingCustomers }) => {
    const [newCustomer, setNewCustomer] = useState({ id: '', name: '', phone: '', address: '', area: '', reference: '' });

    const handleSave = () => {
        const trimmedId = newCustomer.id.trim();
        if (!trimmedId) {
            alert('Customer ID is required.');
            return;
        }
        if (!newCustomer.name || !newCustomer.phone || !newCustomer.address || !newCustomer.area) {
            alert('Please fill all required fields (Name, Phone, Address, Area).');
            return;
        }

        const finalId = `CUST-${trimmedId}`;
        const isIdTaken = existingCustomers.some(c => c.id.toLowerCase() === finalId.toLowerCase());
        
        if (isIdTaken) {
            alert(`Customer ID "${finalId}" is already taken. Please choose another one.`);
            return;
        }

        const customerWithId: Customer = { 
            name: newCustomer.name,
            phone: newCustomer.phone,
            address: newCustomer.address,
            area: newCustomer.area,
            id: finalId,
            reference: newCustomer.reference || ''
        };
        
        onAdd(customerWithId);
        setNewCustomer({ id: '', name: '', phone: '', address: '', area: '', reference: '' });
        onClose();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNewCustomer({ ...newCustomer, [e.target.name]: e.target.value });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[51] p-4 animate-fade-in-fast">
            <Card title="Add New Customer" className="w-full max-w-md animate-scale-in">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer ID</label>
                        <div className="flex items-center mt-1">
                            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm dark:bg-slate-700 dark:border-slate-600 dark:text-gray-400">
                                CUST-
                            </span>
                            <input
                                type="text"
                                name="id"
                                placeholder="Enter unique ID"
                                value={newCustomer.id}
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded-r-md dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                                autoFocus
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                        <input type="text" placeholder="Full Name" name="name" value={newCustomer.name} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Phone</label>
                        <input type="text" placeholder="Phone Number" name="phone" value={newCustomer.phone} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address</label>
                        <input type="text" placeholder="Full Address" name="address" value={newCustomer.address} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Area/Location</label>
                        <input type="text" placeholder="e.g. Ameerpet" name="area" value={newCustomer.area} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference (Optional)</label>
                        <input type="text" placeholder="Referred by..." name="reference" value={newCustomer.reference} onChange={handleInputChange} className="w-full p-2 border rounded mt-1 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={handleSave} className="w-full">Save Customer</Button>
                        <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default AddCustomerModal;
