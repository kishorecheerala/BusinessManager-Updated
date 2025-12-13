
import { ReactNode } from "react";

export type Page = 'DASHBOARD' | 'CUSTOMERS' | 'SALES' | 'PURCHASES' | 'REPORTS' | 'RETURNS' | 'PRODUCTS' | 'INSIGHTS' | 'EXPENSES' | 'QUOTATIONS' | 'INVOICE_DESIGNER' | 'SYSTEM_OPTIMIZER' | 'SQL_ASSISTANT' | 'TRASH' | 'FINANCIAL_PLANNING';
// ... (rest of imports)

// --- Financial Planning Types ---
export interface Budget {
  id: string; // "monthly_expense"
  category: string; // e.g., "Advertising" or "All Expenses"
  amount: number; // Target amount
  period: 'monthly' | 'quarterly' | 'yearly';
  startDate: string; // ISO
}

export interface FinancialScenario {
  id: string;
  name: string;
  description?: string;
  changes: {
    revenueChangePercent: number; // e.g. -10 for 10% drop
    expenseChangePercent: number; // e.g. +5 for 5% increase
    cogsChangePercent: number; // Cost of Goods Sold adjustment
  };
  isActive: boolean; // Is this the currently visualized scenario?
}



// ... rest
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

export interface BankAccount {
  id: string; // e.g. "BANK-1718..."
  name: string; // "SBI Current", "Axis Saving"
  accountNumber: string; // Last 4 digits or full
  type: 'SAVINGS' | 'CURRENT' | 'OD' | 'CASH';
  openingBalance: number;
  currentBalance?: number; // Calculated, or maintained
  isDefault?: boolean;
}

export interface Payment {
  id: string;
  amount: number;
  date: string; // ISO string
  method: 'CASH' | 'UPI' | 'CHEQUE' | 'RETURN_CREDIT';
  reference?: string;
  accountId?: string; // Linked Bank Account ID
}

export interface Customer {
  id: string; // Manual input
  name: string;
  phone: string;
  address: string;
  area: string;
  reference?: string;
  loyaltyPoints?: number; // New: Loyalty Points Balance
  priceTier?: 'RETAIL' | 'WHOLESALE'; // New: Customer Pricing Tier
  updatedAt?: string; // ISO 8601 Timestamp for Smart Sync
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
  updatedAt?: string; // ISO 8601 Timestamp for Smart Sync
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
  wholesalePrice?: number; // New: Wholesale Price
  gstPercent: number;
  unit?: string; // New: Unit of Measurement (Pcs, Kg, Mtr, etc.)
  image?: string; // Base64 encoded image (Main)
  updatedAt?: string; // ISO 8601 Timestamp for Smart Sync
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
  id: string;
  customerId: string;
  items: SaleItem[];
  discount: number;
  gstAmount: number;
  totalAmount: number;
  date: string; // ISO string
  payments: Payment[];
  loyaltyPointsUsed?: number; // New: Points redeemed
  loyaltyPointsEarned?: number; // New: Points awarded
  updatedAt?: string; // ISO 8601 Timestamp for Smart Sync
}

// --- New Types for Sales Management ---
export interface SaleDraft {
  customerId: string;
  items: SaleItem[];
  discount: string;
  date: string;
  paymentDetails: {
    amount: string;
    method: 'CASH' | 'UPI' | 'CHEQUE';
    date: string;
    reference: string;
  };
  editId?: string; // If editing an existing sale
}

export interface ParkedSale extends SaleDraft {
  id: string; // Draft ID
  parkedAt: number;
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
  updatedAt?: string; // For Smart Sync
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
  discount?: number; // New: Discount on purchase
  gstAmount?: number; // New: GST Amount
  date: string; // ISO string
  invoiceUrl?: string; // Legacy: For uploaded invoice (Single)
  invoiceImages?: string[]; // New: Array of base64 strings for multiple photos
  supplierInvoiceId?: string; // Manual invoice ID from supplier
  payments: Payment[];
  paymentDueDates?: string[]; // ISO date strings
  updatedAt?: string; // ISO 8601 Timestamp for Smart Sync
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
  updatedAt?: string; // For Smart Sync
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
  accountId?: string; // Paid from which account
}

