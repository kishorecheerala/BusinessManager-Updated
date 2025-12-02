
import React, { useState, useRef } from 'react';
import { User, BarChart2, Activity, LogIn, LogOut, RefreshCw, CloudLightning, Sun, Moon, Palette, Check, Settings, Monitor, Shield, ChevronRight, RotateCcw, BrainCircuit, Terminal, Receipt, FileText, Lock, PenTool, Gauge, Cloud, Layout, Download, Sparkles, Smartphone, FileSpreadsheet } from 'lucide-react';
import { Page } from '../types';
import { useAppContext } from '../context/AppContext';
import AuditLogPanel from './AuditLogPanel';
import CloudDebugModal from './CloudDebugModal';
import ColorPickerModal from './ColorPickerModal';
import GradientPickerModal from './GradientPickerModal';
import PinModal from './PinModal';
import InvoiceSettingsModal from './InvoiceSettingsModal';
import APIConfigModal from './APIConfigModal';
import UISettingsModal from './UISettingsModal';
import { DataImportModal } from './DataImportModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface MenuPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileClick: () => void;
  onNavigate: (page: Page) => void;
  onOpenDevTools: () => void;
  onLockApp?: () => void;
  onOpenChangeLog?: () => void;
}

interface ThemeColor {
    hex: string;
    name: string;
    gradient?: string; // Optional gradient override for header
}

interface ThemeGroup {
    name: string;
    colors: ThemeColor[];
}

