
import React, { useState, useMemo, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, 
  Calendar, Download, ArrowUp, ArrowDown, 
  CreditCard, Wallet, FileText, Activity, Users, Lightbulb, Target, Zap, Scale, ShieldCheck,
  PackagePlus, UserMinus, PieChart as PieIcon, BarChart2, AlertTriangle, ShieldAlert,
  Trophy, Medal, Timer, ArrowRight, Edit, Sparkles, AlertCircle, Lock, Package
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import PinModal from '../components/PinModal';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Page, Sale, Customer, Product, AppMetadataRevenueGoal, Purchase } from '../types';

interface InsightsPageProps {
    setCurrentPage: (page: Page) => void;
}

// --- Helper Functions ---
const calculateRisk = (customer: Customer, allSales: Sale[]) => {
    const custSales = allSales.filter(s => s.customerId === customer.id);
    if (custSales.length === 0) return 'Safe';

    const totalRevenue = custSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
    const totalPaid = custSales.reduce((sum, s) => sum + s.payments.reduce((p, pay) => p + Number(pay.amount), 0), 0);
    const due = totalRevenue - totalPaid;

    if (due <= 100) return 'Safe'; // Negligible due

    const dueRatio = totalRevenue > 0 ? due / totalRevenue : 0;

    // Logic: High risk if owing > 50% AND due > 5000
    if (dueRatio > 0.5 && due > 5000) return 'High';
    // Logic: Medium risk if owing > 30%
    if (dueRatio > 0.3) return 'Medium';
    
    return 'Low';
};

const formatCurrencyCompact = (value: number) => {
    if (value >= 10000000) return `₹${(value / 10000000).toFixed(1)}Cr`;
    if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
    if (value >= 1000) return `₹${(value / 1000).toFixed(1)}k`;
    return `₹${value.toLocaleString('en-IN')}`;
};

// --- AI Components ---

const AIDailyBriefing: React.FC<{ 
    sales: Sale[], 
    revenueGoal: number, 
    currentRevenue: number,
    ownerName: string
}> = ({ sales, revenueGoal, currentRevenue, ownerName }) => {
    const briefing = useMemo(() => {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const dayOfMonth = today.getDate();
        
        const progress = currentRevenue / revenueGoal;
        const expectedProgress = dayOfMonth / daysInMonth;
        
        let sentiment: 'positive' | 'neutral' | 'negative' = 'neutral';
        let headline = "";
        let advice = "";

        const firstName = ownerName.split(' ')[0] || 'Boss';

        if (currentRevenue === 0) {
            headline = `Ready to start the month, ${firstName}?`;
            advice = "Record your first sale to get the analytics engine running.";
            sentiment = 'neutral';
        } else if (progress >= 1) {
            headline = "Outstanding! Goal Achieved.";
            advice = `You've already hit your monthly target. Everything from now on is bonus profit. Consider running a 'Customer Appreciation' sale.`;
            sentiment = 'positive';
        } else if (progress >= expectedProgress) {
            headline = "You are on track.";
            advice = `You're ahead of the curve by ${((progress - expectedProgress) * 100).toFixed(0)}%. Maintain this pace and you'll beat the target easily.`;
            sentiment = 'positive';
        } else {
            headline = "Time to push sales.";
            const shortfall = (expectedProgress * revenueGoal) - currentRevenue;
            advice = `You are slightly behind schedule (approx ₹${shortfall.toLocaleString('en-IN', {maximumFractionDigits: 0})}). Try contacting your 'High Value' customers today.`;
            sentiment = 'negative';
        }

        return { headline, advice, sentiment };
    }, [sales, revenueGoal, currentRevenue, ownerName]);

    const bgColors = {
        positive: 'bg-gradient-to-r from-emerald-500 to-teal-600',
        neutral: 'bg-gradient-to-r from-blue-500 to-indigo-600',
        negative: 'bg-gradient-to-r from-amber-500 to-orange-600'
    };

    return (
        <div className={`rounded-xl p-6 text-white shadow-lg relative overflow-hidden ${bgColors[briefing.sentiment]} mb-6`}>
            <div className="absolute top-0 right-0 p-4 opacity-20">
                <Sparkles size={100} />
            </div>
            <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                    <span className="bg-white/20 backdrop-blur-md px-2 py-1 rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles size={12} /> AI Briefing
                    </span>
                    <span className="text-xs opacity-80">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </div>
                <h2 className="text-2xl font-bold mb-2">{briefing.headline}</h2>
                <p className="text-white/90 text-sm md:text-base max-w-2xl leading-relaxed">{briefing.advice}</p>
            </div>
        </div>
    );
};

