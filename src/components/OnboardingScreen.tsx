

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, Building2, Lock, ArrowRight } from 'lucide-react';
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
    const [pin, setPin] = useState('');
    
    useEffect(() => {
        if (isOpen) document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    const handleStart = () => {
        if (!businessName.trim() || !ownerName.trim()) {
            showToast("Please enter your business and owner names.", 'error');
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

        if (pin.length === 4) {
            dispatch({ type: 'SET_PIN', payload: pin });
            showToast("Welcome! Your business is set up.", 'success');
        } else if (pin.length > 0) {
            showToast("PIN must be 4 digits. Skipping PIN setup.", 'info');
        } else {
            showToast("Welcome! Your business is set up.", 'success');
        }
        onClose();
    };

    const handleSkip = () => {
        const defaultProfile: ProfileData = {
            id: 'userProfile',
            name: 'My Business',
            ownerName: 'Owner',
            phone: '',
            address: '',
            gstNumber: '',
            logo: ''
        };
        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        showToast("Welcome! You can update details later in Settings.", 'info');
        onClose();
    };
    
    const handleInfoClick = () => {
      showToast("To restore from a file, use the 'Restore from Backup' button on the Dashboard.", 'info');
    }

    const handleSignInAndRestore = () => {
      // The AppContext handles restore logic on sign-in if profile is missing
      googleSignIn();
      onClose();
    }

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[5000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-sans text-slate-800 dark:text-slate-200 animate-fade-in-fast">
            <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg dark:border dark:border-slate-700 animate-scale-in">
                
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-2">Business Manager</h1>
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-200">Welcome 👋</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Let's set up your profile to track sales and purchases.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="relative">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Business Name (e.g. My Shop)"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="w-full h-14 pl-12 pr-4 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Owner Name"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            className="w-full h-14 pl-12 pr-4 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="Set 4-Digit Security PIN (Optional)"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            className="w-full h-14 pl-12 pr-4 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                        />
                    </div>

                    <Button onClick={handleStart} className="w-full h-14 text-lg shadow-lg">
                        Start Business <ArrowRight size={20} className="ml-2" />
                    </Button>
                </div>

                <div className="text-center my-6 text-sm text-slate-500">
                    Or restore existing data
                </div>
                
                <div className="flex justify-center">
                     <button 
                        onClick={handleSignInAndRestore}
                        className="w-16 h-16 bg-white rounded-full shadow-md border border-gray-200 dark:border-slate-700 flex items-center justify-center hover:scale-105 transition-transform"
                        title="Restore from Google Drive"
                    >
                        <svg width="28" height="28" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            <path fill="none" d="M0 0h48v48H0z"/>
                        </svg>
                    </button>
                </div>

                <div className="text-center mt-8 space-y-3">
                    <p className="text-slate-500 text-sm">
                        Already have a backup file?{' '}
                        <button onClick={handleInfoClick} className="text-primary font-bold hover:underline bg-primary/10 px-2 py-1 rounded-md">Info</button>
                    </p>
                    <button onClick={handleSkip} className="text-slate-400 text-xs hover:text-primary transition-colors underline decoration-dotted underline-offset-4">
                        Skip setup & try app
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default OnboardingScreen;