
import React, { useState } from 'react';
import { User, BarChart2, Activity, LogIn, LogOut, RefreshCw, Copy, HelpCircle, ExternalLink, AlertTriangle } from 'lucide-react';
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
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Check if we are in a known preview environment (e.g., googleusercontent, vercel.app, localhost)
    const isPreviewEnv = origin.includes('googleusercontent.com') || origin.includes('vercel.app') || origin.includes('localhost');

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

                <div className="mt-4 p-3 bg-blue-50 dark:bg-slate-900 rounded border border-blue-100 dark:border-slate-700">
                    <p className="font-bold text-xs text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                        <HelpCircle size={12}/> Google Cloud Setup
                    </p>
                    
                    {isPreviewEnv && (
                        <div className="mb-2 p-1 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded text-[9px] text-yellow-800 dark:text-yellow-200 flex gap-1">
                            <AlertTriangle size={12} className="flex-shrink-0" />
                            <span>Preview URL detected. You must authorize this EXACT URL below.</span>
                        </div>
                    )}

                    <div className="mb-3 border-b border-blue-100 dark:border-slate-700 pb-2">
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">1. Setup URL (Fix Error 400):</p>
                        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 p-1 rounded border dark:border-slate-600 mb-1">
                            <code className="select-all flex-grow truncate text-[9px] text-gray-600 dark:text-gray-300">
                                {origin}
                            </code>
                        </div>
                        <p className="text-[9px] text-gray-500">Paste into 'Authorized JavaScript origins' (No slash at end)</p>
                    </div>

                    <div>
                        <p className="text-[10px] font-bold text-gray-600 dark:text-gray-400 mb-1">2. Allow Users (Fix Access Denied):</p>
                        <a 
                            href="https://console.cloud.google.com/apis/credentials/consent" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[9px] text-blue-600 hover:underline mb-2 bg-blue-100/50 p-1 rounded"
                        >
                            <span>Open OAuth Consent Screen</span>
                            <ExternalLink size={8} />
                        </a>
                        <ul className="text-[9px] text-gray-500 leading-tight list-disc pl-3 space-y-1">
                            <li><strong>Scroll down</strong> to "Test users" section.</li>
                            <li>Click <strong>+ ADD USERS</strong> and add your email.</li>
                            <li>OR click <strong>PUBLISH APP</strong> to skip this.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
        )}
        </>
    );
};

export default MenuPanel;
