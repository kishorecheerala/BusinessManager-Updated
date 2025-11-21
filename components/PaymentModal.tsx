
import React from 'react';
import Card from './Card';
import Button from './Button';
import Dropdown from './Dropdown';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    totalAmount: number;
    dueAmount: number;
    paymentDetails: {
        amount: string;
        method: 'CASH' | 'UPI' | 'CHEQUE';
        date: string;
        reference: string;
    };
    setPaymentDetails: (details: any) => void;
    type?: 'sale' | 'purchase';
}

const PaymentModal: React.FC<PaymentModalProps> = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    totalAmount, 
    dueAmount, 
    paymentDetails, 
    setPaymentDetails,
    type = 'sale'
}) => {
    if (!isOpen) return null;

    const paymentMethodOptions = [
        { value: 'CASH', label: 'Cash' },
        { value: 'UPI', label: 'UPI' },
        { value: 'CHEQUE', label: 'Cheque' }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4 animate-fade-in-fast">
            <Card title="Add Payment" className="w-full max-w-sm animate-scale-in">
                <div className="space-y-4">
                    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg border dark:border-slate-600">
                        <p className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-400">Invoice Total:</span>
                            <span className="font-bold">₹{totalAmount.toLocaleString('en-IN')}</span>
                        </p>
                        <p className="flex justify-between text-sm mt-1">
                            <span className="text-gray-600 dark:text-gray-400">Amount Due:</span>
                            <span className="font-bold text-red-600">₹{dueAmount.toLocaleString('en-IN')}</span>
                        </p>
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Amount</label>
                        <input 
                            type="number" 
                            placeholder="Enter amount" 
                            value={paymentDetails.amount} 
                            onChange={e => setPaymentDetails({ ...paymentDetails, amount: e.target.value })} 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200" 
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
                         <Dropdown 
                            options={paymentMethodOptions}
                            value={paymentDetails.method}
                            onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Date</label>
                        <input 
                            type="date" 
                            value={paymentDetails.date} 
                            onChange={e => setPaymentDetails({ ...paymentDetails, date: e.target.value })} 
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Reference (Optional)</label>
                        <input 
                            type="text"
                            placeholder="e.g. UPI ID, Cheque No."
                            value={paymentDetails.reference}
                            onChange={e => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                            className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                        />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                       <Button onClick={onSubmit} className="w-full">Save Payment</Button>
                       <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default PaymentModal;
