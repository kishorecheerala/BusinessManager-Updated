
import React, { useState, useRef } from 'react';
import { User, BarChart2, Activity, LogIn, LogOut, RefreshCw, CloudLightning, Sun, Moon, Palette, Check, Settings, Monitor, Shield, ChevronRight, RotateCcw, BrainCircuit, Terminal, Receipt, FileText, Lock, PenTool, Gauge, Cloud, Layout, Download, Sparkles, Smartphone, FileSpreadsheet, Type, PaintBucket, Plus, Trash2, Database } from 'lucide-react';
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
  onOpenSignIn?: () => void;
}

interface ThemeColor {
    hex: string;
    name: string;
}

interface ThemeGroup {
    name: string;
    colors: ThemeColor[];
}

interface GradientPreset {
    name: string;
    value: string;
}

const GRADIENT_PRESETS: GradientPreset[] = [
    { name: 'Nebula', value: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' },
    { name: 'Sunset', value: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
    { name: 'Ocean', value: 'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)' },
    { name: 'Forest', value: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
    { name: 'Midnight', value: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
    { name: 'Royal', value: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' },
    { name: 'Candy', value: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' },
    { name: 'Minimal', value: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)' },
    { name: 'Peachy', value: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)' },
    { name: 'Deep Sea', value: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)' },
    { name: 'Night', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
    { name: 'Love', value: 'linear-gradient(135deg, #ff9a9e 0%, #fad0c4 99%, #fad0c4 100%)' },
    { name: 'Lemon', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
    { name: 'Sky', value: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)' },
    { name: 'Horizon', value: 'linear-gradient(135deg, #00c6fb 0%, #005bea 100%)' },
    { name: 'Rose', value: 'linear-gradient(135deg, #f43b47 0%, #453a94 100%)' },
];

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
        name: 'Dark',
        colors: [
            { hex: '#475569', name: 'Slate' },
            { hex: '#52525b', name: 'Zinc' },
            { hex: '#57534e', name: 'Stone' },
            { hex: '#000000', name: 'Black' },
        ]
    }
];

const APP_FONTS = [
    { name: 'Inter', label: 'Inter (Default)', style: { fontFamily: 'Inter, sans-serif' } },
    { name: 'Poppins', label: 'Poppins', style: { fontFamily: 'Poppins, sans-serif' } },
    { name: 'Roboto', label: 'Roboto', style: { fontFamily: 'Roboto, sans-serif' } },
    { name: 'Playfair Display', label: 'Playfair', style: { fontFamily: '"Playfair Display", serif' } },
    { name: 'Space Mono', label: 'Space Mono', style: { fontFamily: '"Space Mono", monospace' } },
];

// Helper to determine best text color (black or white) for a given background color
const getContrastColor = (hexColor: string) => {
    const r = parseInt(hexColor.substr(1, 2), 16);
    const g = parseInt(hexColor.substr(3, 2), 16);
    const b = parseInt(hexColor.substr(5, 2), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
};

const MenuPanel: React.FC<MenuPanelProps> = ({ isOpen, onClose, onProfileClick, onNavigate, onOpenDevTools, onLockApp, onOpenChangeLog, onOpenSignIn }) => {
    const { state, dispatch, googleSignOut, syncData, showToast } = useAppContext();
    const { isInstallable, install } = usePWAInstall();
    
    const [isAuditOpen, setIsAuditOpen] = useState(false);
    const [isCloudDebugOpen, setIsCloudDebugOpen] = useState(false);
    const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
    const [isHeaderColorPickerOpen, setIsHeaderColorPickerOpen] = useState(false); // Separate picker for header
    const [isGradientPickerOpen, setIsGradientPickerOpen] = useState(false);
    const [isInvoiceSettingsOpen, setIsInvoiceSettingsOpen] = useState(false);
    const [isAPIConfigOpen, setIsAPIConfigOpen] = useState(false);
    const [isUISettingsOpen, setIsUISettingsOpen] = useState(false);
    const [isImportOpen, setIsImportOpen] = useState(false);
    
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinMode, setPinMode] = useState<'setup' | 'enter'>('enter');
    const fontInputRef = useRef<HTMLInputElement>(null);
    const [googleFontName, setGoogleFontName] = useState('');

    const setTheme = (mode: 'light' | 'dark') => {
        dispatch({ type: 'SET_THEME', payload: mode });
    };

    const resetTheme = () => {
        dispatch({ type: 'SET_THEME_COLOR', payload: '#8b5cf6' });
        // Reset to default gradient (Nebula)
        dispatch({ type: 'SET_THEME_GRADIENT', payload: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)' });
        dispatch({ type: 'SET_HEADER_COLOR', payload: '' }); // Clear manual header color
        dispatch({ type: 'SET_THEME', payload: 'light' });
        dispatch({ type: 'SET_FONT', payload: 'Inter' });
    };

    const handleColorSelect = (color: ThemeColor) => {
        // Set Accent Color
        dispatch({ type: 'SET_THEME_COLOR', payload: color.hex });
        // Clear Gradient so the solid color takes effect on the header
        dispatch({ type: 'SET_THEME_GRADIENT', payload: '' });
        // Clear specific header color override if any
        dispatch({ type: 'SET_HEADER_COLOR', payload: '' });
    };

    const handleGradientSelect = (gradient: string) => {
        dispatch({ type: 'SET_THEME_GRADIENT', payload: gradient });
        dispatch({ type: 'SET_HEADER_COLOR', payload: '' }); // Clear solid override
        
        // Extract the first hex color from the gradient to set as the primary app color
        // This ensures the "whole app" feels cohesive with the header
        const match = gradient.match(/#(?:[0-9a-fA-F]{3}){1,2}/);
        if (match && match[0]) {
            dispatch({ type: 'SET_THEME_COLOR', payload: match[0] });
        }
    };

    const handleFontSelect = (fontName: string) => {
        dispatch({ type: 'SET_FONT', payload: fontName });
    };

    const handleLoadGoogleFont = () => {
        if (!googleFontName.trim()) return;
        const fontName = googleFontName.trim();
        
        // Dynamically load font
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        
        // Add to state list so it's selectable (persisted as custom font without base64 for now to keep it simple)
        const newFont = {
            id: `gfont-${Date.now()}`,
            name: fontName,
            data: 'GOOGLE_FONT_REF' // Marker
        };
        dispatch({ type: 'ADD_CUSTOM_FONT', payload: newFont });
        dispatch({ type: 'SET_FONT', payload: fontName }); // Auto-select
        setGoogleFontName('');
        showToast(`Loaded ${fontName} from Google Fonts!`);
    };

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (!file.name.match(/\.(ttf|otf|woff|woff2)$/i)) {
                showToast("Only .ttf or .otf files allowed.", 'error');
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                const result = event.target?.result as string;
                if (result) {
                    const fontName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, ""); 
                    const newFont = {
                        id: `font-${Date.now()}`,
                        name: fontName,
                        data: result
                    };
                    dispatch({ type: 'ADD_CUSTOM_FONT', payload: newFont });
                    dispatch({ type: 'SET_FONT', payload: fontName }); // Auto-select
                    showToast(`Font "${fontName}" added & selected!`);
                }
            };
            reader.readAsDataURL(file);
            e.target.value = '';
        }
    };

    const handleRemoveFont = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (window.confirm("Delete this custom font?")) {
            dispatch({ type: 'REMOVE_CUSTOM_FONT', payload: id });
            if (state.font === state.customFonts.find(f => f.id === id)?.name) {
                dispatch({ type: 'SET_FONT', payload: 'Inter' }); // Reset if active
            }
        }
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

    if (!isOpen && !isAuditOpen && !isCloudDebugOpen && !isColorPickerOpen && !isHeaderColorPickerOpen && !isGradientPickerOpen && !isPinModalOpen && !isInvoiceSettingsOpen && !isAPIConfigOpen && !isUISettingsOpen && !isImportOpen) return null;

    return (
        <>
        <AuditLogPanel isOpen={isAuditOpen} onClose={() => setIsAuditOpen(false)} />
        <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
        <InvoiceSettingsModal isOpen={isInvoiceSettingsOpen} onClose={() => setIsInvoiceSettingsOpen(false)} />
        <APIConfigModal isOpen={isAPIConfigOpen} onClose={() => setIsAPIConfigOpen(false)} />
        <UISettingsModal isOpen={isUISettingsOpen} onClose={() => setIsUISettingsOpen(false)} />
        <DataImportModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} />
        
        {/* Accent Color Picker */}
        <ColorPickerModal 
            isOpen={isColorPickerOpen} 
            onClose={() => setIsColorPickerOpen(false)}
            initialColor={state.themeColor}
            onChange={(color) => {
                dispatch({ type: 'SET_THEME_COLOR', payload: color });
            }}
        />

        {/* Header Solid Color Picker */}
        <ColorPickerModal 
            isOpen={isHeaderColorPickerOpen} 
            onClose={() => setIsHeaderColorPickerOpen(false)}
            initialColor={state.headerColor || state.themeColor}
            onChange={(color) => {
                dispatch({ type: 'SET_HEADER_COLOR', payload: color });
                dispatch({ type: 'SET_THEME_GRADIENT', payload: '' }); // Clear gradient to show solid color
            }}
        />

        <GradientPickerModal
            isOpen={isGradientPickerOpen}
            onClose={() => setIsGradientPickerOpen(false)}
            initialStartColor={state.themeColor}
            onChange={(gradient, startColor) => {
                dispatch({ type: 'SET_THEME_COLOR', payload: startColor }); // Sync accent to start
                dispatch({ type: 'SET_THEME_GRADIENT', payload: gradient });
                dispatch({ type: 'SET_HEADER_COLOR', payload: '' });
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
                    <div className="rounded-xl overflow-hidden shadow-lg relative text-white bg-theme" style={{ background: state.themeGradient || state.headerColor || state.themeColor }}>
                        {/* Decorative background shapes */}
                        <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl"></div>
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-black/10 rounded-full translate-y-1/3 -translate-x-1/4 blur-xl"></div>
                        
                        <div className="relative p-5">
                            <h3 className="font-bold text-xl mb-3 tracking-tight truncate drop-shadow-md">
                                {state.profile?.name || 'Business Manager'}
                            </h3>
                            
                            {state.googleUser ? (
                                <div className="flex items-center gap-3 p-3 bg-white/20 rounded-xl backdrop-blur-md border border-white/30 shadow-inner">
                                    <img src={state.googleUser.picture} alt="User" className="w-12 h-12 rounded-full border-2 border-white/70 shadow-sm" />
                                    <div className="overflow-hidden min-w-0 flex-1">
                                        <p className="text-sm font-bold leading-tight break-words text-white drop-shadow-sm">{state.googleUser.name}</p>
                                        <p className="text-[10px] text-white/80 truncate mb-1">{state.googleUser.email}</p>
                                        {state.lastSyncTime && (
                                            <div className="flex items-center gap-2">
                                                <span className="relative flex h-2 w-2">
                                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${state.syncStatus === 'syncing' ? 'bg-white' : 'bg-green-400'} opacity-75`}></span>
                                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${state.syncStatus === 'syncing' ? 'bg-white' : 'bg-green-500'}`}></span>
                                                </span>
                                                <p className="text-[10px] text-white/90 font-medium">
                                                    {state.syncStatus === 'syncing' ? 'Syncing...' : new Date(state.lastSyncTime).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true})}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <p className="text-xs text-white/90 mb-3 font-medium">Sign in to backup your data.</p>
                                    <button
                                        onClick={() => { onOpenSignIn?.(); onClose(); }}
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
                    <button onClick={() => { onClose(); onProfileClick(); }} className="menu-item">
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
                    <button onClick={() => { onClose(); onNavigate('SQL_ASSISTANT'); }} className="menu-item">
                        <Database className="w-5 h-5 text-indigo-500" />
                        <span className="flex-grow text-sm font-medium">SQL AI Assistant</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); setIsImportOpen(true); }} className="menu-item">
                        <FileSpreadsheet className="w-5 h-5 text-orange-500" />
                        <span className="flex-grow text-sm font-medium">Import Data (CSV)</span>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>

                    <button onClick={() => { onClose(); setIsUISettingsOpen(true); }} className="menu-item">
                        <Layout className="w-5 h-5 text-teal-500" />
                        <span className="flex-grow text-sm font-medium">UI Preferences</span>
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

                     <button onClick={() => { onClose(); onNavigate('TRASH'); }} className="menu-item text-red-600 dark:text-red-400">
                        <Trash2 className="w-5 h-5" />
                        <span className="flex-grow text-sm font-medium">Recycle Bin</span>
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

                {/* 4. Appearance Section */}
                <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <Palette className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Theme & Style</span>
                        </div>
                        <button 
                            onClick={resetTheme}
                            className="p-1.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex items-center gap-1 text-[10px] font-bold px-2"
                            title="Reset to Default"
                        >
                            <RotateCcw size={12} /> Reset
                        </button>
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

                    {/* Accent Color Presets */}
                    <div className="space-y-4 px-1">
                        {THEME_GROUPS.map(group => (
                            <div key={group.name}>
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-2">{group.name} Colors</p>
                                <div className="flex flex-wrap gap-3">
                                    {group.colors.map((t) => {
                                        const isSelected = state.themeColor.toLowerCase() === t.hex.toLowerCase();

                                        return (
                                            <button
                                                key={t.name}
                                                onClick={() => handleColorSelect(t)}
                                                className={`w-9 h-9 rounded-full flex items-center justify-center transition-all relative ${
                                                    isSelected 
                                                    ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110 shadow-md' 
                                                    : 'border border-gray-200 dark:border-slate-600 opacity-90 hover:opacity-100 hover:scale-105'
                                                }`}
                                                style={{ background: t.hex }}
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
                        
                        {/* Pre-Defined Gradients */}
                        <div>
                            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 mb-2">Gradients</p>
                            <div className="flex gap-3 overflow-x-auto p-2 custom-scrollbar -mx-1 px-4">
                                {GRADIENT_PRESETS.map((g) => {
                                    const isSelected = state.themeGradient === g.value;
                                    return (
                                        <button
                                            key={g.name}
                                            onClick={() => handleGradientSelect(g.value)}
                                            className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center transition-all relative ${
                                                isSelected 
                                                ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 scale-110 shadow-md' 
                                                : 'border border-gray-200 dark:border-slate-600 opacity-90 hover:opacity-100 hover:scale-105'
                                            }`}
                                            style={{ background: g.value }}
                                            title={g.name}
                                        >
                                            {isSelected && <Check size={16} color="white" strokeWidth={3} className="drop-shadow-md" />}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Custom Colors & Header */}
                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500">Advanced Customization</p>
                                <button 
                                    onClick={resetTheme}
                                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                                >
                                    <RotateCcw size={10} /> Reset
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    className="p-2 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                                    onClick={() => { onClose(); setIsColorPickerOpen(true); }}
                                >
                                    <div className="w-4 h-4 rounded-full border border-black/10" style={{ background: state.themeColor }}></div>
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Accent Color</span>
                                </button>
                                
                                <div className="flex gap-1">
                                    <button 
                                        className="flex-1 p-2 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
                                        onClick={() => { onClose(); setIsHeaderColorPickerOpen(true); }}
                                        title="Solid Header Background"
                                    >
                                        <PaintBucket size={14} /> Header
                                    </button>
                                    <button 
                                        className="flex-1 p-2 rounded-lg bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 flex items-center justify-center gap-2 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors text-xs font-medium text-gray-700 dark:text-gray-300"
                                        onClick={() => { onClose(); setIsGradientPickerOpen(true); }}
                                        title="Gradient Header"
                                    >
                                        <Layout size={14} /> Grad.
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Font Selection */}
                        <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                            <div className="flex justify-between items-center mb-2">
                                <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 flex items-center gap-1">
                                    <Type size={12} /> App Font
                                </p>
                                <button 
                                    onClick={() => fontInputRef.current?.click()} 
                                    className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1 hover:underline"
                                >
                                    <Plus size={10} /> Add Custom
                                </button>
                                <input 
                                    type="file" 
                                    accept=".ttf,.otf,.woff,.woff2" 
                                    ref={fontInputRef} 
                                    className="hidden" 
                                    onChange={handleFontUpload}
                                />
                            </div>
                            
                            {/* Google Font Loader Input */}
                            <div className="flex gap-1 mb-2">
                                <input 
                                    type="text" 
                                    placeholder="Enter Google Font Name (e.g. Lato)" 
                                    className="flex-grow text-xs p-1.5 border rounded bg-gray-50 dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                    value={googleFontName}
                                    onChange={(e) => setGoogleFontName(e.target.value)}
                                />
                                <button onClick={handleLoadGoogleFont} className="text-xs bg-blue-600 text-white px-2 rounded hover:bg-blue-700">Load</button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {/* Standard Fonts */}
                                {APP_FONTS.map(font => (
                                    <button
                                        key={font.name}
                                        onClick={() => handleFontSelect(font.name)}
                                        className={`px-3 py-1.5 text-xs border rounded-lg transition-all ${
                                            (state.font || 'Inter') === font.name 
                                                ? 'bg-primary text-white border-primary shadow-sm' 
                                                : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                                        }`}
                                        style={font.style}
                                    >
                                        {font.label}
                                    </button>
                                ))}
                                
                                {/* Custom Fonts */}
                                {state.customFonts.map(font => (
                                    <div key={font.id} className="relative group">
                                        <button
                                            onClick={() => handleFontSelect(font.name)}
                                            className={`px-3 py-1.5 text-xs border rounded-lg transition-all pr-6 ${
                                                (state.font) === font.name 
                                                    ? 'bg-primary text-white border-primary shadow-sm' 
                                                    : 'bg-white dark:bg-slate-700 border-gray-200 dark:border-slate-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50'
                                            }`}
                                            style={{ fontFamily: font.name }}
                                        >
                                            {font.name}
                                        </button>
                                        <button 
                                            onClick={(e) => handleRemoveFont(e, font.id)}
                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-red-100 text-red-500 opacity-60 hover:opacity-100"
                                            title="Delete font"
                                        >
                                            <Trash2 size={10} />
                                        </button>
                                    </div>
                                ))}
                            </div>
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
