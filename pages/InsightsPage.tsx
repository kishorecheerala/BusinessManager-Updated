import React, { useMemo } from 'react';
import { BarChart2, TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Package, Users, Activity, Receipt } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Page } from '../types';
import Card from '../components/Card';
import { calculateRevenueForecast, calculateCLV, calculateInventoryTurnover } from '../utils/analytics';

interface InsightsPageProps {
    setCurrentPage: (page: Page) => void;
}

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

    return (
        <div className="space-y-6 animate-fade-in-fast">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <BarChart2 className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-primary">Business Insights</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Estimated Profit</p>
                            <h3 className={`text-2xl font-bold mt-1 ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{estimatedProfit.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </h3>
                        </div>
                        <div className={`p-2 rounded-full ${estimatedProfit >= 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                            <Activity size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Revenue - COGS - Expenses</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Forecast (Next 7 Days)</p>
                            <h3 className="text-2xl font-bold mt-1 text-blue-600">
                                {forecast.slope > 0 ? <TrendingUp className="inline mr-1" size={20}/> : <TrendingDown className="inline mr-1" size={20}/>}
                                {forecast.slope > 0 ? 'Growing' : 'Declining'}
                            </h3>
                        </div>
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-full">
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Based on recent sales trend</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Customer Lifetime Value</p>
                            <h3 className="text-2xl font-bold mt-1 text-purple-600">
                                ₹{Math.round(clv.clv).toLocaleString('en-IN')}
                            </h3>
                        </div>
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-full">
                            <Users size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Avg. revenue per customer</p>
                </Card>

                <Card className="bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Inventory Turnover</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-600">
                                {inventory.ratio.toFixed(1)}x
                            </h3>
                        </div>
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-full">
                            <Package size={20} />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Times stock sold per year</p>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card title="Revenue Forecast (Next 7 Days)">
                    <div className="space-y-3 mt-2">
                        {forecast.forecast.map((point, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <span className="text-sm font-mono w-16 text-gray-500">{point.date}</span>
                                <div className="flex-1 h-4 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-blue-500 rounded-full" 
                                        style={{ width: `${Math.min(100, (point.value / (Math.max(...forecast.forecast.map(f => f.value)) || 1)) * 100)}%` }}
                                    ></div>
                                </div>
                                <span className="text-sm font-bold text-gray-700 dark:text-gray-300 w-20 text-right">₹{Math.round(point.value).toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                <Card title="Business Health">
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-2">
                                <ShoppingCart size={16} className="text-green-500"/>
                                <span className="text-sm">Total Revenue</span>
                            </div>
                            <span className="font-bold">₹{totalRevenue.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-2">
                                <Package size={16} className="text-blue-500"/>
                                <span className="text-sm">Cost of Goods Sold (Est.)</span>
                            </div>
                            <span className="font-bold text-gray-600 dark:text-gray-400">- ₹{Math.round(totalCOGS).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center border-b dark:border-slate-700 pb-2">
                            <div className="flex items-center gap-2">
                                <Receipt size={16} className="text-red-500"/>
                                <span className="text-sm">Operating Expenses</span>
                            </div>
                            <span className="font-bold text-red-500">- ₹{totalExpenses.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                            <span className="font-bold text-lg">Net Profit</span>
                            <span className={`font-bold text-lg ${estimatedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{estimatedProfit.toLocaleString()}
                            </span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
};

export default InsightsPage;