
import { AppState } from '../context/AppContext';
import { ProfileData, Customer, Supplier, Product, Purchase, Sale, Return, Expense } from '../types';

// Utility to create dates relative to today
const daysAgo = (days: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
};

const daysFromNow = (days: number): string => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
};

export const testProfile: ProfileData = {
  id: 'userProfile',
  name: 'My Business',
  ownerName: 'Owner Name',
  phone: '9876543210',
  address: '123 Market Street, City, 500001',
  gstNumber: '36ABCDE1234F1Z5',
};

const customers: Customer[] = [
    { id: 'CUST-001', name: 'Aaradhya Rao', phone: '9876543210', address: '1-101, Kukatpally', area: 'Kukatpally', reference: 'Friend' },
    { id: 'CUST-002', name: 'Bhavna Reddy', phone: '9876543211', address: '2-202, Ameerpet', area: 'Ameerpet' },
    { id: 'CUST-003', name: 'Charvi Patel', phone: '9876543212', address: '3-303, Jubilee Hills', area: 'Jubilee Hills' },
    { id: 'CUST-004', name: 'Devika Singh', phone: '9876543213', address: '4-404, Gachibowli', area: 'Gachibowli' },
    { id: 'CUST-005', name: 'Esha Gupta', phone: '9876543214', address: '5-505, Madhapur', area: 'Madhapur' },
];

const suppliers: Supplier[] = [
    { id: 'SUPP-001', name: 'Surat Weavers Guild', phone: '8887776661', location: 'Surat', gstNumber: '24AAAAA0000A1Z5' },
    { id: 'SUPP-002', name: 'Kanchi Silks Emporium', phone: '8887776662', location: 'Kanchipuram', gstNumber: '33BBBBB0000B1Z5' },
    { id: 'SUPP-003', name: 'Varanasi Brocades Ltd', phone: '8887776663', location: 'Varanasi', gstNumber: '09CCCCC0000C1Z5' },
    { id: 'SUPP-004', name: 'Jaipur Prints Co.', phone: '8887776664', location: 'Jaipur', gstNumber: '08DDDDD0000D1Z5' },
    { id: 'SUPP-005', name: 'Kolkata Cottons', phone: '8887776665', location: 'Kolkata', gstNumber: '19EEEEE0000E1Z5' },
];

