import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Card from './Card';
import Button from './Button';
import { Lock } from 'lucide-react';
import Input from './Input';

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
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
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

    return createPortal(
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onCancel} />
            <Card title={title} className="relative z-10 w-full max-w-sm animate-scale-in shadow-2xl bg-white dark:bg-slate-900 border dark:border-slate-700">
                <div className="space-y-6">
                    <div className="text-center">
                        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock size={32} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-center">
                            <Input
                                ref={pinInputRef}
                                type="password"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={pin}
                                onChange={handlePinChange}
                                onKeyDown={handleKeyPress}
                                placeholder="----"
                                maxLength={4}
                                className="w-48 text-center text-3xl tracking-[0.5em] font-mono !p-2 !border-0 !border-b-2 !border-slate-300 focus:!border-indigo-500 !bg-transparent !rounded-none"
                                autoFocus
                            />
                        </div>

                        {mode === 'setup' && (
                            <div className="flex justify-center animate-fade-in-up">
                                <Input
                                    ref={confirmInputRef}
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    value={confirmPin}
                                    onChange={handleConfirmPinChange}
                                    onKeyDown={handleKeyPress}
                                    placeholder="----"
                                    maxLength={4}
                                    className="w-48 text-center text-3xl tracking-[0.5em] font-mono !p-2 !border-0 !border-b-2 !border-slate-300 focus:!border-indigo-500 !bg-transparent !rounded-none"
                                />
                            </div>
                        )}

                        {error && <p className="text-sm text-red-500 text-center font-medium animate-shake">{error}</p>}
                    </div>

                    <div className="flex gap-3 pt-2">
                        {onCancel && (
                            <Button onClick={onCancel} variant="secondary" className="flex-1">
                                Cancel
                            </Button>
                        )}
                        <Button 
                            ref={submitButtonRef} 
                            onClick={handleSubmit} 
                            className={`flex-1 shadow-lg ${onCancel ? '' : 'w-full'}`}
                        >
                            {mode === 'setup' ? 'Set PIN' : 'Unlock'}
                        </Button>
                    </div>
                </div>
            </Card>
        </div>,
        document.body
    );
};

export default PinModal;
