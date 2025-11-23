
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { IndianRupee, User, AlertTriangle, Download, Upload, ShoppingCart, Package, XCircle, CheckCircle, Info, ShieldCheck, ShieldX, Archive, PackageCheck, TestTube2, Sparkles, TrendingUp, ArrowRight, Zap, BrainCircuit, TrendingDown, Wallet, CalendarClock, Tag, Undo2, Crown, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import * as db from '../utils/db';
import Card from '../components/Card';
import Button from '../components/Button';
import { DataImportModal } from '../components/DataImportModal';
import { Page, Customer, Sale, Purchase, Supplier, Product, Return, AppMetadataBackup } from '../types';
import { testData, testProfile } from '../utils/testData';
import { useDialog } from '../context/DialogContext';
import PinModal from '../components/PinModal';
import DatePill from '../components/DatePill';

interface DashboardProps {
    setCurrentPage: (page: Page) => void;
}

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
        className={`rounded-lg shadow-md p-5 flex items-center transition-all duration-300 hover:shadow-xl hover:scale-[1.01] ${color} ${onClick ? 'cursor-pointer' : ''} animate-slide-up-fade`}
        style={{ animationDelay: `${delay || 0}ms` }}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick() : undefined}
    >
        <div className={`p-4 ${iconBgColor} rounded-full flex-shrink-0`}>
            <Icon className={`w-8 h-8 ${textColor}`} />
        </div>
        <div className="ml-5 flex-grow">
            <p className={`font-bold text-xl ${textColor}`}>{title}</p>
            <p className={`text-3xl font-extrabold ${textColor} break-all mt-1`}>{unit}{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>
            {subValue && <p className={`text-sm font-medium mt-1 opacity-90 ${textColor}`}>{subValue}</p>}
        </div>
    </div>
);

