import React, { useState, useEffect } from 'react';
import { Lock, Unlock, KeyRound, Delete } from 'lucide-react';
import Button from './Button';

interface PinLockProps {
    mode: 'unlock' | 'setup' | 'verify';
    onSuccess: (pin: string) => void;
    onCancel?: () => void;
    storedPin?: string; // For unlock mode
}

const PinLock: React.FC<PinLockProps> = ({ mode, onSuccess, onCancel, storedPin }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState(''); // Only for setup
    const [step, setStep] = useState<'enter' | 'confirm'>('enter'); // for setup flow
    const [error, setError] = useState('');

    const handleNumberClick = (num: number) => {
        if (error) setError('');
        if (pin.length < 4) {
            setPin(prev => prev + num);
        }
    };

    const handleDelete = () => {
        if (error) setError('');
        setPin(prev => prev.slice(0, -1));
    };

    const handleSubmit = () => {
        if (pin.length !== 4) return;

        if (mode === 'unlock') {
            if (pin === storedPin) {
                onSuccess(pin);
            } else {
                setError('Incorrect PIN');
                setPin('');
            }
        } else if (mode === 'setup') {
            if (step === 'enter') {
                setConfirmPin(pin);
                setPin('');
                setStep('confirm');
            } else {
                if (pin === confirmPin) {
                    onSuccess(pin);
                } else {
                    setError('PINs do not match. Try again.');
                    setPin('');
                    setConfirmPin('');
                    setStep('enter');
                }
            }
        }
    };

    useEffect(() => {
        if (pin.length === 4) {
            // Auto-submit for better UX
            const timer = setTimeout(() => handleSubmit(), 200);
            return () => clearTimeout(timer);
        }
    }, [pin]);

    const title = mode === 'unlock' ? 'App Locked'
        : mode === 'setup' ? (step === 'enter' ? 'Set New PIN' : 'Confirm PIN')
            : 'Enter PIN';

    const subtitle = mode === 'unlock' ? 'Enter your 4-digit PIN to access.'
        : mode === 'setup' ? (step === 'enter' ? 'Choose a secure 4-digit PIN.' : 'Re-enter to confirm.')
            : '';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-900/95 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border border-gray-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                        {mode === 'unlock' ? <Lock size={32} /> : <KeyRound size={32} />}
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center">{subtitle}</p>
                </div>

                {/* PIN Display */}
                <div className="flex justify-center gap-4 mb-8">
                    {[0, 1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length
                                    ? `bg-primary scale-110`
                                    : 'bg-gray-200 dark:bg-slate-700'
                                } ${error ? 'bg-red-500 animate-pulse' : ''}`}
                        />
                    ))}
                </div>

                {error && (
                    <p className="text-red-500 text-sm text-center mb-6 animate-bounce">{error}</p>
                )}

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                            key={num}
                            onClick={() => handleNumberClick(num)}
                            className="w-16 h-16 rounded-full text-2xl font-semibold bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary mx-auto"
                        >
                            {num}
                        </button>
                    ))}
                    <div /> {/* Spacer */}
                    <button
                        onClick={() => handleNumberClick(0)}
                        className="w-16 h-16 rounded-full text-2xl font-semibold bg-gray-50 dark:bg-slate-700 hover:bg-gray-100 dark:hover:bg-slate-600 text-gray-900 dark:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary mx-auto"
                    >
                        0
                    </button>
                    <button
                        onClick={handleDelete}
                        className="w-16 h-16 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors mx-auto"
                    >
                        <Delete size={24} />
                    </button>
                </div>

                {onCancel && (
                    <div className="text-center">
                        <button
                            onClick={onCancel}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PinLock;