const products: Product[] = [
    // Kanchi Pattu - 10
    { id: 'BM-KAN-001', name: 'Kanchi Pattu - Peacock Blue', quantity: 18, purchasePrice: 4000, salePrice: 6500, gstPercent: 5 },
    { id: 'BM-KAN-002', name: 'Kanchi Pattu - Ruby Red', quantity: 9, purchasePrice: 4200, salePrice: 7000, gstPercent: 5 },
    { id: 'BM-KAN-003', name: 'Kanchi Pattu - Emerald Green', quantity: 10, purchasePrice: 4100, salePrice: 6800, gstPercent: 5 },
    { id: 'BM-KAN-004', name: 'Kanchi Pattu - Golden Yellow', quantity: 15, purchasePrice: 3900, salePrice: 6400, gstPercent: 5 },
    { id: 'BM-KAN-005', name: 'Kanchi Pattu - Royal Purple', quantity: 12, purchasePrice: 4500, salePrice: 7500, gstPercent: 5 },
    // Chettinad Cotton - 10
    { id: 'BM-COT-001', name: 'Chettinad Cotton - Mustard', quantity: 23, purchasePrice: 800, salePrice: 1500, gstPercent: 5 },
    { id: 'BM-COT-002', name: 'Chettinad Cotton - Indigo', quantity: 30, purchasePrice: 850, salePrice: 1600, gstPercent: 5 },
    { id: 'BM-COT-003', name: 'Chettinad Cotton - Maroon Checks', quantity: 25, purchasePrice: 900, salePrice: 1700, gstPercent: 5 },
    { id: 'BM-COT-004', name: 'Chettinad Cotton - Bottle Green', quantity: 28, purchasePrice: 820, salePrice: 1550, gstPercent: 5 },
    { id: 'BM-COT-005', name: 'Chettinad Cotton - Black & Red', quantity: 20, purchasePrice: 950, salePrice: 1800, gstPercent: 5 },
    // Mysore Silk - 10
    { id: 'BM-SILK-001', name: 'Mysore Silk - Royal Green', quantity: 14, purchasePrice: 2500, salePrice: 4500, gstPercent: 5 },
    { id: 'BM-SILK-002', name: 'Mysore Silk - Classic Pink', quantity: 18, purchasePrice: 2600, salePrice: 4700, gstPercent: 5 },
    { id: 'BM-SILK-003', name: 'Mysore Silk - Deep Blue', quantity: 12, purchasePrice: 2550, salePrice: 4600, gstPercent: 5 },
    { id: 'BM-SILK-004', name: 'Mysore Silk - Elegant Black', quantity: 10, purchasePrice: 2800, salePrice: 5000, gstPercent: 5 },
    { id: 'BM-SILK-005', name: 'Mysore Silk - Bright Red', quantity: 15, purchasePrice: 2700, salePrice: 4800, gstPercent: 5 },
    // Synthetics - 10
    { id: 'BM-SYN-001', name: 'Synthetic Georgette - Floral', quantity: 27, purchasePrice: 500, salePrice: 950, gstPercent: 12 },
    { id: 'BM-SYN-002', name: 'Synthetic Crepe - Polka Dots', quantity: 35, purchasePrice: 450, salePrice: 850, gstPercent: 12 },
    { id: 'BM-SYN-003', name: 'Synthetic Chiffon - Abstract', quantity: 40, purchasePrice: 400, salePrice: 750, gstPercent: 12 },
    { id: 'BM-SYN-004', name: 'Synthetic Satin - Plain Black', quantity: 30, purchasePrice: 550, salePrice: 1050, gstPercent: 12 },
    { id: 'BM-SYN-005', name: 'Synthetic Organza - Embroidery', quantity: 25, purchasePrice: 600, salePrice: 1200, gstPercent: 12 },
    // Banarasi - 10
    { id: 'BM-BAN-001', name: 'Banarasi Silk - Red Bridal', quantity: 8, purchasePrice: 6000, salePrice: 11000, gstPercent: 5 },
    { id: 'BM-BAN-002', name: 'Banarasi Silk - Blue & Gold', quantity: 12, purchasePrice: 5500, salePrice: 10000, gstPercent: 5 },
    { id: 'BM-BAN-003', name: 'Banarasi Katan Silk - Pink', quantity: 10, purchasePrice: 6500, salePrice: 12000, gstPercent: 5 },
    { id: 'BM-BAN-004', name: 'Banarasi Organza - Floral', quantity: 15, purchasePrice: 4000, salePrice: 7500, gstPercent: 5 },
    { id: 'BM-BAN-005', name: 'Banarasi Georgette - Green', quantity: 13, purchasePrice: 4500, salePrice: 8500, gstPercent: 5 },
];

const purchases: Purchase[] = [
    { id: 'PUR-20240701-090000', supplierId: 'SUPP-002', items: [{ productId: 'BM-KAN-001', productName: 'Kanchi Pattu - Peacock Blue', quantity: 20, price: 4000, gstPercent: 5, saleValue: 6500 }], totalAmount: 80000, date: daysAgo(50), payments: [{ id: 'PAY-P-1', amount: 80000, date: daysAgo(50), method: 'UPI' }], paymentDueDates: [] },
    { id: 'PUR-20240705-140000', supplierId: 'SUPP-001', items: [{ productId: 'BM-COT-001', productName: 'Chettinad Cotton - Mustard', quantity: 30, price: 800, gstPercent: 5, saleValue: 1500 }], totalAmount: 24000, date: daysAgo(45), payments: [{ id: 'PAY-P-2', amount: 14000, date: daysAgo(45), method: 'CASH' }], paymentDueDates: [daysFromNow(15)] },
    { id: 'PUR-20240801-120000', supplierId: 'SUPP-006', items: [{ productId: 'BM-SILK-001', productName: 'Mysore Silk - Royal Green', quantity: 20, price: 2500, gstPercent: 5, saleValue: 4500 }], totalAmount: 50000, date: daysAgo(18), payments: [{ id: 'PAY-P-3', amount: 25000, date: daysAgo(18), method: 'CASH' }], paymentDueDates: [daysAgo(10), daysFromNow(25)] },
];

