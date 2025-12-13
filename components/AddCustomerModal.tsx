import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card from './Card';
import Button from './Button';
import Input from './Input';
import Dropdown from './Dropdown';
import { Customer } from '../types';
import { useAppContext } from '../context/AppContext';
import { X, User, Phone, MapPin, LocateFixed } from 'lucide-react';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (customer: Customer) => void;
    existingCustomers: Customer[];
}

const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ isOpen, onClose, onAdd, existingCustomers }) => {
    const { showToast } = useAppContext();
    const [newCustomer, setNewCustomer] = useState({ id: '', name: '', phone: '', address: '', area: '', reference: '', priceTier: 'RETAIL' as 'RETAIL' | 'WHOLESALE' });

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleSave = () => {
        const trimmedId = newCustomer.id.trim();
        if (!trimmedId) {
            showToast('Customer ID is required.', 'error');
            return;
        }
        if (!newCustomer.name || !newCustomer.phone || !newCustomer.address || !newCustomer.area) {
            showToast('Please fill all required fields (Name, Phone, Address, Area).', 'error');
            return;
        }

        const finalId = `CUST-${trimmedId}`;
        const isIdTaken = existingCustomers.some(c => c.id.toLowerCase() === finalId.toLowerCase());

        if (isIdTaken) {
            showToast(`Customer ID "${finalId}" is already taken. Please choose another one.`, 'error');
            return;
        }

        const customerWithId: Customer = {
            name: newCustomer.name,
            phone: newCustomer.phone,
            address: newCustomer.address,
            area: newCustomer.area,
            id: finalId,
            reference: newCustomer.reference || '',
            priceTier: newCustomer.priceTier
        };

        onAdd(customerWithId);
        setNewCustomer({ id: '', name: '', phone: '', address: '', area: '', reference: '', priceTier: 'RETAIL' });
        onClose();
    };

    const handleUseLocation = () => {
        if (!navigator.geolocation) {
            showToast("Geolocation is not supported by your browser", "error");
            return;
        }

        const toastId = `geo-${Date.now()}`;
        showToast("Fetching location...", "info");

        navigator.geolocation.getCurrentPosition(async (pos) => {
            const { latitude, longitude } = pos.coords;
            try {
                // Attempt Reverse Geocoding using OpenStreetMap (Nominatim) - Free & No Key
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`, {
                    headers: {
                        'User-Agent': 'BusinessManagerApp/1.0'
                    }
                });
                const data = await response.json();

                if (data && data.display_name) {
                    setNewCustomer(prev => ({
                        ...prev,
                        address: data.display_name,
                        area: data.address?.city || data.address?.town || data.address?.village || data.address?.suburb || prev.area
                    }));
                    showToast("Precise location found!", "success");
                } else {
                    throw new Error("No address found");
                }
            } catch (e) {
                // Fallback to coordinates
                setNewCustomer(prev => ({ ...prev, address: `Lat: ${latitude.toFixed(6)}, Long: ${longitude.toFixed(6)}` }));
                showToast("Location coordinates captured.", "info");
            }
        }, (err) => {
            console.error("Geo Error", err);
            showToast("Unable to retrieve location. Please enable permissions.", "error");
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setNewCustomer({ ...newCustomer, [e.target.name]: e.target.value });
    };

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
            <div className="relative z-10 w-full sm:max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh] animate-scale-in overflow-hidden border border-gray-200 dark:border-slate-700">

                {/* Header */}
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center shrink-0 bg-gray-50 dark:bg-slate-900/50">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">Add New Customer</h2>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-grow space-y-6">

                    {/* ID Section */}
                    <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 ml-1">Customer ID</label>
                        <div className="flex items-center">
                            <span className="bg-gray-100 dark:bg-slate-700/50 border border-r-0 border-gray-200 dark:border-slate-600 px-3 py-3 rounded-l-lg text-sm text-gray-500 font-mono">CUST-</span>
                            <Input
                                type="text"
                                name="id"
                                placeholder="unique-id"
                                value={newCustomer.id}
                                onChange={handleInputChange}
                                className="rounded-l-none font-mono"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                            <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400"><User size={16} /></div>
                            Basic Information
                        </h3>

                        <div>
                            <Input
                                label="Full Name *"
                                type="text"
                                name="name"
                                placeholder="Enter Customer Name"
                                value={newCustomer.name}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                            <div className="relative">
                                <Input
                                    type="tel"
                                    name="phone"
                                    placeholder="Enter Phone Number"
                                    value={newCustomer.phone}
                                    onChange={handleInputChange}
                                    className="pl-10"
                                />
                                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    {/* Address & Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 border-b dark:border-slate-700 pb-2">
                            <div className="p-1.5 bg-green-100 dark:bg-green-900/30 rounded-md text-green-600 dark:text-green-400"><MapPin size={16} /></div>
                            Address & Details
                        </h3>

                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Address *</label>
                                <button
                                    onClick={handleUseLocation}
                                    className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                                    title="Use Current Location"
                                >
                                    <LocateFixed size={12} /> Use Current Location
                                </button>
                            </div>
                            <Input
                                type="text"
                                name="address"
                                placeholder="House No, Street, Landmark"
                                value={newCustomer.address}
                                onChange={handleInputChange}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Input
                                    label="Area / City *"
                                    type="text"
                                    name="area"
                                    placeholder="e.g. Ameerpet"
                                    value={newCustomer.area}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pricing Tier</label>
                                <Dropdown
                                    options={[
                                        { value: 'RETAIL', label: 'Retail' },
                                        { value: 'WHOLESALE', label: 'Wholesale' }
                                    ]}
                                    value={newCustomer.priceTier}
                                    onChange={(val) => setNewCustomer({ ...newCustomer, priceTier: val as 'RETAIL' | 'WHOLESALE' })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t dark:border-slate-700 flex gap-3 bg-gray-50 dark:bg-slate-900/50 shrink-0">
                    <Button onClick={handleSave} className="flex-[2] py-3.5 rounded-xl shadow-lg shadow-indigo-200 dark:shadow-none font-bold">
                        Save Customer
                    </Button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-xl font-semibold bg-white text-gray-700 hover:bg-gray-100 border border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:border-slate-600 transition-all"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default AddCustomerModal;