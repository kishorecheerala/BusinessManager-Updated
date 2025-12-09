
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Terminal, CloudLightning, Zap, Trash2, RefreshCw, HardDrive, Save, AlertTriangle, Bell, Bug, History, RotateCcw, PlusCircle, Server, Activity } from 'lucide-react';
import Card from './Card';
import Button from './Button';
import { useAppContext } from '../context/AppContext';
import * as db from '../utils/db';
import { testData, testProfile } from '../utils/testData';
import { useDialog } from '../context/DialogContext';
import { Snapshot, Customer, Product, Sale, SaleItem } from '../types';

interface DeveloperToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCloudDebug: () => void;
}

const DeveloperToolsModal: React.FC<DeveloperToolsModalProps> = ({ isOpen, onClose, onOpenCloudDebug }) => {
  const { state, dispatch, showToast } = useAppContext();
  const { showConfirm, showPrompt } = useDialog();
  const [activeTab, setActiveTab] = useState<'general' | 'state' | 'db' | 'stress' | 'danger'>('general');
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number, quota: number } | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);

  // Stress Test Config
  const [stressConfig, setStressConfig] = useState({
      customers: 500,
      products: 1000,
      sales: 2000,
      monthsHistory: 12
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState('');

  useEffect(() => {
    if (isOpen) {
        document.body.style.overflow = 'hidden';
        if (navigator.storage && navigator.storage.estimate) {
            navigator.storage.estimate().then(estimate => {
                if (estimate.usage !== undefined && estimate.quota !== undefined) {
                setStorageEstimate({ usage: estimate.usage, quota: estimate.quota });
                }
            });
        }
        loadSnapshots();
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const loadSnapshots = async () => {
      setIsSnapshotLoading(true);
      try {
          const snaps = await db.getSnapshots();
          setSnapshots(snaps);
      } catch (e) {
          console.error("Failed to load snapshots", e);
      } finally {
          setIsSnapshotLoading(false);
      }
  };

  const handleCreateSnapshot = async () => {
      const name = await showPrompt("Enter a name for this checkpoint:", `Checkpoint ${new Date().toLocaleTimeString()}`);
      if (name) {
          setIsSnapshotLoading(true);
          try {
              await db.createSnapshot(name);
              showToast("Checkpoint created successfully.", "success");
              await loadSnapshots();
          } catch (e) {
              console.error(e);
              showToast("Failed to create checkpoint.", "error");
          } finally {
              setIsSnapshotLoading(false);
          }
      }
  };

  const handleRestoreSnapshot = async (snap: Snapshot) => {
      const confirmed = await showConfirm(`Restore "${snap.name}"? Current data will be replaced by this snapshot.`, {
          title: "Restore Checkpoint",
          confirmText: "Restore",
          variant: "danger"
      });

      if (confirmed) {
          try {
              await db.restoreSnapshot(snap.id);
              window.location.reload();
          } catch (e) {
              console.error(e);
              showToast("Failed to restore.", "error");
          }
      }
  };

  const handleDeleteSnapshot = async (id: string) => {
      if (await showConfirm("Delete this checkpoint?")) {
          await db.deleteSnapshot(id);
          setSnapshots(prev => prev.filter(s => s.id !== id));
          showToast("Checkpoint deleted.");
      }
  };

  const handleLoadTestData = async () => {
    const confirmed = await showConfirm("This will OVERWRITE your current data with sample test data. Proceed?", {
      title: "Load Test Data",
      confirmText: "Overwrite",
      variant: "danger"
    });

    if (confirmed) {
      try {
        await db.importData(testData as any);
        await db.saveCollection('profile', [testProfile]);
        window.location.reload();
      } catch (error) {
        console.error("Failed to load test data:", error);
        showToast("Failed to load test data.", 'info');
      }
    }
  };

  const handleFactoryReset = async () => {
    const confirmed = await showConfirm("FACTORY RESET: This will wipe ALL data from this device. This action cannot be undone. Are you absolutely sure?", {
      title: "Factory Reset",
      confirmText: "WIPE EVERYTHING",
      variant: "danger"
    });

    if (confirmed) {
      await db.clearDatabase();
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleClearLocalStorage = () => {
      if(window.confirm("Clear LocalStorage? This will reset settings but keep data.")) {
          localStorage.clear();
          window.location.reload();
      }
  };

  const handleTestNotification = () => {
      dispatch({
          type: 'ADD_NOTIFICATION',
          payload: {
              id: `TEST-${Date.now()}`,
              title: 'Test Notification',
              message: 'This is a test notification from Developer Tools.',
              read: false,
              createdAt: new Date().toISOString(),
              type: 'info'
          }
      });
      showToast("Test notification sent.");
  };

  const handleExportState = () => {
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `app_state_dump_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // --- Stress Generator Logic ---
  const generateStressData = async () => {
      const confirmed = await showConfirm(
          `This will generate ${stressConfig.customers + stressConfig.products + stressConfig.sales} records. EXISTING DATA WILL BE REPLACED.`, 
          { title: "Start Stress Test", confirmText: "Generate & Replace", variant: "danger" }
      );
      if(!confirmed) return;

      setIsGenerating(true);
      
      // Delay to allow UI to update
      setTimeout(async () => {
          try {
            // 1. Generate Customers
            setGenProgress('Generating Customers...');
            const customers: Customer[] = [];
            for (let i = 0; i < stressConfig.customers; i++) {
                customers.push({
                    id: `CUST-GEN-${i}`,
                    name: `Customer ${i} ${Math.random().toString(36).substring(7)}`,
                    phone: `9${Math.floor(Math.random() * 1000000000)}`,
                    address: `Address Block ${Math.floor(Math.random() * 100)}, Street ${Math.floor(Math.random() * 10)}`,
                    area: ['North', 'South', 'East', 'West', 'Central'][Math.floor(Math.random() * 5)],
                    priceTier: Math.random() > 0.8 ? 'WHOLESALE' : 'RETAIL'
                });
            }

            // 2. Generate Products
            setGenProgress('Generating Products...');
            const products: Product[] = [];
            for (let i = 0; i < stressConfig.products; i++) {
                const price = Math.floor(Math.random() * 5000) + 100;
                products.push({
                    id: `PROD-GEN-${i}`,
                    name: `Product Item ${i}-${Math.random().toString(36).substring(7)}`,
                    category: ['Electronics', 'Clothing', 'Groceries', 'Hardware', 'Services'][Math.floor(Math.random() * 5)],
                    quantity: Math.floor(Math.random() * 100),
                    purchasePrice: price,
                    salePrice: Math.floor(price * 1.3),
                    gstPercent: [0, 5, 12, 18, 28][Math.floor(Math.random() * 5)]
                });
            }

            // 3. Generate Sales
            setGenProgress('Generating Sales History...');
            const sales: Sale[] = [];
            const today = new Date();
            for (let i = 0; i < stressConfig.sales; i++) {
                const numItems = Math.floor(Math.random() * 5) + 1;
                const saleItems: SaleItem[] = [];
                let total = 0;
                let gst = 0;

                for (let k = 0; k < numItems; k++) {
                    const prod = products[Math.floor(Math.random() * products.length)];
                    const qty = Math.floor(Math.random() * 5) + 1;
                    const lineTotal = prod.salePrice * qty;
                    
                    saleItems.push({
                        productId: prod.id,
                        productName: prod.name,
                        quantity: qty,
                        price: prod.salePrice
                    });

                    total += lineTotal;
                    gst += lineTotal - (lineTotal / (1 + prod.gstPercent / 100));
                }

                // Random date within configured months
                const date = new Date();
                date.setDate(today.getDate() - Math.floor(Math.random() * (stressConfig.monthsHistory * 30)));

                sales.push({
                    id: `INV-GEN-${i}`,
                    customerId: customers[Math.floor(Math.random() * customers.length)].id,
                    items: saleItems,
                    totalAmount: Math.floor(total),
                    gstAmount: Math.floor(gst),
                    discount: 0,
                    date: date.toISOString(),
                    payments: Math.random() > 0.2 ? [{
                        id: `PAY-GEN-${i}`,
                        amount: Math.floor(total),
                        method: 'CASH',
                        date: date.toISOString()
                    }] : [] // 20% unpaid
                });
            }

            setGenProgress('Saving to Database...');
            await db.saveCollection('customers', customers);
            await db.saveCollection('products', products);
            await db.saveCollection('sales', sales);
            // Clear other tables to avoid conflicts
            await db.saveCollection('purchases', []);
            await db.saveCollection('returns', []);
            await db.saveCollection('expenses', []);
            
            showToast(`Generated ${sales.length} transactions! Reloading...`, 'success');
            setTimeout(() => window.location.reload(), 1000);

          } catch (e) {
              console.error(e);
              showToast("Generation failed", 'error');
              setIsGenerating(false);
          }
      }, 100);
  };

  if (!isOpen) return null;

  const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return createPortal(
    <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in-fast" onClick={onClose} />
      <Card className="relative z-10 w-full max-w-4xl h-full flex flex-col p-0 overflow-hidden animate-scale-in bg-slate-50 dark:bg-slate-900 border-2 border-indigo-500 shadow-2xl">
        
        {/* Header */}
        <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={20} className="text-green-400" />
            <div>
                <h2 className="font-bold text-lg leading-none">Developer Tools</h2>
                <span className="text-[10px] font-mono text-slate-400">Mode: Enabled</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full transition-colors"><X size={20}/></button>
        </div>

        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Nav */}
            <div className="w-48 bg-slate-100 dark:bg-slate-800 border-r dark:border-slate-700 flex flex-col">
                <button onClick={() => setActiveTab('general')} className={`p-4 text-left text-sm font-semibold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700 ${activeTab === 'general' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <Zap size={16} /> General
                </button>
                <button onClick={() => setActiveTab('state')} className={`p-4 text-left text-sm font-semibold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700 ${activeTab === 'state' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <Database size={16} /> State Viewer
                </button>
                <button onClick={() => setActiveTab('db')} className={`p-4 text-left text-sm font-semibold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700 ${activeTab === 'db' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 border-r-2 border-indigo-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <HardDrive size={16} /> Storage & Snaps
                </button>
                <button onClick={() => setActiveTab('stress')} className={`p-4 text-left text-sm font-semibold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700 ${activeTab === 'stress' ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 border-r-2 border-amber-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <Activity size={16} /> Stress Test
                </button>
                <button onClick={() => setActiveTab('danger')} className={`p-4 text-left text-sm font-semibold flex items-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 ${activeTab === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-r-2 border-red-600' : 'text-slate-600 dark:text-slate-400'}`}>
                    <AlertTriangle size={16} /> Danger Zone
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-slate-900">
                
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Environment</h3>
                                <div className="space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                                    <p><span className="text-slate-400">User Agent:</span> {navigator.userAgent}</p>
                                    <p><span className="text-slate-400">Platform:</span> {navigator.platform}</p>
                                    <p><span className="text-slate-400">Screen:</span> {window.innerWidth}x{window.innerHeight}</p>
                                    <p><span className="text-slate-400">Online:</span> {navigator.onLine ? 'Yes' : 'No'}</p>
                                </div>
                            </div>
                            <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700">
                                <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">App Status</h3>
                                <div className="space-y-1 text-xs font-mono text-slate-700 dark:text-slate-300">
                                    <p><span className="text-slate-400">Dev Mode:</span> Enabled</p>
                                    <p><span className="text-slate-400">Theme:</span> {state.theme}</p>
                                    <p><span className="text-slate-400">DB Loaded:</span> Yes</p>
                                    <p><span className="text-slate-400">Sync Status:</span> {state.syncStatus}</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Quick Actions</h3>
                            <div className="flex flex-wrap gap-3">
                                <Button onClick={onOpenCloudDebug} variant="secondary" className="h-auto py-2 text-xs">
                                    <CloudLightning size={14} className="mr-2"/> Cloud Diagnostics
                                </Button>
                                <Button onClick={handleTestNotification} variant="secondary" className="h-auto py-2 text-xs">
                                    <Bell size={14} className="mr-2"/> Test Notification
                                </Button>
                                <Button onClick={() => showToast("This is a test toast message", "info")} variant="secondary" className="h-auto py-2 text-xs">
                                    <Bug size={14} className="mr-2"/> Test Toast
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'state' && (
                    <div className="h-full flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Current App State</h3>
                            <Button onClick={handleExportState} variant="secondary" className="h-8 text-xs"><Save size={14} className="mr-1"/> Export JSON</Button>
                        </div>
                        <div className="flex-grow bg-slate-900 rounded-lg p-4 overflow-auto border border-slate-700">
                            <pre className="text-xs text-green-400 font-mono">
                                {JSON.stringify(state, null, 2)}
                            </pre>
                        </div>
                    </div>
                )}

                {activeTab === 'db' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                            <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2">Storage Usage</h3>
                            {storageEstimate ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs font-medium text-blue-700 dark:text-blue-200">
                                        <span>Used: {formatBytes(storageEstimate.usage)}</span>
                                        <span>Quota: {formatBytes(storageEstimate.quota)}</span>
                                    </div>
                                    <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2.5">
                                        <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${(storageEstimate.usage / storageEstimate.quota) * 100}%` }}></div>
                                    </div>
                                    <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">Includes IndexedDB and Cache Storage.</p>
                                </div>
                            ) : (
                                <p className="text-xs text-blue-600">Estimating...</p>
                            )}
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                    <History size={16} /> System Checkpoints
                                </h3>
                                <Button onClick={handleCreateSnapshot} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                                    <PlusCircle size={12} className="mr-1.5" /> Create Checkpoint
                                </Button>
                            </div>
                            
                            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg border dark:border-slate-700 overflow-hidden">
                                {isSnapshotLoading ? (
                                    <div className="p-4 text-center text-xs text-slate-500">Loading snapshots...</div>
                                ) : snapshots.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-500">No checkpoints created.</div>
                                ) : (
                                    <div className="divide-y dark:divide-slate-700 max-h-48 overflow-y-auto">
                                        {snapshots.map(snap => (
                                            <div key={snap.id} className="p-3 flex justify-between items-center hover:bg-white dark:hover:bg-slate-700/50 transition-colors">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{snap.name}</p>
                                                    <p className="text-[10px] text-slate-500 font-mono">{new Date(snap.timestamp).toLocaleString()}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button onClick={() => handleRestoreSnapshot(snap)} variant="secondary" className="h-7 text-xs px-2">
                                                        <RotateCcw size={12} className="mr-1" /> Restore
                                                    </Button>
                                                    <Button onClick={() => handleDeleteSnapshot(snap.id)} variant="secondary" className="h-7 text-xs px-2 text-red-600 hover:bg-red-50 border-red-100">
                                                        <Trash2 size={12} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <p className="text-[10px] text-slate-400 mt-2">
                                Snapshots save the entire database state locally. Use before major operations.
                            </p>
                        </div>

                        <div>
                            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Database Actions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Button onClick={handleLoadTestData} variant="secondary" className="bg-purple-100 hover:bg-purple-200 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200 border-purple-200 dark:border-purple-800">
                                    <Database size={14} className="mr-2"/> Seed Test Data
                                </Button>
                                <Button onClick={() => window.location.reload()} variant="secondary">
                                    <RefreshCw size={14} className="mr-2"/> Force Reload App
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'stress' && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                            <h3 className="font-bold text-amber-800 dark:text-amber-200 text-sm flex items-center gap-2 mb-2">
                                <Activity size={16} /> Load Testing
                            </h3>
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                This tool generates massive amounts of random data to test the app's performance and stability. 
                                <strong> Warning: Existing data will be wiped.</strong>
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of Customers</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" min="100" max="10000" step="100" 
                                        value={stressConfig.customers}
                                        onChange={(e) => setStressConfig({...stressConfig, customers: parseInt(e.target.value)})}
                                        className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-sm font-mono w-16 text-right">{stressConfig.customers}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Number of Products</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" min="100" max="5000" step="100" 
                                        value={stressConfig.products}
                                        onChange={(e) => setStressConfig({...stressConfig, products: parseInt(e.target.value)})}
                                        className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-sm font-mono w-16 text-right">{stressConfig.products}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sales Volume</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" min="500" max="20000" step="500" 
                                        value={stressConfig.sales}
                                        onChange={(e) => setStressConfig({...stressConfig, sales: parseInt(e.target.value)})}
                                        className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-sm font-mono w-16 text-right">{stressConfig.sales}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">History Range (Months)</label>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" min="1" max="24" step="1" 
                                        value={stressConfig.monthsHistory}
                                        onChange={(e) => setStressConfig({...stressConfig, monthsHistory: parseInt(e.target.value)})}
                                        className="flex-grow h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                    />
                                    <span className="text-sm font-mono w-16 text-right">{stressConfig.monthsHistory}mo</span>
                                </div>
                            </div>

                            <Button 
                                onClick={generateStressData}
                                disabled={isGenerating}
                                className="w-full bg-red-600 hover:bg-red-700 text-white shadow-lg"
                            >
                                {isGenerating ? (
                                    <>Generating... {genProgress}</>
                                ) : (
                                    <><Server size={16} className="mr-2" /> Generate Large Dataset</>
                                )}
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'danger' && (
                    <div className="space-y-6">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-red-600 shrink-0 mt-1" size={20} />
                                <div>
                                    <h3 className="text-sm font-bold text-red-700 dark:text-red-200">Factory Reset</h3>
                                    <p className="text-xs text-red-600 dark:text-red-300 mt-1 mb-3">
                                        This will completely wipe the IndexedDB database and LocalStorage. All data (customers, sales, etc.) will be lost unless backed up.
                                    </p>
                                    <Button onClick={handleFactoryReset} variant="danger" className="text-xs">
                                        <Trash2 size={14} className="mr-2"/> Wipe Everything
                                    </Button>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                            <div className="flex items-start gap-3">
                                <Trash2 className="text-orange-600 shrink-0 mt-1" size={20} />
                                <div>
                                    <h3 className="text-sm font-bold text-orange-700 dark:text-orange-200">Clear LocalStorage Only</h3>
                                    <p className="text-xs text-orange-600 dark:text-orange-300 mt-1 mb-3">
                                        This will reset settings like Theme, PIN, and Google Auth tokens, but ideally keeps IndexedDB data (depending on browser implementation).
                                    </p>
                                    <Button onClick={handleClearLocalStorage} variant="secondary" className="text-xs bg-orange-100 text-orange-800 hover:bg-orange-200 border-orange-200">
                                        Clear LocalStorage
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
      </Card>
    </div>,
    document.body
  );
};

export default DeveloperToolsModal;