const sales: Sale[] = [
    { id: 'SALE-20240710-113000', customerId: 'CUST-001', items: [{ productId: 'BM-KAN-001', productName: 'Kanchi Pattu - Peacock Blue', quantity: 1, price: 6500 }], discount: 200, totalAmount: 6300, gstAmount: 309.52, date: daysAgo(40), payments: [{ id: 'PAY-S-1', amount: 6300, date: daysAgo(40), method: 'UPI' }] },
    { id: 'SALE-20240715-150000', customerId: 'CUST-002', items: [{ productId: 'BM-COT-001', productName: 'Chettinad Cotton - Mustard', quantity: 2, price: 1500 }], discount: 0, totalAmount: 3000, gstAmount: 142.86, date: daysAgo(35), payments: [{ id: 'PAY-S-2', amount: 1000, date: daysAgo(35), method: 'CASH' }] },
    { id: 'SALE-20240801-100000', customerId: 'CUST-003', items: [{ productId: 'BM-KAN-002', productName: 'Kanchi Pattu - Ruby Red', quantity: 1, price: 7000 }, { productId: 'BM-SILK-001', productName: 'Mysore Silk - Royal Green', quantity: 1, price: 4500 }], discount: 500, totalAmount: 11000, gstAmount: 523.81, date: daysAgo(15), payments: [{ id: 'PAY-S-3', amount: 11000, date: daysAgo(15), method: 'CHEQUE', reference: 'CHQ-54321' }] },
    { id: 'SALE-20240810-180000', customerId: 'CUST-001', items: [{ productId: 'BM-SYN-001', productName: 'Synthetic Georgette - Floral', quantity: 3, price: 950 }], discount: 50, totalAmount: 2800, gstAmount: 300, date: daysAgo(5), payments: [] },
    { id: 'SALE-20240811-120000', customerId: 'CUST-004', items: [{ productId: 'BM-SILK-002', productName: 'Mysore Silk - Classic Pink', quantity: 1, price: 4700 }], discount: 0, totalAmount: 4700, gstAmount: 223.81, date: daysAgo(4), payments: [{ id: 'PAY-S-4', amount: 4700, date: daysAgo(4), method: 'CASH' }] },
    { id: 'SALE-20240812-163000', customerId: 'CUST-005', items: [{ productId: 'BM-COT-003', productName: 'Chettinad Cotton - Maroon Checks', quantity: 3, price: 1700 }], discount: 100, totalAmount: 5000, gstAmount: 238.1, date: daysAgo(3), payments: [{ id: 'PAY-S-5', amount: 2000, date: daysAgo(3), method: 'UPI' }] },
    { id: 'SALE-20240813-110000', customerId: 'CUST-002', items: [{ productId: 'BM-BAN-001', productName: 'Banarasi Silk - Red Bridal', quantity: 1, price: 11000 }], discount: 1000, totalAmount: 10000, gstAmount: 476.19, date: daysAgo(2), payments: [] },
];

const returns: Return[] = [
    { id: 'RET-20240720-100000', type: 'CUSTOMER', referenceId: 'SALE-20240710-113000', partyId: 'CUST-001', items: [{ productId: 'BM-KAN-001', productName: 'Kanchi Pattu - Peacock Blue', quantity: 1, price: 6500 }], returnDate: daysAgo(30), amount: 6300, reason: 'Color mismatch' }
];

