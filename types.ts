

import { ReactNode } from "react";

export type Page = 'DASHBOARD' | 'CUSTOMERS' | 'SALES' | 'PURCHASES' | 'REPORTS' | 'RETURNS' | 'PRODUCTS' | 'INSIGHTS' | 'EXPENSES' | 'QUOTATIONS' | 'INVOICE_DESIGNER' | 'SYSTEM_OPTIMIZER';
export type Theme = 'light' | 'dark';

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
  accessToken: string;
  expiresAt?: number; // Timestamp when token expires
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

export interface ProductBatch {
  id: string; // Batch Number
  quantity: number;
  expiryDate?: string; // ISO Date
  entryDate: string; // ISO Date
}

export interface Product {
  id: string; // QR code or manual entry
  name: string;
  description?: string; // New field for sharing/details
  category?: string; 
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  gstPercent: number;
  image?: string; // Base64 encoded image (Main)
  additionalImages?: string[]; // New: Multiple images
  batches?: ProductBatch[]; 
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
  batchNumber?: string; // New
  expiryDate?: string; // New
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

export interface CustomFont {
  id: string;
  name: string; // Display name
  data: string; // Base64 encoded TTF data
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
  type: 'backup' | 'info' | 'expiry' | 'stock';
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

// --- Invoice Template Configuration ---
export type DocumentType = 'INVOICE' | 'ESTIMATE' | 'DEBIT_NOTE' | 'RECEIPT' | 'REPORT';

export interface InvoiceLabels {
    billedTo: string;
    date: string;
    invoiceNo: string; // or Estimate No, etc.
    item: string;
    qty: string;
    rate: string;
    amount: string;
    subtotal: string;
    discount: string;
    gst: string;
    grandTotal: string;
    paid: string;
    balance: string;
}

export interface InvoiceTemplateConfig {
  id: string;
  currencySymbol: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  colors: {
    primary: string;
    secondary: string;
    text: string;
    tableHeaderBg: string;
    tableHeaderText: string;
    bannerBg?: string;
    bannerText?: string;
    footerBg?: string;
    footerText?: string;
    borderColor?: string;
    alternateRowBg?: string;
  };
  fonts: {
    headerSize: number;
    bodySize: number;
    titleFont: string; // 'helvetica', 'times', 'courier', or custom font name
    bodyFont: string;
  };
  layout: {
    margin: number; // mm
    logoSize: number; // mm
    logoPosition: 'left' | 'center' | 'right';
    logoOffsetX?: number; // mm
    logoOffsetY?: number; // mm
    qrPosition?: 'header-right' | 'details-right' | 'footer-left' | 'footer-right';
    headerAlignment: 'left' | 'center' | 'right';
    headerStyle?: 'standard' | 'banner' | 'minimal'; // New: Header Style
    footerStyle?: 'standard' | 'banner'; // New: Footer Style
    showWatermark: boolean;
    watermarkOpacity: number; // 0.1 to 1.0
    columnWidths?: { qty?: number; rate?: number; amount?: number; }; // Custom column widths
    tablePadding?: number;
    borderRadius?: number;
    uppercaseHeadings?: boolean;
    boldBorders?: boolean;
    spacing?: number; // Vertical spacing scale (default 1.0)
    elementSpacing?: { // New: Individual element spacing overrides
        logoBottom?: number;
        titleBottom?: number;
        addressBottom?: number;
        headerBottom?: number;
    };
    tableOptions: {
        hideQty: boolean;
        hideRate: boolean;
        stripedRows: boolean;
        bordered?: boolean; // New: Table Border
        compact?: boolean; // New: Compact Padding
    };
    tableHeaderAlign?: 'left' | 'center' | 'right';
    sectionOrdering?: string[];
    backgroundImage?: string; // Base64 encoded background/stationery
    paperSize?: 'a4' | 'letter';
  };
  content: {
    titleText: string; // e.g. "TAX INVOICE"
    showTerms: boolean;
    showQr: boolean;
    termsText: string;
    footerText: string;
    showBusinessDetails?: boolean;
    showCustomerDetails?: boolean;
    showSignature?: boolean;
    signatureText?: string;
    signatureImage?: string; // Base64 signature image
    showAmountInWords?: boolean; // New: Show amount in words
    showStatusStamp?: boolean; // New: Show PAID/DUE stamp
    showTaxBreakdown?: boolean; // New: Show Tax Breakdown Table
    showGst?: boolean; // New: Show GST Line in totals (Default: true)
    labels?: InvoiceLabels; // Custom labels for tables and fields
    
    // New Fields
    qrType?: 'INVOICE_ID' | 'UPI_PAYMENT';
    upiId?: string;
    payeeName?: string;
    bankDetails?: string;
  };
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

export interface AppMetadataInvoiceSettings {
  id: 'invoiceSettings';
  terms: string;
  footer: string;
  showQr: boolean;
}

export interface AppMetadataNavOrder {
  id: 'navOrder';
  order: string[]; // List of Page strings
}

export interface AppMetadataQuickActions {
  id: 'quickActions';
  actions: string[]; // List of action IDs
}

export type AppMetadata = AppMetadataPin | AppMetadataBackup | AppMetadataRevenueGoal | AppMetadataLastModified | AppMetadataTheme | AppMetadataInvoiceSettings | AppMetadataNavOrder | AppMetadataQuickActions | InvoiceTemplateConfig;

export interface Snapshot {
  id: string;
  timestamp: string; // ISO string
  name: string;
  data: any; // The exported data object
}