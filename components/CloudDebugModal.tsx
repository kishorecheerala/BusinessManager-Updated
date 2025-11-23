
import React, { useEffect, useState } from 'react';
import { X, Download, Folder, FileText, RefreshCw, Terminal, AlertTriangle, LogIn, Settings, Save } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import { debugDriveState, getClientId } from '../utils/googleDrive';

interface CloudDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CloudDebugModal: React.FC<CloudDebugModalProps> = ({ isOpen, onClose }) => {
  const { state, dispatch, googleSignIn } = useAppContext();
  const [logs, setLogs] = useState<string[]>([]);
  const [details, setDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  
  const [customClientId, setCustomClientId] = useState('');

  useEffect(() => {
      setCustomClientId(getClientId());
  }, [isOpen]);

  const runDiagnostics = async () => {
    if (!state.googleUser?.accessToken) {
      setLogs(["Error: Not signed in."]);
      return;
    }
    setLoading(true);
    setLogs(["Starting diagnostics..."]);
    setDetails([]);
    
    try {
      const result = await debugDriveState(state.googleUser.accessToken);
      setLogs(result.logs);
      setDetails(result.details);
    } catch (e) {
      setLogs(prev => [...prev, `Exception: ${(e as Error).message}`]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && state.googleUser) {
      runDiagnostics();
    }
  }, [isOpen]);

  const handleManualRestore = async (fileId: string) => {
    if (!state.googleUser?.accessToken) return;
    if (!window.confirm("Force restore this file? It will overwrite local data.")) return;

    setRestoringId(fileId);
    try {
        // @ts-ignore
        const restoreFn = state.restoreFromFileId; 
        if (restoreFn) {
            await restoreFn(fileId);
        } else {
            alert("Restore function not available in context yet. Please refresh.");
        }
    } catch (e) {
        alert("Restore failed.");
    }
    setRestoringId(null);
    onClose();
  };

  const handleForceAuth = () => {
      googleSignIn({ forceConsent: true });
      onClose();
  };
  
  const handleSaveClientId = () => {
      if (!customClientId.trim()) return;
      if (window.confirm("Changing Client ID requires a page reload. Continue?")) {
          localStorage.setItem('google_client_id', customClientId.trim());
          window.location.reload();
      }
  };
  
  const handleResetClientId = () => {
      if (window.confirm("Reset to default Client ID?")) {
          localStorage.removeItem('google_client_id');
          window.location.reload();
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[110] p-4 animate-fade-in-fast">
      <Card className="w-full max-w-2xl h-[85vh] flex flex-col p-0 overflow-hidden animate-scale-in">
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-yellow-400" />
            <h2 className="font-bold text-lg">Cloud Diagnostics</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-900">
            {/* Status Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
                <span className={`text-xs font-bold px-2 py-1 rounded ${loading ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                    {loading ? 'Scanning Drive...' : 'Scan Complete'}
                </span>
                <div className="flex gap-2">
                    <Button onClick={handleForceAuth} variant="secondary" className="h-8 text-xs bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-200">
                        <LogIn size={14} className="mr-1" /> Force Re-Auth
                    </Button>
                    <Button onClick={runDiagnostics} variant="secondary" className="h-8 text-xs">
                        <RefreshCw size={14} className={`mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            {/* Found Data Section */}
            <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Folder size={16} /> Found Backup Folders ({details.length})
                </h3>
                {details.length === 0 && !loading && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
                        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                        <p className="text-sm text-red-700 dark:text-red-300 font-bold">No Backup Folders Found</p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            The app cannot see any folder named 'BusinessManager_AppData'. 
                            This usually means the backup was created with a different Google Account 
                            or a different version of this app.
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-bold">
                            If Debug Log shows "403": Check Configuration below.
                        </p>
                    </div>
                )}
                
                <div className="space-y-3">
                    {details.map((item: any) => (
                        <div key={item.folder.id} className="border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg overflow-hidden shadow-sm">
                            <div className="p-3 bg-slate-100 dark:bg-slate-700 border-b dark:border-slate-600 flex justify-between items-center">
                                <div>
                                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{item.folder.name}</p>
                                    <p className="text-[10px] text-slate-500 font-mono">ID: {item.folder.id}</p>
                                </div>
                                <span className="text-xs bg-slate-200 dark:bg-slate-600 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                    {item.files.length} files
                                </span>
                            </div>
                            <div className="divide-y dark:divide-slate-700">
                                {item.files.length === 0 ? (
                                    <p className="p-3 text-xs text-gray-400 italic">Empty folder.</p>
                                ) : (
                                    item.files.map((f: any) => (
                                        <div key={f.id} className="p-3 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <FileText size={18} className="text-blue-500 flex-shrink-0" />
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{f.name}</p>
                                                    <p className="text-[10px] text-gray-500">
                                                        {new Date(f.modifiedTime).toLocaleString()} • {(Number(f.size)/1024).toFixed(1)} KB
                                                    </p>
                                                </div>
                                            </div>
                                            <Button 
                                                onClick={() => handleManualRestore(f.id)}
                                                className="h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700"
                                                disabled={restoringId === f.id}
                                            >
                                                {restoringId === f.id ? 'Restoring...' : 'Restore'}
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Custom Configuration Section */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                    <Settings size={16} /> Custom Configuration
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    If you are getting a <b>403 error</b>, it means the default Client ID is blocked or mismatches your project. 
                    Create your own OAuth Client ID in Google Cloud Console, enable Drive API, and paste the ID below.
                </p>
                <div className="space-y-2">
                    <label className="block text-xs font-bold text-gray-600 dark:text-gray-300">Client ID</label>
                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={customClientId}
                            onChange={(e) => setCustomClientId(e.target.value)}
                            className="flex-grow p-2 text-xs border rounded dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                            placeholder="7320...apps.googleusercontent.com"
                        />
                        <Button onClick={handleSaveClientId} className="h-8 text-xs">
                            <Save size={14} className="mr-1" /> Save & Reload
                        </Button>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                        <p className="text-[10px] text-gray-400">
                            Authorized Origin: <span className="font-mono text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 px-1 rounded">{window.location.origin}</span>
                        </p>
                        <button onClick={handleResetClientId} className="text-[10px] text-red-500 hover:underline">Reset to Default</button>
                    </div>
                </div>
            </div>

            {/* Logs Section */}
            <div>
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">Debug Log</h3>
                <div className="bg-slate-900 text-green-400 font-mono text-xs p-3 rounded-lg h-40 overflow-y-auto border border-slate-700">
                    {logs.map((line, i) => (
                        <div key={i} className="whitespace-pre-wrap mb-1">{line}</div>
                    ))}
                    {logs.length === 0 && <span className="opacity-50">Waiting to start...</span>}
                </div>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default CloudDebugModal;
