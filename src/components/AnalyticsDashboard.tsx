
import React from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { IndianRupee, Clock, ShoppingBag, TrendingUp, User, ArrowUpRight } from 'lucide-react';
import Card from './Card';

const MetricCard = ({ title, value, subValue, icon: Icon, colorClass }: any) => (
  <div className={`p-4 rounded-xl border ${colorClass} shadow-sm relative overflow-hidden group`}>
    <div className="flex justify-between items-start z-10 relative">
      <div>
        <p className="text-sm font-medium opacity-80 mb-1">{title}</p>
        <h3 className="text-2xl font-bold">{value}</h3>
        {subValue && <p className="text-xs mt-1 font-medium flex items-center gap-1">
           {subValue}
        </p>}
      </div>
      <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
        <Icon size={20} />
      </div>
    </div>
    {/* Decorative background circle */}
    <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/10 z-0 group-hover:scale-150 transition-transform duration-500"></div>
  </div>
);

export const AnalyticsDashboard: React.FC = () => {
  const { metrics, loading } = useAnalytics();

  if (loading) {
      return (
          <div className="animate-pulse grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-200 dark:bg-slate-700 rounded-xl"></div>)}
          </div>
      );
  }

  return (
    <div className="space-y-6 mb-8 animate-fade-in-fast">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Revenue"
          value={`₹${(metrics.totalRevenue / 100000).toFixed(2)}L`}
          subValue={`+ ₹${metrics.averageOrderValue.toLocaleString()} avg`}
          icon={IndianRupee}
          colorClass="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-emerald-600"
        />
        <MetricCard
          title="Pending Dues"
          value={`₹${(metrics.pendingAmount / 100000).toFixed(2)}L`}
          subValue="Receivable"
          icon={Clock}
          colorClass="bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-600"
        />
        <MetricCard
          title="Today's Orders"
          value={metrics.completedToday}
          subValue="Invoices Generated"
          icon={ShoppingBag}
          colorClass="bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-blue-600"
        />
        <MetricCard
          title="Growth"
          value="+12%" 
          subValue="vs Last Month"
          icon={TrendingUp}
          colorClass="bg-gradient-to-br from-purple-500 to-violet-600 text-white border-purple-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Monthly Revenue Trend" className="lg:col-span-2">
              <div className="h-48 flex items-end justify-between gap-2 pt-4">
                  {metrics.monthlyTrend.length > 0 ? metrics.monthlyTrend.map((item, idx) => {
                      const max = Math.max(...metrics.monthlyTrend.map(d => d.value));
                      const height = max > 0 ? (item.value / max) * 100 : 0;
                      return (
                          <div key={idx} className="flex flex-col items-center flex-1 group">
                              <div className="w-full bg-gray-100 dark:bg-slate-700 rounded-t-lg relative h-32 flex items-end overflow-hidden">
                                  <div 
                                    className="w-full bg-indigo-500 dark:bg-indigo-400 rounded-t-sm transition-all duration-1000 ease-out group-hover:bg-indigo-600"
                                    style={{ height: `${height}%` }}
                                  ></div>
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full mb-2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                      ₹{item.value.toLocaleString()}
                                  </div>
                              </div>
                              <span className="text-xs text-gray-500 mt-2 font-medium">{item.name}</span>
                          </div>
                      )
                  }) : (
                      <p className="w-full text-center text-gray-400 self-center">No trend data available yet</p>
                  )}
              </div>
          </Card>

          <Card title="Top Customers">
              <div className="space-y-4">
                  {metrics.topCustomers.length > 0 ? metrics.topCustomers.map((c, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              idx === 0 ? 'bg-yellow-100 text-yellow-700' : 
                              idx === 1 ? 'bg-gray-100 text-gray-700' : 
                              'bg-orange-50 text-orange-700'
                          }`}>
                              {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate dark:text-gray-200">{c.name}</p>
                              <p className="text-xs text-gray-500 truncate">{c.area}</p>
                          </div>
                          <div className="text-right">
                              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">₹{c.totalSpent.toLocaleString()}</p>
                          </div>
                      </div>
                  )) : (
                      <p className="text-gray-400 text-sm text-center py-4">No customer data</p>
                  )}
                  {metrics.topCustomers.length > 0 && (
                      <button className="w-full text-xs text-center text-indigo-600 dark:text-indigo-400 font-medium hover:underline mt-2 flex items-center justify-center gap-1">
                          View All Customers <ArrowUpRight size={12} />
                      </button>
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
};