export interface CustomFont {
  id: string;
  name: string; // Display name
  data: string; // Base64 encoded TTF data
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

export interface CustomSection {
  id: string;
  type: 'text-block' | 'image-block' | 'divider';
  content?: string; // Text content or Image Base64
  styles?: {
    fontSize?: number;
    fontWeight?: 'normal' | 'bold';
    align?: 'left' | 'center' | 'right';
    color?: string; // hex code
    height?: number; // for divider/image (mm)
    width?: number; // for image (mm) or percentage
    marginTop?: number; // mm
    marginBottom?: number; // mm
  };
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
    logoPosX?: number; // Absolute X position override for Logo
    logoPosY?: number; // Absolute Y position override for Logo
    qrPosition?: 'header-right' | 'details-right' | 'footer-left' | 'footer-right';
    qrPosX?: number; // Absolute X position override
    qrPosY?: number; // Absolute Y position override
    qrOverlaySize?: number; // New: Size override for QR code
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
    customSections?: CustomSection[]; // New: List of custom added sections
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
  pin?: string;
  security?: {
    pin: string;
    enabled: boolean;
    lastAttempt?: number;
  };
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
  headerColor?: string;
  gradient: string;
  font?: string;
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

export interface AppMetadataUIPreferences {
  id: 'uiPreferences';
  buttonStyle: 'rounded' | 'pill' | 'sharp';
  cardStyle: 'glass' | 'solid' | 'bordered';
  toastPosition: 'top-center' | 'top-right' | 'bottom-center' | 'bottom-right';
  density: 'comfortable' | 'compact';
  navStyle?: 'docked' | 'floating';
  fontSize?: 'small' | 'normal' | 'large';
}

export type AppMetadata = AppMetadataPin | AppMetadataBackup | AppMetadataRevenueGoal | AppMetadataLastModified | AppMetadataTheme | AppMetadataInvoiceSettings | AppMetadataNavOrder | AppMetadataQuickActions | AppMetadataUIPreferences | InvoiceTemplateConfig;

export interface Snapshot {
  id: string;
  timestamp: string; // ISO string
  name: string;
  data: any; // The exported data object
}

export interface TrashItem {
  id: string;
  originalStore: string; // StoreName
  data: any;
  deletedAt: string; // ISO String
}

// --- AI Types ---
export interface ActionItem {
  id: string;
  title: string;
  description: string;
  type: 'restock' | 'promo' | 'collect' | 'general';
  targetId?: string; // e.g. productId to restock
  priority: 'high' | 'medium' | 'low';
}

export interface AIResponse {
  businessHealthScore: number; // 0-100
  healthReason: string;
  growthAnalysis: string;
  riskAnalysis: string;
  actions: ActionItem[];
  strategy: string;
}

// --- Application State ---

export interface ToastState {
  message: string;
  show: boolean;
  type: 'success' | 'info' | 'error';
}

export interface AppState {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  returns: Return[];
  expenses: Expense[];
  quotes: Quote[];
  customFonts: CustomFont[];
  app_metadata: AppMetadata[];
  notifications: Notification[];
  audit_logs: AuditLogEntry[];
  profile: ProfileData | null;
  invoiceTemplate: InvoiceTemplateConfig;
  estimateTemplate: InvoiceTemplateConfig;
  debitNoteTemplate: InvoiceTemplateConfig;
  receiptTemplate: InvoiceTemplateConfig;
  reportTemplate: InvoiceTemplateConfig;
  invoiceSettings?: AppMetadataInvoiceSettings;

  // Multi-Account
  bankAccounts: BankAccount[];

  // Financial Planning
  budgets: Budget[];
  financialScenarios: FinancialScenario[];

  // UI Preferences
  uiPreferences: AppMetadataUIPreferences;

  toast: ToastState;
  selection: { page: Page; id: string; action?: 'edit' | 'new'; data?: any } | null;
  pin: string | null;
  theme: Theme;
  themeColor: string;
  headerColor: string;
  themeGradient: string;
  font: string;
  googleUser: GoogleUser | null;
  syncStatus: SyncStatus;
  lastSyncTime: null | number | string;
  lastLocalUpdate: number;
  devMode: boolean;
  performanceMode: boolean;
  navOrder: string[];
  quickActions: string[];
  isOnline: boolean;
  isLocked: boolean; // For App Lock

  // Sales Management State
  currentSale: SaleDraft;
  parkedSales: ParkedSale[];

  // Trash
  trash: TrashItem[];

  restoreFromFileId?: (fileId: string) => Promise<void>;
}

// --- Enterprise Reporting Types ---

export type ReportType = 'TABLE' | 'BAR' | 'LINE' | 'PIE' | 'AREA' | 'SCATTER' | 'COMPOSED' | 'KPI';

export type Aggregation = 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'NONE';

export interface ReportField {
  id: string; // "totalAmount", "customer.name"
  label: string;
  type: 'string' | 'number' | 'date' | 'currency';
  aggregation?: Aggregation;
  hidden?: boolean; // Used for calculation but not display
}

export interface ReportFilter {
  id: string; // Field ID
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'between' | 'in';
  value: any;
}

export interface ReportConfig {
  id: string;
  title: string;
  description?: string;
  dataSource: 'sales' | 'purchases' | 'inventory' | 'customers' | 'expenses';
  fields: ReportField[];
  filters: ReportFilter[];
  groupBy?: string; // Field ID to group by
  chartType: ReportType;
  createdAt: number;
}

