import React, { useState } from 'react';
import { User, Building2, Lock, ArrowRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ProfileData } from '../types';
import Button from './Button';

const OnboardingScreen: React.FC = () => {
    const { dispatch, googleSignIn, showToast } = useAppContext();
    const [businessName, setBusinessName] = useState('');
    const [ownerName, setOwnerName] = useState('');
    const [pin, setPin] = useState('');

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
    };

    const handleSkip = () => {
        const defaultProfile: ProfileData = {
            id: 'userProfile',
            name: 'My Saree Business',
            ownerName: 'Owner',
            phone: '',
            address: '',
            gstNumber: '',
            logo: ''
        };
        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        showToast("Welcome! You can update details later in Settings.", 'info');
    };
    
    const handleInfoClick = () => {
      showToast("To restore from a file, use the 'Restore from Backup' button on the Dashboard.", 'info');
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-800 dark:text-slate-200">
            <div className="w-full max-w-md mx-auto bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-2xl border dark:border-slate-700">
                
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-primary mb-2">Saree Business Manager</h1>
                    <p className="text-2xl font-semibold text-slate-700 dark:text-slate-300">Welcome 👋</p>
                    <p className="text-slate-500 dark:text-slate-400 mt-2">
                        Let's set up your profile to track sales and purchases.
                    </p>
                </div>

                <div className="space-y-6">
                    <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Business Name (e.g. My Saree Shop)"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="w-full h-12 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                        />
                    </div>

                    <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="text"
                            placeholder="Owner Name"
                            value={ownerName}
                            onChange={(e) => setOwnerName(e.target.value)}
                            className="w-full h-12 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                        />
                    </div>

                    <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input
                            type="password"
                            inputMode="numeric"
                            maxLength={4}
                            placeholder="Set 4-Digit Security PIN (Optional)"
                            value={pin}
                            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                            className="w-full h-12 pl-10 pr-4 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
                        />
                    </div>

                    <Button onClick={handleStart} className="w-full h-12 shadow-lg">
                        Start Business <ArrowRight size={20} className="ml-2" />
                    </Button>
                </div>

                <div className="text-center my-6 text-sm text-slate-500">
                    Or restore existing data
                </div>
                
                <div className="flex justify-center">
                     <button 
                        onClick={() => googleSignIn()}
                        className="w-14 h-14 bg-white rounded-full shadow-md border border-gray-100 flex items-center justify-center hover:scale-105 transition-transform"
                        title="Restore from Google Drive"
                    >
                        <svg width="24" height="24" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                            <path fill="none" d="M0 0h48v48H0z"/>
                        </svg>
                    </button>
                </div>

                <div className="text-center mt-8 space-y-3">
                    <p className="text-slate-500 text-xs">
                        Already have a backup file?{' '}
                        <button onClick={handleInfoClick} className="text-primary font-medium hover:underline">Info</button>
                    </p>
                    <button onClick={handleSkip} className="text-slate-400 text-xs hover:text-primary transition-colors underline decoration-dotted underline-offset-4">
                        Skip setup & try app
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OnboardingScreen;