const expenses: Expense[] = [
    { id: 'EXP-001', category: 'Rent', amount: 15000, date: daysAgo(30), note: 'Shop Rent', paymentMethod: 'UPI' },
    { id: 'EXP-002', category: 'Electricity', amount: 2500, date: daysAgo(25), note: 'Electric Bill', paymentMethod: 'UPI' },
    { id: 'EXP-003', category: 'Transport', amount: 500, date: daysAgo(10), note: 'Auto charges', paymentMethod: 'CASH' },
    { id: 'EXP-004', category: 'Food', amount: 150, date: daysAgo(2), note: 'Tea & Snacks', paymentMethod: 'CASH' },
];

export const testData: Omit<AppState, 'toast' | 'selection' | 'pin' | 'googleUser' | 'syncStatus' | 'currentSale' | 'parkedSales' | 'trash' | 'restoreFromFileId'> = {
  customers,
  suppliers,
  products,
  sales,
  purchases,
  returns,
  expenses,
  quotes: [],
  app_metadata: [],
  audit_logs: [],
  customFonts: [],
  theme: 'light',
  themeColor: '#8b5cf6',
  headerColor: '',
  font: 'Inter',
  themeGradient: 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)',
  lastLocalUpdate: 0,
  lastSyncTime: null,
  devMode: false,
  performanceMode: false,
  isOnline: true,
  navOrder: [
    'DASHBOARD', 'CUSTOMERS', 'SALES', 'PURCHASES', 
    'INSIGHTS', 'REPORTS', 'PRODUCTS', 'EXPENSES', 
    'RETURNS', 'QUOTATIONS', 'INVOICE_DESIGNER', 'SYSTEM_OPTIMIZER'
  ],
  quickActions: [
    'add_sale', 'add_customer', 'add_expense', 'add_purchase', 'add_quote', 'add_return'
  ],
  invoiceTemplate: {
    id: 'invoiceTemplateConfig',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    colors: {
        primary: '#0d9488',
        secondary: '#333333',
        text: '#000000',
        tableHeaderBg: '#0d9488',
        tableHeaderText: '#ffffff',
        bannerBg: '#0d9488',
        bannerText: '#ffffff',
        footerBg: '#f3f4f6',
        footerText: '#374151',
        borderColor: '#e5e7eb',
        alternateRowBg: '#f9fafb'
    },
    fonts: {
        headerSize: 22,
        bodySize: 10,
        titleFont: 'helvetica',
        bodyFont: 'helvetica'
    },
    layout: {
        margin: 10,
        logoSize: 25,
        logoPosition: 'center',
        logoOffsetX: 0,
        logoOffsetY: 0,
        headerAlignment: 'center',
        headerStyle: 'standard',
        footerStyle: 'standard',
        showWatermark: false,
        watermarkOpacity: 0.1,
        tableOptions: {
            hideQty: false,
            hideRate: false,
            stripedRows: false,
            bordered: false,
            compact: false
        },
        columnWidths: { qty: 15, rate: 20, amount: 35 },
        tablePadding: 3,
        borderRadius: 4,
        spacing: 1.0,
        elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 }
    },
    content: {
        titleText: 'TAX INVOICE',
        showTerms: true,
        showQr: true,
        termsText: '',
        footerText: 'Thank you for your business!',
        showBusinessDetails: true,
        showCustomerDetails: true,
        showSignature: true,
        signatureText: 'Authorized Signatory',
        showAmountInWords: true,
        showStatusStamp: false,
        labels: {
            billedTo: "Billed To",
            invoiceNo: "Invoice No",
            date: "Date",
            item: "Item",
            qty: "Qty",
            rate: "Rate",
            amount: "Amount",
            subtotal: "Subtotal",
            discount: "Discount",
            gst: "GST",
            grandTotal: "Grand Total",
            paid: "Paid",
            balance: "Balance"
        },
        qrType: 'INVOICE_ID',
        bankDetails: ''
    }
  },
  estimateTemplate: {
    id: 'estimateTemplateConfig',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    colors: { primary: '#4f46e5', secondary: '#333333', text: '#000000', tableHeaderBg: '#4f46e5', tableHeaderText: '#ffffff', bannerBg: '#4f46e5' },
    fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
    layout: { 
        margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1,
        tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false },
        columnWidths: { qty: 15, rate: 20, amount: 35 },
        tablePadding: 3,
        borderRadius: 4,
        spacing: 1.0,
        elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 }
    },
    content: { titleText: 'ESTIMATE', showTerms: true, showQr: false, termsText: '', footerText: 'Valid for 7 days.', showBusinessDetails: true, showCustomerDetails: true, showSignature: true, showAmountInWords: true }
  },
  debitNoteTemplate: {
    id: 'debitNoteTemplateConfig',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    colors: { primary: '#000000', secondary: '#333333', text: '#000000', tableHeaderBg: '#333333', tableHeaderText: '#ffffff', bannerBg: '#333333' },
    fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
    layout: { 
        margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1,
        tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false },
        columnWidths: { qty: 15, rate: 20, amount: 35 },
        tablePadding: 3,
        borderRadius: 4,
        spacing: 1.0,
        elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 }
    },
    content: { titleText: 'DEBIT NOTE', showTerms: false, showQr: false, termsText: '', footerText: '', showBusinessDetails: true, showCustomerDetails: true, showSignature: true, showAmountInWords: true }
  },
  receiptTemplate: {
    id: 'receiptTemplateConfig',
    currencySymbol: 'Rs.',
    dateFormat: 'DD/MM/YYYY',
    colors: { primary: '#000000', secondary: '#000000', text: '#000000', tableHeaderBg: '#ffffff', tableHeaderText: '#000000' },
    fonts: { headerSize: 12, bodySize: 8, titleFont: 'helvetica', bodyFont: 'helvetica' },
    layout: { 
        margin: 2, logoSize: 15, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1,
        tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false },
        columnWidths: { qty: 10, rate: 15, amount: 25 },
        tablePadding: 2,
        borderRadius: 0,
        spacing: 0.9,
        elementSpacing: { logoBottom: 2, titleBottom: 1, addressBottom: 1, headerBottom: 2 }
    },
    content: { titleText: 'RECEIPT', showTerms: true, showQr: true, termsText: '', footerText: 'Thank You!', showBusinessDetails: true, showCustomerDetails: true, showSignature: false, showAmountInWords: true }
  },
  reportTemplate: {
    id: 'reportTemplateConfig',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', bannerBg: '#0d9488', bannerText: '#ffffff', footerBg: '#f3f4f6', footerText: '#374151', borderColor: '#e5e7eb', alternateRowBg: '#f9fafb' },
    fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
    layout: { 
        margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1,
        tableOptions: { hideQty: false, hideRate: false, stripedRows: true, bordered: true, compact: true },
        columnWidths: { qty: 15, rate: 20, amount: 35 },
        tablePadding: 3,
        borderRadius: 4,
        spacing: 1.0,
        elementSpacing: { logoBottom: 5, titleBottom: 2, addressBottom: 1, headerBottom: 5 }
    },
    content: { 
        titleText: 'REPORT', showTerms: false, showQr: false, termsText: '', footerText: 'Generated Report', showBusinessDetails: true, showCustomerDetails: true, showSignature: false, signatureText: '', showAmountInWords: false, showStatusStamp: false, showTaxBreakdown: false, showGst: false,
        labels: {
            billedTo: "Billed To",
            invoiceNo: "Report No",
            date: "Date",
            item: "Item",
            qty: "Qty",
            rate: "Rate",
            amount: "Amount",
            subtotal: "Subtotal",
            discount: "Discount",
            gst: "GST",
            grandTotal: "Grand Total",
            paid: "Paid",
            balance: "Balance"
        },
        qrType: 'INVOICE_ID',
        bankDetails: ''
    }
  },
  uiPreferences: {
    id: 'uiPreferences',
    buttonStyle: 'rounded',
    cardStyle: 'solid',
    toastPosition: 'top-center',
    density: 'comfortable'
  }
};