const SmartAnalystCard: React.FC<{ sales: Sale[], products: Product[], customers: Customer[], purchases: Purchase[], returns: Return[] }> = ({ sales, products, customers, purchases, returns }) => {
    const insights = useMemo(() => {
        const list: { icon: React.ElementType, text: string, color: string, type: string }[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const currentDay = Math.max(1, now.getDate());

        // 1. Revenue Projection
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

        // 2. Cash Flow Pulse
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
            } else if (flow > 0 && thisMonthPurchases > 0) {
                 list.push({
                    icon: Wallet,
                    type: 'Healthy Flow',
                    text: `Net positive cash flow of ₹${flow.toLocaleString('en-IN')} so far this month.`,
                    color: 'text-blue-600 dark:text-blue-400'
                });
            }
        }

        // 3. Dead Stock
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

        // 4. Weekend Surge Analysis
        let weekendSales = 0, weekdaySales = 0;
        let weekendDays = 0, weekdayDays = 0;
        
        sales.forEach(s => {
            const day = new Date(s.date).getDay();
            const amt = Number(s.totalAmount);
            if (day === 0 || day === 6) { // Sun or Sat
                weekendSales += amt;
                weekendDays++;
            } else {
                weekdaySales += amt;
                weekdayDays++;
            }
        });
        
        const avgWeekend = weekendDays > 0 ? weekendSales / weekendDays : 0;
        const avgWeekday = weekdayDays > 0 ? weekdaySales / weekdayDays : 0;
        
        if (avgWeekend > avgWeekday * 1.3) {
             list.push({
                icon: CalendarClock,
                type: 'Strategy',
                text: `Weekends are your power days! Sales are ${(avgWeekend/avgWeekday).toFixed(1)}x higher. Stock up on Fridays.`,
                color: 'text-purple-600 dark:text-purple-400'
            });
        }

        // 5. Category Trends
        const categoryCounts: Record<string, number> = {};
        thisMonthSales.forEach(s => {
            s.items.forEach(i => {
                // Infer category from ID (e.g., BM-KAN-001 -> KAN) or Name
                const cat = i.productId.split('-')[1] || 'General';
                categoryCounts[cat] = (categoryCounts[cat] || 0) + Number(i.quantity);
            });
        });
        const topCategory = Object.keys(categoryCounts).sort((a, b) => categoryCounts[b] - categoryCounts[a])[0];
        
        if (topCategory) {
             const catMap: Record<string, string> = { 'KAN': 'Kanchi', 'COT': 'Cotton', 'SILK': 'Mysore Silk', 'BAN': 'Banarasi', 'GAD': 'Gadwal', 'UPP': 'Uppada' };
             const friendlyName = catMap[topCategory] || topCategory;
             list.push({
                icon: Tag,
                type: 'Trending',
                text: `${friendlyName} is the top category this month. Ensure you have enough variety.`,
                color: 'text-pink-600 dark:text-pink-400'
            });
        }

        // 6. Fast Moving Item (Velocity Risk)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSales = sales.filter(s => new Date(s.date) >= sevenDaysAgo);
        const productVelocity: Record<string, number> = {}; // sold per day
        recentSales.forEach(s => {
            s.items.forEach(i => {
                productVelocity[i.productId] = (productVelocity[i.productId] || 0) + Number(i.quantity);
            });
        });

        let stockoutRiskItem = null;
        for (const [pid, qtySold] of Object.entries(productVelocity)) {
            const product = products.find(p => p.id === pid);
            if (product && product.quantity > 0) {
                const dailyRate = qtySold / 7;
                const daysLeft = product.quantity / dailyRate;
                if (daysLeft < 7 && dailyRate > 0.5) { 
                    stockoutRiskItem = { name: product.name, days: Math.round(daysLeft) };
                    break; 
                }
            }
        }

        if (stockoutRiskItem) {
            list.push({
                icon: Zap,
                type: 'Velocity Alert',
                text: `"${stockoutRiskItem.name}" is selling fast! Estimated to run out in ${stockoutRiskItem.days} days.`,
                color: 'text-amber-600 dark:text-amber-400'
            });
        }

        // 7. High Return Rate (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentReturnsVal = returns
            .filter(r => new Date(r.returnDate) >= thirtyDaysAgo && r.type === 'CUSTOMER')
            .reduce((sum, r) => sum + Number(r.amount), 0);
        const recentSalesVal = sales
            .filter(s => new Date(s.date) >= thirtyDaysAgo)
            .reduce((sum, s) => sum + Number(s.totalAmount), 0);

        if (recentSalesVal > 0) {
            const returnRate = (recentReturnsVal / recentSalesVal) * 100;
            if (returnRate > 15) {
                list.push({
                    icon: Undo2,
                    type: 'Quality Check',
                    text: `Return rate is high (${returnRate.toFixed(1)}%) recently. Check product quality or descriptions.`,
                    color: 'text-red-600 dark:text-red-400'
                });
            }
        }

        // 8. Top Customer of the Month
        const customerSpend: Record<string, number> = {};
        thisMonthSales.forEach(s => {
            customerSpend[s.customerId] = (customerSpend[s.customerId] || 0) + Number(s.totalAmount);
        });
        const topCustomerId = Object.keys(customerSpend).sort((a, b) => customerSpend[b] - customerSpend[a])[0];
        
        if (topCustomerId) {
            const topCustomer = customers.find(c => c.id === topCustomerId);
            if (topCustomer) {
                 list.push({
                    icon: Crown,
                    type: 'Top Customer',
                    text: `${topCustomer.name} is the top spender this month (₹${customerSpend[topCustomerId].toLocaleString('en-IN')}).`,
                    color: 'text-teal-600 dark:text-teal-400'
                });
            }
        }

        // Default if list is empty
        if (list.length === 0) {
            list.push({
                icon: Sparkles,
                type: 'AI Assistant',
                text: "I'm analyzing your data. Record more sales and purchases to see advanced trends and alerts here.",
                color: 'text-teal-600 dark:text-teal-400'
            });
        }

        return list;
    }, [sales, products, customers, purchases, returns]);

    return (
        <div className="relative overflow-hidden rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-teal-100 dark:border-slate-700 transition-all hover:shadow-xl animate-slide-up-fade">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500"></div>
            <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                    <div className="p-2 bg-teal-100 dark:bg-teal-900/50 rounded-full animate-pulse-bg">
                        <BrainCircuit className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                    </div>
                    <h3 className="font-bold text-xl text-gray-800 dark:text-white">Smart Analyst</h3>
                    <span className="text-[10px] font-bold bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-800">AI Powered</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {insights.map((insight, idx) => (
                        <div key={idx} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-700/30 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors border border-transparent hover:border-teal-100 dark:hover:border-teal-800 animate-slide-up-fade" style={{ animationDelay: `${idx * 100}ms` }}>
                            <div className="mt-1 flex-shrink-0">
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

const BackupStatusAlert: React.FC<{ lastBackupDate: string | null }> = ({ lastBackupDate }) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    
    let status: 'no-backup' | 'overdue' | 'safe' = 'no-backup';
    let diffDays = 0;
    let backupDate: Date | null = null;

    if (lastBackupDate) {
        backupDate = new Date(lastBackupDate);
        const backupDateStr = backupDate.toISOString().slice(0, 10);
        diffDays = Math.floor((now.getTime() - backupDate.getTime()) / (1000 * 60 * 60 * 24));
        status = backupDateStr === todayStr ? 'safe' : 'overdue';
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
            title: 'Data is Safe',
            message: `Backed up today at ${backupDate?.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}.`
        }
    };

    const current = config[status];
    const Icon = current.icon;

    return (
        <div className={`flex items-start p-4 rounded-lg border ${current.classes} mb-6`}>
            <Icon className={`w-6 h-6 mr-3 flex-shrink-0 ${current.iconColor}`} />
            <div>
                <h4 className="font-bold text-sm uppercase tracking-wide mb-1">{current.title}</h4>
                <p className="text-sm opacity-90">{current.message}</p>
            </div>
        </div>
    );
};

const OverdueDuesCard: React.FC<{ sales: Sale[]; customers: Customer[]; onNavigate: (customerId: string) => void; }> = ({ sales, customers, onNavigate }) => {
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
            <p className="text-sm text-rose-700 dark:text-rose-300 mb-4">The following customers have dues from sales older than 30 days. Please follow up.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {overdueCustomersArray.sort((a, b) => b.totalOverdue - a.totalOverdue).map(({ customer, totalOverdue, oldestOverdueDate }) => (
                    <div
                        key={customer.id}
                        className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm cursor-pointer hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors flex justify-between items-center border dark:border-slate-700"
                        onClick={() => onNavigate(customer.id)}
                        role="button"
                        tabIndex={0}
                        aria-label={`View details for ${customer.name}`}
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
                            <p className="text-xs text-gray-500 dark:text-gray-400">Oldest: {new Date(oldestOverdueDate).toLocaleDateString()}</p>
                        </div>
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
        const dues: {
            purchaseId: string;
            supplier: Supplier;
            totalPurchaseDue: number;
            dueDate: Date;
            daysRemaining: number;
        }[] = [];

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
                    const dueDate = new Date(dateStr + 'T00:00:00'); // Treat date string as local time
                    
                    if (dueDate >= today && dueDate <= thirtyDaysFromNow) {
                        const timeDiff = dueDate.getTime() - today.getTime();
                        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        
                        dues.push({
                            purchaseId: purchase.id,
                            supplier: supplier,
                            totalPurchaseDue: dueAmount,
                            dueDate: dueDate,
                            daysRemaining: daysRemaining,
                        });
                    }
                });
            }
        });

        return dues.sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [purchases, suppliers]);

    if (upcomingDues.length === 0) {
        return (
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
    }

    return (
        <Card className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-600">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 mr-3" />
                <h2 className="text-lg font-bold text-amber-800 dark:text-amber-200">Upcoming Purchase Dues</h2>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300 mb-4">The following payments to suppliers are due within the next 30 days.</p>
            <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {upcomingDues.map((due) => {
                    const countdownText = due.daysRemaining === 0
                        ? "Due today"
                        : `Due in ${due.daysRemaining} day${due.daysRemaining !== 1 ? 's' : ''}`;
                    return (
                        <div
                            key={`${due.purchaseId}-${due.dueDate.toISOString()}`}
                            className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors flex justify-between items-center border dark:border-slate-700"
                            onClick={() => onNavigate(due.supplier.id)}
                            role="button"
                            tabIndex={0}
                        >
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

    if (lowStockProducts.length === 0) {
        return (
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
    }

    return (
        <Card className="border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-600">
            <div className="flex items-center mb-4">
                <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400 mr-3" />
                <h2 className="text-lg font-bold text-orange-800 dark:text-orange-200">Low Stock Alert</h2>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {lowStockProducts.map(product => (
                    <div
                        key={product.id}
                        className="p-2 bg-white dark:bg-slate-800 rounded shadow-sm flex justify-between items-center cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors border dark:border-slate-700"
                        onClick={() => onNavigate(product.id)}
                    >
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
    const { customers, sales, purchases, products, app_metadata, suppliers, returns, profile } = state;
    const { showConfirm, showAlert } = useDialog();
    
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth().toString());
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    
    // State for secure PIN verification
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

    // Dummy state for "generating" report to show visual feedback
    const [isGeneratingReport, setIsGeneratingReport] = useState(false);

    // FIX: Cast result to AppMetadataBackup to access .date
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
        
        // 1. All Time
        const allTimeSales = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const allTimePurchases = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

        // 2. Yearly
        const filteredYearSales = sales.filter(s => new Date(s.date).getFullYear() === yearInt);
        const filteredYearPurchases = purchases.filter(p => new Date(p.date).getFullYear() === yearInt);
        const yearSalesTotal = filteredYearSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const yearPurchasesTotal = filteredYearPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

        // 3. Monthly (or All Months if selected)
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
        
        // Customer Dues (All time, not just this month)
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
            allTimeSales, 
            allTimePurchases,
            yearSalesTotal,
            yearPurchasesTotal,
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
            // Use dynamic name based on profile or default to 'business_manager'
            const filename = (state.profile?.name || 'business_manager').toLowerCase().replace(/\s+/g, '_');
            a.download = `${filename}_backup_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            await db.setLastBackupDate();
            dispatch({ type: 'SET_LAST_BACKUP_DATE', payload: new Date().toISOString() });
            showToast("Backup downloaded successfully!");
        } catch (e) {
            console.error("Backup failed", e);
            showToast("Backup failed!", 'info');
        } finally {
            setIsGeneratingReport(false);
        }
    };

    const handleLoadTestData = async () => {
        const confirmed = await showConfirm("This will OVERWRITE your current data with sample test data. Are you sure you want to proceed?", {
            title: "Load Test Data",
            confirmText: "Yes, Overwrite",
            variant: "danger"
        });
        
        if (confirmed) {
            setIsGeneratingReport(true);
            try {
                // Prepare data object for importData
                // testData matches the structure expected by importData (mostly)
                await db.importData(testData as any);
                await db.saveCollection('profile', [testProfile]);
                
                // Force reload to re-initialize state from IndexedDB
                window.location.reload();
            } catch (error) {
                console.error("Failed to load test data:", error);
                showToast("Failed to load test data.", 'info');
                setIsGeneratingReport(false);
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
        e.target.value = ''; // Reset input to allow re-selection
    };

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <DataImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} />
            
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
            
            {/* Header Section with Welcome, Title, and Date */}
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-3 items-center relative">
                    
                    {/* Left: Welcome Message (First) */}
                    <div className="flex justify-start z-10">
                         <span className="text-xs sm:text-sm font-medium px-2 sm:px-4 py-1 sm:py-1.5 rounded-full bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-700/50 shadow-sm transition-transform hover:scale-105 cursor-default whitespace-nowrap flex items-center gap-1 max-w-full">
                            <span className="hidden sm:inline">Welcome back,</span>
                            <span className="sm:hidden">Hi,</span>
                            <strong className="truncate">{profile?.ownerName || 'Owner'}</strong>
                        </span>
                    </div>

                    {/* Center: Dashboard Title (Second) */}
                    <div className="flex justify-center">
                        <h1 className="text-xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-600 dark:from-teal-400 dark:to-emerald-400 tracking-tight drop-shadow-sm">
                            Dashboard
                        </h1>
                    </div>

                    {/* Right: Date (Third/Edge) */}
                    <div className="flex justify-end z-10">
                         <DatePill />
                    </div>
                </div>
            </div>
            
            {/* New Smart Analyst AI Card (Moved Top) */}
            <SmartAnalystCard sales={sales} products={products} customers={customers} purchases={purchases} returns={returns} />
            
            {/* Toolbar for Period Selectors */}
            <div className="flex justify-end items-center mb-1">
                 <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
                     <select 
                        value={selectedMonth} 
                        onChange={(e) => setSelectedMonth(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                        aria-label="Select Month for Stats"
                    >
                        {monthOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className="h-4 w-px bg-gray-300 dark:bg-slate-600"></div>
                    <select 
                        value={selectedYear} 
                        onChange={(e) => setSelectedYear(e.target.value)} 
                        className="p-1.5 border-none bg-transparent text-sm font-semibold text-gray-700 dark:text-gray-200 focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                        aria-label="Select Year for Stats"
                    >
                        {getYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard 
                    icon={IndianRupee} 
                    title="Sales" 
                    value={stats.monthSalesTotal} 
                    subValue={`${stats.salesCount} orders this period`}
                    color="bg-teal-50 dark:bg-teal-900/20" 
                    iconBgColor="bg-teal-100 dark:bg-teal-800" 
                    textColor="text-teal-700 dark:text-teal-100" 
                    onClick={() => setCurrentPage('SALES')}
                    delay={0}
                />
                 <MetricCard 
                    icon={Package} 
                    title="Purchases" 
                    value={stats.monthPurchasesTotal} 
                    subValue="This period"
                    color="bg-blue-50 dark:bg-blue-900/20" 
                    iconBgColor="bg-blue-100 dark:bg-blue-800" 
                    textColor="text-blue-700 dark:text-blue-100" 
                    onClick={() => setCurrentPage('PURCHASES')}
                    delay={100}
                />
                <MetricCard 
                    icon={User} 
                    title="Customer Dues" 
                    value={stats.totalCustomerDues} 
                    subValue="Total Pending"
                    color="bg-purple-50 dark:bg-purple-900/20" 
                    iconBgColor="bg-purple-100 dark:bg-purple-800" 
                    textColor="text-purple-700 dark:text-purple-100" 
                    onClick={() => setCurrentPage('REPORTS')}
                    delay={200}
                />
                <MetricCard 
                    icon={ShoppingCart} 
                    title="My Dues" 
                    value={stats.totalSupplierDues} 
                    subValue="To Suppliers"
                    color="bg-amber-50 dark:bg-amber-900/20" 
                    iconBgColor="bg-amber-100 dark:bg-amber-800" 
                    textColor="text-amber-700 dark:text-amber-100" 
                    onClick={() => setCurrentPage('PURCHASES')}
                    delay={300}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <OverdueDuesCard sales={sales} customers={customers} onNavigate={(id) => handleNavigate('CUSTOMERS', id)} />
                <UpcomingPurchaseDuesCard purchases={purchases} suppliers={suppliers} onNavigate={(id) => handleNavigate('PURCHASES', id)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <LowStockCard products={products} onNavigate={(id) => handleNavigate('PRODUCTS', id)} />
                 <div className="space-y-6">
                    <Card title="Data Management">
                        <BackupStatusAlert lastBackupDate={lastBackupDate} />
                        <div className="space-y-4 mt-4">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Your data is stored locally on this device. Please create regular backups to prevent data loss.
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
                                <Button onClick={() => runSecureAction(() => setIsImportModalOpen(true))} variant="secondary" className="w-full">
                                    <Upload className="w-4 h-4 mr-2" /> Import Bulk Data from CSV
                                </Button>
                                <Button onClick={() => runSecureAction(handleLoadTestData)} className="w-full bg-purple-600 hover:bg-purple-700 focus:ring-purple-600" disabled={isGeneratingReport}>
                                    <TestTube2 className="w-4 h-4 mr-2" /> Load Test Data
                                </Button>
                            </div>
                             <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-md border border-yellow-200 dark:border-yellow-700">
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