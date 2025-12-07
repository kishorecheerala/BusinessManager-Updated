
import React from 'react';
import Card from './Card';
import Button from './Button';
import Dropdown from './Dropdown';
import DateInput from './DateInput';
import Input from './Input';
import { useAppContext } from '../context/AppContext';

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
    const { showToast } = useAppContext();

    if (!isOpen) return null;

    const paymentMethodOptions = [
        { value: 'CASH', label: 'Cash' },
        { value: 'UPI', label: 'UPI' },
        { value: 'CHEQUE', label: 'Cheque' }
    ];

    const handleSubmit = () => {
        if (!paymentDetails.amount || parseFloat(paymentDetails.amount) <= 0) {
            showToast("Please enter a valid amount.", 'error');
            return;
        }
        onSubmit();
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] p-4 animate-fade-in-fast">
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
                        <Input 
                            label="Amount"
                            type="number" 
                            placeholder="Enter amount" 
                            value={paymentDetails.amount} 
                            onChange={e => setPaymentDetails({ ...paymentDetails, amount: e.target.value })} 
                            autoFocus
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Method</label>
                         <Dropdown 
                            options={paymentMethodOptions}
                            value={paymentDetails.method}
                            onChange={(val) => setPaymentDetails({ ...paymentDetails, method: val as any })}
                        />
                    </div>
                    
                    <DateInput
                        label="Payment Date"
                        value={paymentDetails.date} 
                        onChange={e => setPaymentDetails({ ...paymentDetails, date: e.target.value })} 
                    />
                    
                    <div>
                        <Input 
                            label="Reference (Optional)"
                            type="text"
                            placeholder="e.g. UPI ID, Cheque No."
                            value={paymentDetails.reference}
                            onChange={e => setPaymentDetails({ ...paymentDetails, reference: e.target.value })}
                        />
                    </div>
                    
                    <div className="flex gap-2 pt-2">
                       <Button onClick={handleSubmit} className="w-full">Save Payment</Button>
                       <Button onClick={onClose} variant="secondary" className="w-full">Cancel</Button>
                    </div>
                </div>
            </Card>
        </div>
    );
};

export default PaymentModal;
