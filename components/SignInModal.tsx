
import React from 'react';
import { X, Check, Cloud, Shield, RefreshCw, Calendar, FileSpreadsheet } from 'lucide-react';
import Card from './Card';
import { useAppContext } from '../context/AppContext';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { googleSignIn } = useAppContext();

  if (!isOpen) return null;

  const handleSignIn = () => {
    googleSignIn();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200] p-4 animate-fade-in-fast backdrop-blur-sm">
      <Card className="w-full max-w-md p-0 overflow-hidden animate-scale-in border-none shadow-2xl relative bg-white dark:bg-slate-900">
        <button 
            onClick={onClose} 
            className="absolute top-4 right-4 p-2 rounded-full bg-black/10 hover:bg-black/20 text-white transition-colors z-20"
        >
            <X size={20} />
        </button>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-center text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-30" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
            <div className="relative z-10 flex flex-col items-center">
                <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md mb-4 shadow-inner">
                    <Cloud size={40} className="text-white drop-shadow-md" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Sync & Integration</h2>
                <p className="text-blue-100 text-sm max-w-xs mx-auto">
                    Secure your data and enable powerful integrations.
                </p>
            </div>
        </div>

        {/* Benefits List */}
        <div className="p-6 space-y-5">
            <div className="space-y-4">
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg shrink-0">
                        <Shield size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">Secure Cloud Backup</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Automated backups to your private Google Drive folder. Optimized for performance with separate image storage.</p>
                    </div>
                </div>
                
                <div className="flex items-start gap-4">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg shrink-0">
                        <Calendar size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">Calendar Integration</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Automatically add purchase payment due dates to your Google Calendar.</p>
                    </div>
                </div>

                <div className="flex items-start gap-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg shrink-0">
                        <FileSpreadsheet size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-800 dark:text-white text-sm">Export to Sheets</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Directly export your sales reports, customer dues, and inventory to Google Sheets.</p>
                    </div>
                </div>
            </div>

            <div className="pt-4 space-y-3">
                <button 
                    onClick={handleSignIn}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2 group"
                >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5 bg-white rounded-full p-0.5" />
                    Sign In with Google
                </button>
                <button 
                    onClick={onClose} 
                    className="w-full py-3 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                    Maybe Later
                </button>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default SignInModal;
