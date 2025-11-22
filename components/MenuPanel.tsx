
import React, { useState } from 'react';
import { User, BarChart2, Activity, LogIn, LogOut, RefreshCw } from 'lucide-react';
import { Page } from '../types';
import { useAppContext } from '../context/AppContext';
import AuditLogPanel from './AuditLogPanel';

interface MenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileClick: () => void;
  onNavigate: (page: Page) => void;
}

const MenuPanel: React.FC<MenuPanelProps> = ({ isOpen, onClose, onProfileClick, onNavigate }) => {
    const { state, googleSignIn, googleSignOut, syncData } = useAppContext();
    const [isAuditOpen, setIsAuditOpen] = useState(false);

    if (!isOpen && !isAuditOpen) return null;

    return (
        <>
        <AuditLogPanel isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
        {isOpen && (
        <div 
          className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 text-text dark:text-slate-200 animate-scale-in origin-top-left z-40 flex flex-col max-h-[80vh]"
          role="dialog"
          aria-label="Main Menu"
        >
            <div className="p-2 flex-grow overflow-y-auto">
                {state.googleUser ? (
                    <div className="p-3 mb-2 bg-gray-100 dark:bg-slate-700 rounded-lg flex items-center gap-3">
                        <img src={state.googleUser.picture} alt="User" className="w-8 h-8 rounded-full" />
                        <div className="overflow-hidden">
                            <p className="text-xs font-bold truncate">{state.googleUser.name}</p>
                            <p className="text-[10px] text-gray-500 truncate">{state.googleUser.email}</p>
                        </div>
                    </div>
                ) : null}

                <button
                    onClick={onProfileClick}
                    className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <User className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">My Business Profile</span>
                </button>
                <button
                    onClick={() => onNavigate('INSIGHTS')}
                    className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <BarChart2 className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">Business Insights</span>
                </button>
                <button
                    onClick={() => { onClose(); setIsAuditOpen(true); }}
                    className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                >
                    <Activity className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">Audit Logs</span>
                </button>
                
                <div className="my-1 border-t dark:border-slate-700"></div>

                {state.googleUser ? (
                    <>
                    <button
                        onClick={() => { syncData(); onClose(); }}
                        className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 text-blue-600 ${state.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                        <span className="font-semibold text-sm">Sync Now</span>
                    </button>
                    <button
                        onClick={() => { googleSignOut(); onClose(); }}
                        className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-red-600 group"
                    >
                        <LogOut className="w-5 h-5" />
                        <div>
                            <span className="font-semibold text-sm block">Sign Out & Switch</span>
                            <span className="text-[10px] opacity-70 group-hover:opacity-100">Clears local data</span>
                        </div>
                    </button>
                    </>
                ) : (
                    <button
                        onClick={() => { googleSignIn(); onClose(); }}
                        className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors text-primary"
                    >
                        <LogIn className="w-5 h-5" />
                        <span className="font-semibold text-sm">Sign In with Google</span>
                    </button>
                )}
            </div>
        </div>
        )}
        </>
    );
};

export default MenuPanel;