const StrategicInsightCard: React.FC<{
    icon: React.ElementType;
    title: string;
    insight: string;
    color: string;
    impact?: string;
    action?: string;
}> = ({ icon: Icon, title, insight, color, impact, action }) => (
    <div className="p-5 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col h-full">
        <div className="flex justify-between items-start mb-3">
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10 dark:bg-opacity-20`}>
                <Icon size={22} className={color.replace('bg-', 'text-')} />
            </div>
            {impact && <span className="text-[10px] font-bold px-2 py-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300">{impact}</span>}
        </div>
        <h4 className="font-bold text-gray-800 dark:text-gray-200 text-base mb-2">{title}</h4>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 leading-relaxed flex-grow">
            {insight}
        </p>
        {action && (
            <div className="mt-auto pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs font-semibold text-primary flex items-center gap-1">
                    <ArrowRight size={12} />
                    <span>{action}</span>
                </p>
            </div>
        )}
    </div>
);

const SmartInsightsSection: React.FC<{ sales: Sale[], products: Product[], customers: Customer[] }> = ({ sales, products, customers }) => {
    const insights = useMemo(() => {
        const list: any[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Data Prep
        const thisMonthSales = sales.filter(s => {
            const d = new Date(s.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });
        
        // 1. "Cash Trap" Detection
        const productSalesLast30Days: Record<string, number> = {};
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        sales.forEach(s => {
            if (new Date(s.date) >= thirtyDaysAgo) {
                s.items.forEach(i => {
                    productSalesLast30Days[i.productId] = (productSalesLast30Days[i.productId] || 0) + Number(i.quantity);
                });
            }
        });

        const cashTraps = products.filter(p => {
            const salesCount = productSalesLast30Days[p.id] || 0;
            const stockValue = p.quantity * p.purchasePrice;
            return p.quantity >= 3 && salesCount === 0 && stockValue > 3000;
        }).sort((a, b) => (b.quantity * b.purchasePrice) - (a.quantity * a.purchasePrice));

        if (cashTraps.length > 0) {
            const topTrap = cashTraps[0];
            const trappedValue = topTrap.quantity * topTrap.purchasePrice;
            list.push({
                icon: Lock,
                title: "Cash Trap Detected",
                color: "bg-red-500 text-red-600",
                impact: "Cash Flow",
                insight: `The item "${topTrap.name}" has ₹${trappedValue.toLocaleString()} tied up in inventory with 0 sales in 30 days.`,
                action: `Run a 15% discount clearance sale on this item to free up cash.`
            });
        }

        // 2. "Hidden Gem"
        const gems = products.filter(p => {
            const margin = ((p.salePrice - p.purchasePrice) / p.purchasePrice) * 100;
            const salesCount = productSalesLast30Days[p.id] || 0;
            return margin > 40 && salesCount > 0 && salesCount < 5;
        }).sort((a, b) => b.salePrice - a.salePrice);

        if (gems.length > 0) {
            const gem = gems[0];
            list.push({
                icon: Lightbulb,
                title: "Hidden Profit Gem",
                color: "bg-amber-500 text-amber-600",
                impact: "Profitability",
                insight: `"${gem.name}" has a high profit margin but low sales volume.`,
                action: "Place this item on your WhatsApp status or front display to boost visibility."
            });
        }

        // 3. Stockout Opportunity Cost
        const outOfStockHighVelocity = products.filter(p => p.quantity === 0 && (productSalesLast30Days[p.id] || 0) > 2);
        if (outOfStockHighVelocity.length > 0) {
            const lostItem = outOfStockHighVelocity[0];
            const estLostRevenue = (productSalesLast30Days[lostItem.id] / 4) * lostItem.salePrice; // Est weekly loss
             list.push({
                icon: AlertCircle,
                title: "Revenue Leak",
                color: "bg-orange-500 text-orange-600",
                impact: "Revenue",
                insight: `You are out of stock on "${lostItem.name}". You are losing approx ₹${estLostRevenue.toLocaleString()} per week in potential sales.`,
                action: "Reorder this item immediately from your supplier."
            });
        }

        // 4. Peak Time
        if (thisMonthSales.length > 5) {
            const dayRevenue = [0, 0, 0, 0, 0, 0, 0];
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            thisMonthSales.forEach(s => dayRevenue[new Date(s.date).getDay()] += Number(s.totalAmount));
            const bestDayIndex = dayRevenue.indexOf(Math.max(...dayRevenue));
            
            list.push({
                icon: Calendar,
                title: "Peak Trading Window",
                color: "bg-purple-500 text-purple-600",
                impact: "Operations",
                insight: `${dayNames[bestDayIndex]}s are generating your highest revenue this month.`,
                action: "Ensure you have full staff and updated displays ready before " + dayNames[bestDayIndex] + "."
            });
        }

        // Default filler
        if (list.length < 2) {
             list.push({
                icon: Activity,
                title: "Data Building...",
                color: "bg-blue-500 text-blue-600",
                impact: "System",
                insight: "I'm analyzing your data patterns. Record more sales to unlock deeper financial insights like Cash Traps and Hidden Gems.",
                action: "Keep recording all transactions."
            });
        }

        return list;
    }, [sales, products]);

    return (
        <div className="mb-8 animate-fade-in-up">
            <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="text-amber-500" /> Actionable Intelligence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {insights.map((item, idx) => (
                    <StrategicInsightCard key={idx} {...item} />
                ))}
            </div>
        </div>
    );
};

// --- New Growth Components ---

const RevenueTargetCard: React.FC<{ 
    currentRevenue: number, 
    previousRevenue: number, 
    customGoal?: number,
    onEditGoal: () => void
}> = ({ currentRevenue, previousRevenue, customGoal, onEditGoal }) => {
    const target = customGoal && customGoal > 0 ? customGoal : (previousRevenue > 0 ? previousRevenue * 1.10 : 50000);
    const percentage = Math.min(100, Math.max(0, (currentRevenue / target) * 100));
    const remaining = Math.max(0, target - currentRevenue);
    
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md border border-gray-100 dark:border-slate-700 relative overflow-hidden">
             <div className="flex justify-between items-center relative z-10 h-full">
                <div className="flex-1 pr-4">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                             <Target size={16} className="text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 font-semibold text-xs uppercase tracking-wide">Monthly Goal</h3>
                        <button 
                            onClick={onEditGoal} 
                            className="text-gray-400 hover:text-primary transition-colors"
                            aria-label="Edit Goal"
                        >
                            <Edit size={14} />
                        </button>
                    </div>
                    
                    <p className="text-3xl font-bold tracking-tight text-gray-800 dark:text-white break-all">₹{currentRevenue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                    
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                         <span>Target: ₹{target.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                    
                    <div className="mt-4 text-xs font-medium">
                        {remaining > 0 ? (
                             <span className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded">Needs <strong>₹{remaining.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</strong> more</span>
                        ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded flex items-center gap-1 font-bold w-fit">
                                <Trophy size={12}/> Goal Hit!
                            </span>
                        )}
                    </div>
                </div>
                
                <div className="relative flex items-center justify-center w-32 h-32 flex-shrink-0 ml-2">
                    <div className="absolute inset-0 flex items-center justify-center opacity-10 dark:opacity-20 pointer-events-none">
                        <Target size={64} className="text-indigo-500" strokeWidth={1.5} />
                    </div>
                    <svg className="transform -rotate-90 w-full h-full drop-shadow-xl relative z-10">
                        <circle 
                            cx="50%" 
                            cy="50%" 
                            r={radius} 
                            stroke="currentColor" 
                            strokeWidth="8" 
                            fill="transparent" 
                            className="text-gray-100 dark:text-slate-700" 
                        />
                        <circle 
                            cx="50%" 
                            cy="50%" 
                            r={radius} 
                            stroke="currentColor" 
                            strokeWidth="8" 
                            fill="transparent" 
                            className={`${percentage >= 100 ? 'text-emerald-500' : 'text-indigo-500'} transition-all duration-1000 ease-out`}
                            strokeDasharray={circumference} 
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                        />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <span className="text-xl font-bold text-gray-700 dark:text-white">{percentage.toFixed(0)}%</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ChampionsCard: React.FC<{ sales: Sale[], customers: Customer[] }> = ({ sales, customers }) => {
    const topCustomers = useMemo(() => {
        const customerSpend: Record<string, number> = {};
        sales.forEach(s => {
            customerSpend[s.customerId] = (customerSpend[s.customerId] || 0) + Number(s.totalAmount);
        });
        
        return Object.entries(customerSpend)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([id, spend]) => {
                const c = customers.find(cust => cust.id === id);
                return { name: c?.name || 'Unknown', spend, area: c?.area || '' };
            });
    }, [sales, customers]);

    return (
        <Card title="Customer Champions (All Time)" className="h-full">
            <div className="space-y-4 mt-2">
                {topCustomers.map((c, idx) => {
                    let icon, color, bg;
                    if (idx === 0) { icon = Trophy; color = 'text-yellow-600'; bg = 'bg-yellow-100 dark:bg-yellow-900/30'; }
                    else if (idx === 1) { icon = Medal; color = 'text-slate-500'; bg = 'bg-slate-100 dark:bg-slate-700'; }
                    else { icon = Medal; color = 'text-amber-700'; bg = 'bg-orange-100 dark:bg-orange-900/30'; }
                    const Icon = icon;

                    return (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-full ${bg} ${color}`}>
                                    <Icon size={18} />
                                </div>
                                <div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{c.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{c.area}</p>
                                </div>
                            </div>
                            <p className="font-bold text-primary">₹{c.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
                        </div>
                    );
                })}
                {topCustomers.length === 0 && <p className="text-gray-500 text-sm text-center py-4">No customer data available yet.</p>}
            </div>
        </Card>
    );
};

