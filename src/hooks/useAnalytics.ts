
import { useEffect, useState } from 'react';
import { apiClient } from '../utils/api-client';
import { Customer } from '../types';

interface TrendData {
    name: string;
    value: number;
}

interface AnalyticsMetrics {
    totalInvoices: number;
    totalRevenue: number;
    pendingAmount: number;
    completedToday: number;
    conversionRate: number;
    averageOrderValue: number;
    topCustomers: (Customer & { totalSpent: number })[];
    monthlyTrend: TrendData[];
}

export const useAnalytics = () => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics>({
    totalInvoices: 0,
    totalRevenue: 0,
    pendingAmount: 0,
    completedToday: 0,
    conversionRate: 0,
    averageOrderValue: 0,
    topCustomers: [],
    monthlyTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        const result = await apiClient.get('/api/analytics/dashboard');
        const data = result.data as any;
        
        setMetrics({
          totalInvoices: data.totalCount,
          totalRevenue: data.totalRevenue,
          pendingAmount: data.pending,
          completedToday: data.todayCount,
          conversionRate: data.conversionRate,
          averageOrderValue: data.avgValue,
          topCustomers: data.topCustomers || [],
          monthlyTrend: data.monthlyTrend || []
        });
      } catch (err) {
        console.error('[Analytics] Failed to load:', err);
      } finally {
        setLoading(false);
      }
    };

    loadAnalytics();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { metrics, loading };
};