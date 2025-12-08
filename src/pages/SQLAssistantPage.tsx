import React, { useState, useEffect, useMemo } from 'react';
import { Database, Play, Terminal, Table as TableIcon, Wand2, AlertCircle, Loader2, Trash2, WifiOff, Layout, History, FileSpreadsheet, ChevronRight, Cloud, HardDrive, RefreshCw, Info, FolderTree } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import { GoogleGenAI } from "@google/genai";
import { Page } from '../types';
import Input from '../components/Input';
import Textarea from '../components/Textarea';

interface SQLAssistantPageProps {
    setCurrentPage: (page: Page) => void;
}

// Alasql typing
declare const alasql: any;

const SQLAssistantPage: React.FC<SQLAssistantPageProps> = ({ setCurrentPage }) => {
    const { state, showToast } = useAppContext();
    const [query, setQuery] = useState('SELECT * FROM products LIMIT 5');
    const [results, setResults] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [naturalInput, setNaturalInput] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [history, setHistory] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'query' | 'schema' | 'backup'>('query');

    // Schema Definition for UI and AI Context
    const schema = useMemo(() => ({
        customers: ['id', 'name', 'phone', 'area', 'loyaltyPoints', 'priceTier'],
        products: ['id', 'name', 'category', 'quantity', 'purchasePrice', 'salePrice', 'gstPercent'],
        sales: ['id', 'customerId', 'totalAmount', 'date', 'discount', 'gstAmount'],
        purchases: ['id', 'supplierId', 'totalAmount', 'date', 'supplierInvoiceId'],
        expenses: ['id', 'category', 'amount', 'date', 'note', 'paymentMethod'],
        suppliers: ['id', 'name', 'phone', 'location', 'gstNumber']
    }), []);

    // Initialize Database Tables from App Context
    useEffect(() => {
        if (typeof alasql !== 'undefined') {
            try {
                // Reset tables if they exist to ensure fresh data
                alasql('DROP TABLE IF EXISTS customers');
                alasql('DROP TABLE IF EXISTS products');
                alasql('DROP TABLE IF EXISTS sales');
                alasql('DROP TABLE IF EXISTS purchases');
                alasql('DROP TABLE IF EXISTS expenses');
                alasql('DROP TABLE IF EXISTS suppliers');

                // Create and Populate Tables
                alasql('CREATE TABLE customers');
                alasql('CREATE TABLE products');
                alasql('CREATE TABLE sales');
                alasql('CREATE TABLE purchases');
                alasql('CREATE TABLE expenses');
                alasql('CREATE TABLE suppliers');

                if(state.customers.length) alasql.tables.customers.data = state.customers.map(c => ({...c}));
                if(state.products.length) alasql.tables.products.data = state.products.map(p => ({...p}));
                if(state.sales.length) alasql.tables.sales.data = state.sales.map(s => ({...s}));
                if(state.purchases.length) alasql.tables.purchases.data = state.purchases.map(p => ({...p}));
                if(state.expenses.length) alasql.tables.expenses.data = state.expenses.map(e => ({...e}));
                if(state.suppliers.length) alasql.tables.suppliers.data = state.suppliers.map(s => ({...s}));

                console.log("SQL Database initialized with app data.");
            } catch (e) {
                console.error("Failed to init SQL DB", e);
                setError("Failed to initialize database engine.");
            }
        } else {
            setError("SQL Engine (Alasql) not loaded. Please check internet connection or script tags.");
        }
    }, [state.customers, state.products, state.sales, state.purchases, state.expenses, state.suppliers]);

    const handleRunSQL = () => {
        setError(null);
        setResults([]);
        try {
            const res = alasql(query);
            if (Array.isArray(res)) {
                setResults(res);
                if (res.length === 0) showToast("Query executed successfully but returned no results.", 'info');
                else {
                    showToast(`Returned ${res.length} rows.`, 'success');
                    // Add to history if unique
                    if (!history.includes(query)) {
                        setHistory(prev => [query, ...prev].slice(0, 10));
                    }
                }
            } else {
                showToast("Query executed.", 'success');
            }
        } catch (e: any) {
            setError(e.message);
        }
    };

    const handleExportCSV = () => {
        if (results.length === 0) return;
        const keys = Object.keys(results[0]);
        const csvContent = [
            keys.join(','),
            ...results.map(row => keys.map(k => `"${String(row[k] || '').replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `query_result_${Date.now()}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleAskAI = async () => {
        if (!naturalInput.trim()) return;
        if (!state.isOnline) {
            showToast("You are offline.", 'error');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            if (!apiKey) throw new Error("API Key missing. Configure in Settings.");

            const ai = new GoogleGenAI({ apiKey });
            
            const schemaContext = Object.entries(schema).map(([table, cols]) => 
                `- ${table}(${(cols as string[]).join(', ')})`
            ).join('\n');

            const prompt = `
                You are a SQL generator for a local business database (SQLite syntax compatible).
                
                Schema:
                ${schemaContext}
                
                User Request: "${naturalInput}"
                
                Write a SQL query to answer this. 
                - Use JOINs if needed (e.g. sales.customerId = customers.id). 
                - Return ONLY the raw SQL string. No markdown, no explanation.
                - Do not use functions that are not standard SQL-92.
                - Format dates as ISO strings 'YYYY-MM-DD'.
            `;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt,
            });

            let sql = response.text?.trim();
            // Cleanup markdown if present
            if (sql?.startsWith('```sql')) sql = sql.replace('```sql', '').replace('```', '');
            if (sql?.startsWith('```')) sql = sql.replace('```', '').replace('```', '');
            
            if (sql) {
                setQuery(sql.trim());
            } else {
                throw new Error("AI returned empty response.");
            }

        } catch (e: any) {
            console.error("AI Error", e);
            setError(e.message || "Failed to generate SQL.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in-fast pb-20">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                    <Database size={24} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">SQL Assistant</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Advanced Data Query & Backup Info</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
                
                {/* Left Sidebar: Navigation & Schema */}
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 overflow-hidden">
                        <div className="flex border-b dark:border-slate-700">
                            <button onClick={() => setActiveTab('query')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'query' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-500'}`}>
                                <Terminal size={16} /> Query
                            </button>
                            <button onClick={() => setActiveTab('backup')} className={`flex-1 p-3 text-sm font-medium flex items-center justify-center gap-2 ${activeTab === 'backup' ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600' : 'text-gray-500'}`}>
                                <Cloud size={16} /> Backup
                            </button>
                        </div>
                        
                        {activeTab === 'query' && (
                            <div className="p-3 space-y-4">
                                <div>
                                    <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1">Database Tables</h3>
                                    <div className="space-y-1">
                                        {Object.keys(schema).map(table => (
                                            <button 
                                                key={table}
                                                onClick={() => setQuery(`SELECT * FROM ${table} LIMIT 10`)}
                                                className="w-full flex items-center gap-2 p-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-left transition-colors"
                                            >
                                                <TableIcon size={14} className="text-gray-400" /> 
                                                <span className="font-mono text-gray-700 dark:text-gray-300">{table}</span>
                                                <span className="ml-auto text-[10px] text-gray-400 bg-gray-100 dark:bg-slate-900 px-1.5 rounded">
                                                    {(state as any)[table]?.length || 0}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {history.length > 0 && (
                                    <div>
                                        <h3 className="text-xs font-bold text-gray-500 uppercase mb-2 px-1 mt-2">History</h3>
                                        <div className="space-y-1">
                                            {history.map((h, i) => (
                                                <button 
                                                    key={i}
                                                    onClick={() => setQuery(h)}
                                                    className="w-full flex items-center gap-2 p-2 text-xs hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg text-left truncate"
                                                >
                                                    <History size={14} className="text-gray-400 shrink-0" /> 
                                                    <span className="truncate font-mono text-gray-600 dark:text-gray-400">{h}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'backup' && (
                            <div className="p-4 space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase">Data Health</h3>
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <HardDrive size={16} className="text-green-600" />
                                        <span className="text-sm font-bold text-green-800 dark:text-green-200">Local Data</span>
                                    </div>
                                    <p className="text-xs text-green-700 dark:text-green-300">
                                        Safe in IndexedDB.
                                    </p>
                                </div>
                                {state.googleUser ? (
                                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-3 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Cloud size={16} className="text-blue-600" />
                                            <span className="text-sm font-bold text-blue-800 dark:text-blue-200">Cloud Sync</span>
                                        </div>
                                        <p className="text-xs text-blue-700 dark:text-blue-300">
                                            Connected to Google Drive.
                                            <br/>
                                            Last Sync: {state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleTimeString() : 'Never'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="bg-gray-100 dark:bg-slate-700 p-3 rounded-lg">
                                        <p className="text-xs text-gray-500">Cloud Sync Disabled</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main Content */}
                <div className="lg:col-span-9 space-y-6">
                    
                    {activeTab === 'backup' ? (
                        <Card title="Data Architecture & Backup Strategy">
                            <div className="space-y-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full">
                                        <RefreshCw size={24} className="text-indigo-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 dark:text-white">How your data is backed up</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                                            Business Manager uses a <strong>Local-First</strong> architecture. All your data (sales, products, customers) lives instantly on your device in a high-performance database called <strong>IndexedDB</strong>. This ensures the app works perfectly without internet.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="border dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-800">
                                        <HardDrive className="w-8 h-8 text-gray-400 mb-3" />
                                        <h4 className="font-bold text-sm">1. Local Save</h4>
                                        <p className="text-xs text-gray-500 mt-1">Every click and edit is saved immediately to your device's internal storage.</p>
                                    </div>
                                    <div className="flex items-center justify-center text-gray-300">
                                        <ChevronRight size={32} />
                                    </div>
                                    <div className="border dark:border-slate-700 rounded-xl p-4 bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-800">
                                        <Cloud className="w-8 h-8 text-blue-500 mb-3" />
                                        <h4 className="font-bold text-sm text-blue-900 dark:text-blue-100">2. Cloud Sync</h4>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">When online, data is encrypted and uploaded to your personal Google Drive.</p>
                                    </div>
                                </div>

                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl">
                                    <h4 className="font-bold text-sm mb-3 flex items-center gap-2">
                                        <FolderTree size={16} /> File Structure in Google Drive
                                    </h4>
                                    <ul className="space-y-2 text-xs font-mono text-slate-600 dark:text-slate-400">
                                        <li className="flex items-center gap-2"><FolderTree size={12} /> /BusinessManager_AppData (Hidden App Folder)</li>
                                        <li className="pl-4 flex items-center gap-2 text-green-600">
                                            <Layout size={12} /> BusinessManager_Core_YYYY-MM-DD.json
                                            <span className="text-gray-400">- Lightweight text data (Sales, Customers)</span>
                                        </li>
                                        <li className="pl-4 flex items-center gap-2 text-orange-600">
                                            <Layout size={12} /> BusinessManager_Assets_YYYY-MM-DD.json
                                            <span className="text-gray-400">- Heavy images (Products, Receipts)</span>
                                        </li>
                                    </ul>
                                    <p className="text-xs text-gray-500 mt-3 italic">
                                        This split strategy ensures fast syncs even with many product photos.
                                    </p>
                                </div>
                            </div>
                        </Card>
                    ) : (
                        <>
                            {/* Natural Language Input */}
                            <Card className="bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-none p-1">
                                <div className="p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Wand2 size={18} className="text-yellow-300" />
                                        <h3 className="font-bold">Ask your data</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input 
                                            type="text"
                                            value={naturalInput}
                                            onChange={(e) => setNaturalInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                                            placeholder="e.g., Show top 5 customers by sales amount..."
                                            className="flex-grow !p-2.5 !bg-white/10 !border-white/20 !text-white placeholder-white/50 focus:!ring-white/50"
                                        />
                                        <Button 
                                            onClick={handleAskAI} 
                                            disabled={isGenerating} 
                                            className="bg-white text-indigo-700 hover:bg-white/90 border-none font-bold px-4"
                                        >
                                            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : 'Generate'}
                                        </Button>
                                    </div>
                                </div>
                            </Card>

                            {/* SQL Editor */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col">
                                <div className="p-2 border-b dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50 rounded-t-xl">
                                    <span className="text-xs font-bold text-gray-500 uppercase ml-2">SQL Editor</span>
                                    <div className="flex gap-2">
                                        <Button onClick={handleRunSQL} className="h-7 text-xs">
                                            <Play size={12} className="mr-1" /> Run
                                        </Button>
                                        <Button onClick={() => { setQuery(''); setResults([]); setError(null); }} variant="secondary" className="h-7 text-xs px-2">
                                            <Trash2 size={12} />
                                        </Button>
                                    </div>
                                </div>
                                <Textarea 
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="!w-full h-32 font-mono text-xs !bg-slate-900 !text-green-400 focus:!outline-none !resize-y !border-0 !rounded-none !rounded-b-xl"
                                    placeholder="SELECT * FROM ..."
                                />
                            </div>

                            {/* Results Area */}
                            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border dark:border-slate-700 flex flex-col min-h-[300px]">
                                <div className="p-3 border-b dark:border-slate-700 flex justify-between items-center">
                                    <h3 className="font-bold text-sm flex items-center gap-2">
                                        <TableIcon size={16} className="text-gray-500" /> Query Results
                                    </h3>
                                    {results.length > 0 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-gray-500">{results.length} rows</span>
                                            <Button onClick={handleExportCSV} variant="secondary" className="h-7 text-xs">
                                                <FileSpreadsheet size={12} className="mr-1" /> Export CSV
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {error ? (
                                    <div className="flex-grow flex items-center justify-center p-8 text-red-500 bg-red-50 dark:bg-red-900/20">
                                        <div className="text-center">
                                            <AlertCircle size={32} className="mx-auto mb-2" />
                                            <p className="font-bold">Syntax Error</p>
                                            <p className="text-xs font-mono mt-2 bg-white dark:bg-black/20 p-2 rounded">{error}</p>
                                        </div>
                                    </div>
                                ) : results.length > 0 ? (
                                    <div className="flex-grow overflow-auto max-h-[500px]">
                                        <table className="w-full text-sm text-left border-collapse">
                                            <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-900 dark:text-gray-300 sticky top-0 z-10 shadow-sm">
                                                <tr>
                                                    {Object.keys(results[0]).map((key) => (
                                                        <th key={key} className="px-4 py-3 border-b dark:border-slate-700 whitespace-nowrap bg-gray-50 dark:bg-slate-900">
                                                            {key}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                                                {results.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                                                        {Object.values(row).map((val: any, vIdx) => (
                                                            <td key={vIdx} className="px-4 py-2 border-b dark:border-slate-700 text-gray-600 dark:text-gray-300 whitespace-nowrap font-mono text-xs">
                                                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex-grow flex items-center justify-center text-gray-400 flex-col">
                                        <Terminal size={48} className="mb-3 opacity-20" />
                                        <p className="text-sm">Ready to execute.</p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SQLAssistantPage;