const InventoryVelocityCard: React.FC<{ sales: Sale[], products: Product[] }> = ({ sales, products }) => {
    const velocityData = useMemo(() => {
        const productSoldQty: Record<string, number> = {};
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 60);
        
        sales.forEach(s => {
            if (new Date(s.date) >= cutoffDate) {
                s.items.forEach(i => {
                    productSoldQty[i.productId] = (productSoldQty[i.productId] || 0) + Number(i.quantity);
                });
            }
        });

        const sorted = Object.entries(productSoldQty).sort(([, a], [, b]) => b - a);
        const fastMovers = sorted.slice(0, 3).map(([id, qty]) => ({ id, qty, name: products.find(p => p.id === id)?.name || id }));
        
        const slowMovers = products
            .filter(p => p.quantity > 5 && !productSoldQty[p.id])
            .slice(0, 3)
            .map(p => ({ id: p.id, name: p.name, stock: p.quantity }));

        return { fastMovers, slowMovers };
    }, [sales, products]);

    return (
        <Card title="Inventory Velocity (60 Days)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/50">
                    <div className="flex items-center gap-2 mb-2">
                        <Zap size={16} className="text-emerald-600" />
                        <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-200">Fastest Movers</h4>
                    </div>
                    {velocityData.fastMovers.length > 0 ? (
                        <ul className="space-y-2">
                            {velocityData.fastMovers.map(item => (
                                <li key={item.id} className="text-xs flex justify-between items-center text-gray-700 dark:text-gray-300 border-b border-emerald-100 dark:border-emerald-900/50 pb-1 last:border-0">
                                    <span className="truncate w-2/3 font-medium">{item.name}</span>
                                    <span className="font-bold text-emerald-600">{item.qty} sold</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-xs text-gray-500">No sales yet.</p>}
                </div>

                <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-900/50">
                    <div className="flex items-center gap-2 mb-2">
                        <Timer size={16} className="text-orange-600" />
                        <h4 className="text-sm font-bold text-orange-800 dark:text-orange-200">Slow Movers</h4>
                    </div>
                    {velocityData.slowMovers.length > 0 ? (
                        <ul className="space-y-2">
                            {velocityData.slowMovers.map(item => (
                                <li key={item.id} className="text-xs flex justify-between items-center text-gray-700 dark:text-gray-300 border-b border-orange-100 dark:border-orange-900/50 pb-1 last:border-0">
                                    <span className="truncate w-2/3 font-medium">{item.name}</span>
                                    <span className="font-bold text-orange-600">{item.stock} left</span>
                                </li>
                            ))}
                        </ul>
                    ) : <p className="text-xs text-gray-500">Inventory is moving well!</p>}
                </div>
            </div>
        </Card>
    );
};

// --- Visual Chart Components ---

const DayOfWeekChart: React.FC<{ filteredSales: Sale[] }> = ({ filteredSales }) => {
    const dayData = useMemo(() => {
        if (!filteredSales || filteredSales.length === 0) {
             // Return empty placeholder if no data
             const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
             return days.map(day => ({ day, value: 0, height: 0 }));
        }

        const counts = Array(7).fill(0);
        const revenue = Array(7).fill(0);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        filteredSales.forEach(s => {
            const date = new Date(s.date);
            if (!isNaN(date.getTime())) {
                const d = date.getDay();
                counts[d]++;
                revenue[d] += Number(s.totalAmount);
            }
        });

        const maxVal = Math.max(...revenue, 1);
        return days.map((day, i) => ({
            day,
            value: revenue[i],
            // Scaling height to max 85% to leave room for labels on top
            height: revenue[i] > 0 ? Math.max((revenue[i] / maxVal) * 85, 5) : 0
        }));
    }, [filteredSales]);

    return (
        <div className="h-48 flex items-end justify-between gap-2 pt-6">
            {dayData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                     {d.value > 0 && (
                        <span className="mb-1 text-[10px] font-medium text-gray-600 dark:text-gray-300">
                            {formatCurrencyCompact(d.value)}
                        </span>
                    )}
                    <div 
                        className={`w-full rounded-t-md transition-all duration-500 ${d.value > 0 ? 'bg-indigo-500 dark:bg-indigo-400 group-hover:bg-indigo-600' : 'bg-gray-100 dark:bg-slate-700'}`}
                        style={{ height: `${d.height}%` }} 
                    />
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-2 font-medium">{d.day}</span>
                </div>
            ))}
        </div>
    );
};

const RetentionChart: React.FC<{ filteredSales: Sale[], allSales: Sale[] }> = ({ filteredSales, allSales }) => {
    const data = useMemo(() => {
        if (filteredSales.length === 0) return { new: 0, returning: 0, newPct: 0, retPct: 0 };
        
        const currentCustomerIds = new Set(filteredSales.map(s => s.customerId));
        let newCustomers = 0;
        let returningCustomers = 0;
        
        currentCustomerIds.forEach(custId => {
            const customerHistory = allSales.filter(s => s.customerId === custId).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            if (customerHistory.length === 0) return;

            // Check if their first ever sale is within the filtered sales list
            const firstSale = customerHistory[0];
            const isNew = filteredSales.some(s => s.id === firstSale.id);
            
            if (isNew) newCustomers++;
            else returningCustomers++;
        });

        const total = newCustomers + returningCustomers;
        return { 
            new: newCustomers, 
            returning: returningCustomers, 
            newPct: total > 0 ? (newCustomers / total) * 100 : 0,
            retPct: total > 0 ? (returningCustomers / total) * 100 : 0
        };
    }, [filteredSales, allSales]);

    return (
        <div className="flex flex-col h-48 justify-center">
             <div className="flex items-center gap-6 mb-4 justify-center">
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                     <span className="text-xs text-gray-600 dark:text-gray-300">Returning ({data.returning})</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                     <span className="text-xs text-gray-600 dark:text-gray-300">New ({data.new})</span>
                 </div>
             </div>
             <div className="relative h-4 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden flex w-full">
                 <div style={{ width: `${data.retPct}%` }} className="bg-emerald-500 h-full transition-all duration-700"></div>
                 <div style={{ width: `${data.newPct}%` }} className="bg-blue-500 h-full transition-all duration-700"></div>
             </div>
             <div className="mt-6 text-center">
                 <p className="text-sm text-gray-600 dark:text-gray-400">
                     <strong className="text-emerald-600 dark:text-emerald-400">{data.retPct.toFixed(0)}%</strong> of customers this period are loyal regulars.
                 </p>
             </div>
        </div>
    );
};

const RiskAnalysisCard: React.FC<{ customers: Customer[], sales: Sale[], onNavigate: (id: string) => void }> = ({ customers, sales, onNavigate }) => {
    const riskData = useMemo(() => {
        const stats = { High: 0, Medium: 0, Low: 0, Safe: 0 };
        const highRiskList: { name: string, id: string, due: number }[] = [];

        customers.forEach(c => {
            const risk = calculateRisk(c, sales);
            stats[risk]++;
            
            if (risk === 'High') {
                const custSales = sales.filter(s => s.customerId === c.id);
                const totalRevenue = custSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
                const totalPaid = custSales.reduce((sum, s) => sum + s.payments.reduce((p, pay) => p + Number(pay.amount), 0), 0);
                const due = totalRevenue - totalPaid;
                highRiskList.push({ name: c.name, id: c.id, due });
            }
        });

        const total = customers.length;
        return { 
            stats, 
            highRiskList: highRiskList.sort((a, b) => b.due - a.due).slice(0, 5),
            percentages: {
                High: total > 0 ? (stats.High / total) * 100 : 0,
                Medium: total > 0 ? (stats.Medium / total) * 100 : 0,
                Low: total > 0 ? (stats.Low / total) * 100 : 0,
                Safe: total > 0 ? (stats.Safe / total) * 100 : 0,
            }
        };
    }, [customers, sales]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card title="Customer Risk Distribution">
                <div className="flex items-center justify-center gap-8 h-48">
                     <div className="relative w-32 h-32 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden flex items-center justify-center">
                        <div className="absolute inset-0" style={{
                            background: `conic-gradient(
                                #ef4444 0% ${riskData.percentages.High}%, 
                                #f59e0b ${riskData.percentages.High}% ${riskData.percentages.High + riskData.percentages.Medium}%, 
                                #10b981 ${riskData.percentages.High + riskData.percentages.Medium}% ${riskData.percentages.High + riskData.percentages.Medium + riskData.percentages.Low}%,
                                #94a3b8 ${riskData.percentages.High + riskData.percentages.Medium + riskData.percentages.Low}% 100%
                            )`
                        }}></div>
                        <div className="absolute w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center z-10">
                            <span className="text-xs font-bold text-gray-500 dark:text-gray-400 text-center">Total<br/>{customers.length}</span>
                        </div>
                    </div>
                    <div className="flex flex-col justify-center gap-2 text-xs">
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500 rounded-sm"></div><span>High Risk ({riskData.stats.High})</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-sm"></div><span>Medium Risk ({riskData.stats.Medium})</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-sm"></div><span>Low Risk ({riskData.stats.Low})</span></div>
                        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-slate-400 rounded-sm"></div><span>Safe ({riskData.stats.Safe})</span></div>
                    </div>
                </div>
                <p className="text-xs text-center text-gray-500 mt-2">High Risk = Owe &gt;50% of purchase value &amp; &gt;₹5k</p>
            </Card>
            <Card title="High Risk Accounts (Top 5)">
                {riskData.highRiskList.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-gray-500 text-sm flex-col">
                        <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2" />
                        <p>Great! No high risk customers found.</p>
                    </div>
                ) : (
                    <div className="space-y-3 overflow-y-auto h-48 pr-2">
                        {riskData.highRiskList.map(c => (
                            <div key={c.id} className="flex justify-between items-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
                                <div>
                                    <p className="font-bold text-sm text-gray-800 dark:text-gray-200">{c.name}</p>
                                    <button onClick={() => onNavigate(c.id)} className="text-xs text-red-600 hover:underline">View Profile</button>
                                </div>
                                <div className="text-right">
                                    <span className="block text-xs text-gray-500 dark:text-gray-400">Total Due</span>
                                    <span className="font-bold text-red-600">₹{c.due.toLocaleString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>
        </div>
    );
};

const InsightsPage: React.FC<InsightsPageProps> = ({ setCurrentPage }) => {
    const { state, dispatch } = useAppContext();
    const { sales, products, customers, purchases, pin, app_metadata, profile } = state;

    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState<string>('all');
    
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
    const [tempGoal, setTempGoal] = useState('');

    // Fetch custom goal
    const revenueGoal = (app_metadata.find(m => m.id === 'revenueGoal') as AppMetadataRevenueGoal | undefined)?.amount;

    const handleSaveGoal = () => {
        const val = parseFloat(tempGoal);
        if (!isNaN(val) && val >= 0) {
            dispatch({ type: 'SET_REVENUE_GOAL', payload: val });
        }
        setIsGoalModalOpen(false);
    };

    // --- Helpers ---
    const getYears = useMemo(() => {
        const years = new Set<string>();
        sales.forEach(s => years.add(new Date(s.date).getFullYear().toString()));
        years.add(new Date().getFullYear().toString());
        return Array.from(years).sort().reverse();
    }, [sales]);

    const months = [
        { value: 'all', label: 'Full Year' },
        { value: '0', label: 'January' }, { value: '1', label: 'February' }, { value: '2', label: 'March' },
        { value: '3', label: 'April' }, { value: '4', label: 'May' }, { value: '5', label: 'June' },
        { value: '6', label: 'July' }, { value: '7', label: 'August' }, { value: '8', label: 'September' },
        { value: '9', label: 'October' }, { value: '10', label: 'November' }, { value: '11', label: 'December' },
    ];

    // --- Data Filtering & Aggregation ---

    // 1. All Time
    const allTimeSales = useMemo(() => sales.reduce((sum, s) => sum + Number(s.totalAmount), 0), [sales]);
    const allTimePurchases = useMemo(() => purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0), [purchases]);

    // 2. Yearly
    const filteredYearSales = useMemo(() => sales.filter(s => new Date(s.date).getFullYear().toString() === selectedYear), [sales, selectedYear]);
    const filteredYearPurchases = useMemo(() => purchases.filter(p => new Date(p.date).getFullYear().toString() === selectedYear), [purchases, selectedYear]);
    const yearSalesTotal = useMemo(() => filteredYearSales.reduce((sum, s) => sum + Number(s.totalAmount), 0), [filteredYearSales]);
    const yearPurchasesTotal = useMemo(() => filteredYearPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0), [filteredYearPurchases]);

    // 3. Monthly
    const filteredMonthSales = useMemo(() => {
        if (selectedMonth === 'all') return []; // Only applicable if a month is selected
        return filteredYearSales.filter(s => new Date(s.date).getMonth().toString() === selectedMonth);
    }, [filteredYearSales, selectedMonth]);
    
    const filteredMonthPurchases = useMemo(() => {
        if (selectedMonth === 'all') return [];
        return filteredYearPurchases.filter(p => new Date(p.date).getMonth().toString() === selectedMonth);
    }, [filteredYearPurchases, selectedMonth]);

    const monthSalesTotal = useMemo(() => filteredMonthSales.reduce((sum, s) => sum + Number(s.totalAmount), 0), [filteredMonthSales]);
    const monthPurchasesTotal = useMemo(() => filteredMonthPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0), [filteredMonthPurchases]);


    // Determine main filtered dataset for charts based on dropdowns
    const filteredSales = useMemo(() => {
        return sales.filter(s => {
            const d = new Date(s.date);
            const yearMatch = d.getFullYear().toString() === selectedYear;
            const monthMatch = selectedMonth === 'all' || d.getMonth().toString() === selectedMonth;
            return yearMatch && monthMatch;
        });
    }, [sales, selectedYear, selectedMonth]);

    // Calculate Metrics for the KPI cards
    const calculateMetrics = (data: typeof sales) => {
        const revenue = data.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        let cost = 0;
        data.forEach(s => {
            s.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                const itemCost = product ? Number(product.purchasePrice) : (Number(item.price) * 0.7); 
                cost += itemCost * Number(item.quantity);
            });
        });
        const profit = revenue - cost;
        const orders = data.length;
        const aov = orders > 0 ? revenue / orders : 0;
        
        return { revenue, profit, orders, aov };
    };

    const currentMetrics = useMemo(() => calculateMetrics(filteredSales), [filteredSales, products]);

    // --- Chart Data Logic (Fixed) ---
    const chartData = useMemo(() => {
        if (selectedMonth === 'all') {
            // Year View: 12 Buckets
            const data = Array(12).fill(0).map((_, i) => ({ 
                label: months[i + 1].label.substr(0, 3), 
                sales: 0, 
                profit: 0 
            }));
            
            filteredSales.forEach(s => {
                const m = new Date(s.date).getMonth();
                data[m].sales += Number(s.totalAmount);
                let cost = 0;
                s.items.forEach(i => {
                    const p = products.find(prod => prod.id === i.productId);
                    cost += (p ? Number(p.purchasePrice) : Number(i.price) * 0.7) * Number(i.quantity);
                });
                data[m].profit += (Number(s.totalAmount) - cost);
            });
            return data;
        } else {
            // Month View: Daily Buckets (1 to 31)
            const year = parseInt(selectedYear);
            const month = parseInt(selectedMonth);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            
            const data = Array(daysInMonth).fill(0).map((_, i) => ({ 
                label: (i + 1).toString(), 
                sales: 0, 
                profit: 0 
            }));
            
            filteredSales.forEach(s => {
                const d = new Date(s.date).getDate() - 1;
                if (data[d]) {
                    data[d].sales += Number(s.totalAmount);
                    let cost = 0;
                    s.items.forEach(i => {
                        const p = products.find(prod => prod.id === i.productId);
                        cost += (p ? Number(p.purchasePrice) : Number(i.price) * 0.7) * Number(i.quantity);
                    });
                    data[d].profit += (Number(s.totalAmount) - cost);
                }
            });
            return data;
        }
    }, [filteredSales, selectedMonth, selectedYear, products]);

    const maxChartValue = Math.max(...chartData.map(d => d.sales), 1);

    // --- Category Data ---
    const categoryData = useMemo(() => {
        const cats: Record<string, number> = {};
        filteredSales.forEach(s => {
            s.items.forEach(i => {
                const cat = i.productId.split('-')[1] || 'Other';
                cats[cat] = (cats[cat] || 0) + (Number(i.price) * Number(i.quantity));
            });
        });
        const total = Object.values(cats).reduce((a, b) => a + b, 0);
        return Object.entries(cats)
            .map(([name, value]) => ({ name, value, percent: total > 0 ? (value / total) * 100 : 0 }))
            .sort((a, b) => b.value - a.value);
    }, [filteredSales]);

    // --- Payment Method Analysis ---
    const paymentStats = useMemo(() => {
        let cash = 0, upi = 0, cheque = 0;
        let totalPaid = 0;
        const totalBilled = currentMetrics.revenue;

        filteredSales.forEach(s => {
            (s.payments || []).forEach(p => {
                const amount = Number(p.amount);
                totalPaid += amount;
                if (p.method === 'CASH') cash += amount;
                else if (p.method === 'UPI') upi += amount;
                else if (p.method === 'CHEQUE') cheque += amount;
            });
        });

        return { cash, upi, cheque, credit: Math.max(0, totalBilled - totalPaid) };
    }, [filteredSales, currentMetrics]);

    // --- Top Lists ---
    const topProducts = useMemo(() => {
        const prodMap: Record<string, number> = {};
        filteredSales.forEach(s => {
            s.items.forEach(i => {
                prodMap[i.productId] = (prodMap[i.productId] || 0) + Number(i.quantity);
            });
        });
        return Object.entries(prodMap)
            .map(([id, qty]) => {
                const product = products.find(p => p.id === id);
                return { name: product?.name || id, quantity: qty, id };
            })
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 5);
    }, [filteredSales, products]);

    const handleDownloadReport = () => {
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.setTextColor('#0d9488');
        doc.text('Business Performance Report', 14, 20);
        doc.setFontSize(10);
        doc.setTextColor('#666666');
        doc.text(`Period: ${selectedMonth === 'all' ? 'Full Year' : months[parseInt(selectedMonth) + 1].label} ${selectedYear}`, 14, 28);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 33);
        
        autoTable(doc, {
            startY: 40,
            head: [['Metric', 'Value']],
            body: [
                ['Total Revenue', `Rs. ${currentMetrics.revenue.toLocaleString()}`],
                ['Gross Profit', `Rs. ${currentMetrics.profit.toLocaleString()}`],
                ['Total Orders', currentMetrics.orders.toString()],
                ['Avg Order Value', `Rs. ${currentMetrics.aov.toLocaleString()}`]
            ],
            theme: 'grid',
            headStyles: { fillColor: [13, 148, 136] }
        });
        
        let finalY = (doc as any).lastAutoTable.finalY + 15;
        
        doc.text('Payment Analysis', 14, finalY);
        autoTable(doc, {
            startY: finalY + 5,
            head: [['Method', 'Amount']],
            body: [
                ['Cash', `Rs. ${paymentStats.cash.toLocaleString()}`],
                ['UPI', `Rs. ${paymentStats.upi.toLocaleString()}`],
                ['Cheque', `Rs. ${paymentStats.cheque.toLocaleString()}`],
                ['Pending (Credit)', `Rs. ${paymentStats.credit.toLocaleString()}`],
            ],
            theme: 'striped'
        });
        
        finalY = (doc as any).lastAutoTable.finalY + 15;
        doc.text('Top Selling Products', 14, finalY);
        autoTable(doc, {
            startY: finalY + 5,
            head: [['Product Name', 'Quantity Sold']],
            body: topProducts.map(p => [p.name, p.quantity]),
            theme: 'striped'
        });
        
        doc.save(`Business_Report_${selectedYear}_${selectedMonth}.pdf`);
    };

    const handleNavigateCustomer = (id: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page: 'CUSTOMERS', id: id } });
        setCurrentPage('CUSTOMERS');
    };

    if (!pin) {
        return (
            <div className="flex items-center justify-center min-h-[70vh] relative">
                <PinModal
                    mode="setup"
                    onSetPin={(newPin) => {
                        dispatch({ type: 'SET_PIN', payload: newPin });
                        setIsUnlocked(true);
                    }}
                    onCancel={() => setCurrentPage('DASHBOARD')}
                />
                {/* Background UI elements */}
            </div>
        );
    }

    if (!isUnlocked) {
        return (
            <div className="flex items-center justify-center min-h-[70vh] relative">
                <PinModal
                    mode="enter"
                    correctPin={pin}
                    onCorrectPin={() => setIsUnlocked(true)}
                    onCancel={() => setCurrentPage('DASHBOARD')}
                    onResetRequest={() => {
                        if (window.confirm("Are you sure you want to reset your PIN? This will remove the security until you set a new one.")) {
                            dispatch({ type: 'REMOVE_PIN' });
                        }
                    }}
                />
                 {/* Background UI elements */}
            </div>
        );
    }

    const FinancialColumn = ({ title, sales, purchases, highlight = false }: any) => (
        <div className={`p-4 rounded-lg border ${highlight ? 'bg-teal-50 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800 ring-2 ring-teal-500 ring-opacity-20' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'} flex flex-col gap-3`}>
            <h3 className={`text-xs font-bold uppercase tracking-wider ${highlight ? 'text-teal-700 dark:text-teal-300' : 'text-gray-500 dark:text-gray-400'}`}>{title}</h3>
            <div className="space-y-2">
                <div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Sales</p>
                    <p className={`text-lg font-bold ${highlight ? 'text-teal-700 dark:text-teal-300' : 'text-gray-800 dark:text-white'}`}>₹{sales.toLocaleString('en-IN')}</p>
                </div>
                <div>
                     <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Purchases</p>
                     <p className={`text-sm font-semibold ${highlight ? 'text-teal-600/80 dark:text-teal-400/80' : 'text-gray-600 dark:text-gray-400'}`}>₹{purchases.toLocaleString('en-IN')}</p>
                </div>
            </div>
        </div>
    );

    const KPICard = ({ title, value, icon: Icon, prefix = '' }: any) => (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-md border border-gray-100 dark:border-slate-700">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{title}</p>
                    <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{prefix}{value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</h3>
                </div>
                <div className={`p-2 rounded-full bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400`}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-6 pb-10 animate-fade-in-fast">
             {/* Edit Goal Modal */}
             {isGoalModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in-fast">
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-xl w-full max-w-sm animate-scale-in">
                        <h3 className="text-lg font-bold mb-4 text-primary">Set Monthly Revenue Goal</h3>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">Target Amount (₹)</label>
                            <input 
                                type="number" 
                                value={tempGoal} 
                                onChange={(e) => setTempGoal(e.target.value)}
                                placeholder="Enter target amount"
                                className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600 dark:text-white"
                                autoFocus
                            />
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="secondary" onClick={() => setIsGoalModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSaveGoal}>Save Goal</Button>
                        </div>
                    </div>
                </div>
            )}
            
            <AIDailyBriefing 
                sales={sales}
                revenueGoal={revenueGoal || 50000} 
                currentRevenue={currentMetrics.revenue}
                ownerName={profile?.ownerName || 'Owner'}
            />
            
            {/* New Financial Performance Matrix */}
            <div className="mb-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-primary">Business Insights</h1>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                            <ShieldCheck size={12} className="mr-1" /> Secured
                        </span>
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <select 
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="p-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white shadow-sm focus:ring-primary focus:border-primary flex-grow"
                        >
                            {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                        <select 
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="p-2 border rounded-md bg-white dark:bg-slate-700 dark:border-slate-600 dark:text-white shadow-sm focus:ring-primary focus:border-primary flex-grow"
                        >
                            {getYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <Button onClick={handleDownloadReport} variant="secondary">
                            <Download size={18} />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <FinancialColumn 
                        title="All Time" 
                        sales={allTimeSales} 
                        purchases={allTimePurchases} 
                    />
                    <FinancialColumn 
                        title={`Year (${selectedYear})`} 
                        sales={yearSalesTotal} 
                        purchases={yearPurchasesTotal} 
                    />
                    {selectedMonth !== 'all' ? (
                        <FinancialColumn 
                            title={`${months[parseInt(selectedMonth)+1].label.substring(0,3)} ${selectedYear}`} 
                            sales={monthSalesTotal} 
                            purchases={monthPurchasesTotal}
                            highlight={true}
                        />
                    ) : (
                        <div className="p-4 rounded-lg border bg-gray-50 dark:bg-slate-800 border-dashed border-gray-300 dark:border-slate-600 flex flex-col justify-center items-center text-gray-400 dark:text-gray-500 text-center">
                             <Calendar size={20} className="mb-2 opacity-50"/>
                             <p className="text-xs">Select a month<br/>to see details</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Smart Insights Section */}
            <SmartInsightsSection sales={sales} products={products} customers={customers} />

            {/* Growth Tracking Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <RevenueTargetCard 
                    currentRevenue={currentMetrics.revenue} 
                    previousRevenue={0} // Simplified for this view
                    customGoal={revenueGoal}
                    onEditGoal={() => {
                        setTempGoal(revenueGoal ? revenueGoal.toString() : '');
                        setIsGoalModalOpen(true);
                    }}
                />
                <ChampionsCard sales={sales} customers={customers} />
                <InventoryVelocityCard sales={sales} products={products} />
            </div>

            {/* Filtered KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard title="Filtered Revenue" value={currentMetrics.revenue} icon={DollarSign} prefix="₹" />
                <KPICard title="Est. Gross Profit" value={currentMetrics.profit} icon={TrendingUp} prefix="₹" />
                <KPICard title="Orders Count" value={currentMetrics.orders} icon={ShoppingCart} />
                <KPICard title="Avg Order Value" value={currentMetrics.aov} icon={Activity} prefix="₹" />
            </div>
            
            {/* Risk Section */}
            <RiskAnalysisCard customers={customers} sales={sales} onNavigate={handleNavigateCustomer} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card title={selectedMonth === 'all' ? 'Monthly Sales Trend' : 'Daily Sales Trend'} className="lg:col-span-2">
                    <div className="h-64 flex items-end gap-2 pt-4 overflow-x-auto pb-2">
                        {chartData.map((d, i) => {
                            // Use 80% max height to leave room for labels
                            const height = maxChartValue > 0 ? (d.sales / maxChartValue) * 80 : 0;
                            return (
                                <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center group relative h-full justify-end">
                                     {d.sales > 0 && (
                                        <span className="mb-1 text-[9px] sm:text-[10px] font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                            {formatCurrencyCompact(d.sales)}
                                        </span>
                                    )}
                                    <div 
                                        className="w-full bg-teal-500 hover:bg-teal-600 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-t transition-all relative" 
                                        style={{ height: `${Math.max(height, 2)}%` }}
                                    >
                                         {/* Keep full details tooltip on hover for desktop users */}
                                         <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 bg-black text-white text-xs p-2 rounded whitespace-nowrap shadow-lg pointer-events-none">
                                            <p className="font-bold">{d.label}</p>
                                            <p>Sales: ₹{d.sales.toLocaleString()}</p>
                                            <p>Profit: ₹{d.profit.toLocaleString()}</p>
                                        </div>
                                    </div>
                                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate w-full text-center">{d.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </Card>
                
                <Card title="Payment Analysis" className="lg:col-span-1">
                    <div className="space-y-4">
                        {[
                            { label: 'Cash', value: paymentStats.cash, color: 'bg-green-500', icon: Wallet },
                            { label: 'UPI', value: paymentStats.upi, color: 'bg-blue-500', icon: Activity },
                            { label: 'Cheque', value: paymentStats.cheque, color: 'bg-yellow-500', icon: FileText },
                            { label: 'Credit (Due)', value: paymentStats.credit, color: 'bg-red-500', icon: CreditCard },
                        ].map((item) => (
                            <div key={item.label}>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                                        <item.icon size={14} className="text-gray-400" /> {item.label}
                                    </span>
                                    <span className="font-medium dark:text-white">₹{item.value.toLocaleString()}</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2.5">
                                    <div 
                                        className={`h-2.5 rounded-full ${item.color}`} 
                                        style={{ width: `${currentMetrics.revenue > 0 ? (item.value / currentMetrics.revenue) * 100 : 0}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
            
            {/* New Customer Intelligence Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Weekly Trading Pattern">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Average sales performance by day (Selected Period)</p>
                        <BarChart2 size={16} className="text-gray-400" />
                    </div>
                    <DayOfWeekChart filteredSales={filteredSales} />
                </Card>

                <Card title="Customer Loyalty">
                     <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-gray-500 dark:text-gray-400">New vs. Returning Customers</p>
                        <PieIcon size={16} className="text-gray-400" />
                    </div>
                    <RetentionChart filteredSales={filteredSales} allSales={sales} />
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Top Selling Products">
                    <div className="space-y-4">
                         {topProducts.length === 0 ? (
                            <p className="text-gray-500 text-sm">No sales data available.</p>
                         ) : topProducts.map((p, idx) => (
                            <div key={p.id} className="flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                        {idx + 1}
                                    </div>
                                    <p className="text-sm font-medium truncate dark:text-gray-200">{p.name}</p>
                                </div>
                                <span className="text-sm font-bold text-gray-600 dark:text-gray-400 whitespace-nowrap">{p.quantity} sold</span>
                            </div>
                        ))}
                    </div>
                </Card>
                
                 <Card title="Category Sales">
                    <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                         {categoryData.length === 0 ? (
                            <p className="text-gray-500 text-sm">No category data available.</p>
                         ) : categoryData.map((cat) => (
                            <div key={cat.name}>
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium dark:text-gray-300">{cat.name}</span>
                                    <span className="text-gray-500">{cat.percent.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-full h-2">
                                    <div 
                                        className="h-2 rounded-full bg-purple-500" 
                                        style={{ width: `${cat.percent}%` }}
                                    ></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default InsightsPage;
