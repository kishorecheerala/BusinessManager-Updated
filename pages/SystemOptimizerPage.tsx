
import React, { useState, useEffect, useMemo } from 'react';
import { Settings, Zap, Database, Trash2, Image as ImageIcon, CheckCircle, BarChart2, Gauge, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import { optimizeBase64 } from '../utils/imageUtils';
import { Product } from '../types';
import { useDialog } from '../context/DialogContext';

const SystemOptimizerPage: React.FC = () => {
    const { state, dispatch, showToast } = useAppContext();
    const { showConfirm } = useDialog();
    const [isOptimizing, setIsOptimizing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [stats, setStats] = useState({
        totalImages: 0,
        heavyImages: 0,
        potentialSavings: 0,
        productsCount: 0,
        notificationsCount: 0,
        logsCount: 0
    });

    useEffect(() => {
        // Calculate basic stats
        let heavyImgCount = 0;
        let imgCount = 0;
        
        state.products.forEach(p => {
            if (p.image) {
                imgCount++;
                if (p.image.length > 500 * 1024) { // > 500KB base64 string
                    heavyImgCount++;
                }
            }
        });

        setStats({
            totalImages: imgCount,
            heavyImages: heavyImgCount,
            potentialSavings: heavyImgCount * 0.5, // Rough est: save 50%
            productsCount: state.products.length,
            notificationsCount: state.notifications.length,
            logsCount: state.audit_logs.length
        });
    }, [state.products, state.notifications, state.audit_logs]);

    const handleOptimizeImages = async () => {
        if (stats.heavyImages === 0) {
            const confirmed = await showConfirm("No heavy images detected. Optimize all images anyway?");
            if (!confirmed) return;
        }

        setIsOptimizing(true);
        setProgress(0);
        
        const productsToUpdate: Product[] = [];
        const total = state.products.length;
        let processed = 0;

        // Process in chunks to avoid UI freeze
        const processChunk = async (startIndex: number) => {
            const chunkSize = 10;
            const end = Math.min(startIndex + chunkSize, total);
            
            for (let i = startIndex; i < end; i++) {
                const product = state.products[i];
                if (product.image) {
                    try {
                        // Optimize if it's large or png
                        const isLarge = product.image.length > 300 * 1024;
                        if (isLarge || product.image.startsWith('data:image/png')) {
                            const newImage = await optimizeBase64(product.image, 800, 0.7);
                            if (newImage.length < product.image.length) {
                                productsToUpdate.push({ ...product, image: newImage });
                            }
                        }
                    } catch (e) {
                        console.error("Failed to optimize image for", product.name);
                    }
                }
                processed++;
                setProgress(Math.round((processed / total) * 100));
            }

            if (processed < total) {
                // Schedule next chunk
                requestAnimationFrame(() => processChunk(end));
            } else {
                // Done
                if (productsToUpdate.length > 0) {
                    dispatch({ type: 'BATCH_UPDATE_PRODUCTS', payload: productsToUpdate });
                    showToast(`Optimized ${productsToUpdate.length} product images.`);
                } else {
                    showToast("Images are already optimized.");
                }
                setIsOptimizing(false);
            }
        };

        processChunk(0);
    };

    const handleCleanup = async () => {
        if (await showConfirm("Remove old notifications and audit logs (older than 30 days)?")) {
            dispatch({ type: 'CLEANUP_OLD_DATA' });
            showToast("Cleanup complete.");
        }
    };

    const handleTogglePerformance = () => {
        dispatch({ type: 'TOGGLE_PERFORMANCE_MODE' });
    };

    return (
        <div className="space-y-6 animate-fade-in-fast pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Settings size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">System Optimizer</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Manage storage and improve app performance</p>
                </div>
            </div>

            {/* Performance Mode Card */}
            <Card title="Performance Settings">
                <div className="flex items-center justify-between">
                    <div className="flex gap-4 items-center">
                        <div className={`p-3 rounded-full ${state.performanceMode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                            <Gauge size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-700 dark:text-slate-200">Low Power Mode</h3>
                            <p className="text-xs text-slate-500 max-w-xs">
                                Reduces visual effects like blur (glassmorphism) and complex animations to save battery and improve speed on older devices.
                            </p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={state.performanceMode}
                            onChange={handleTogglePerformance}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Image Optimizer */}
                <Card title="Image Optimization">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex justify-between text-sm mb-4 bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                                <span className="text-slate-500">Total Images: <strong className="text-slate-700 dark:text-slate-200">{stats.totalImages}</strong></span>
                                <span className="text-orange-500">Heavy (&gt;500KB): <strong>{stats.heavyImages}</strong></span>
                            </div>
                            <p className="text-xs text-slate-500 mb-4">
                                Compresses large product images to efficient WebP format without visible quality loss. Significantly reduces database size.
                            </p>
                        </div>
                        
                        {isOptimizing ? (
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                                    <div className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                                </div>
                                <p className="text-xs text-center text-slate-500">Optimizing... {progress}%</p>
                            </div>
                        ) : (
                            <Button onClick={handleOptimizeImages} disabled={stats.totalImages === 0} className="w-full">
                                <Zap size={16} className="mr-2" /> Optimize Database Images
                            </Button>
                        )}
                    </div>
                </Card>

                {/* Database Cleanup */}
                <Card title="Database Maintenance">
                    <div className="flex flex-col h-full justify-between">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between items-center text-sm p-2 border-b dark:border-slate-700">
                                <span className="flex items-center gap-2"><Database size={14}/> Audit Logs</span>
                                <span className="font-mono">{stats.logsCount} records</span>
                            </div>
                            <div className="flex justify-between items-center text-sm p-2 border-b dark:border-slate-700">
                                <span className="flex items-center gap-2"><BarChart2 size={14}/> Notifications</span>
                                <span className="font-mono">{stats.notificationsCount} records</span>
                            </div>
                        </div>
                        <Button onClick={handleCleanup} variant="secondary" className="w-full text-red-600 hover:bg-red-50 border-red-200 dark:bg-red-900/10 dark:hover:bg-red-900/30">
                            <Trash2 size={16} className="mr-2" /> Clean Old Logs (30+ Days)
                        </Button>
                    </div>
                </Card>
            </div>

            {state.performanceMode && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-start gap-3">
                    <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={20} />
                    <div>
                        <h4 className="text-sm font-bold text-green-800 dark:text-green-200">Performance Mode Active</h4>
                        <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            Backdrop blurs and heavy transitions are disabled. The app should feel snappier on this device.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SystemOptimizerPage;
