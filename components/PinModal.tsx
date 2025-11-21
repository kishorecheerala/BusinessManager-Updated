import React, { useState, useRef, useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import { Lock } from 'lucide-react';

interface PinModalProps {
    mode: 'setup' | 'enter';
    onSetPin?: (pin: string) => void;
    onCorrectPin?: () => void;
    correctPin?: string | null;
    onResetRequest?: () => void;
    onCancel?: () => void;
}

const PinModal: React.FC<PinModalProps> = ({ mode, onSetPin, onCorrectPin, correctPin, onResetRequest, onCancel }) => {
    const [pin, setPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    
    const pinInputRef = useRef<HTMLInputElement>(null);
    const confirmInputRef = useRef<HTMLInputElement>(null);
    const submitButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        // Auto-focus the first input when the modal appears
        setTimeout(() => {
            pinInputRef.current?.focus();
        }, 100);
    }, [mode]);
    
    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Allow only 4 digits
        if (/^\d{0,4}$/.test(value)) {
            setPin(value);
            setError('');
            
            if (value.length === 4) {
                if (mode === 'setup') {
                    confirmInputRef.current?.focus();
                } else {
                    // In enter mode, complete -> focus submit
                    pinInputRef.current?.blur();
                    submitButtonRef.current?.focus();
                }
            }
        }
    };

    const handleConfirmPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (/^\d{0,4}$/.test(value)) {
            setConfirmPin(value);
            setError('');
            
            if (value.length === 4) {
                // Blur to hide keyboard and focus submit button
                confirmInputRef.current?.blur();
                submitButtonRef.current?.focus();
            }
        }
    };

    const handleSubmit = () => {
        if (mode === 'setup') {
            if (pin.length !== 4) {
                setError('PIN must be 4 digits.');
                return;
            }
            if (pin !== confirmPin) {
                setError('PINs do not match.');
                return;
            }
            onSetPin?.(pin);
        } else { // 'enter' mode
            if (pin === correctPin) {
                onCorrectPin?.();
            } else {
                setError('Incorrect PIN. Please try again.');
                setPin('');
                // Refocus
                setTimeout(() => pinInputRef.current?.focus(), 100);
            }
        }
    };
    
    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    const title = mode === 'setup' ? 'Set a Security PIN' : 'Enter PIN';
    const description = mode === 'setup'
        ? 'Create a 4-digit PIN to secure your Business Insights.'
        : 'Enter your 4-digit PIN to continue.';

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
            <Card className="w-full max-w-sm animate-scale-in">
                <div className="text-center">
                    <Lock size={24} className="mx-auto text-primary mb-2" />
                    <h2 className="text-xl font-bold text-primary">{title}</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-4">{description}</p>
                </div>
                <div className="space-y-4">
                    <input
                        ref={pinInputRef}
                        type="password"
                        inputMode="numeric"
                        pattern="\d{4}"
                        maxLength={4}
                        value={pin}
                        onChange={handlePinChange}
                        onKeyPress={handleKeyPress}
                        className="w-full p-3 text-center text-2xl tracking-[1em] bg-gray-100 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                        placeholder="----"
                        autoComplete="off"
                    />
                    {mode === 'setup' && (
                        <input
                            ref={confirmInputRef}
                            type="password"
                            inputMode="numeric"
                            pattern="\d{4}"
                            maxLength={4}
                            value={confirmPin}
                            onChange={handleConfirmPinChange}
                            onKeyPress={handleKeyPress}
                            className="w-full p-3 text-center text-2xl tracking-[1em] bg-gray-100 border-2 border-gray-300 rounded-lg focus:border-primary focus:ring-primary dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                            placeholder="----"
                            autoComplete="off"
                        />
                    )}
                    {error && <p className="text-red-600 text-sm text-center">{error}</p>}
                    <div className="flex flex-col gap-2">
                        <Button ref={submitButtonRef} onClick={handleSubmit} className="w-full">
                            {mode === 'setup' ? 'Set PIN' : 'Unlock'}
                        </Button>
                        {onCancel && (
                             <Button onClick={onCancel} variant="secondary" className="w-full bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                                Go Back
                            </Button>
                        )}
                    </div>
                    {mode === 'enter' && onResetRequest && (
                        <button
                            onClick={onResetRequest}
                            className="text-sm text-center text-blue-600 hover:underline mt-2 w-full dark:text-blue-400"
                        >
                            Forgot PIN? Reset
                        </button>
                    )}
                </div>
            </Card>
        </div>
    );
};

export default PinModal;