const THEME_GROUPS: ThemeGroup[] = [
    {
        name: 'Business',
        colors: [
            { hex: '#0d9488', name: 'Teal' },
            { hex: '#2563eb', name: 'Blue' },
            { hex: '#4f46e5', name: 'Indigo' },
            { hex: '#334155', name: 'Slate' },
        ]
    },
    {
        name: 'Vibrant',
        colors: [
            { hex: '#7c3aed', name: 'Violet' },
            { hex: '#db2777', name: 'Pink' },
            { hex: '#e11d48', name: 'Rose' },
            { hex: '#ea580c', name: 'Orange' },
        ]
    },
    {
        name: 'Nature',
        colors: [
            { hex: '#059669', name: 'Emerald' },
            { hex: '#16a34a', name: 'Green' },
            { hex: '#65a30d', name: 'Lime' },
            { hex: '#0891b2', name: 'Cyan' },
        ]
    },
    {
        name: 'Gradients',
        colors: [
            { hex: '#0d9488', name: 'Oceanic', gradient: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)' },
            { hex: '#e11d48', name: 'Sunset', gradient: 'linear-gradient(135deg, #f59e0b 0%, #e11d48 100%)' },
            { hex: '#db2777', name: 'Berry', gradient: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' },
            { hex: '#6366f1', name: 'Royal', gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
            { hex: '#334155', name: 'Midnight', gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
            { hex: '#10b981', name: 'Aurora', gradient: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)' },
            { hex: '#8b5cf6', name: 'Nebula', gradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' },
            { hex: '#f97316', name: 'Solar', gradient: 'linear-gradient(135deg, #f97316 0%, #dc2626 100%)' },
            { hex: '#15803d', name: 'Forest', gradient: 'linear-gradient(135deg, #15803d 0%, #0f766e 100%)' },
            { hex: '#475569', name: 'Slate', gradient: 'linear-gradient(135deg, #64748b 0%, #0f172a 100%)' },
        ]
    },
    {
        name: 'Dark',
        colors: [
            { hex: '#475569', name: 'Slate' },
            { hex: '#52525b', name: 'Zinc' },
            { hex: '#57534e', name: 'Stone' },
            { hex: '#000000', name: 'Black' },
        ]
    }
];

// Helper to determine best text color (black or white) for a given background color
const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
};

const MenuPanel: React.FC<MenuPanelProps> = ({ isOpen, onClose, onProfileClick, onNavigate, onOpenDevTools, onLockApp, onOpenChangeLog }) => {
    const { state, dispatch, googleSignIn, googleSignOut, syncData } = useAppContext();
    const { isInstallable, install } = usePWAInstall();
    
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isCloudDebugOpen, setIsCloudDebugOpen] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isGradientPickerOpen, setIsGradientPickerOpen] = useState(false);
    const [isInvoiceSettingsOpen, setIsInvoiceSettingsOpen] = useState(false);
    const [isAPIConfigOpen, setIsAPIConfigOpen] = useState(false);
    const [isUISettingsOpen, setIsUISettingsOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinMode, setPinMode] = useState<'setup' | 'enter'>('enter');

    const setTheme = (mode: 'light' | 'dark') => {
        dispatch({ type: 'SET_THEME', payload: mode });
    };

    const resetTheme = () => {
        dispatch({ type: 'SET_THEME_COLOR', payload: '#0d9488' });
        // Reset to default gradient (Oceanic)
        dispatch({ type: 'SET_THEME_GRADIENT', payload: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)' });
        dispatch({ type: 'SET_THEME', payload: 'light' });
    };

    const handleColorSelect = (color: ThemeColor) => {
        dispatch({ type: 'SET_THEME_COLOR', payload: color.hex });
        // If the selected theme has a gradient, apply it. Otherwise, clear it (solid mode).
        dispatch({ type: 'SET_THEME_GRADIENT', payload: color.gradient || '' });
    };

    const handleDevToolsClick = () => {
        if (state.pin) {
            setPinMode('enter');
        } else {
            setPinMode('setup');
        }
        setIsPinModalOpen(true);
    };

    const handlePinSuccess = (newPin?: string) => {
        if (newPin) {
            // If setup mode, save the pin first
            dispatch({ type: 'SET_PIN', payload: newPin });
        }
        setIsPinModalOpen(false);
        onClose(); // Close menu
        onOpenDevTools();
    };

    if (!isOpen && !isAuditOpen && !isCloudDebugOpen && !isColorPickerOpen && !isGradientPickerOpen && !isPinModalOpen && !isInvoiceSettingsOpen && !isAPIConfigOpen && !isUISettingsOpen && !isImportOpen) return null;

    return (
        <>
        <AuditLogPanel isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
        <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
        <InvoiceSettingsModal isOpen={isInvoiceSettingsOpen} onClose={() => setIsInvoiceSettingsOpen(false)} />
        <APIConfigModal isOpen={isAPIConfigOpen} onClose={() => setIsAPIConfigOpen(false)} />
        <UISettingsModal isOpen={isUISettingsOpen} onClose={() => setIsUISettingsOpen(false)} />
        <DataImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
        <ColorPickerModal 
            isOpen={isColorPickerOpen} 
            onClose={() => setIsColorPickerOpen(false)}
            initialColor={state.themeColor}
            onChange={(color) => {
                dispatch({ type: 'SET_THEME_COLOR', payload: color });
                dispatch({ type: 'SET_THEME_GRADIENT', payload: '' }); // Custom color is always solid
            }}
        />
        <GradientPickerModal
            isOpen={isGradientPickerOpen}
            onClose={() => setIsGradientPickerOpen(false)}
            initialStartColor={state.themeColor}
            onChange={(gradient, startColor) => {
                dispatch({ type: 'SET_THEME_COLOR', payload: startColor });
                dispatch({ type: 'SET_THEME_GRADIENT', payload: gradient });
            }}
        />
        {isPinModalOpen && (
            <PinModal
                mode={pinMode}
                correctPin={state.pin}
                onCorrectPin={() => handlePinSuccess()}
                onSetPin={(pin) => handlePinSuccess(pin)}
                onCancel={() => setIsPinModalOpen(false)}
            />
        )}
        
        {isOpen && (
        <>
        <div className="fixed inset-0 z-[100] bg-transparent" onClick={onClose}></div>
        <div 
          className="fixed top-16 left-4 mt-2 w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 text-text dark:text-slate-200 animate-scale-in origin-top-left z-[101] flex flex-col overflow-hidden max-h-[calc(100vh-6rem)]"
          role="dialog"
          aria-label="Main Menu"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()} 
        >
            {/* Scrollable Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar min-h-0 overscroll-contain pb-10">
                
                {/* 1. Profile / Sign In Card - Styled as Gradient Card */}
                <div className="p-3">
                    <div className="rounded-xl overflow-hidden shadow-lg relative text-white bg-theme" style={{ background: state.themeGradient || state.themeColor }}>
                        {/* Decorative background shapes */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl"></div>
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-xl"></div>
                        
                        <div className="relative p-5">
                            <h3 className="font-bold text-xl mb-3 tracking-tight truncate drop-shadow-md">
                                {state.profile?.name || 'Business Manager'}
                            </h3>
                            
                            {state.googleUser ? (
                                <div className="flex items-center gap-3 p-2 bg-white/20 rounded-lg backdrop-blur-md border border-white/30">
                                    <img src={state.googleUser.picture} alt="User" className="w-10 h-10 rounded-full border-2 border-white/50" />
                                    <div className="overflow-hidden min-w-0">
                                        <p className="text-sm font-bold truncate">{state.googleUser.name}</p>
                                        <p className="text-[10px] text-white/80 truncate">{state.googleUser.email}</p>
                                        {state.lastSyncTime && (
                                            <p className="text-[9px] text-white/90 mt-0.5 font-medium flex items-center gap-1">
                                                <RefreshCw size={8} />
                                                Last Synced: {new Date(state.lastSyncTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs text-white/90 mb-3 font-medium">Sign in to backup your data.</p>
                                    <button
                                        onClick={() => { googleSignIn(); onClose(); }}
                                        className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white text-primary font-bold text-sm shadow-md hover:bg-gray-50 transition-all group"
                                    >
                                        <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
                                        Sign In with Google
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* 1.5 INSTALL PWA BUTTON */}
                {isInstallable && (
                    <div className="px-3 mb-2 animate-fade-in-up">
                        <button 
                            onClick={install} 
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white p-3 rounded-xl shadow-lg flex items-center justify-between group transform hover:scale-[1.02] transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                                    <Download size={20} className="text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-sm">Download App</p>
                                    <p className="text-[10px] opacity-90 font-medium">Install for offline use & fullscreen</p>
                                </div>
                            </div>
                            <ChevronRight className="opacity-70 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}

                {/* 2. Main Navigation & Actions */}
                <div className="p-2 space-y-1 border-b border-gray-100 dark:border-slate-700 pb-3">
                    <button onClick={onProfileClick} className="menu-item">
                        <User className="w-5 h-5 text-blue-500" />
                        <span className="flex-grow text-sm font-medium">Business Profile</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    <button onClick={() => { onClose(); onNavigate('INVOICE_DESIGNER'); }} className="menu-item">
                        <PenTool className="w-5 h-5 text-pink-500" />
                        <span className="flex-grow text-sm font-medium">Invoice Designer</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => onNavigate('INSIGHTS')} className="menu-item">
                        <BarChart2 className="w-5 h-5 text-purple-500" />
                        <span className="flex-grow text-sm font-medium">Business Insights</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); setIsAuditOpen(true); }} className="menu-item">
                        <Activity className="w-5 h-5 text-amber-500" />
                        <span className="flex-grow text-sm font-medium">Audit Logs</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); onOpenChangeLog?.(); }} className="menu-item">
                        <Sparkles className="w-5 h-5 text-yellow-500" />
                        <span className="flex-grow text-sm font-medium">What's New</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                {/* 3. Admin Section */}
                <div className="px-4 py-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Admin</span>
                </div>
                <div className="p-2 space-y-1">
                    <button onClick={() => { onClose(); setIsImportOpen(true); }} className="menu-item">
                        <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                        <span className="flex-grow text-sm font-medium">Import Data (CSV)</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); setIsUISettingsOpen(true); }} className="menu-item">
                        <Layout className="w-5 h-5 text-teal-500" />
                        <span className="flex-grow text-sm font-medium">UI & Theme</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); setIsInvoiceSettingsOpen(true); }} className="menu-item">
                        <Settings className="w-5 h-5 text-slate-500" />
                        <span className="flex-grow text-sm font-medium">Quick Invoice Settings</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                    
                    <button onClick={() => { onClose(); setIsAPIConfigOpen(true); }} className="menu-item">
                        <Cloud className="w-5 h-5 text-sky-500" />
                        <span className="flex-grow text-sm font-medium">API Configuration</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); onNavigate('SYSTEM_OPTIMIZER'); }} className="menu-item">
                        <Gauge className="w-5 h-5 text-emerald-500" />
                        <span className="flex-grow text-sm font-medium">System Optimizer</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    {/* Lock App - Only if PIN is set */}
                    {state.pin && onLockApp && (
                        <button onClick={onLockApp} className="menu-item text-rose-600 dark:text-rose-400">
                            <Lock className="w-5 h-5" />
                            <span className="flex-grow text-sm font-medium">Lock App Now</span>
                            <ChevronRight className="w-4 h-4 text-gray-400" />
                        </button>
                    )}

                    <button onClick={handleDevToolsClick} className="menu-item bg-slate-100 dark:bg-slate-700/50 mt-1">
                        <Terminal className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="flex-grow text-sm font-medium text-green-800 dark:text-green-200">Developer Tools</span>
                        {state.pin && <Shield className="w-3 h-3 text-gray-400" />}
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                </div>

                <div className="my-2 border-t border-gray-100 dark:border-slate-700 mx-4"></div>

                {/* 4. Appearance Section - Moved to Bottom */}
                <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 mb-3 px-1">
                        <Palette className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Appearance</span>
                    </div>

                    {/* Mode Switcher */}
                    <div className="bg-gray-100 dark:bg-slate-700 p-1 rounded-lg flex mb-4 mx-1">
                        <button 
                            onClick={() => setTheme('light')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-semibold transition-all ${state.theme === 'light' ? 'bg-white dark:bg-slate-600 text-primary shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                        >
                            <Sun size={14} /> Light
                        </button>
                        <button 
                            onClick={() => setTheme('dark')}
                            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-semibold transition-all ${state.theme === 'dark' ? 'bg-slate-600 text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}
                        >
                            <Moon size={14} /> Dark
                        </button>
                    </div>

                    {/* Color Picker Grid */}
                    <div className="space-y-4 px-1">
                        {THEME_GROUPS.map(group => (
                            <div key={group.name}>
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-2">{group.name}</p>
                                <div className="flex flex-wrap gap-3">
                                    {group.colors.map((t) => {
                                        const isHexMatch = state.themeColor.toLowerCase() === t.hex.toLowerCase();
                                        const isGradientMatch = (state.themeGradient || '') === (t.gradient || '');
                                        const isSelected = isHexMatch && isGradientMatch;

                                        return (
                                            <button
                                                key={t.name}
                                                onClick={() => handleColorSelect(t)}
                                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all relative ${
                                                    isSelected 
                                                    ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110 shadow-md' 
                                                    : 'border border-gray-200 dark:border-slate-600 opacity-90 hover:opacity-100 hover:scale-105'
                                                }`}
                                                style={{ background: t.gradient || t.hex }}
                                                title={t.name}
                                            >
                                                {isSelected && (
                                                    <Check 
                                                        size={16} 
                                                        color={getContrastColor(t.hex)} 
                                                        strokeWidth={3} 
                                                        className="drop-shadow-sm" 
                                                    />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        
                        {/* Custom & Reset */}
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                             <div 
                                className="relative group cursor-pointer flex-1"
                                onClick={() => { onClose(); setIsColorPickerOpen(true); }}
                             >
                                <div className="w-full h-9 rounded-lg bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md transition-all border border-white/20 hover:scale-[1.02]">
                                    Custom Color
                                </div>
                            </div>
                            <div 
                                className="relative group cursor-pointer flex-1"
                                onClick={() => { onClose(); setIsGradientPickerOpen(true); }}
                             >
                                <div className="w-full h-9 rounded-lg bg-gradient-to-r from-teal-400 via-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shadow-sm group-hover:shadow-md transition-all border border-white/20 hover:scale-[1.02]">
                                    Custom Gradient
                                </div>
                            </div>
                            <button 
                                onClick={resetTheme}
                                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                                title="Reset to Default"
                            >
                                <RotateCcw size={16} />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="my-2 border-t border-gray-100 dark:border-slate-700 mx-4"></div>

                {/* 5. System / Sync Section */}
                {state.googleUser && (
                    <div className="px-2 pb-2 space-y-1">
                        <button
                            onClick={() => { syncData(); onClose(); }}
                            className="menu-item text-blue-600 dark:text-blue-400 justify-between group"
                        >
                            <div className="flex items-center gap-2">
                                <RefreshCw className={`w-5 h-5 ${state.syncStatus === 'syncing' ? 'animate-spin' : ''}`} />
                                <span className="text-sm font-medium">Sync Now</span>
                            </div>
                        </button>
                        
                        <button
                            onClick={() => { onClose(); setIsCloudDebugOpen(true); }}
                            className="menu-item text-amber-600 dark:text-amber-400"
                        >
                            <CloudLightning className="w-5 h-5" />
                            <span className="flex-grow text-sm font-medium">Cloud Diagnostics</span>
                        </button>

                        <button
                            onClick={() => { googleSignOut(); onClose(); }}
                            className="menu-item text-red-600 dark:text-red-400"
                        >
                            <LogOut className="w-5 h-5" />
                            <span className="flex-grow text-sm font-medium">Sign Out</span>
                        </button>
                    </div>
                )}
            </div>
            
            <style>{`
                .menu-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 12px;
                    transition: all 0.2s;
                    color: inherit;
                }
                .menu-item:hover {
                    background-color: rgba(0,0,0,0.04);
                }
                .dark .menu-item:hover {
                    background-color: rgba(255,255,255,0.05);
                }
            `}</style>
        </div>
        </>
        )}
        </>
    );
};

export default MenuPanel;
