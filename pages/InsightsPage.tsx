
import React, { useMemo } from 'react';
import { BarChart2, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, Users, Activity, Receipt, PieChart } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Page } from '../types';
import Card from '../components/Card';
import { calculateRevenueForecast, calculateCLV, calculateInventoryTurnover } from '../utils/analytics';

interface InsightsPageProps {
    setCurrentPage: (page: Page) => void;
}

// Simple SVG Line Chart Component
const SimpleLineChart: React.FC<{ data: number[], labels: string[], color: string }> = ({ data, labels, color }) => {
    const max = Math.max(...data, 1);
    const height = 100;
    const width = 100;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - (val / max) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="w-full h-48 flex flex-col justify-end">
            <div className="relative w-full h-40 overflow-hidden">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
                    {/* Fill Gradient */}
                    <path 
                        d={`M 0,${height} ${points} L ${width},${height} Z`} 
                        className={`fill-current opacity-20`} 
                        style={{ color }}
                    />
                    {/* Line */}
                    <polyline 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2" 
                        points={points} 
                        style={{ color }}
                        vectorEffect="non-scaling-stroke"
                    />
                    {/* Dots */}
                    {data.map((val, i) => {
                        const x = (i / (data.length - 1)) * width;
                        const y = height - (val / max) * height;
                        return (
                            <circle key={i} cx={x} cy={y} r="1.5" fill="currentColor" style={{ color }} className="opacity-0 hover:opacity-100 transition-opacity" />
                        )
                    })}
                </svg>
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400 font-mono">
                {labels.map((l, i) => (i % 2 === 0 ? <span key={i}>{l}</span> : null))}
            </div>
        </div>
    );
};

// Simple Expense Bar Component
const ExpenseBar: React.FC<{ label: string, value: number, total: number, color: string }> = ({ label, value, total, color }) => {
    const percent = total > 0 ? (value / total) * 100 : 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs">
                <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
                <span className="text-gray-500">₹{value.toLocaleString()} ({Math.round(percent)}%)</span>
            </div>
            <div className="h-2 w-full bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }}></div>
            </div>
        </div>
    );
};

const InsightsPage: React.FC<InsightsPageProps> = ({ setCurrentPage }) => {
    const { state } = useAppContext();
    const { sales, purchases, products, customers, expenses } = state;

    const forecast = useMemo(() => calculateRevenueForecast(sales), [sales]);
    const clv = useMemo(() => calculateCLV(sales, customers), [sales, customers]);
    const inventory = useMemo(() => calculateInventoryTurnover(sales, products, purchases), [sales, products, purchases]);

    // Calculate Profit
    const totalRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const totalCOGS = inventory.cogs;
    const estimatedProfit = totalRevenue - totalCOGS - totalExpenses;

    // Prepare Chart Data (Last 14 days)
    const chartData = useMemo(() => {
        const days = 14;
        const data = [];
        const labels = [];
        const today = new Date();
        
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const dayStr = d.toISOString().split('T')[0];
            
            const dailyTotal = sales
                .filter(s => s.date.startsWith(dayStr))
                .reduce((sum, s) => sum + s.totalAmount, 0);
            
            data.push(dailyTotal);
            labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
        }
        return { data, labels };
    }, [sales]);

    // Prepare Expense Data
    const expenseBreakdown = useMemo(() => {
        const breakdown: Record<string, number> = {};
        expenses.forEach(e => {
            breakdown[e.category] = (breakdown[e.category] || 0) + e.amount;
        });
        return Object.entries(breakdown).sort((a, b) => b[1] - a[1]); // Sort by amount desc
    }, [expenses]);

    const expenseColors = [
        'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500'
    ];

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <BarChart2 className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-primary">Business Insights</h1>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Net Profit (Est.)</p>
                            <h3 className={`text-2xl font-bold mt-1 ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{estimatedProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </h3>
                        </div>
                        <div className={`p-2 rounded-full ${estimatedProfit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            <Activity size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Rev - COGS - Exp</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Growth Trend</p>
                            <h3 className="text-2xl font-bold mt-1 text-blue-600">
                                {forecast.slope > 0 ? <TrendingUp className="inline mr-1" size={20}/> : <TrendingDown className="inline mr-1" size={20}/>}
                                {forecast.slope > 0 ? 'Growing' : 'Declining'}
                            </h3>
                        </div>
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Based on 30-day velocity</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Customer Value (LTV)</p>
                            <h3 className="text-2xl font-bold mt-1 text-purple-600">
                                ₹{Math.round(clv.clv).toLocaleString('en-IN')}
                            </h3>
                        </div>
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                            <Users size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Avg lifetime revenue</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Stock Turnover</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-600">
                                {inventory.ratio.toFixed(1)}x
                            </h3>
                        </div>
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                            <Package size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Times sold per year</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Sales Trend Chart */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                            <TrendingUp size={18} className="text-indigo-500" />
                            Sales Trend (14 Days)
                        </h3>
                        <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-1 rounded dark:bg-indigo-900/30 dark:text-indigo-300">
                            Total: ₹{chartData.data.reduce((a,b)=>a+b, 0).toLocaleString()}
                        </span>
                    </div>
                    <SimpleLineChart 
                        data={chartData.data} 
                        labels={chartData.labels} 
                        color="#6366f1" // Indigo-500
                    />
                </Card>

                {/* Expense Breakdown */}
                <Card>
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg text-gray-800 dark:text-white flex items-center gap-2">
                            <PieChart size={18} className="text-rose-500" />
                            Expense Breakdown
                        </h3>
                        <span className="text-xs font-mono bg-rose-50 text-rose-700 px-2 py-1 rounded dark:bg-rose-900/30 dark:text-rose-300">
                            Total: ₹{totalExpenses.toLocaleString()}
                        </span>
                    </div>
                    
                    <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                        {expenseBreakdown.length > 0 ? (
                            expenseBreakdown.map(([cat, val], idx) => (
                                <ExpenseBar 
                                    key={cat} 
                                    label={cat} 
                                    value={val} 
                                    total={totalExpenses} 
                                    color={expenseColors[idx % expenseColors.length]} 
                                />
                            ))
                        ) : (
                            <div className="text-center py-8 text-gray-400 text-sm">
                                No expenses recorded yet.
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default InsightsPage;
