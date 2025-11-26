
import React, { useMemo, useState } from 'react';
import { Download, XCircle, Users, Package, AlertTriangle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from '../components/Card';
import Button from '../components/Button';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Customer, Sale, Supplier, Page, Product } from '../types';
import Dropdown from '../components/Dropdown';
import DatePill from '../components/DatePill';

interface CustomerWithDue extends Customer {
  dueAmount: number;
  lastPaidDate: string | null;
}

interface ReportsPageProps {
    setCurrentPage: (page: Page) => void;
}

const ReportsPage: React.FC<ReportsPageProps> = ({ setCurrentPage }) => {
    const { state, dispatch } = useAppContext();
    const [activeTab, setActiveTab] = useState<'customer' | 'supplier' | 'stock'>('customer');

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

    const generateDuesPDF = () => {
        if (customerDues.length === 0) return alert("No customer dues data to export.");
        const doc = new jsPDF();
        doc.text('Customer Dues Report', 14, 22);
        autoTable(doc, {
            startY: 40,
            head: [['Customer Name', 'Area', 'Last Paid Date', 'Due Amount (Rs.)']],
            body: customerDues.map(c => [ c.name, c.area, c.lastPaidDate || 'N/A', c.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ]),
            theme: 'grid', headStyles: { fillColor: [13, 148, 136] }, columnStyles: { 3: { halign: 'right' } }
        });
        const finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.text(`Total Due: Rs. ${totalDuesFiltered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 196, finalY, { align: 'right' });
        doc.save('customer-dues-report.pdf');
    };

    const generateDuesCSV = () => {
        if (customerDues.length === 0) return alert("No customer dues data to export.");
        const headers = ['Customer Name', 'Area', 'Last Paid Date', 'Due Amount'];
        const rows = customerDues.map(c => `"${c.name}","${c.area}","${c.lastPaidDate || 'N/A'}","${c.dueAmount}"`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'customer-dues-report.csv';
        link.click();
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

    const generateCustomerSummaryPDF = () => {
        if (customerAccountSummary.length === 0) return alert("No customer account data to export.");
        const doc = new jsPDF();
        doc.text('Customer Account Summary Report', 14, 22);
        autoTable(doc, {
            startY: 40,
            head: [['Customer Name', 'Last Purchase Date', 'Total Purchased', 'Total Paid', 'Outstanding Due']],
            body: customerAccountSummary.map(s => [
                s.customer.name,
                s.lastPurchaseDate || 'N/A',
                s.totalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                s.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                s.outstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })
            ]),
            theme: 'grid', headStyles: { fillColor: [13, 148, 136] },
            columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
        });
        doc.save('customer-account-summary.pdf');
    };

    const generateCustomerSummaryCSV = () => {
        if (customerAccountSummary.length === 0) return alert("No customer account data to export.");
        const headers = ['Customer Name', 'Last Purchase Date', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = customerAccountSummary.map(s => `"${s.customer.name}","${s.lastPurchaseDate || 'N/A'}",${s.totalPurchased},${s.totalPaid},${s.outstandingDue}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'customer-account-summary.csv';
        link.click();
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

    const generateSupplierDuesPDF = () => {
        if (supplierDues.length === 0) return alert("No supplier dues data to export.");
        const doc = new jsPDF();
        doc.text('Supplier Dues Report', 14, 22);
        autoTable(doc, {
            startY: 40,
            head: [['Supplier', 'Purchase ID', 'Next Due Date', 'Due Amount']],
            body: supplierDues.map(p => [
                p.supplierName,
                p.id,
                p.nextDueDate || 'N/A',
                p.dueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })
            ]),
            theme: 'grid', headStyles: { fillColor: [13, 148, 136] },
            columnStyles: { 3: { halign: 'right' } }
        });
        doc.save('supplier-dues-report.pdf');
    };

    const generateSupplierDuesCSV = () => {
        if (supplierDues.length === 0) return alert("No supplier dues data to export.");
        const headers = ['Supplier', 'Purchase ID', 'Next Due Date', 'Due Amount'];
        const rows = supplierDues.map(p => `"${p.supplierName}","${p.id}","${p.nextDueDate || 'N/A'}",${p.dueAmount}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'supplier-dues-report.csv';
        link.click();
    };

    const generateSupplierSummaryPDF = () => {
        if (supplierAccountSummary.length === 0) return alert("No supplier account data to export.");
        const doc = new jsPDF();
        doc.text('Supplier Account Summary Report', 14, 22);
        autoTable(doc, {
            startY: 40,
            head: [['Supplier Name', 'Total Purchased', 'Total Paid', 'Outstanding Due']],
            body: supplierAccountSummary.map(s => [
                s.supplier.name,
                s.totalPurchased.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                s.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 }),
                s.outstandingDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })
            ]),
            theme: 'grid', headStyles: { fillColor: [13, 148, 136] },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } }
        });
        doc.save('supplier-account-summary.pdf');
    };

    const generateSupplierSummaryCSV = () => {
        if (supplierAccountSummary.length === 0) return alert("No supplier account data to export.");
        const headers = ['Supplier Name', 'Total Purchased', 'Total Paid', 'Outstanding Due'];
        const rows = supplierAccountSummary.map(s => `"${s.supplier.name}",${s.totalPurchased},${s.totalPaid},${s.outstandingDue}`);
        const csv = [headers.join(','), ...rows].join('\n');
        const link = document.createElement("a");
        link.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        link.download = 'supplier-account-summary.csv';
        link.click();
    };

    // --- Low Stock Report Logic ---
    const lowStockItems = useMemo(() => {
        return state.products
            .filter(p => p.quantity < 5)
            .sort((a, b) => a.quantity - b.quantity);
    }, [state.products]);

    const generateLowStockPDF = () => {
        if (lowStockItems.length === 0) return alert("No low stock items found.");
        const doc = new jsPDF();
        
        doc.setFontSize(20);
        doc.setTextColor('#dc2626'); // Red title
        doc.text('Low Stock Reorder Report', 14, 20);
        
        doc.setFontSize(10);
        doc.setTextColor('#666666');
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
        
        autoTable(doc, {
            startY: 35,
            head: [['Product Name', 'Current Stock', 'Last Cost']],
            body: lowStockItems.map(p => [
                p.name,
                p.quantity,
                `Rs. ${p.purchasePrice.toLocaleString('en-IN')}`
            ]),
            theme: 'striped',
            headStyles: { fillColor: [220, 38, 38] }, // Red header
            columnStyles: { 1: { halign: 'center', fontStyle: 'bold' }, 2: { halign: 'right' } }
        });
        
        doc.save('low-stock-report.pdf');
    };

    return (
        <div className="space-y-6">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-primary">Reports</h1>
                    <DatePill />
                </div>
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
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="p-2">Name</th><th className="p-2">Area</th><th className="p-2">Last Paid Date</th><th className="p-2 text-right">Due Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {customerDues.length > 0 ? customerDues.map(c => (
                                        <tr key={c.id} className="border-b dark:border-slate-700">
                                            <td className="p-2 font-semibold">
                                                <button 
                                                    onClick={() => handleCustomerClick(c.id)}
                                                    className="text-primary hover:underline text-left"
                                                >
                                                    {c.name}
                                                </button>
                                            </td>
                                            <td className="p-2">{c.area}</td><td className="p-2">{c.lastPaidDate || 'N/A'}</td><td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">₹{c.dueAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    )) : <tr><td colSpan={4} className="text-center p-4 text-gray-500 dark:text-gray-400">No dues found for the selected filters.</td></tr>}
                                </tbody>
                                <tfoot className="font-bold bg-gray-100 dark:bg-slate-800 dark:text-slate-200">
                                    <tr>
                                        <td colSpan={3} className="p-2 text-right">Total Due</td><td className="p-2 text-right">₹{totalDuesFiltered.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </Card>

                    <Card title="Customer Account Summary">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateCustomerSummaryPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateCustomerSummaryCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr>
                                        <th className="p-2">Name</th>
                                        <th className="p-2">Last Purchase Date</th>
                                        <th className="p-2 text-right">Total Purchased</th>
                                        <th className="p-2 text-right">Total Paid</th>
                                        <th className="p-2 text-right">Outstanding Due</th>
                                    </tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {customerAccountSummary.map(s => (
                                        <tr key={s.customer.id} className="border-b dark:border-slate-700">
                                            <td className="p-2 font-semibold">
                                                <button 
                                                    onClick={() => handleCustomerClick(s.customer.id)}
                                                    className="text-primary hover:underline text-left"
                                                >
                                                    {s.customer.name}
                                                </button>
                                            </td>
                                            <td className="p-2">{s.lastPurchaseDate || 'N/A'}</td>
                                            <td className="p-2 text-right">₹{s.totalPurchased.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right text-green-600 dark:text-green-400">₹{s.totalPaid.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">₹{s.outstandingDue.toLocaleString('en-IN')}</td>
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
                                    searchPlaceholder="Search suppliers..."
                                    icon="search"
                                />
                            </div>
                        </div>
                    </Card>

                     <Card title="Supplier Dues Report">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateSupplierDuesPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateSupplierDuesCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr><th className="p-2">Supplier</th><th className="p-2">Purchase ID</th><th className="p-2">Next Due Date</th><th className="p-2 text-right">Due Amount</th></tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {supplierDues.length > 0 ? supplierDues.map(p => (
                                        <tr key={p.id} className="border-b dark:border-slate-700">
                                            <td className="p-2 font-semibold">{p.supplierName}</td><td className="p-2">{p.id}</td><td className="p-2">{p.nextDueDate || 'N/A'}</td><td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">₹{p.dueAmount.toLocaleString('en-IN')}</td>
                                        </tr>
                                    )) : <tr><td colSpan={4} className="text-center p-4 text-gray-500 dark:text-gray-400">No supplier dues found.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                    
                    <Card title="Supplier Account Summary">
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateSupplierSummaryPDF}><Download className="w-4 h-4 mr-2" /> PDF</Button>
                            <Button onClick={generateSupplierSummaryCSV} variant="secondary"><Download className="w-4 h-4 mr-2" /> CSV</Button>
                        </div>
                         <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300">
                                    <tr><th className="p-2">Name</th><th className="p-2 text-right">Total Purchased</th><th className="p-2 text-right">Total Paid</th><th className="p-2 text-right">Outstanding Due</th></tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {supplierAccountSummary.map(s => (
                                        <tr key={s.supplier.id} className="border-b dark:border-slate-700">
                                            <td className="p-2 font-semibold">{s.supplier.name}</td>
                                            <td className="p-2 text-right">₹{s.totalPurchased.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right text-green-600 dark:text-green-400">₹{s.totalPaid.toLocaleString('en-IN')}</td>
                                            <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">₹{s.outstandingDue.toLocaleString('en-IN')}</td>
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
                    <Card title="Low Stock Reorder Report">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                            This report lists all items with less than 5 units in stock. Use this to place orders with your suppliers.
                        </p>
                        <div className="flex gap-2 mb-4">
                            <Button onClick={generateLowStockPDF} className="bg-red-600 hover:bg-red-700 focus:ring-red-600"><Download className="w-4 h-4 mr-2" /> Download Reorder PDF</Button>
                        </div>
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead className="text-left text-gray-600 bg-gray-50 dark:bg-slate-700 dark:text-gray-300 sticky top-0">
                                    <tr>
                                        <th className="p-2">Product Name</th>
                                        <th className="p-2 text-center">Stock</th>
                                        <th className="p-2 text-right">Last Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="dark:text-slate-300">
                                    {lowStockItems.length > 0 ? lowStockItems.map(p => (
                                        <tr key={p.id} className="border-b dark:border-slate-700">
                                            <td className="p-2 font-semibold">{p.name}</td>
                                            <td className="p-2 text-center font-bold text-red-600">{p.quantity}</td>
                                            <td className="p-2 text-right">₹{p.purchasePrice.toLocaleString('en-IN')}</td>
                                        </tr>
                                    )) : <tr><td colSpan={3} className="text-center p-4 text-gray-500 dark:text-gray-400">Inventory is healthy. No low stock items.</td></tr>}
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
