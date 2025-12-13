import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, ShoppingBag, ArrowRight, Store } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ProfileData } from '../types';
import Button from './Button';

interface OnboardingScreenProps {
    isOpen: boolean;
    onClose: () => void;
}

const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ isOpen, onClose }) => {
    const { dispatch, googleSignIn, showToast } = useAppContext();
    const [businessName, setBusinessName] = useState('');
    const [ownerName, setOwnerName] = useState('');

    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleStart = () => {
        if (!businessName.trim() || !ownerName.trim()) {
            showToast("Please enter your business details to continue.", 'error');
            return;
        }

        const newProfile: ProfileData = {
            id: 'userProfile',
            name: businessName,
            ownerName: ownerName,
            phone: '',
            address: '',
            gstNumber: '',
            logo: ''
        };
        dispatch({ type: 'SET_PROFILE', payload: newProfile });
        showToast("Welcome! Your business is ready.", 'success');
        onClose();
    };

    const handleRestore = () => {
        // Trigger Google Sign In to check for backups
        googleSignIn();
        onClose();
    };

    const handleSkip = () => {
        // Create a default/guest profile to prevent the onboarding loop
        const defaultProfile: ProfileData = {
            id: 'userProfile',
            name: 'My Business',
            ownerName: 'Entrepreneur',
            phone: '',
            address: '',
            gstNumber: '',
            logo: ''
        };
        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        onClose();
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[5000] bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 animate-fade-in-fast">

            {/* Decorative Background */}
            <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center mb-8 border border-gray-100 dark:border-slate-700">
                    <span className="text-6xl font-bold text-primary select-none">ॐ</span>
                </div>

                <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2 text-center">Saree Business Manager</h1>
                <p className="text-slate-500 dark:text-slate-400 text-center mb-10 max-w-xs">
                    Track sales, manage inventory, and grow your saree business effortlessly.
                </p>

                <div className="w-full space-y-4 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-lg border border-gray-100 dark:border-slate-700">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Business Name</label>
                        <div className="relative">
                            <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50" size={20} />
                            <input
                                type="text"
                                placeholder="e.g. Sri Lakshmi Silks"
                                value={businessName}
                                onChange={(e) => setBusinessName(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1 ml-1">Owner Name</label>
                        <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/50" size={20} />
                            <input
                                type="text"
                                placeholder="Your Name"
                                value={ownerName}
                                onChange={(e) => setOwnerName(e.target.value)}
                                className="w-full h-12 pl-12 pr-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium text-slate-800 dark:text-white"
                            />
                        </div>
                    </div>

                    <Button onClick={handleStart} className="w-full h-12 text-lg shadow-lg shadow-primary/20 rounded-xl mt-4">
                        Get Started <ArrowRight size={20} className="ml-2" />
                    </Button>
                </div>

                <div className="mt-8 text-center space-y-4">
                    <div>
                        <p className="text-sm text-slate-400 mb-2">Already have data?</p>
                        <button
                            onClick={handleRestore}
                            className="text-primary font-bold text-sm hover:underline bg-primary/10 px-4 py-2 rounded-full transition-colors"
                        >
                            Restore from Cloud Backup
                        </button>
                    </div>

                    <button
                        onClick={handleSkip}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-medium transition-colors underline decoration-dotted underline-offset-4"
                    >
                        Skip Setup
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OnboardingScreen;