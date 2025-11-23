import { AppState } from '../context/AppContext';
import { ProfileData, Customer, Supplier, Product, Purchase, Sale, Return } from '../types';

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

// This is a simplified static dataset. In a real generation script, you'd calculate final stock.
// For this static file, the quantities in the `products` array are pre-calculated for simplicity.
// (Total Purchases) - (Total Sales) + (Total Customer Returns)

export const testData: Omit<AppState, 'toast' | 'selection' | 'installPromptEvent' | 'notifications' | 'profile' | 'pin' | 'googleUser' | 'syncStatus'> = {
  customers,
  suppliers,
  products,
  sales,
  purchases,
  returns,
  app_metadata: [],
  audit_logs: [],
  theme: 'light',
  themeColor: '#0d9488',
  lastLocalUpdate: 0,
  lastSyncTime: null,
};
