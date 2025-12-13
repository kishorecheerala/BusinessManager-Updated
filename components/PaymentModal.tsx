import React from 'react';
import Card from './Card';
import Button from './Button';
import Dropdown from './Dropdown';
import ModernDateInput from './ModernDateInput';
import Input from './Input';
import { useAppContext } from '../context/AppContext';
import { Smartphone } from 'lucide-react';

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
        accountId?: string;
    };
    setPaymentDetails: (details: any) => void;
    type?: 'sale' | 'purchase';
    title?: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    totalAmount,
    dueAmount,
    paymentDetails,
    setPaymentDetails,
    type = 'sale',
    title = 'Add Payment'
}) => {
    const { state, showToast } = useAppContext();

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

    const accountOptions = [
        { value: '', label: 'Select Account (Optional)' },
        ...(state.bankAccounts || []).map(acc => ({
            value: acc.id,
            label: `${acc.name} (${acc.type})`
        }))
    ];

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}
            className="p-4"
        >
            <div className="absolute inset-0 bg-black/50 animate-fade-in-fast" onClick={onClose} />
            <Card title={title} className="relative z-10 w-full max-w-sm animate-scale-in">
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

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            {type === 'sale' ? 'Deposit To Account' : 'Paid From Account'}
                        </label>
                        <Dropdown
                            options={accountOptions}
                            value={paymentDetails.accountId || ''}
                            onChange={(val) => setPaymentDetails({ ...paymentDetails, accountId: val })}
                        />
                        {(!state.bankAccounts || state.bankAccounts.length === 0) && (
                            <p className="text-xs text-amber-600 mt-1">
                                * No bank accounts found. Add them in your Profile.
                            </p>
                        )}
                    </div>

                    <ModernDateInput
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

                    {/* Mobile Payment Deep Link */}
                    {paymentDetails.method === 'UPI' && paymentDetails.amount && (
                        <button
                            onClick={() => {
                                const upiId = state.invoiceTemplate.content.upiId;
                                const name = state.invoiceTemplate.content.payeeName || state.profile?.name;

                                if (!upiId) {
                                    showToast("Please configure UPI ID in Invoice Settings first.", "error");
                                    return;
                                }
                                const url = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(name || '')}&am=${paymentDetails.amount}&cu=INR`;
                                window.location.href = url;
                            }}
                            className="w-full flex items-center justify-center gap-2 p-2 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 hover:bg-indigo-100 transition-colors text-sm font-semibold"
                        >
                            <Smartphone size={16} /> Open UPI App / GPay
                        </button>
                    )}

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
