
import React, { useMemo, useState } from 'react';
import { Download, XCircle, Users, Package, AlertTriangle, FileSpreadsheet, Loader2, BarChart3 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import { Customer, Sale, Supplier, Page, Product } from '../types';
import Dropdown from '../components/Dropdown';
import { generateGenericReportPDF } from '../utils/pdfGenerator';
import { exportReportToSheet } from '../utils/googleSheets';

interface CustomerWithDue extends Customer {
  dueAmount: number;
  lastPaidDate: string | null;
  salesWithDue: Sale[];
}

interface ReportsPageProps {
    setCurrentPage: (page: Page) => void;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ setCurrentPage }) => {
    const { state, dispatch, showToast } = useAppContext();
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier' | 'stock'>('customer');
    const [isExporting, setIsExporting] = useState(false);

    // --- Customer Filters ---
    const [areaFilter, setAreaFilter] = useState('all');
    const [duesAgeFilter, setDuesAgeFilter] = useState('all');
    const [customDuesAge, setCustomDuesAge] = useState('');

    // --- Supplier Filters ---
    const [supplierFilter, setSupplierFilter] = useState('all');

    const handleCustomerClick = (customerId: string) => {
        dispatch({ type: 'SET_SELECTION', payload: { page: 'CUSTOMERS', id: customerId } });
        setCurrentPage('CUSTOMERS');
    };

    // --- Helper for Sheet Export ---
    const handleSheetExport = async (title: string, headers: string[], rows: string[][]) => {
        if (!state.googleUser?.accessToken) {
            showToast("Please sign in with Google (Menu > Sign In) to use Sheets export.", "info");
            return;
        }
        
        setIsExporting(true);
        try {
            const url = await exportReportToSheet(
                state.googleUser.accessToken,
                `${title} - ${new Date().toLocaleDateString('en-IN')}`,
                headers,
                rows
            );
            
            showToast("Export successful! Opening Google Sheet...", "success");
            window.open(url, '_blank');
        } catch (error: any) {
            console.error(error);
            if (error.message.includes('401') || error.message.includes('403')) {
                showToast("Permission denied. Please Sign Out and Sign In again to grant Sheets access.", "error");
            } else {
                showToast("Failed to export to Google Sheets.", "error");
            }
        } finally {
            setIsExporting(false);
        }
    };

    // --- Customer Dues Report Logic ---
    const customerDues = useMemo((): CustomerWithDue[] => {
        const customersWithDuesAndDates = state.customers.map(customer => {
            const customerSales = state.sales.filter(sale => sale.customerId === customer.id);
            let totalDue = 0;
            let lastPaidDate: Date | null = null;
            const salesWithDue: Sale[] = [];

            customerSales.forEach(sale => {
                const amountPaid = (sale.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const due = Number(sale.totalAmount) - amountPaid;
                if (due > 0.01) {
                    totalDue += due;
                    salesWithDue.push(sale);
                }
                
                (sale.payments || []).forEach(p => {
                    const paymentDate = new Date(p.date);
                    if (!lastPaidDate || paymentDate > lastPaidDate) {
                        lastPaidDate = paymentDate;
                    }
                });
            });

            return {
                ...customer,
                dueAmount: totalDue,
                lastPaidDate: lastPaidDate ? lastPaidDate.toLocaleDateString('en-IN') : null,
                salesWithDue
            };
        });

        return customersWithDuesAndDates
            .filter(c => c.dueAmount > 0.01)
            .filter(c => areaFilter === 'all' || c.area === areaFilter)
            .filter(c => {
                if (duesAgeFilter === 'all') return true;
                const days = duesAgeFilter === 'custom' ? parseInt(customDuesAge) || 0 : parseInt(duesAgeFilter);
                if (days <= 0) return true; 
                const thresholdDate = new Date();
                thresholdDate.setDate(thresholdDate.getDate() - days);
                return c.salesWithDue.some(sale => new Date(sale.date) < thresholdDate);
            });
    }, [state.customers, state.sales, areaFilter, duesAgeFilter, customDuesAge]);

    const uniqueAreas = useMemo(() => [...new Set(state.customers.map(c => c.area).filter(Boolean))], [state.customers]);
    const totalDuesFiltered = useMemo(() => customerDues.reduce((sum, c) => sum + c.dueAmount, 0), [customerDues]);

    const generateDuesPDF = async () => {
        if (customerDues.length === 0) { showToast("No data to export.", 'error'); return; }
        
        try {
            const doc = await generateGenericReportPDF(
                "Customer Dues Report",
                `Filter: Area=${areaFilter}, Age=${duesAgeFilter === 'custom' ? customDuesAge + ' days' : duesAgeFilter}`,
                ['Customer Name', 'Area', 'Last Paid Date', 'Due Amount'],
                customerDues.map(c => [ c.name, c.area, c.lastPaidDate || 'N/A', `Rs. ${c.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` ]),
                [{ label: 'Total Outstanding Due', value: `Rs. ${totalDuesFiltered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' }],
                state.profile,
                state.reportTemplate,
                state.customFonts
            );
            
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Report_CustomerDues_${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const generateDuesCSV = () => {
        if (customerDues.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Customer Name', 'Area', 'Last Paid Date', 'Due Amount'];
        const rows = customerDues.map(c => `"${c.name}","${c.area}","${c.lastPaidDate || 'N/A'}","${c.dueAmount}"`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'customer-dues-report.csv';
        link.click();
    };

    const exportDuesToSheets = () => {
        if (customerDues.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Customer Name', 'Area', 'Last Paid Date', 'Due Amount'];
        const rows = customerDues.map(c => [c.name, c.area, c.lastPaidDate || 'N/A', c.dueAmount.toString()]);
        handleSheetExport("Customer Dues Report", headers, rows);
    };
    
    // --- Customer Account Summary Logic ---
    const customerAccountSummary = useMemo(() => {
        return state.customers.map(customer => {
            const customerSales = state.sales.filter(s => s.customerId === customer.id);
            const totalPurchased = customerSales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
            const totalPaid = customerSales.reduce((sum, s) => sum + (s.payments || []).reduce((pSum, p) => pSum + Number(p.amount), 0), 0);
            const outstandingDue = totalPurchased - totalPaid;
            
            let lastPurchaseDate: string | null = null;
            if (customerSales.length > 0) {
                const lastSale = customerSales.reduce((latest, sale) => {
                    return new Date(sale.date) > new Date(latest.date) ? sale : latest;
                });
                lastPurchaseDate = new Date(lastSale.date).toLocaleDateString('en-IN');
            }

            return { customer, totalPurchased, totalPaid, outstandingDue, lastPurchaseDate };
        });
    }, [state.customers, state.sales]);

    const generateCustomerSummaryPDF = async () => {
        if (customerAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        
        try {
            const doc = await generateGenericReportPDF(
                "Customer Account Summary",
                `Generated on: ${new Date().toLocaleDateString()}`,
                ['Customer Name', 'Last Purchase', 'Total Billed', 'Total Paid', 'Balance'],
                customerAccountSummary.map(s => [
                    s.customer.name,
                    s.lastPurchaseDate || 'N/A',
                    `Rs. ${s.totalPurchased.toLocaleString('en-IN')}`,
                    `Rs. ${s.totalPaid.toLocaleString('en-IN')}`,
                    `Rs. ${s.outstandingDue.toLocaleString('en-IN')}`
                ]),
                [], // No grand totals summary needed here as it's a list
                state.profile,
                state.reportTemplate,
                state.customFonts
            );
            
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Report_CustomerSummary_${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const generateCustomerSummaryCSV = () => {
        if (customerAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Customer Name', 'Last Purchase Date', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = customerAccountSummary.map(s => `"${s.customer.name}","${s.lastPurchaseDate || 'N/A'}",${s.totalPurchased},${s.totalPaid},${s.outstandingDue}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'customer-account-summary.csv';
        link.click();
    };

    const exportCustomerSummaryToSheets = () => {
        if (customerAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Customer Name', 'Last Purchase Date', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = customerAccountSummary.map(s => [
            s.customer.name,
            s.lastPurchaseDate || 'N/A',
            s.totalPurchased.toString(),
            s.totalPaid.toString(),
            s.outstandingDue.toString()
        ]);
        handleSheetExport("Customer Account Summary", headers, rows);
    };
    
    // --- Supplier Reports Logic ---
    const uniqueSuppliers = useMemo(() => state.suppliers, [state.suppliers]);

    const supplierDues = useMemo(() => {
        return state.purchases
            .map(purchase => {
                const paid = (purchase.payments || []).reduce((sum, p) => sum + Number(p.amount), 0);
                const dueAmount = Number(purchase.totalAmount) - paid;
                return { ...purchase, dueAmount };
            })
            .filter(p => p.dueAmount > 0.01 && (supplierFilter === 'all' || p.supplierId === supplierFilter))
            .map(purchase => {
                const supplier = state.suppliers.find(s => s.id === purchase.supplierId);
                const now = new Date();
                now.setHours(0, 0, 0, 0);

                const futureDueDates = (purchase.paymentDueDates || [])
                    .map(d => new Date(d))
                    .filter(d => d >= now)
                    .sort((a, b) => a.getTime() - b.getTime());

                let nextDueDate: string | null = null;
                if (futureDueDates.length > 0) {
                    nextDueDate = futureDueDates[0].toLocaleDateString('en-IN');
                } else {
                    const pastDueDates = (purchase.paymentDueDates || [])
                        .map(d => new Date(d))
                        .sort((a, b) => b.getTime() - a.getTime());
                    if (pastDueDates.length > 0) {
                        nextDueDate = `${pastDueDates[0].toLocaleDateString('en-IN')} (Overdue)`;
                    }
                }
                return { ...purchase, supplierName: supplier?.name || 'Unknown', nextDueDate };
            });
    }, [state.purchases, state.suppliers, supplierFilter]);
    
    const supplierAccountSummary = useMemo(() => {
        return state.suppliers.map(supplier => {
            const supplierPurchases = state.purchases.filter(p => p.supplierId === supplier.id);
            const totalPurchased = supplierPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);
            const totalPaid = supplierPurchases.reduce((sum, p) => sum + (p.payments || []).reduce((pSum, payment) => pSum + Number(payment.amount), 0), 0);
            const outstandingDue = totalPurchased - totalPaid;
            return { supplier, totalPurchased, totalPaid, outstandingDue };
        });
    }, [state.suppliers, state.purchases]);

    const generateSupplierDuesPDF = async () => {
        if (supplierDues.length === 0) { showToast("No data to export.", 'error'); return; }
        
        try {
            const totalDue = supplierDues.reduce((sum, p) => sum + p.dueAmount, 0);
            const doc = await generateGenericReportPDF(
                "Supplier Dues Report",
                `Filter: Supplier=${supplierFilter === 'all' ? 'All' : state.suppliers.find(s=>s.id===supplierFilter)?.name}`,
                ['Supplier', 'Purchase ID', 'Next Due Date', 'Due Amount'],
                supplierDues.map(p => [
                    p.supplierName,
                    p.id,
                    p.nextDueDate || 'N/A',
                    `Rs. ${p.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                ]),
                [{ label: 'Total Payable', value: `Rs. ${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, color: '#dc2626' }],
                state.profile,
                state.reportTemplate,
                state.customFonts
            );
            
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Report_SupplierDues_${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const generateSupplierDuesCSV = () => {
        if (supplierDues.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Supplier', 'Purchase ID', 'Next Due Date', 'Due Amount'];
        const rows = supplierDues.map(p => `"${p.supplierName}","${p.id}","${p.nextDueDate || 'N/A'}",${p.dueAmount}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'supplier-dues-report.csv';
        link.click();
    };

    const exportSupplierDuesToSheets = () => {
        if (supplierDues.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Supplier', 'Purchase ID', 'Next Due Date', 'Due Amount'];
        const rows = supplierDues.map(p => [
            p.supplierName,
            p.id,
            p.nextDueDate || 'N/A',
            p.dueAmount.toString()
        ]);
        handleSheetExport("Supplier Dues Report", headers, rows);
    };

    const generateSupplierSummaryPDF = async () => {
        if (supplierAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        
        try {
            const doc = await generateGenericReportPDF(
                "Supplier Account Summary",
                `Generated on: ${new Date().toLocaleDateString()}`,
                ['Supplier Name', 'Total Purchased', 'Total Paid', 'Outstanding Due'],
                supplierAccountSummary.map(s => [
                    s.supplier.name,
                    `Rs. ${s.totalPurchased.toLocaleString('en-IN')}`,
                    `Rs. ${s.totalPaid.toLocaleString('en-IN')}`,
                    `Rs. ${s.outstandingDue.toLocaleString('en-IN')}`
                ]),
                [],
                state.profile,
                state.reportTemplate,
                state.customFonts
            );
            
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Report_SupplierSummary_${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const generateSupplierSummaryCSV = () => {
        if (supplierAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Supplier Name', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = supplierAccountSummary.map(s => `"${s.supplier.name}",${s.totalPurchased},${s.totalPaid},${s.outstandingDue}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'supplier-account-summary.csv';
        link.click();
    };

    const exportSupplierSummaryToSheets = () => {
        if (supplierAccountSummary.length === 0) { showToast("No data to export.", 'error'); return; }
        const headers = ['Supplier Name', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = supplierAccountSummary.map(s => [
            s.supplier.name,
            s.totalPurchased.toString(),
            s.totalPaid.toString(),
            s.outstandingDue.toString()
        ]);
        handleSheetExport("Supplier Account Summary", headers, rows);
    };

    // --- Low Stock Report Logic ---
    const lowStockItems = useMemo(() => {
        return state.products
            .filter(p => p.quantity < 5)
            .sort((a, b) => a.quantity - b.quantity);
    }, [state.products]);

    const generateLowStockPDF = async () => {
        if (lowStockItems.length === 0) { showToast("No low stock items found.", 'info'); return; }
        
        try {
            const doc = await generateGenericReportPDF(
                "Low Stock Reorder Report",
                "Items with quantity < 5",
                ['Product Name', 'Current Stock', 'Last Cost'],
                lowStockItems.map(p => [
                    p.name,
                    p.quantity.toString(),
                    `Rs. ${p.purchasePrice.toLocaleString('en-IN')}`
                ]),
                [],
                state.profile,
                state.reportTemplate,
                state.customFonts
            );
            
            const dateStr = new Date().toLocaleDateString('en-IN').replace(/\//g, '-');
            doc.save(`Report_LowStock_${dateStr}.pdf`);
        } catch (e) {
            console.error(e);
            showToast("Failed to generate PDF", 'error');
        }
    };

    const exportLowStockToSheets = () => {
        if (lowStockItems.length === 0) { showToast("No low stock items found.", 'info'); return; }
        const headers = ['Product Name', 'Current Stock', 'Last Cost'];
        const rows = lowStockItems.map(p => [p.name, p.quantity.toString(), p.purchasePrice.toString()]);
        handleSheetExport("Low Stock Report", headers, rows);
    };

    const SheetButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
        <Button onClick={onClick} variant="secondary" className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 border-emerald-200">
            {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-2" />}
            Sheets
        </Button>
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <BarChart3 className="w-6 h-6" />
                </div>
                <h1 className="text-2xl font-bold text-primary">Reports</h1>
            </div>
            <div className="border-b dark:border-slate-700">
                <nav className="-mb-px flex space-x-6 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('customer')} 
                        className={`py-2 px-1 border-b-2 font-semibold flex items-center gap-2 ${activeTab === 'customer' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}
                    >
                        <Users size={16} /> Customer Reports
                    </button>
                    <button 
                        onClick={() => setActiveTab('supplier')} 
                        className={`py-2 px-1 border-b-2 font-semibold flex items-center gap-2 ${activeTab === 'supplier' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}
                    >
                        <Package size={16} /> Supplier Reports
                    </button>
                    <button 
                        onClick={() => setActiveTab('stock')} 
                        className={`py-2 px-1 border-b-2 font-semibold flex items-center gap-2 ${activeTab === 'stock' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500'}`}
                    >
                        <AlertTriangle size={16} /> Inventory Reports
                    </button>
                </nav>
            </div>
            
            {activeTab === 'customer' && (
                <div className="animate-fade-in-fast space-y-6">
                    <Card title="Filters">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Area</label>
                                <div className="mt-1">
                                    <Dropdown 
                                        options={[{value: 'all', label: 'All Areas'}, ...uniqueAreas.map(area => ({ value: area, label: area }))]}
                                        value={areaFilter}
                                        onChange={setAreaFilter}
                                        searchable={true}
                                        searchPlaceholder="Search areas..."
                                        icon="search"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Dues Age</label>
                                <div className="mt-1">
                                    <Dropdown
                                        options={[
                                            { value: 'all', label: 'All Dues' },
                                            { value: '30', label: 'Older than 30 days' },
                                            { value: '60', label: 'Older than 60 days' },
                                            { value: '90', label: 'Older than 90 days' },
                                            { value: 'custom', label: 'Custom' },
                                        ]}
                                        value={duesAgeFilter}
                                        onChange={setDuesAgeFilter}
                                    />
                                </div>
                                {duesAgeFilter === 'custom' && (
                                    <input type="number" value={customDuesAge} onChange={e => setCustomDuesAge(e.target.value)} placeholder="Enter days" className="w-full p-2 border rounded-lg mt-2 dark:bg-slate-700 dark:border-slate-600 dark:text-white" />
                                )}
                            </div>
                        </div>
                        <div className="text-right mt-4">
                            <Button onClick={() => { setAreaFilter('all'); setDuesAgeFilter('all'); setCustomDuesAge(''); }} variant="secondary" className="bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600">
                                <XCircle className="w-4 h-4 mr-2" />
                                Clear Filters
                            </Button>
                        </div>
                    </Card>

                    <Card title="Customer Dues Report">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateDuesPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateDuesCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                            <SheetButton onClick={exportDuesToSheets} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Customer</th>
                                        <th className="px-4 py-3">Area</th>
                                        <th className="px-4 py-3">Last Paid</th>
                                        <th className="px-4 py-3 text-right">Due Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerDues.map(c => (
                                        <tr key={c.id} onClick={() => handleCustomerClick(c.id)} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.name}</td>
                                            <td className="px-4 py-3">{c.area}</td>
                                            <td className="px-4 py-3">{c.lastPaidDate || '-'}</td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">₹{c.dueAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {customerDues.length === 0 && <tr><td colSpan={4} className="px-4 py-3 text-center text-gray-500">No dues found matching filters.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card title="Customer Account Summary">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateCustomerSummaryPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateCustomerSummaryCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                            <SheetButton onClick={exportCustomerSummaryToSheets} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Customer</th>
                                        <th className="px-4 py-3 text-right">Total Billed</th>
                                        <th className="px-4 py-3 text-right">Total Paid</th>
                                        <th className="px-4 py-3 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customerAccountSummary.map(c => (
                                        <tr key={c.customer.id} onClick={() => handleCustomerClick(c.customer.id)} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{c.customer.name}</td>
                                            <td className="px-4 py-3 text-right">₹{c.totalPurchased.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right text-green-600">₹{c.totalPaid.toLocaleString('en-IN')}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${c.outstandingDue > 0 ? 'text-red-600' : 'text-gray-600'}`}>₹{c.outstandingDue.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'supplier' && (
                <div className="animate-fade-in-fast space-y-6">
                    <Card title="Filters">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Supplier</label>
                            <div className="mt-1">
                                <Dropdown 
                                    options={[{value: 'all', label: 'All Suppliers'}, ...uniqueSuppliers.map(s => ({ value: s.id, label: s.name }))]}
                                    value={supplierFilter}
                                    onChange={setSupplierFilter}
                                    searchable={true}
                                />
                            </div>
                        </div>
                    </Card>

                    <Card title="Supplier Payables (Dues)">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateSupplierDuesPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateSupplierDuesCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                            <SheetButton onClick={exportSupplierDuesToSheets} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3">Invoice / Next Due</th>
                                        <th className="px-4 py-3 text-right">Due Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierDues.map((p, idx) => (
                                        <tr key={idx} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.supplierName}</td>
                                            <td className="px-4 py-3">
                                                <div className="text-xs text-gray-500">Inv: {p.id}</div>
                                                <div>{p.nextDueDate || 'No Schedule'}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-bold text-red-600 dark:text-red-400">₹{p.dueAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {supplierDues.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-center text-gray-500">No supplier dues found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <Card title="Supplier Account Summary">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateSupplierSummaryPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateSupplierSummaryCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                            <SheetButton onClick={exportSupplierSummaryToSheets} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3 text-right">Total Purchased</th>
                                        <th className="px-4 py-3 text-right">Total Paid</th>
                                        <th className="px-4 py-3 text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {supplierAccountSummary.map(s => (
                                        <tr key={s.supplier.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.supplier.name}</td>
                                            <td className="px-4 py-3 text-right">₹{s.totalPurchased.toLocaleString('en-IN')}</td>
                                            <td className="px-4 py-3 text-right text-green-600">₹{s.totalPaid.toLocaleString('en-IN')}</td>
                                            <td className={`px-4 py-3 text-right font-bold ${s.outstandingDue > 0 ? 'text-red-600' : 'text-gray-600'}`}>₹{s.outstandingDue.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'stock' && (
                <div className="animate-fade-in-fast space-y-6">
                    <Card title="Low Stock Report (Reorder)">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateLowStockPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <SheetButton onClick={exportLowStockToSheets} />
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="px-4 py-3">Product Name</th>
                                        <th className="px-4 py-3 text-center">Current Stock</th>
                                        <th className="px-4 py-3 text-right">Last Purchase Price</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStockItems.map(p => (
                                        <tr key={p.id} className="bg-white border-b dark:bg-slate-800 dark:border-slate-700">
                                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
                                            <td className="px-4 py-3 text-center font-bold text-red-600">{p.quantity}</td>
                                            <td className="px-4 py-3 text-right">₹{p.purchasePrice.toLocaleString('en-IN')}</td>
                                        </tr>
                                    ))}
                                    {lowStockItems.length === 0 && <tr><td colSpan={3} className="px-4 py-3 text-center text-gray-500">Stock is healthy (No items &lt; 5).</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};

export default ReportsPage;
