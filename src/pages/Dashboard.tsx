
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IndianRupee, User, AlertTriangle, Download, Upload, ShoppingCart, Package, ShieldCheck, ShieldX, Archive, PackageCheck, TestTube2, Sparkles, TrendingUp, TrendingDown, CalendarClock, Volume2, StopCircle, X, RotateCw, BrainCircuit, Loader2, MessageCircle, Share, Award } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import * as db from '../utils/db';
import Card from '../components/Card';
import Button from '../components/Button';
import { Page, Customer, Sale, Purchase, Supplier, Product, Return, AppMetadataBackup, Expense } from '../types';
import { testData, testProfile } from '../utils/testData';
import { useDialog } from '../context/DialogContext';
import PinModal from '../components/PinModal';
import DatePill from '../components/DatePill';
import CheckpointsModal from '../components/CheckpointsModal';
import { GoogleGenAI, Modality } from "@google/genai";
import { usePWAInstall } from '../hooks/usePWAInstall';

interface DashboardProps {
    setCurrentPage: (page: Page) => void;
}

const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
};

const MetricCard: React.FC<{
    icon: React.ElementType;
    title: string;
    value: string | number;
    color: string;
    iconBgColor: string;
    textColor: string;
    unit?: string;
    subValue?: string;
    onClick?: () => void;
    delay?: number;
}> = ({ icon: Icon, title, value, color, iconBgColor, textColor, unit = '₹', subValue, onClick, delay }) => (
    <div
        onClick={onClick}
        className={`rounded-lg shadow-md p-5 flex items-center transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${color} ${onClick ? 'cursor-pointer' : ''} animate-slide-up-fade group`}
        style={{ animationDelay: `${delay || 0}ms` }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
        <div className={`p-4 ${iconBgColor} rounded-full flex-shrink-0 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-6`}>
            <Icon className={`w-8 h-8 ${textColor}`} />
        </div>
        <div className="ml-5 flex-grow">
            <p className={`font-bold text-xl ${textColor}`}>{title}</p>
            <p className={`text-3xl font-extrabold ${textColor} break-all mt-1`}>{unit}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
            {subValue && <p className={`text-sm font-medium mt-1 opacity-90 ${textColor}`}>{subValue}</p>}
        </div>
    </div>
);

// --- Helper for TTS decoding ---
async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const SmartAnalystCard: React.FC<{ 
    sales: Sale[], 
    products: Product[], 
    customers: Customer[], 
    purchases: Purchase[], 
    returns: Return[], 
    expenses: Expense[], 
    ownerName: string 
}> = ({ sales, products, customers, purchases, returns, expenses, ownerName }) => {
    const { showToast } = useAppContext();
    const [aiBriefing, setAiBriefing] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const staticInsights = useMemo(() => {
        const list: { icon: React.ElementType, text: string, color: string, type: string }[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const currentDay = Math.max(1, now.getDate());

        const thisMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        const currentRevenue = thisMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        
        if (currentRevenue > 0) {
            const dailyRunRate = currentRevenue / currentDay;
            const projectedRevenue = dailyRunRate * daysInMonth;
            if (projectedRevenue > currentRevenue) {
                list.push({
                    icon: TrendingUp,
                    type: 'Prediction',
                    text: `On track for ₹${Math.round(projectedRevenue).toLocaleString('en-IN')} revenue this month.`,
                    color: 'text-emerald-600 dark:text-emerald-400'
                });
            }
        }

        const thisMonthPurchases = purchases.filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        }).reduce((sum, p) => sum + Number(p.totalAmount), 0);

        if (currentRevenue > 0 || thisMonthPurchases > 0) {
            const flow = currentRevenue - thisMonthPurchases;
            if (flow < 0) {
                 list.push({
                    icon: TrendingDown,
                    type: 'Cash Flow Alert',
                    text: `Spending > Income by ₹${Math.abs(flow).toLocaleString('en-IN')} this month. Watch stock purchases.`,
                    color: 'text-orange-600 dark:text-orange-400'
                });
            }
        }

        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const activeProductIds = new Set();
        sales.forEach(s => {
            if (new Date(s.date) > sixtyDaysAgo) s.items.forEach(i => activeProductIds.add(i.productId));
        });
        const deadStock = products
            .filter(p => !activeProductIds.has(p.id) && p.quantity > 5)
            .sort((a, b) => (b.quantity * b.purchasePrice) - (a.quantity * a.purchasePrice))
            .slice(0, 1);

        if (deadStock.length > 0) {
            list.push({
                icon: Archive,
                type: 'Inventory Alert',
                text: `"${deadStock[0].name}" hasn't sold in 60 days. Consider a discount to clear ${deadStock[0].quantity} units.`,
                color: 'text-amber-600 dark:text-amber-400'
            });
        }

        if (list.length === 0) {
            list.push({
                icon: Sparkles,
                type: 'AI Assistant',
                text: "Analyze trends by adding more sales data.",
                color: 'text-primary dark:text-teal-400'
            });
        }

        return list.slice(0, 2); 
    }, [sales, products, customers, purchases, returns, expenses]);

    const handleGenerateBriefing = async () => {
        setIsGenerating(true);
        try {
            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            if (!apiKey) throw new Error("API Key not found");

            const ai = new GoogleGenAI({ apiKey });
            
            const recentSales = sales.slice(-10);
            const totalRev = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
            const totalDue = customers.reduce((acc, c) => {
                const cSales = sales.filter(s => s.customerId === c.id);
                const paid = cSales.reduce((sum, s) => sum + s.payments.reduce((p, pay) => p + Number(pay.amount), 0), 0);
                const billed = cSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
                return acc + (billed - paid);
            }, 0);

            const prompt = `Act as a business analyst for owner ${ownerName}. 
            Data: Total Revenue ₹${totalRev}, Outstanding Dues ₹${totalDue}.
            Recent 10 Sales Total: ₹${recentSales.reduce((acc, s) => acc + Number(s.totalAmount), 0)}.
            Write a 2-bullet point executive briefing. Focus on cash flow or action items. Keep it encouraging but realistic. Max 30 words per bullet.`;

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: prompt
            });

            if (response.text) {
                setAiBriefing(response.text);
            }
        } catch (error) {
            console.error("AI Error", error);
            showToast("Could not generate briefing. Check API Key or connection.", 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStopAudio = () => {
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
            audioSourceRef.current = null;
        }
        setIsPlaying(false);
    };

    const handlePlayBriefing = async () => {
        if (isPlaying) {
            handleStopAudio();
            return;
        }

        setIsPlaying(true);
        try {
            const apiKey = process.env.API_KEY || localStorage.getItem('gemini_api_key');
            if (!apiKey) throw new Error("API Key not found");

            const ai = new GoogleGenAI({ apiKey });
            const briefingText = aiBriefing || "Your business is running smoothly. Check your sales and stock levels for more details.";
            
            const prompt = `Say in a professional, encouraging news-anchor voice: "Here is your business briefing, ${ownerName}. ${briefingText.replace(/[*#]/g, '')}"`;

            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!base64Audio) throw new Error("No audio returned");

            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
            }
            
            const audioBuffer = await decodeAudioData(
                decodeBase64(base64Audio),
                audioContextRef.current,
                24000,
                1
            );

            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);
            source.onended = () => setIsPlaying(false);
            source.start();
            audioSourceRef.current = source;

        } catch (e) {
            console.error("TTS Error", e);
            showToast("Failed to play audio briefing.", 'error');
            setIsPlaying(false);
        }
    };

    const displayInsights = aiBriefing 
        ? aiBriefing.split('\n').filter(line => line.trim().startsWith('*') || line.trim().startsWith('-') || line.trim().length > 0).slice(0, 2).map(text => ({
            icon: Sparkles,
            type: 'AI Briefing',
            text: text.replace(/^[\*\-]\s*/, ''),
            color: 'text-indigo-600 dark:text-indigo-400'
        }))
        : staticInsights;

    return (
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-primary/10 dark:border-slate-700 transition-all hover:shadow-xl animate-slide-up-fade group">
            <div className="absolute top-0 left-0 w-full h-1 bg-primary"></div>
            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary/10 rounded-full animate-pulse">
                            <BrainCircuit className="w-6 h-6 text-primary transition-transform duration-700 group-hover:rotate-12" />
                        </div>
                        <div>
                            <h3 className="font-bold text-xl text-gray-800 dark:text-white">Smart Analyst</h3>
                            <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">AI Powered</span>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handlePlayBriefing}
                            className={`p-2 rounded-full transition-colors ${isPlaying ? 'bg-red-100 text-red-600 animate-pulse' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500'}`}
                            title={isPlaying ? "Stop Briefing" : "Listen to Briefing"}
                        >
                            {isPlaying ? <StopCircle size={18} /> : <Volume2 size={18} />}
                        </button>
                        <button 
                            onClick={handleGenerateBriefing} 
                            disabled={isGenerating}
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 transition-colors"
                            title="Refresh AI Insights"
                        >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <RotateCw size={18} />}
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayInsights.map((insight, idx) => (
                        <div key={idx} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/30 hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10 animate-slide-up-fade group/item" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="mt-1 flex-shrink-0 transition-transform group-hover/item:scale-110 duration-300">
                                <insight.icon className={`w-5 h-5 ${insight.color}`} />
                            </div>
                            <div>
                                <p className={`text-xs font-bold uppercase mb-0.5 ${insight.color}`}>{insight.type}</p>
                                <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed font-medium">
                                    {insight.text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const BackupStatusAlert: React.FC<{ lastBackupDate: string | null, lastSyncTime: number | null }> = ({ lastBackupDate, lastSyncTime }) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    let status: 'no-backup' | 'overdue' | 'safe' = 'no-backup';
    let diffDays = 0;
    let backupDate: Date | null = null;
    let isCloud = false;

    if (lastSyncTime) {
        const syncD = new Date(lastSyncTime);
        const syncStr = syncD.toISOString().slice(0, 10);
        if (syncStr === todayStr) {
            status = 'safe';
            backupDate = syncD;
            isCloud = true;
        }
    }

    if (status !== 'safe' && lastBackupDate) {
        const manualD = new Date(lastBackupDate);
        const manualStr = manualD.toISOString().slice(0, 10);
        if (manualStr === todayStr) {
            status = 'safe';
            backupDate = manualD;
            isCloud = false;
        } else {
            const latestDate = lastSyncTime ? (manualD > new Date(lastSyncTime) ? manualD : new Date(lastSyncTime)) : manualD;
            diffDays = Math.floor((now.getTime() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
            status = 'overdue';
            backupDate = latestDate;
        }
    } else if (status !== 'safe' && lastSyncTime) {
         const syncD = new Date(lastSyncTime);
         diffDays = Math.floor((now.getTime() - syncD.getTime()) / (1000 * 60 * 60 * 24));
         status = 'overdue';
         backupDate = syncD;
    }

    const config = {
        'no-backup': {
            icon: ShieldX,
            classes: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
            iconColor: 'text-red-600 dark:text-red-400',
            title: 'No Backup Found',
            message: 'Please create a backup immediately to protect your data.'
        },
        'overdue': {
            icon: ShieldX,
            classes: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
            iconColor: 'text-amber-600 dark:text-amber-400',
            title: 'Backup Overdue',
            message: diffDays > 0 ? `Last backup was ${diffDays} day${diffDays > 1 ? 's' : ''} ago.` : "Last backup was not today."
        },
        'safe': {
            icon: ShieldCheck,
            classes: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            title: `Data is Safe ${isCloud ? '(Cloud Sync)' : '(Manual Backup)'}`,
            message: `Backed up today at ${backupDate?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`
        }
    };

    const current = config[status];
    const Icon = current.icon;

    return (
        <div className={`flex items-start p-4 rounded-lg border ${current.classes} mb-6 group`}>
            <Icon className={`w-6 h-6 mr-3 flex-shrink-0 ${current.iconColor} transition-transform group-hover:scale-110`} />
            <div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">{current.title}</h4>
                <p className="text-sm opacity-90">{current.message}</p>
            </div>
        </div>
    );
};

const OverdueDuesCard: React.FC<{ sales: Sale[]; customers: Customer[]; onNavigate: (customerId: string) => void; }> = ({ sales, customers, onNavigate }) => {
    const { state } = useAppContext();
    const businessName = state.profile?.name || 'Our Business';

    const overdueCustomersArray = useMemo(() => {
        const overdueCustomers: { [key: string]: { customer: Customer; totalOverdue: number; oldestOverdueDate: string } } = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        sales.forEach(sale => {
            const saleDate = new Date(sale.date);
            if (saleDate < thirtyDaysAgo) {
                const amountPaid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const dueAmount = Number(sale.totalAmount) - amountPaid;
                if (dueAmount > 0.01) {
                    const customerId = sale.customerId;
                    if (!overdueCustomers[customerId]) {
                        const customer = customers.find(c => c.id === customerId);
                        if (customer) {
                            overdueCustomers[customerId] = {
                                customer: customer,
                                totalOverdue: 0,
                                oldestOverdueDate: sale.date
                            };
                        }
                    }
                    if (overdueCustomers[customerId]) {
                        overdueCustomers[customerId].totalOverdue += dueAmount;
                        if (new Date(sale.date) < new Date(overdueCustomers[customerId].oldestOverdueDate)) {
                            overdueCustomers[customerId].oldestOverdueDate = sale.date;
                        }
                    }
                }
            }
        });
        return Object.values(overdueCustomers);
    }, [sales, customers]);

    const sendWhatsAppReminder = (e: React.MouseEvent, customer: Customer, totalDue: number) => {
        e.stopPropagation();
        const message = `Dear ${customer.name}, your outstanding balance with ${businessName} is ₹${totalDue.toLocaleString('en-IN')}. Please clear it at the earliest. Thank you.`;
        const encodedMessage = encodeURIComponent(message);
        const cleanPhone = customer.phone.replace(/\D/g, '');
        const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
        window.open(`https://wa.me/${finalPhone}?text=${encodedMessage}`, '_blank');
    };

    if (overdueCustomersArray.length === 0) {
        return (
            <Card className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
                <div className="flex items-center">
                    <ShieldCheck className="w-8 h-8 text-green-600 dark:text-green-400 mr-4" />
                    <div>
                        <p className="font-bold text-green-800 dark:text-green-200">No Overdue Dues</p>
                        <p className="text-sm text-green-700 dark:text-green-300">All customer payments older than 30 days are settled.</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <Card className="border-l-4 border-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-600">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-rose-600 dark:text-rose-400 mr-3" />
                <h2 className="text-lg font-bold text-rose-800 dark:text-rose-200">Overdue Dues Alert</h2>
            </div>
            <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">The following customers have dues from sales older than 30 days.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {overdueCustomersArray.sort((a, b) => b.totalOverdue - a.totalOverdue).map(({ customer, totalOverdue, oldestOverdueDate }) => (
                    <div
                        key={customer.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors flex justify-between items-center border dark:border-slate-700"
                        onClick={() => onNavigate(customer.id)}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="flex items-center gap-3">
                            <User className="w-6 h-6 text-rose-700 dark:text-rose-400 flex-shrink-0" />
                            <div>
                                <p className="font-bold text-rose-900 dark:text-rose-100">{customer.name}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{customer.area}</p>
                            </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                            <p className="font-bold text-lg text-red-600 dark:text-red-400">₹{totalOverdue.toLocaleString('en-IN')}</p>
                            <div className="flex items-center justify-end gap-2">
                                <p className="text-xs text-gray-500 dark:text-gray-400">{Math.floor((new Date().getTime() - new Date(oldestOverdueDate).getTime()) / (1000 * 60 * 60 * 24))} days old</p>
                                <button onClick={(e) => sendWhatsAppReminder(e, customer, totalOverdue)} className="bg-green-500 text-white p-1 rounded-full hover:scale-110 transition-transform" title="Send Reminder"><MessageCircle size={12} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const TopProductsCard: React.FC<{ sales: Sale[] }> = ({ sales }) => {
    const topProducts = useMemo(() => {
        const productMap: Record<string, { name: string, quantity: number, revenue: number }> = {};
        
        sales.forEach(sale => {
            sale.items.forEach(item => {
                if (!productMap[item.productId]) {
                    productMap[item.productId] = { 
                        name: item.productName, 
                        quantity: 0,
                        revenue: 0 
                    };
                }
                productMap[item.productId].quantity += item.quantity;
                productMap[item.productId].revenue += (item.quantity * item.price);
            });
        });

        return Object.values(productMap)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 3);
    }, [sales]);

    if (topProducts.length === 0) return null;

    return (
        <Card className="border-l-4 border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-600">
            <div className="flex items-center mb-4">
                <Award className="w-6 h-6 text-indigo-600 dark:text-indigo-400 mr-3" />
                <h2 className="text-lg font-bold text-indigo-800 dark:text-indigo-200">Top Selling Products</h2>
            </div>
            <div className="space-y-3">
                {topProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-2 bg-white dark:bg-slate-800 rounded shadow-sm">
                        <div className="flex items-center gap-3">
                            <span className="font-bold text-lg text-indigo-300 w-4">{idx + 1}</span>
                            <div>
                                <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{p.name}</p>
                                <p className="text-xs text-gray-500">{p.quantity} units sold</p>
                            </div>
                        </div>
                        <p className="font-bold text-indigo-600 dark:text-indigo-400">₹{p.revenue.toLocaleString('en-IN')}</p>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const UpcomingPurchaseDuesCard: React.FC<{ 
    purchases: Purchase[]; 
    suppliers: Supplier[]; 
    onNavigate: (supplierId: string) => void; 
}> = ({ purchases, suppliers, onNavigate }) => {
    const upcomingDues = useMemo(() => {
        const dues: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        thirtyDaysFromNow.setHours(23, 59, 59, 999);

        purchases.forEach(purchase => {
            const amountPaid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
            const dueAmount = Number(purchase.totalAmount) - amountPaid;

            if (dueAmount > 0.01 && purchase.paymentDueDates && purchase.paymentDueDates.length > 0) {
                const supplier = suppliers.find(s => s.id === purchase.supplierId);
                if (!supplier) return;

                purchase.paymentDueDates.forEach(dateStr => {
                    const dueDate = new Date(dateStr + 'T00:00:00');
                    if (dueDate >= today && dueDate <= thirtyDaysFromNow) {
                        const timeDiff = dueDate.getTime() - today.getTime();
                        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        dues.push({ purchaseId: purchase.id, supplier: supplier, totalPurchaseDue: dueAmount, dueDate: dueDate, daysRemaining: daysRemaining });
                    }
                });
            }
        });
        return dues.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [purchases, suppliers]);

    if (upcomingDues.length === 0) return (
        <Card className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
            <div className="flex items-center">
                <PackageCheck className="w-8 h-8 text-green-600 dark:text-green-400 mr-4" />
                <div>
                    <p className="font-bold text-green-800 dark:text-green-200">No Upcoming Purchase Dues</p>
                    <p className="text-sm text-green-700 dark:text-green-300">There are no payment dues to suppliers in the next 30 days.</p>
                </div>
            </div>
        </Card>
    );

    return (
        <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 mr-3" />
                <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200">Upcoming Purchase Dues</h2>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">The following payments to suppliers are due within the next 30 days.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {upcomingDues.map((due) => {
                    const countdownText = due.daysRemaining === 0 ? "Due today" : `Due in ${due.daysRemaining} day${due.daysRemaining !== 1 ? 's' : ''}`;
                    return (
                        <div key={`${due.purchaseId}-${due.dueDate.toISOString()}`} className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex justify-between items-center border dark:border-slate-700" onClick={() => onNavigate(due.supplier.id)}>
                            <div className="flex items-center gap-3">
                                <Package className="w-6 h-6 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-amber-900 dark:text-amber-100">{due.supplier.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">Inv: {due.purchaseId}</p>
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                                <p className="font-bold text-lg text-amber-600 dark:text-amber-400">{countdownText}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Date: {due.dueDate.toLocaleDateString()}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
};

const LowStockCard: React.FC<{ products: Product[]; onNavigate: (id: string) => void; }> = ({ products, onNavigate }) => {
    const lowStockProducts = useMemo(() => {
        return products.filter(p => p.quantity < 5).sort((a, b) => a.quantity - b.quantity);
    }, [products]);

    if (lowStockProducts.length === 0) return (
        <Card className="border-l-4 border-green-500 bg-green-50 dark:bg-green-900/20 dark:border-green-600">
            <div className="flex items-center">
                <PackageCheck className="w-8 h-8 text-green-600 dark:text-green-400 mr-4" />
                <div>
                    <p className="font-bold text-green-800 dark:text-green-200">Stock Healthy</p>
                    <p className="text-sm text-green-700 dark:text-green-300">All products have sufficient stock levels (5+).</p>
                </div>
            </div>
        </Card>
    );

    return (
        <Card className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 mr-3" />
                <h2 className="text-lg font-bold text-orange-800 dark:text-orange-200">Low Stock Alert</h2>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {lowStockProducts.map(product => (
                    <div key={product.id} className="p-2 bg-white dark:bg-slate-800 rounded shadow-sm flex justify-between items-center cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors border dark:border-slate-700" onClick={() => onNavigate(product.id)}>
                        <div>
                            <p className="font-semibold text-sm dark:text-slate-200">{product.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">ID: {product.id}</p>
                        </div>
                        <span className="font-bold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-xs">
                            {product.quantity} left
                        </span>
                    </div>
                ))}
            </div>
        </Card>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ setCurrentPage }) => {
    const { state, dispatch, showToast } = useAppContext();
    const { customers, sales, purchases, products, app_metadata, suppliers, returns, profile, expenses } = state;
    const { showConfirm, showAlert } = useDialog();
    const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
    const [bannerDismissed, setBannerDismissed] = useState(false);
    
    useEffect(() => {
        // Check session storage for dismissed state
        const dismissed = sessionStorage.getItem('pwa_banner_dismissed');
        if (dismissed === 'true') {
            setBannerDismissed(true);
        }
    }, []);

    const handleDismissBanner = () => {
        setBannerDismissed(true);
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
    };
    
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
    
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    const [isGeneratingReport, setIsGeneratingReport] = useState(false);
    const [isCheckpointsModalOpen, setIsCheckpointsModalOpen] = useState(false);

    const lastBackupDate = (app_metadata.find(m => m.id === 'lastBackup') as AppMetadataBackup | undefined)?.date || null;
    
    const getYears = useMemo(() => {
        const years = new Set<string>();
        sales.forEach(s => years.add(new Date(s.date).getFullYear().toString()));
        years.add(new Date().getFullYear().toString());
        return Array.from(years).sort().reverse();
    }, [sales]);

    const monthOptions = [
        { value: 'all', label: 'Full Year' },
        { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
        { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
        { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
        { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' },
    ];

    const stats = useMemo(() => {
        const yearInt = parseInt(selectedYear);
        
        // 1. Yearly
        const filteredYearSales = sales.filter(s => new Date(s.date).getFullYear() === yearInt);
        const filteredYearPurchases = purchases.filter(p => new Date(p.date).getFullYear() === yearInt);
        
        // 2. Monthly
        let filteredMonthSales = [];
        let filteredMonthPurchases = [];

        if (selectedMonth === 'all') {
             filteredMonthSales = filteredYearSales;
             filteredMonthPurchases = filteredYearPurchases;
        } else {
             const monthIndex = parseInt(selectedMonth);
             filteredMonthSales = filteredYearSales.filter(s => new Date(s.date).getMonth() === monthIndex);
             filteredMonthPurchases = filteredYearPurchases.filter(p => new Date(p.date).getMonth() === monthIndex);
        }
        
        const monthSalesTotal = filteredMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const monthPurchasesTotal = filteredMonthPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
        
        // Customer Dues (All time)
        const totalCustomerDues = sales.reduce((sum, s) => {
            const paid = (s.payments || []).reduce((pSum, p) => pSum + Number(p.amount), 0);
            return sum + (Number(s.totalAmount) - paid);
        }, 0);

        // Supplier Dues (All time)
        const totalSupplierDues = purchases.reduce((sum, p) => {
            const paid = (p.payments || []).reduce((pSum, p) => pSum + Number(p.amount), 0);
            return sum + (Number(p.totalAmount) - paid);
        }, 0);

        return { 
            monthSalesTotal,
            monthPurchasesTotal,
            totalCustomerDues, 
            totalSupplierDues, 
            salesCount: filteredMonthSales.length 
        };
    }, [sales, purchases, selectedMonth, selectedYear]);

    const runSecureAction = (action: () => void) => {
        if (state.pin) {
            setPendingAction(() => action);
            setIsPinModalOpen(true);
        } else {
            action();
        }
    };

    const handlePinSuccess = () => {
        setIsPinModalOpen(false);
        if (pendingAction) {
            pendingAction();
            setPendingAction(null);
        }
    };

    const handleBackup = async () => {
        setIsGeneratingReport(true);
        try {
            const data = await db.exportData();
            const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const filename = (state.profile?.name || 'business_manager').toLowerCase().replace(/\s+/g, '_');
            a.download = `${filename}_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await db.setLastBackupDate();
            dispatch({ type: 'SET_LAST_BACKUP_DATE', payload: new Date().toISOString() });
            showToast("Backup downloaded successfully!", 'success');
        } catch (e) {
            console.error("Backup failed", e);
            showToast("Backup failed!", 'error');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleCreateCheckpoint = async () => {
        const name = prompt("Enter a name for this checkpoint:", `Backup ${new Date().toLocaleTimeString()}`);
        if (name) {
            try {
                await db.createSnapshot(name);
                showToast("Checkpoint created successfully.", 'success');
            } catch (e) {
                console.error(e);
                showToast("Failed to create checkpoint.", 'error');
            }
        }
    };

    const handleNavigate = (page: Page, id: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page, id } });
        setCurrentPage(page);
    };
    
    const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        
        const processRestore = async () => {
            const confirmed = await showConfirm("Restoring will OVERWRITE all current data. Are you sure you want to restore from this backup?", {
                title: "Restore Backup",
                confirmText: "Yes, Restore",
                variant: "danger"
            });
            
            if (confirmed) {
                try {
                    const text = await file.text();
                    const data = JSON.parse(text);
                    await db.importData(data);
                    window.location.reload();
                } catch (err) {
                    showAlert("Failed to restore backup. The file might be invalid or corrupted.");
                }
            }
        };

        runSecureAction(processRestore);
        e.target.value = ''; 
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

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <CheckpointsModal isOpen={isCheckpointsModalOpen} onClose={() => setIsCheckpointsModalOpen(false)} />
            
            {isPinModalOpen && (
                <PinModal
                    mode="enter"
                    correctPin={state.pin}
                    onCorrectPin={handlePinSuccess}
                    onCancel={() => {
                        setIsPinModalOpen(false);
                        setPendingAction(null);
                    }}
                />
            )}
            
            {/* Header Section */}
            <div className="flex flex-row items-center justify-between gap-2 relative mb-6">
                <div className="flex-shrink-0">
                     <span className="text-xs sm:text-sm font-medium px-3 py-1.5 rounded-full bg-primary/10 text-primary border border-primary/20 shadow-sm cursor-default flex flex-col items-start gap-0.5 max-w-full">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{getTimeBasedGreeting()},</span>
                        <strong className="truncate max-w-[120px] sm:max-w-[150px] text-sm">{profile?.ownerName || 'Owner'}</strong>
                    </span>
                </div>

                <div className="flex-grow text-center">
                    <h1 className="text-lg sm:text-2xl md:text-3xl font-bold text-primary tracking-tight drop-shadow-sm truncate">
                        Dashboard
                    </h1>
                </div>
                
                <div className="flex-shrink-0">
                    <DatePill />
                </div>
            </div>

            {/* Install Prompt Banner - Shows if installable AND NOT dismissed this session */}
            {(isInstallable || (isIOS && !isInstalled)) && !bannerDismissed && (
                <div className="bg-gradient-to-r from-indigo-500 to-blue-600 text-white rounded-xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-3 animate-slide-down-fade mb-4 relative">
                    {/* Close Button */}
                    <button 
                        onClick={handleDismissBanner}
                        className="absolute top-2 right-2 p-1 hover:bg-white/20 rounded-full transition-colors"
                        aria-label="Dismiss install banner"
                    >
                        <X size={16} />
                    </button>

                    <div className="flex items-center gap-3 pr-8">
                        <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                            <Download size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-base">Install App for Offline Use</h3>
                            <p className="text-xs opacity-90">Get the best experience with full screen & faster loading.</p>
                        </div>
                    </div>
                    {isIOS ? (
                        <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm">
                            <p className="text-xs font-bold text-white">Tap <Share size={12} className="inline mx-1"/> then "Add to Home Screen"</p>
                        </div>
                    ) : (
                        <button onClick={install} className="bg-white text-indigo-600 px-4 py-2 rounded-lg font-bold text-sm shadow hover:bg-gray-100 transition-colors whitespace-nowrap w-full sm:w-auto">
                            Install Now
                        </button>
                    )}
                </div>
            )}
            
            <SmartAnalystCard 
                sales={sales} 
                products={products} 
                customers={customers} 
                purchases={purchases} 
                returns={returns} 
                expenses={expenses}
                ownerName={profile?.ownerName || 'Owner'}
            />
            
            {/* Toolbar for Period Selectors */}
            <div className="flex justify-end items-center mb-1">
                 <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                     <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                    >
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                    >
                        {getYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard icon={IndianRupee} title="Sales" value={stats.monthSalesTotal} subValue={`${stats.salesCount} orders`} color="bg-primary/5 dark:bg-primary/10" iconBgColor="bg-primary/20" textColor="text-primary" onClick={() => setCurrentPage('SALES')} delay={0} />
                <MetricCard icon={Package} title="Purchases" value={stats.monthPurchasesTotal} subValue="Inventory cost" color="bg-blue-50 dark:bg-blue-900/20" iconBgColor="bg-blue-100 dark:bg-blue-800" textColor="text-blue-700 dark:text-blue-100" onClick={() => setCurrentPage('PURCHASES')} delay={100} />
                <MetricCard icon={User} title="Cust. Dues" value={stats.totalCustomerDues} subValue="Total Receivable" color="bg-purple-50 dark:bg-purple-900/20" iconBgColor="bg-purple-100 dark:bg-purple-800" textColor="text-purple-700 dark:text-purple-100" onClick={() => setCurrentPage('CUSTOMERS')} delay={200} />
                <MetricCard icon={ShoppingCart} title="My Payables" value={stats.totalSupplierDues} subValue="Total Payable" color="bg-amber-50 dark:bg-amber-900/20" iconBgColor="bg-amber-100 dark:bg-amber-800" textColor="text-amber-700 dark:text-amber-100" onClick={() => setCurrentPage('PURCHASES')} delay={300} />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OverdueDuesCard sales={sales} customers={customers} onNavigate={(id) => handleNavigate('CUSTOMERS', id)} />
                <UpcomingPurchaseDuesCard purchases={purchases} suppliers={suppliers} onNavigate={(id) => handleNavigate('PURCHASES', id)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="flex flex-col gap-6">
                    <TopProductsCard sales={sales} />
                    <LowStockCard products={products} onNavigate={(id) => handleNavigate('PRODUCTS', id)} />
                 </div>
                 <div className="space-y-6">
                    <Card title="Data Management">
                        <BackupStatusAlert lastBackupDate={lastBackupDate} lastSyncTime={state.lastSyncTime} />
                        <div className="space-y-4 mt-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Your data is stored locally. Please create regular backups.
                            </p>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <Button onClick={handleBackup} className="w-full" disabled={isGeneratingReport}>
                                    <Download className="w-4 h-4 mr-2" /> {isGeneratingReport ? 'Preparing...' : 'Backup Data Now'}
                                </Button>
                                <label htmlFor="restore-backup" className="px-4 py-2 rounded-md font-semibold text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-sm flex items-center justify-center gap-2 bg-secondary hover:bg-teal-500 focus:ring-secondary cursor-pointer w-full text-center dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                                    <Upload className="w-4 h-4 mr-2" /> Restore from Backup
                                </label>
                                <input 
                                    id="restore-backup" 
                                    type="file" 
                                    accept="application/json" 
                                    className="hidden" 
                                    onChange={handleFileRestore} 
                                />
                                <Button onClick={() => runSecureAction(handleLoadTestData)} variant="secondary" className="w-full bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-800">
                                    <TestTube2 className="w-4 h-4 mr-2" /> Load Test Data
                                </Button>
                            </div>

                             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-700 mt-4">
                                <div className="flex gap-2">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                                        <strong>Tip:</strong> Send the backup file to your email or save it to Google Drive for safe keeping.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Card>
                 </div>
            </div>
        </div>
    );
};

export default Dashboard;
