
import { ReactNode } from "react";

export type Page = 'DASHBOARD' | 'CUSTOMERS' | 'SALES' | 'PURCHASES' | 'REPORTS' | 'RETURNS' | 'PRODUCTS' | 'INSIGHTS' | 'EXPENSES' | 'QUOTATIONS';
export type Theme = 'light' | 'dark';

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  accessToken?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string; // Email or Name
  action: string; // e.g., "Added Sale", "Updated Customer"
  details: string; // Brief description or ID reference
}

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

export interface Payment {
  id: string;
  amount: number;
  date: string; // ISO string
  method: 'CASH' | 'UPI' | 'CHEQUE' | 'RETURN_CREDIT';
  reference?: string;
}

export interface Customer {
  id: string; // Manual input
  name: string;
  phone: string;
  address: string;
  area: string;
  reference?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  location: string;
  gstNumber?: string;
  reference?: string;
  account1?: string;
  account2?: string;
  upi?: string;
}

export interface Product {
  id: string; // QR code or manual entry
  name: string;
  category?: string; // New field for categorization
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  gstPercent: number;
  image?: string; // Base64 encoded image
}

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Sale {
  id:string;
  customerId: string;
  items: SaleItem[];
  discount: number;
  gstAmount: number;
  totalAmount: number;
  date: string; // ISO string
  payments: Payment[];
}

export interface QuoteItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
}

export interface Quote {
  id: string;
  customerId: string;
  items: QuoteItem[];
  totalAmount: number;
  discount: number;
  gstAmount: number;
  date: string; // ISO string
  validUntil?: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED';
  convertedSaleId?: string;
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  gstPercent: number;
  saleValue: number;
}

export interface Purchase {
  id: string;
  supplierId: string;
  items: PurchaseItem[];
  totalAmount: number;
  date: string; // ISO string
  invoiceUrl?: string; // For uploaded invoice
  supplierInvoiceId?: string; // Manual invoice ID from supplier
  payments: Payment[];
  paymentDueDates?: string[]; // ISO date strings
}

export interface ReturnItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number; // The price at which it was sold/purchased
}

export interface Return {
  id: string;
  type: 'CUSTOMER' | 'SUPPLIER';
  referenceId: string; // saleId or purchaseId
  partyId: string; // customerId or supplierId
  items: ReturnItem[];
  returnDate: string; // ISO string
  amount: number; // Amount refunded to customer or credited from supplier
  reason?: string;
  notes?: string;
}

export type ExpenseCategory = 'Rent' | 'Salary' | 'Electricity' | 'Transport' | 'Maintenance' | 'Marketing' | 'Food' | 'Other';

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  date: string; // ISO string
  note?: string;
  paymentMethod: 'CASH' | 'UPI' | 'CHEQUE';
  receiptImage?: string; // Base64 encoded image
}

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string; // ISO string
  type: 'backup' | 'info';
  actionLink?: Page;
}

export interface ProfileData {
  id: 'userProfile'; // a fixed ID for the single profile object
  name: string; // Business Name
  ownerName: string; // Owner Name for greetings
  phone: string;
  address: string;
  gstNumber: string;
  logo?: string; // Base64 encoded logo
}

// --- App Metadata Types ---
export interface AppMetadataPin {
  id: 'securityPin';
  pin: string;
}

export interface AppMetadataBackup {
  id: 'lastBackup';
  date: string;
}

export interface AppMetadataRevenueGoal {
  id: 'revenueGoal';
  amount: number;
}

export interface AppMetadataLastModified {
  id: 'lastModified';
  timestamp: number;
}

export interface AppMetadataTheme {
  id: 'themeSettings';
  theme: Theme;
  color: string;
  gradient: string;
}

export type AppMetadata = AppMetadataPin | AppMetadataBackup | AppMetadataRevenueGoal | AppMetadataLastModified | AppMetadataTheme;
