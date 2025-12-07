
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Layout, Smartphone, CreditCard, Bell, Maximize2, Minimize2, ArrowUp, ArrowDown, Type, Navigation } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { AppMetadataUIPreferences } from '../types';

interface UISettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const UISettingsModal: React.FC<UISettingsModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch, showToast } = useAppContext();
  const [prefs, setPrefs] = useState<AppMetadataUIPreferences>(state.uiPreferences);

  useEffect(() => {
    if (isOpen) {
      setPrefs(state.uiPreferences);
      document.body.style.overflow = 'hidden';
    }
    return () => { 
        document.body.style.overflow = ''; 
    };
  }, [isOpen, state.uiPreferences]);

  const handleSave = () => {
    dispatch({ type: 'UPDATE_UI_PREFERENCES', payload: prefs });
    showToast("UI settings updated. Preferences will sync with your account.", 'success');
    onClose();
  };

  const handleApplyPreset = (preset: 'modern' | 'classic' | 'playful') => {
      let newPrefs: Partial<AppMetadataUIPreferences> = {};
      if (preset === 'modern') {
          newPrefs = { buttonStyle: 'rounded', cardStyle: 'solid', toastPosition: 'top-center', density: 'comfortable', navStyle: 'docked', fontSize: 'normal' };
      } else if (preset === 'classic') {
          newPrefs = { buttonStyle: 'sharp', cardStyle: 'bordered', toastPosition: 'bottom-right', density: 'compact', navStyle: 'docked', fontSize: 'small' };
      } else if (preset === 'playful') {
          newPrefs = { buttonStyle: 'pill', cardStyle: 'glass', toastPosition: 'top-center', density: 'comfortable', navStyle: 'floating', fontSize: 'normal' };
      }
      setPrefs(prev => ({ ...prev, ...newPrefs }));
  };

  if (!isOpen) return null;

  return createPortal(
    <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-lg h-[90vh] flex flex-col p-0 overflow-hidden animate-scale-in border-none shadow-2xl bg-white dark:bg-slate-900">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Layout className="text-teal-400" />
            <h2 className="font-bold text-lg">UI Customizer</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-grow overflow-y-auto p-5 space-y-8 bg-slate-50 dark:bg-slate-900 custom-scrollbar">
          
          {/* Quick Presets */}
          <section>
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                  <Layout size={14} /> Quick Themes
              </h3>
              <div className="grid grid-cols-3 gap-3">
                  <button onClick={() => handleApplyPreset('modern')} className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-xl hover:ring-2 hover:ring-indigo-500 text-sm font-medium transition-all shadow-sm">Modern</button>
                  <button onClick={() => handleApplyPreset('classic')} className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-none hover:ring-2 hover:ring-indigo-500 text-sm font-medium transition-all shadow-sm">Classic</button>
                  <button onClick={() => handleApplyPreset('playful')} className="p-3 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-full hover:ring-2 hover:ring-indigo-500 text-sm font-medium transition-all shadow-sm">Playful</button>
              </div>
          </section>

          <div className="border-t dark:border-slate-700"></div>

          {/* Component Styles */}
          <div className="space-y-6">
            {/* Button Style */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Smartphone size={14} /> Button Style
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { id: 'rounded', label: 'Rounded' },
                        { id: 'pill', label: 'Pill' },
                        { id: 'sharp', label: 'Sharp' }
                    ].map((opt) => (
                        <button 
                            key={opt.id}
                            onClick={() => setPrefs({...prefs, buttonStyle: opt.id as any})}
                            className={`p-3 text-sm font-bold transition-all flex items-center justify-center border shadow-sm ${
                                prefs.buttonStyle === opt.id 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-500' 
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                            } ${
                                opt.id === 'rounded' ? 'rounded-lg' : opt.id === 'pill' ? 'rounded-full' : 'rounded-none'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </section>

            {/* Card Style */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <CreditCard size={14} /> Card Style
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    <button 
                        onClick={() => setPrefs({...prefs, cardStyle: 'solid'})}
                        className={`flex flex-col items-center justify-center p-3 text-center border rounded-xl text-sm font-medium transition-all shadow-sm ${prefs.cardStyle === 'solid' ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'}`}
                    >
                        Solid <span className="text-[10px] font-normal opacity-70 mt-1">Opaque</span>
                    </button>
                    <button 
                        onClick={() => setPrefs({...prefs, cardStyle: 'bordered'})}
                        className={`flex flex-col items-center justify-center p-3 text-center border rounded-xl text-sm font-medium transition-all shadow-sm ${prefs.cardStyle === 'bordered' ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'}`}
                    >
                        Bordered <span className="text-[10px] font-normal opacity-70 mt-1">Outline</span>
                    </button>
                    <button 
                        onClick={() => setPrefs({...prefs, cardStyle: 'glass'})}
                        className={`flex flex-col items-center justify-center p-3 text-center border rounded-xl text-sm font-medium transition-all shadow-sm ${prefs.cardStyle === 'glass' ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 hover:border-gray-300 text-gray-600 dark:text-gray-400'}`}
                    >
                        Glass <span className="text-[10px] font-normal opacity-70 mt-1">Blur</span>
                    </button>
                </div>
            </section>
          </div>
          
          <div className="border-t dark:border-slate-700"></div>
          
          {/* Navigation & Typography */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Navigation Style */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Navigation size={14} /> Navigation Bar
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setPrefs({...prefs, navStyle: 'docked'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all shadow-sm ${
                            (prefs.navStyle || 'docked') === 'docked' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-500' 
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                    >
                        <div className="h-6 w-full max-w-[40px] border-b-2 border-current mb-2 opacity-50"></div>
                        <span className="text-sm font-bold">Docked</span>
                    </button>
                    <button 
                        onClick={() => setPrefs({...prefs, navStyle: 'floating'})}
                        className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all shadow-sm ${
                            prefs.navStyle === 'floating' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-500' 
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                    >
                         <div className="h-6 w-full max-w-[40px] border-2 border-current rounded-full mb-2 opacity-50"></div>
                        <span className="text-sm font-bold">Floating</span>
                    </button>
                </div>
            </section>
            
            {/* Font Size */}
             <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Type size={14} /> Font Size
                </h3>
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { id: 'small', label: 'Small', class: 'text-xs' },
                        { id: 'normal', label: 'Normal', class: 'text-sm' },
                        { id: 'large', label: 'Large', class: 'text-base' }
                    ].map((opt) => (
                        <button 
                            key={opt.id}
                            onClick={() => setPrefs({...prefs, fontSize: opt.id as any})}
                            className={`flex flex-col items-center justify-center p-2 rounded-xl font-medium transition-all border shadow-sm ${
                                (prefs.fontSize || 'normal') === opt.id 
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-600 dark:text-indigo-300 dark:bg-indigo-900/30 ring-1 ring-indigo-500' 
                                : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400 hover:border-gray-300'
                            }`}
                        >
                            <span className={opt.class}>A</span>
                            <span className="text-[10px] mt-1">{opt.label}</span>
                        </button>
                    ))}
                </div>
            </section>
          </div>

          <div className="border-t dark:border-slate-700"></div>

          {/* Layout & Positioning */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Notification Position */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Bell size={14} /> Toast Position
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { id: 'top-center', label: 'Top Center', icon: ArrowUp },
                        { id: 'top-right', label: 'Top Right', icon: ArrowUp },
                        { id: 'bottom-center', label: 'Btm Center', icon: ArrowDown },
                        { id: 'bottom-right', label: 'Btm Right', icon: ArrowDown }
                    ].map((pos) => {
                        const Icon = pos.icon;
                        const isSelected = prefs.toastPosition === pos.id;
                        return (
                            <button
                                key={pos.id}
                                onClick={() => setPrefs({...prefs, toastPosition: pos.id as any})}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl text-xs transition-all border shadow-sm ${
                                    isSelected 
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-600 dark:text-indigo-300 dark:bg-indigo-900/30 ring-1 ring-indigo-500' 
                                    : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-500 hover:border-gray-300'
                                }`}
                            >
                                <Icon size={14} className="mb-1 opacity-70" />
                                {pos.label}
                            </button>
                        )
                    })}
                </div>
            </section>

            {/* Layout Density */}
            <section>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Maximize2 size={14} /> Layout Density
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    <button 
                        onClick={() => setPrefs({...prefs, density: 'comfortable'})}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all shadow-sm ${
                            prefs.density === 'comfortable' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-500' 
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                    >
                        <Maximize2 size={18} className="mb-1 opacity-70" />
                        <span className="text-xs font-bold">Comfortable</span>
                    </button>
                    <button 
                        onClick={() => setPrefs({...prefs, density: 'compact'})}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all shadow-sm ${
                            prefs.density === 'compact' 
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 ring-1 ring-indigo-500' 
                            : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
                        }`}
                    >
                        <Minimize2 size={18} className="mb-1 opacity-70" />
                        <span className="text-xs font-bold">Compact</span>
                    </button>
                </div>
            </section>
          </div>

        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex gap-3 shrink-0">
            <Button onClick={onClose} variant="secondary" className="flex-1">
                Cancel
            </Button>
            <Button onClick={handleSave} className="flex-[2]">
                <Save size={16} className="mr-2" /> Save Preferences
            </Button>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default UISettingsModal;
