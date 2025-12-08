import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Key, Globe, Info, RefreshCw, Settings } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { getClientId } from '../utils/googleDrive';
import Input from './Input';

interface APIConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const APIConfigModal: React.FC<APIConfigModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useAppContext();
  const [clientId, setClientId] = useState('');
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (isOpen) {
      setClientId(getClientId()); // Gets from localStorage or Default
      setApiKey(localStorage.getItem('gemini_api_key') || '');
    }
  }, [isOpen]);

  const handleSave = () => {
    const cleanClientId = clientId.trim();
    const cleanApiKey = apiKey.trim();

    if (cleanClientId) {
      localStorage.setItem('google_client_id', cleanClientId);
    } else {
      localStorage.removeItem('google_client_id');
    }

    if (cleanApiKey) {
      localStorage.setItem('gemini_api_key', cleanApiKey);
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    showToast("Settings saved. Reloading app to apply changes...", 'success');
    
    // Slight delay to allow toast to be seen
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const handleReset = () => {
    if (window.confirm("Reset all API settings to default?")) {
      localStorage.removeItem('google_client_id');
      localStorage.removeItem('gemini_api_key');
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[150] p-4 animate-fade-in-fast backdrop-blur-sm">
      <Card className="w-full max-w-lg h-[85vh] flex flex-col p-0 overflow-hidden animate-scale-in border-none shadow-2xl">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <SettingsIcon className="text-blue-400" />
            <h2 className="font-bold text-lg">API Configuration</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-grow overflow-y-auto p-5 space-y-6 bg-slate-50 dark:bg-slate-900">
          
          {/* Info Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm text-blue-800 dark:text-blue-200">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Why change these?</p>
                <p className="opacity-90 mt-1">
                  By using your own keys, API usage counts against <strong>your</strong> Google Cloud Project quota instead of the developer's. This removes limits and warnings.
                </p>
              </div>
            </div>
          </div>

          {/* Client ID Section */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Globe size={16} className="text-green-600" /> Google OAuth Client ID
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required for Drive Sync, Sheets Export, and Calendar.
            </p>
            <Input 
              type="text" 
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="e.g., 7320...apps.googleusercontent.com"
              className="text-sm font-mono"
            />
            <div className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
              <strong>Setup:</strong> Google Cloud Console &gt; Credentials &gt; OAuth 2.0 Client ID (Web Application).<br/>
              <strong>Authorized Origin:</strong> {window.location.origin}
            </div>
          </div>

          {/* Separator */}
          <div className="border-t dark:border-slate-700"></div>

          {/* Gemini API Key Section */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 flex items-center gap-2">
              <Key size={16} className="text-purple-600" /> Gemini API Key
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Required for Business Insights and Smart Analyst.
            </p>
            <Input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              className="text-sm font-mono"
            />
            <div className="text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-800 p-2 rounded border dark:border-slate-700">
              <strong>Get Key:</strong> Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>.
            </div>
          </div>

        </div>

        <div className="p-4 bg-white dark:bg-slate-800 border-t dark:border-slate-700 flex gap-3 shrink-0">
            <Button onClick={handleReset} variant="secondary" className="flex-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200">
                <RefreshCw size={16} className="mr-2" /> Reset Default
            </Button>
            <Button onClick={handleSave} className="flex-[2]">
                <Save size={16} className="mr-2" /> Save & Reload
            </Button>
        </div>
      </Card>
    </div>
  );
};

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  </svg>
);

export default APIConfigModal;
