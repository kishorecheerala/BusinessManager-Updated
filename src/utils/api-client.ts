
import * as db from './db';
import { Customer, Sale, Product, Purchase } from '../types';

// Helper to simulate network delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const apiClient = {
    get: async (url: string) => {
        await delay(300);

        // --- ANALYTICS DASHBOARD ---
        if (url === '/api/analytics/dashboard') {
            const sales = await db.getAll('sales');
            const customers = await db.getAll('customers');
            
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            
            const totalRevenue = sales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
            
            const pendingAmount = sales.reduce((acc, s) => {
                 const paid = (s.payments || []).reduce((p, pay) => p + Number(pay.amount), 0);
                 const due = Number(s.totalAmount) - paid;
                 return acc + (due > 0.01 ? due : 0);
            }, 0);
            
            const todaySales = sales.filter(s => s.date.startsWith(todayStr));
            
            const totalCount = sales.length;
            const avgValue = totalCount > 0 ? Math.round(totalRevenue / totalCount) : 0;
            
            // Top Customers
            const customerSpend = customers.map(c => {
                const spent = sales.filter(s => s.customerId === c.id).reduce((acc, s) => acc + Number(s.totalAmount), 0);
                return { ...c, totalSpent: spent };
            })
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5);

            // Monthly Trend (Last 6 months)
            const monthlyTrend = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
                const monthName = d.toLocaleString('default', { month: 'short' });
                const year = d.getFullYear();
                
                const monthSales = sales.filter(s => {
                    const sDate = new Date(s.date);
                    return sDate.getMonth() === d.getMonth() && sDate.getFullYear() === year;
                });
                
                const revenue = monthSales.reduce((acc, s) => acc + Number(s.totalAmount), 0);
                monthlyTrend.push({ name: monthName, value: revenue });
            }

            return {
                data: {
                    totalCount,
                    totalRevenue,
                    pending: pendingAmount,
                    todayCount: todaySales.length,
                    conversionRate: 0,
                    avgValue,
                    topCustomers: customerSpend,
                    monthlyTrend
                }
            };
        }
        
        // --- RECOMMENDATIONS ---
        if (url === '/api/recommendations') {
            const sales = await db.getAll('sales');
            const products = await db.getAll('products');
            const recommendations = [];

            // 1. Overdue Check
            let overdueCount = 0;
            sales.forEach(s => {
                const paid = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const due = Number(s.totalAmount) - paid;
                if (due > 10 && new Date(s.date) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
                    overdueCount++;
                }
            });

            if (overdueCount > 0) {
                recommendations.push({
                    title: "Follow up on overdue invoices",
                    description: `${overdueCount} invoices are overdue by 7+ days.`,
                    action: "View Reminders",
                    icon: "⏰",
                    urgency: "high"
                });
            }

            // 2. Low Stock Check
            const lowStockCount = products.filter(p => p.quantity < 5).length;
            if (lowStockCount > 0) {
                recommendations.push({
                    title: "Restock Inventory",
                    description: `${lowStockCount} items are running low on stock.`,
                    action: "View Products",
                    icon: "📦",
                    urgency: "medium"
                });
            }

            // 3. Backup Reminder
            recommendations.push({
                title: "Backup Your Data",
                description: "Ensure your business data is safe.",
                action: "Backup",
                icon: "💾",
                urgency: "low"
            });

            return { data: { recommendations } };
        }

        // --- INVOICE REMINDERS ---
        if (url === '/api/invoices/reminders') {
            const sales = await db.getAll('sales');
            const customers = await db.getAll('customers');
            const reminders = [];
            const now = new Date();

            for (const sale of sales) {
                const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const due = Number(sale.totalAmount) - paid;
                
                if (due > 1) {
                    const saleDate = new Date(sale.date);
                    
                    // Simple logic: Due 30 days after sale
                    const dueDate = new Date(saleDate);
                    dueDate.setDate(dueDate.getDate() + 30);
                    
                    const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 3600 * 24));
                    const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

                    if (daysOverdue > 0 || (daysUntilDue >= 0 && daysUntilDue <= 7)) {
                        const customer = customers.find(c => c.id === sale.customerId);
                        reminders.push({
                            id: sale.id,
                            invoiceId: sale.id,
                            customer: customer ? customer.name : 'Unknown',
                            amount: due,
                            daysOverdue: Math.max(0, daysOverdue),
                            daysUntilDue: daysUntilDue,
                            dueDate: dueDate.toISOString()
                        });
                    }
                }
            }
            
            return { data: reminders.sort((a, b) => b.daysOverdue - a.daysOverdue) };
        }

        // --- ADVANCED SEARCH ---
        if (url.startsWith('/api/search')) {
            const queryString = url.split('?')[1] || '';
            const params = new URLSearchParams(queryString);
            const q = (params.get('q') || '').toLowerCase();
            const dateRange = params.get('dateRange');
            const status = params.get('status');
            const amountRange = params.get('amountRange');

            const sales = await db.getAll('sales');
            const customers = await db.getAll('customers');

            let results: any[] = [];

            // Search Sales
            const filteredSales = sales.filter(s => {
                // Text Match
                const customer = customers.find(c => c.id === s.customerId);
                const textMatch = s.id.toLowerCase().includes(q) || (customer && customer.name.toLowerCase().includes(q));
                if (!textMatch && q) return false;

                // Date Filter
                if (dateRange) {
                    const d = new Date(s.date);
                    const now = new Date();
                    if (dateRange === 'today') {
                        if (d.toDateString() !== now.toDateString()) return false;
                    } else if (dateRange === 'week') {
                        const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
                        if (d < weekAgo) return false;
                    } else if (dateRange === 'month') {
                        const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
                        if (d < monthAgo) return false;
                    }
                }

                // Status Filter & Amount Logic
                const paid = (s.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const total = Number(s.totalAmount);
                const due = total - paid;
                const isPaid = due <= 1;

                if (status) {
                    if (status === 'pending' && isPaid) return false;
                    if (status === 'completed' && !isPaid) return false;
                }

                // Amount Filter
                if (amountRange) {
                    if (amountRange === '0-10000' && total > 10000) return false;
                    if (amountRange === '10000-50000' && (total <= 10000 || total > 50000)) return false;
                    if (amountRange === '50000-100000' && (total <= 50000 || total > 100000)) return false;
                    if (amountRange === '100000+' && total <= 100000) return false;
                }

                return true;
            });

            results = filteredSales.map(s => {
                const customer = customers.find(c => c.id === s.customerId);
                return {
                    id: s.id,
                    title: `Invoice #${s.id} - ${customer?.name || 'Unknown'}`,
                    type: 'Invoice',
                    amount: `₹${Number(s.totalAmount).toLocaleString()}`,
                    date: new Date(s.date).toLocaleDateString(),
                    data: s
                };
            });

            // Also Search Customers if no specific transaction filters are active
            if (!status && !amountRange && !dateRange && q) {
                const filteredCustomers = customers.filter(c => 
                    c.name.toLowerCase().includes(q) || 
                    c.phone.includes(q) || 
                    c.area.toLowerCase().includes(q)
                );
                
                const customerResults = filteredCustomers.map(c => ({
                    id: c.id,
                    title: `${c.name} (${c.area})`,
                    type: 'Customer',
                    amount: '-',
                    date: '-',
                    data: c
                }));
                
                results = [...customerResults, ...results];
            }

            return { data: results.slice(0, 50) };
        }

        throw new Error(`Unknown endpoint: ${url}`);
    },
    
    post: async (url: string, body: any) => {
         await delay(500);
         
         // --- BATCH SEND REMINDERS ---
         if (url === '/api/invoices/batch/send-reminders') {
             console.log(`Sending reminders for invoices: ${body.invoiceIds.join(', ')}`);
             return { data: { success: true, count: body.invoiceIds.length } };
         }

         // --- BATCH MARK PAID ---
         if (url === '/api/invoices/batch/mark-paid') {
             const sales = await db.getAll('sales');
             const now = new Date().toISOString();
             let hasChanges = false;
             
             for (const id of body.invoiceIds) {
                 const sale = sales.find(s => s.id === id);
                 if (sale) {
                     const paid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                     const due = Number(sale.totalAmount) - paid;
                     if (due > 0.01) {
                         const payment = {
                             id: `PAY-BATCH-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
                             amount: due,
                             date: now,
                             method: 'CASH' as const,
                             reference: 'Batch Update'
                         };
                         sale.payments = [...(sale.payments || []), payment];
                         hasChanges = true;
                     }
                 }
             }
             
             if (hasChanges) {
                 // CRITICAL FIX: Save the ENTIRE collection, not just the modified subset.
                 // db.saveCollection overwrites the store.
                 await db.saveCollection('sales', sales);
             }
             
             return { data: { success: true } };
         }

         // --- BATCH EXPORT ---
         if (url.startsWith('/api/invoices/batch/export')) {
             const sales = await db.getAll('sales');
             const customers = await db.getAll('customers');
             
             const selected = sales.filter(s => body.invoiceIds.includes(s.id));
             
             const header = 'Invoice ID,Date,Customer,Total,GST,Discount\n';
             const rows = selected.map(s => {
                 const c = customers.find(cust => cust.id === s.customerId);
                 return `${s.id},${new Date(s.date).toLocaleDateString()},${c?.name || 'Unknown'},${s.totalAmount},${s.gstAmount},${s.discount}`;
             }).join('\n');
             
             return { data: header + rows };
         }

         return { data: { success: true } };
    }
};
