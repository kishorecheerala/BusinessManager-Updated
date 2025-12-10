
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useCallback, useRef } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, Notification, ProfileData, Page, AppMetadata, Theme, GoogleUser, AuditLogEntry, SyncStatus, Expense, Quote, AppMetadataInvoiceSettings, InvoiceTemplateConfig, CustomFont, PurchaseItem, AppMetadataNavOrder, AppMetadataQuickActions, AppMetadataTheme, AppMetadataUIPreferences, SaleDraft, ParkedSale, TrashItem } from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';
import { DriveService, initGoogleAuth, getUserInfo, loadGoogleScript, downloadFile } from '../utils/googleDrive';
import { getLocalDateString } from '../utils/dateUtils';

interface ToastState {
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
  
  // Sales Management State
  currentSale: SaleDraft;
  parkedSales: ParkedSale[];

  // Trash
  trash: TrashItem[];
  
  restoreFromFileId?: (fileId: string) => Promise<void>;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT_STOCK'; payload: { productId: string; change: number } }
  | { type: 'BATCH_UPDATE_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_SALE'; payload: Sale }
  | { type: 'UPDATE_SALE'; payload: { oldSale: Sale; updatedSale: Sale } }
  | { type: 'DELETE_SALE'; payload: string }
  | { type: 'ADD_PAYMENT_TO_SALE'; payload: { saleId: string; payment: any } }
  | { type: 'UPDATE_PAYMENT_IN_SALE'; payload: { saleId: string; payment: any } }
  | { type: 'ADD_PURCHASE'; payload: Purchase }
  | { type: 'UPDATE_PURCHASE'; payload: { oldPurchase: Purchase; updatedPurchase: Purchase } }
  | { type: 'DELETE_PURCHASE'; payload: string }
  | { type: 'ADD_PAYMENT_TO_PURCHASE'; payload: { purchaseId: string; payment: any } }
  | { type: 'ADD_RETURN'; payload: Return }
  | { type: 'UPDATE_RETURN'; payload: { oldReturn: Return; updatedReturn: Return } }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_QUOTE'; payload: Quote }
  | { type: 'UPDATE_QUOTE'; payload: Quote }
  | { type: 'DELETE_QUOTE'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_AS_READ'; payload: string }
  | { type: 'SET_PROFILE'; payload: ProfileData }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'SET_HEADER_COLOR'; payload: string }
  | { type: 'SET_THEME_GRADIENT'; payload: string }
  | { type: 'SET_FONT'; payload: string }
  | { type: 'UPDATE_UI_PREFERENCES'; payload: Partial<AppMetadataUIPreferences> }
  | { type: 'SET_PIN'; payload: string }
  | { type: 'SET_SELECTION'; payload: { page: Page; id: string; action?: 'edit' | 'new' } | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'info' | 'error' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_GOOGLE_USER'; payload: GoogleUser | null }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_LAST_SYNC_TIME'; payload: number }
  | { type: 'SET_LAST_BACKUP_DATE'; payload: string }
  | { type: 'ADD_CUSTOM_FONT'; payload: CustomFont }
  | { type: 'REMOVE_CUSTOM_FONT'; payload: string }
  | { type: 'SET_DOCUMENT_TEMPLATE'; payload: { type: string; config: InvoiceTemplateConfig } }
  | { type: 'UPDATE_INVOICE_SETTINGS'; payload: AppMetadataInvoiceSettings }
  | { type: 'UPDATE_NAV_ORDER'; payload: string[] }
  | { type: 'UPDATE_QUICK_ACTIONS'; payload: string[] }
  | { type: 'TOGGLE_PERFORMANCE_MODE' }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'CLEANUP_OLD_DATA' }
  | { type: 'REPLACE_COLLECTION'; payload: { storeName: StoreName; data: any[] } }
  // Sales Draft Actions
  | { type: 'UPDATE_CURRENT_SALE'; payload: Partial<SaleDraft> }
  | { type: 'PARK_CURRENT_SALE' }
  | { type: 'CLEAR_CURRENT_SALE' }
  | { type: 'RESUME_PARKED_SALE'; payload: ParkedSale }
  | { type: 'DELETE_PARKED_SALE'; payload: string }
  // Trash Actions
  | { type: 'RESTORE_FROM_TRASH'; payload: TrashItem }
  | { type: 'PERMANENTLY_DELETE_FROM_TRASH'; payload: string };

// Default Template to prevent crashes
const DEFAULT_TEMPLATE: InvoiceTemplateConfig = {
    id: 'defaultConfig',
    currencySymbol: '₹',
    dateFormat: 'DD/MM/YYYY',
    colors: { primary: '#0d9488', secondary: '#333333', text: '#000000', tableHeaderBg: '#0d9488', tableHeaderText: '#ffffff', bannerBg: '#0d9488', bannerText: '#ffffff', footerBg: '#f3f4f6', footerText: '#374151', borderColor: '#e5e7eb', alternateRowBg: '#f9fafb' },
    fonts: { headerSize: 22, bodySize: 10, titleFont: 'helvetica', bodyFont: 'helvetica' },
    layout: { margin: 10, logoSize: 25, logoPosition: 'center', logoOffsetX: 0, logoOffsetY: 0, headerAlignment: 'center', headerStyle: 'standard', footerStyle: 'standard', showWatermark: false, watermarkOpacity: 0.1, tableOptions: { hideQty: false, hideRate: false, stripedRows: false, bordered: false, compact: false } },
    content: { titleText: 'TAX INVOICE', showTerms: true, showQr: true, termsText: '', footerText: 'Thank you!', showBusinessDetails: true, showCustomerDetails: true, showSignature: true, showAmountInWords: false, showStatusStamp: false, showTaxBreakdown: false, showGst: true }
};

const DEFAULT_NAV_ORDER = [
    'DASHBOARD', 'CUSTOMERS', 'SALES', 'PURCHASES', 'PRODUCTS',
    'REPORTS', 'EXPENSES', 'RETURNS', 'QUOTATIONS', 
    'INSIGHTS', 'INVOICE_DESIGNER'
];

const DEFAULT_QUICK_ACTIONS = [
    'add_sale', 'add_customer', 'add_expense', 'add_purchase', 'add_quote', 'add_return'
];

const DEFAULT_UI_PREFS: AppMetadataUIPreferences = {
    id: 'uiPreferences',
    buttonStyle: 'rounded',
    cardStyle: 'glass',
    toastPosition: 'top-center',
    density: 'comfortable',
    navStyle: 'floating',
    fontSize: 'normal'
};

// Default empty sale draft
const DEFAULT_SALE_DRAFT: SaleDraft = {
    customerId: '',
    items: [],
    discount: '0',
    date: getLocalDateString(),
    paymentDetails: {
        amount: '',
        method: 'CASH',
        date: getLocalDateString(),
        reference: ''
    }
};

// --- Initial State Helper ---
const getLocalStorageState = () => {
    if (typeof window === 'undefined') return {};
    
    const theme = (localStorage.getItem('theme') as Theme) || 'light';
    const themeColor = localStorage.getItem('themeColor') || '#8b5cf6';
    const font = localStorage.getItem('font') || 'Inter';
    
    let themeGradient = localStorage.getItem('themeGradient');
    if (themeGradient === null) {
        themeGradient = 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)';
    } else if (themeGradient === 'none') {
        themeGradient = '';
    }

    let googleUser = null;
    try {
        const storedUser = localStorage.getItem('googleUser');
        if (storedUser) googleUser = JSON.parse(storedUser);
    } catch(e) {}

    let lastSyncTime = null;
    try {
        const storedTime = localStorage.getItem('lastSyncTime');
        if (storedTime) lastSyncTime = parseInt(storedTime, 10);
    } catch(e) {}
    
    let parkedSales = [];
    try {
        const storedDrafts = localStorage.getItem('parked_sales');
        if (storedDrafts) parkedSales = JSON.parse(storedDrafts);
    } catch(e) {}

    return { theme, themeColor, themeGradient, font, googleUser, lastSyncTime, parkedSales };
};

const localDefaults = getLocalStorageState();

const initialState: AppState = {
    customers: [],
    suppliers: [],
    products: [],
    sales: [],
    purchases: [],
    returns: [],
    expenses: [],
    quotes: [],
    customFonts: [],
    app_metadata: [],
    notifications: [],
    audit_logs: [],
    profile: null,
    invoiceTemplate: DEFAULT_TEMPLATE, 
    estimateTemplate: { ...DEFAULT_TEMPLATE, content: { ...DEFAULT_TEMPLATE.content, titleText: 'ESTIMATE' } },
    debitNoteTemplate: { ...DEFAULT_TEMPLATE, content: { ...DEFAULT_TEMPLATE.content, titleText: 'DEBIT NOTE' } },
    receiptTemplate: { ...DEFAULT_TEMPLATE, content: { ...DEFAULT_TEMPLATE.content, titleText: 'RECEIPT' } },
    reportTemplate: { ...DEFAULT_TEMPLATE, content: { ...DEFAULT_TEMPLATE.content, titleText: 'REPORT' } },
    uiPreferences: DEFAULT_UI_PREFS,
    toast: { message: '', show: false, type: 'info' },
    selection: null,
    pin: null,
    
    theme: localDefaults.theme || 'light',
    themeColor: localDefaults.themeColor || '#8b5cf6',
    headerColor: '',
    themeGradient: localDefaults.themeGradient ?? 'linear-gradient(135deg, #8b5cf6 0%, #06b6d4 100%)', 
    font: localDefaults.font || 'Inter',
    googleUser: localDefaults.googleUser || null,
    lastSyncTime: localDefaults.lastSyncTime || null,
    
    syncStatus: 'idle',
    lastLocalUpdate: 0,
    devMode: false,
    performanceMode: false,
    navOrder: DEFAULT_NAV_ORDER,
    quickActions: DEFAULT_QUICK_ACTIONS,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    
    currentSale: DEFAULT_SALE_DRAFT,
    parkedSales: localDefaults.parkedSales || [],
    trash: []
};

// Logging helper
const logAction = (state: AppState, actionType: string, details: string): AuditLogEntry => {
    return {
        id: `LOG-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user: state.googleUser?.email || state.profile?.ownerName || 'User',
        action: actionType,
        details: details
    };
};

// --- LocalStorage Helpers ---
const safeSetItem = (key: string, value: string) => {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.warn(`Failed to set ${key} in localStorage`, e);
    }
};

const safeRemoveItem = (key: string) => {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        console.warn(`Failed to remove ${key} from localStorage`, e);
    }
};

const appReducer = (state: AppState, action: Action): AppState => {
  const touch = { lastLocalUpdate: Date.now() };
  let newLog: AuditLogEntry;

  switch (action.type) {
    case 'SET_STATE': 
        return { ...state, ...action.payload };

    case 'ADD_CUSTOMER':
        const newCustomer = action.payload;
        db.saveCollection('customers', [...state.customers, newCustomer]);
        newLog = logAction(state, 'Added Customer', `Name: ${newCustomer.name}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
        return { ...state, customers: [...state.customers, newCustomer], audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'UPDATE_CUSTOMER':
        const updatedCustomers = state.customers.map(c => c.id === action.payload.id ? action.payload : c);
        db.saveCollection('customers', updatedCustomers);
        newLog = logAction(state, 'Updated Customer', `ID: ${action.payload.id}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
        return { ...state, customers: updatedCustomers, audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'ADD_SUPPLIER':
        const newSupplier = action.payload;
        db.saveCollection('suppliers', [...state.suppliers, newSupplier]);
        return { ...state, suppliers: [...state.suppliers, newSupplier], ...touch };

    case 'UPDATE_SUPPLIER':
        const updatedSuppliers = state.suppliers.map(s => s.id === action.payload.id ? action.payload : s);
        db.saveCollection('suppliers', updatedSuppliers);
        return { ...state, suppliers: updatedSuppliers, ...touch };

    case 'ADD_PRODUCT':
        const newProduct = action.payload;
        const existingProductIndex = state.products.findIndex(p => p.id === newProduct.id);
        let productsList;
        if (existingProductIndex >= 0) {
            productsList = state.products.map((p, i) => i === existingProductIndex ? { ...p, quantity: p.quantity + newProduct.quantity } : p);
        } else {
            productsList = [...state.products, newProduct];
        }
        db.saveCollection('products', productsList);
        return { ...state, products: productsList, ...touch };

    case 'UPDATE_PRODUCT_STOCK':
        const updatedStockProducts = state.products.map(p => 
            p.id === action.payload.productId ? { ...p, quantity: p.quantity + action.payload.change } : p
        );
        db.saveCollection('products', updatedStockProducts);
        return { ...state, products: updatedStockProducts, ...touch };

    case 'BATCH_UPDATE_PRODUCTS':
        const batchUpdatedProducts = state.products.map(p => {
            const update = action.payload.find(u => u.id === p.id);
            return update ? update : p;
        });
        db.saveCollection('products', batchUpdatedProducts);
        return { ...state, products: batchUpdatedProducts, ...touch };

    case 'ADD_SALE':
        const newSale = action.payload;
        
        let customersAfterSale = [...state.customers];
        const saleCustomerIdx = state.customers.findIndex(c => c.id === newSale.customerId);
        
        if (saleCustomerIdx >= 0) {
            const cust = customersAfterSale[saleCustomerIdx];
            const currentPoints = cust.loyaltyPoints || 0;
            const pointsUsed = newSale.loyaltyPointsUsed || 0;
            const pointsEarned = newSale.loyaltyPointsEarned || 0;
            
            customersAfterSale[saleCustomerIdx] = {
                ...cust,
                loyaltyPoints: Math.max(0, currentPoints - pointsUsed + pointsEarned)
            };
        }

        db.saveCollection('sales', [...state.sales, newSale]);
        db.saveCollection('customers', customersAfterSale);
        newLog = logAction(state, 'New Sale', `ID: ${newSale.id}, Amt: ${newSale.totalAmount}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
        return { ...state, sales: [...state.sales, newSale], customers: customersAfterSale, audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'UPDATE_SALE':
        const { oldSale, updatedSale } = action.payload;
        
        const stockMap: Record<string, number> = {};
        oldSale.items.forEach(item => {
            stockMap[item.productId] = (stockMap[item.productId] || 0) + item.quantity;
        });
        
        updatedSale.items.forEach(item => {
            stockMap[item.productId] = (stockMap[item.productId] || 0) - item.quantity;
        });

        const adjustedProducts = state.products.map(p => {
            if (stockMap[p.id] !== undefined) {
                return { ...p, quantity: p.quantity + stockMap[p.id] };
            }
            return p;
        });

        const updatedSalesList = state.sales.map(s => s.id === updatedSale.id ? updatedSale : s);
        
        db.saveCollection('sales', updatedSalesList);
        db.saveCollection('products', adjustedProducts);
        newLog = logAction(state, 'Updated Sale', `ID: ${updatedSale.id}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { ...state, sales: updatedSalesList, products: adjustedProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'DELETE_SALE': {
        const saleToDelete = state.sales.find(s => s.id === action.payload);
        if (!saleToDelete) return state;

        // Restore Stock
        const restoredProducts = state.products.map(p => {
            const item = saleToDelete.items.find(i => i.productId === p.id);
            return item ? { ...p, quantity: p.quantity + item.quantity } : p;
        });
        
        // Revert Loyalty Points
        let customersAfterDelete = [...state.customers];
        const delCustomerIdx = state.customers.findIndex(c => c.id === saleToDelete.customerId);
        if (delCustomerIdx >= 0) {
            const cust = customersAfterDelete[delCustomerIdx];
            const currentPoints = cust.loyaltyPoints || 0;
            const pointsUsed = saleToDelete.loyaltyPointsUsed || 0;
            const pointsEarned = saleToDelete.loyaltyPointsEarned || 0;
            
            customersAfterDelete[delCustomerIdx] = {
                ...cust,
                loyaltyPoints: Math.max(0, currentPoints + pointsUsed - pointsEarned)
            };
        }

        // Create Trash Item
        const trashSale: TrashItem = {
            id: saleToDelete.id,
            originalStore: 'sales',
            data: saleToDelete,
            deletedAt: new Date().toISOString()
        };

        db.addToTrash(trashSale);
        db.deleteFromStore('sales', saleToDelete.id);
        db.saveCollection('products', restoredProducts);
        db.saveCollection('customers', customersAfterDelete);
        
        newLog = logAction(state, 'Deleted Sale', `ID: ${action.payload}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { 
            ...state, 
            sales: state.sales.filter(s => s.id !== action.payload), 
            products: restoredProducts, 
            customers: customersAfterDelete, 
            trash: [trashSale, ...state.trash],
            audit_logs: [newLog, ...state.audit_logs], 
            ...touch 
        };
    }

    case 'ADD_PAYMENT_TO_SALE':
        const salesWithPayment = state.sales.map(s => 
            s.id === action.payload.saleId 
                ? { ...s, payments: [...(s.payments || []), action.payload.payment] } 
                : s
        );
        db.saveCollection('sales', salesWithPayment);
        return { ...state, sales: salesWithPayment, ...touch };

    case 'UPDATE_PAYMENT_IN_SALE': {
        const { saleId, payment } = action.payload;
        const salesWithUpdatedPayment = state.sales.map(s => {
            if (s.id === saleId) {
                const updatedPayments = s.payments.map(p => p.id === payment.id ? payment : p);
                return { ...s, payments: updatedPayments };
            }
            return s;
        });
        db.saveCollection('sales', salesWithUpdatedPayment);
        return { ...state, sales: salesWithUpdatedPayment, ...touch };
    }

    case 'ADD_PURCHASE':
        const newPurchase = action.payload;
        const prodsAfterPurchase = state.products.map(p => {
            const item = newPurchase.items.find(i => i.productId === p.id);
            if (item) {
                return { 
                    ...p, 
                    quantity: p.quantity + item.quantity,
                    purchasePrice: item.price,
                    salePrice: item.saleValue
                };
            }
            return p;
        });
        
        newPurchase.items.forEach(item => {
            if (!state.products.find(p => p.id === item.productId)) {
                prodsAfterPurchase.push({
                    id: item.productId,
                    name: item.productName,
                    quantity: item.quantity,
                    purchasePrice: item.price,
                    salePrice: item.saleValue,
                    gstPercent: item.gstPercent,
                });
            }
        });

        db.saveCollection('purchases', [...state.purchases, newPurchase]);
        db.saveCollection('products', prodsAfterPurchase);
        newLog = logAction(state, 'New Purchase', `ID: ${newPurchase.id}, Amt: ${newPurchase.totalAmount}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { 
            ...state, 
            purchases: [...state.purchases, newPurchase], 
            products: prodsAfterPurchase,
            audit_logs: [newLog, ...state.audit_logs], 
            ...touch 
        };

    case 'UPDATE_PURCHASE':
        const { updatedPurchase } = action.payload;
        const updatedPurchasesList = state.purchases.map(p => p.id === updatedPurchase.id ? updatedPurchase : p);
        db.saveCollection('purchases', updatedPurchasesList);
        return { ...state, purchases: updatedPurchasesList, ...touch };

    case 'DELETE_PURCHASE': {
        const purchaseToDelete = state.purchases.find(p => p.id === action.payload);
        if (!purchaseToDelete) return state;
        
        // Reduce Stock
        const reducedProducts = state.products.map(p => {
            const item = purchaseToDelete.items.find(i => i.productId === p.id);
            return item ? { ...p, quantity: Math.max(0, p.quantity - item.quantity) } : p;
        });

        // Trash Logic
        const trashPurchase: TrashItem = {
            id: purchaseToDelete.id,
            originalStore: 'purchases',
            data: purchaseToDelete,
            deletedAt: new Date().toISOString()
        };

        db.addToTrash(trashPurchase);
        db.deleteFromStore('purchases', purchaseToDelete.id);
        db.saveCollection('products', reducedProducts);
        
        newLog = logAction(state, 'Deleted Purchase', `ID: ${action.payload}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { 
            ...state, 
            purchases: state.purchases.filter(p => p.id !== action.payload), 
            products: reducedProducts, 
            trash: [trashPurchase, ...state.trash],
            audit_logs: [newLog, ...state.audit_logs], 
            ...touch 
        };
    }

    case 'ADD_PAYMENT_TO_PURCHASE':
        const purchasesWithPayment = state.purchases.map(p => 
            p.id === action.payload.purchaseId 
                ? { ...p, payments: [...(p.payments || []), action.payload.payment] } 
                : p
        );
        db.saveCollection('purchases', purchasesWithPayment);
        return { ...state, purchases: purchasesWithPayment, ...touch };

    case 'ADD_RETURN':
        const newReturn = action.payload;
        let stockAdjProducts = [...state.products];
        if (newReturn.type === 'CUSTOMER') {
            stockAdjProducts = state.products.map(p => {
                const item = newReturn.items.find(i => i.productId === p.id);
                return item ? { ...p, quantity: p.quantity + item.quantity } : p;
            });
        } else {
            stockAdjProducts = state.products.map(p => {
                const item = newReturn.items.find(i => i.productId === p.id);
                return item ? { ...p, quantity: Math.max(0, p.quantity - item.quantity) } : p;
            });
        }
        
        db.saveCollection('returns', [...state.returns, newReturn]);
        db.saveCollection('products', stockAdjProducts);
        newLog = logAction(state, 'Return Processed', `Type: ${newReturn.type}, ID: ${newReturn.id}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { ...state, returns: [...state.returns, newReturn], products: stockAdjProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'UPDATE_RETURN':
        const updatedReturns = state.returns.map(r => r.id === action.payload.updatedReturn.id ? action.payload.updatedReturn : r);
        db.saveCollection('returns', updatedReturns);
        return { ...state, returns: updatedReturns, ...touch };

    case 'ADD_EXPENSE':
        const newExpense = action.payload;
        db.saveCollection('expenses', [...state.expenses, newExpense]);
        return { ...state, expenses: [...state.expenses, newExpense], ...touch };

    case 'DELETE_EXPENSE': {
        const expenseToDelete = state.expenses.find(e => e.id === action.payload);
        if (!expenseToDelete) return state;
        
        const trashExpense: TrashItem = {
            id: expenseToDelete.id,
            originalStore: 'expenses',
            data: expenseToDelete,
            deletedAt: new Date().toISOString()
        };
        
        db.addToTrash(trashExpense);
        db.deleteFromStore('expenses', expenseToDelete.id);
        
        return { 
            ...state, 
            expenses: state.expenses.filter(e => e.id !== action.payload), 
            trash: [trashExpense, ...state.trash],
            ...touch 
        };
    }

    case 'ADD_QUOTE':
        const newQuote = action.payload;
        db.saveCollection('quotes', [...state.quotes, newQuote]);
        return { ...state, quotes: [...state.quotes, newQuote], ...touch };

    case 'UPDATE_QUOTE':
        const updatedQuotes = state.quotes.map(q => q.id === action.payload.id ? action.payload : q);
        db.saveCollection('quotes', updatedQuotes);
        return { ...state, quotes: updatedQuotes, ...touch };

    case 'DELETE_QUOTE': {
        const quoteToDelete = state.quotes.find(q => q.id === action.payload);
        if (!quoteToDelete) return state;

        const trashQuote: TrashItem = {
            id: quoteToDelete.id,
            originalStore: 'quotes',
            data: quoteToDelete,
            deletedAt: new Date().toISOString()
        };
        
        db.addToTrash(trashQuote);
        db.deleteFromStore('quotes', quoteToDelete.id);

        return { 
            ...state, 
            quotes: state.quotes.filter(q => q.id !== action.payload),
            trash: [trashQuote, ...state.trash],
            ...touch 
        };
    }

    case 'RESTORE_FROM_TRASH': {
        const trashItem = action.payload;
        const storeName = trashItem.originalStore as StoreName;
        const itemData = trashItem.data;
        
        // Add back to original store
        db.saveCollection(storeName, [...(state as any)[storeName], itemData]);
        
        // Remove from trash
        db.deleteFromStore('trash', trashItem.id);
        
        return {
            ...state,
            [storeName]: [...(state as any)[storeName], itemData],
            trash: state.trash.filter(t => t.id !== trashItem.id),
            ...touch
        };
    }

    case 'PERMANENTLY_DELETE_FROM_TRASH':
        db.deleteFromStore('trash', action.payload);
        return {
            ...state,
            trash: state.trash.filter(t => t.id !== action.payload),
            ...touch
        };

    case 'ADD_NOTIFICATION':
        const newNotif = action.payload;
        db.saveCollection('notifications', [newNotif, ...state.notifications]);
        return { ...state, notifications: [newNotif, ...state.notifications] };

    case 'MARK_NOTIFICATION_AS_READ':
        const updatedNotifs = state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n);
        db.saveCollection('notifications', updatedNotifs);
        return { ...state, notifications: updatedNotifs };

    case 'SET_PROFILE':
        db.saveCollection('profile', [action.payload]);
        return { ...state, profile: action.payload, ...touch };

    case 'SET_THEME':
        const themeMeta: AppMetadataTheme = {
            id: 'themeSettings',
            theme: action.payload,
            color: state.themeColor,
            headerColor: state.headerColor,
            gradient: state.themeGradient,
            font: state.font
        };
        const metaWithoutTheme = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutTheme, themeMeta]);
        return { ...state, theme: action.payload, app_metadata: [...metaWithoutTheme, themeMeta], ...touch };

    case 'SET_THEME_COLOR':
        const themeMetaColor: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: action.payload,
            headerColor: state.headerColor,
            gradient: state.themeGradient,
            font: state.font
        };
        const metaWithoutThemeColor = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeColor, themeMetaColor]);
        return { ...state, themeColor: action.payload, app_metadata: [...metaWithoutThemeColor, themeMetaColor], ...touch };

    case 'SET_HEADER_COLOR':
        const themeMetaHeader: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: state.themeColor,
            headerColor: action.payload,
            gradient: state.themeGradient,
            font: state.font
        };
        const metaWithoutThemeHeader = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeHeader, themeMetaHeader]);
        return { ...state, headerColor: action.payload, app_metadata: [...metaWithoutThemeHeader, themeMetaHeader], ...touch };

    case 'SET_THEME_GRADIENT':
        const themeMetaGrad: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: state.themeColor,
            headerColor: state.headerColor,
            gradient: action.payload,
            font: state.font
        };
        const metaWithoutThemeGrad = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeGrad, themeMetaGrad]);
        return { ...state, themeGradient: action.payload, app_metadata: [...metaWithoutThemeGrad, themeMetaGrad], ...touch };

    case 'SET_FONT':
        const themeMetaFont: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: state.themeColor,
            headerColor: state.headerColor,
            gradient: state.themeGradient,
            font: action.payload
        };
        const metaWithoutThemeFont = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeFont, themeMetaFont]);
        return { ...state, font: action.payload, app_metadata: [...metaWithoutThemeFont, themeMetaFont], ...touch };

    case 'UPDATE_UI_PREFERENCES':
        const newPrefs = { ...state.uiPreferences, ...action.payload };
        const metaWithoutPrefs = state.app_metadata.filter(m => m.id !== 'uiPreferences');
        newPrefs.id = 'uiPreferences';
        db.saveCollection('app_metadata', [...metaWithoutPrefs, newPrefs]);
        return { ...state, uiPreferences: newPrefs, app_metadata: [...metaWithoutPrefs, newPrefs], ...touch };

    case 'SET_PIN':
        const pinMeta: AppMetadata = { id: 'securityPin', pin: action.payload };
        db.saveCollection('app_metadata', [...state.app_metadata.filter(m => m.id !== 'securityPin'), pinMeta]);
        return { ...state, pin: action.payload };

    case 'SET_SELECTION':
        return { ...state, selection: action.payload };
    case 'CLEAR_SELECTION':
        return { ...state, selection: null };

    case 'SHOW_TOAST':
        return { ...state, toast: { message: action.payload.message, show: true, type: action.payload.type || 'info' } };
    case 'HIDE_TOAST':
        return { ...state, toast: { ...state.toast, show: false } };

    case 'SET_GOOGLE_USER':
        if (action.payload) {
            safeSetItem('googleUser', JSON.stringify(action.payload));
        } else {
            safeRemoveItem('googleUser');
        }
        return { ...state, googleUser: action.payload };
    case 'SET_SYNC_STATUS':
        return { ...state, syncStatus: action.payload };
    case 'SET_LAST_SYNC_TIME':
        safeSetItem('lastSyncTime', String(action.payload));
        return { ...state, lastSyncTime: action.payload };
    
    case 'SET_LAST_BACKUP_DATE':
        const newMeta: AppMetadata[] = state.app_metadata.filter(m => m.id !== 'lastBackup');
        newMeta.push({ id: 'lastBackup', date: action.payload });
        db.saveCollection('app_metadata', newMeta);
        return { ...state, app_metadata: newMeta };

    case 'ADD_CUSTOM_FONT':
        const newFonts = [...state.customFonts, action.payload];
        db.saveCollection('custom_fonts', newFonts);
        return { ...state, customFonts: newFonts };
    
    case 'REMOVE_CUSTOM_FONT':
        const filteredFonts = state.customFonts.filter(f => f.id !== action.payload);
        db.saveCollection('custom_fonts', filteredFonts);
        return { ...state, customFonts: filteredFonts };

    case 'SET_DOCUMENT_TEMPLATE':
        const { type, config } = action.payload;
        const tmplKey = type === 'INVOICE' ? 'invoiceTemplate' : 
                        type === 'ESTIMATE' ? 'estimateTemplate' :
                        type === 'DEBIT_NOTE' ? 'debitNoteTemplate' :
                        type === 'RECEIPT' ? 'receiptTemplate' : 'reportTemplate';
        
        const templateMeta: AppMetadata = { ...config, id: `${tmplKey}Config` as any };
        const otherMeta = state.app_metadata.filter(m => m.id !== templateMeta.id);
        db.saveCollection('app_metadata', [...otherMeta, templateMeta]);
        
        return { ...state, [tmplKey]: config, app_metadata: [...otherMeta, templateMeta] };

    case 'UPDATE_INVOICE_SETTINGS':
        const invSettings: AppMetadataInvoiceSettings = { id: 'invoiceSettings', ...action.payload };
        const metaWithoutSettings = state.app_metadata.filter(m => m.id !== 'invoiceSettings');
        db.saveCollection('app_metadata', [...metaWithoutSettings, invSettings]);
        return { ...state, invoiceSettings: invSettings, app_metadata: [...metaWithoutSettings, invSettings] };

    case 'UPDATE_NAV_ORDER':
        const navOrderMeta: AppMetadataNavOrder = { id: 'navOrder', order: action.payload };
        const metaWithoutNav = state.app_metadata.filter(m => m.id !== 'navOrder');
        db.saveCollection('app_metadata', [...metaWithoutNav, navOrderMeta]);
        return { ...state, navOrder: action.payload, app_metadata: [...metaWithoutNav, navOrderMeta], ...touch };

    case 'UPDATE_QUICK_ACTIONS':
        const qaMeta: AppMetadataQuickActions = { id: 'quickActions', actions: action.payload };
        const metaWithoutQA = state.app_metadata.filter(m => m.id !== 'quickActions');
        db.saveCollection('app_metadata', [...metaWithoutQA, qaMeta]);
        return { ...state, quickActions: action.payload, app_metadata: [...metaWithoutQA, qaMeta], ...touch };

    case 'TOGGLE_PERFORMANCE_MODE':
        return { ...state, performanceMode: !state.performanceMode };

    case 'SET_ONLINE_STATUS':
        return { ...state, isOnline: action.payload };

    case 'CLEANUP_OLD_DATA':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const cleanNotifs = state.notifications.filter(n => new Date(n.createdAt) > thirtyDaysAgo);
        const cleanLogs = state.audit_logs.filter(l => new Date(l.timestamp) > thirtyDaysAgo);
        
        db.saveCollection('notifications', cleanNotifs);
        db.saveCollection('audit_logs', cleanLogs);
        
        return { ...state, notifications: cleanNotifs, audit_logs: cleanLogs };

    case 'REPLACE_COLLECTION': {
        const { storeName, data } = action.payload;
        if (storeName && data) {
            db.saveCollection(storeName, data);
            return { ...state, [storeName]: data, ...touch };
        }
        return state;
    }
        
    case 'UPDATE_CURRENT_SALE':
        return { ...state, currentSale: { ...state.currentSale, ...action.payload } };

    case 'PARK_CURRENT_SALE':
        const draftToPark: ParkedSale = { 
            ...state.currentSale, 
            id: `DRAFT-${Date.now()}`,
            parkedAt: Date.now() 
        };
        const newParkedList = [draftToPark, ...state.parkedSales];
        safeSetItem('parked_sales', JSON.stringify(newParkedList));
        
        return { 
            ...state, 
            parkedSales: newParkedList,
            currentSale: {
                customerId: '',
                items: [],
                discount: '0',
                date: getLocalDateString(),
                paymentDetails: {
                    amount: '',
                    method: 'CASH',
                    date: getLocalDateString(),
                    reference: ''
                }
            } 
        };

    case 'CLEAR_CURRENT_SALE':
        return { 
            ...state, 
            currentSale: {
                customerId: '',
                items: [],
                discount: '0',
                date: getLocalDateString(),
                paymentDetails: {
                    amount: '',
                    method: 'CASH',
                    date: getLocalDateString(),
                    reference: ''
                }
            } 
        };

    case 'RESUME_PARKED_SALE':
        const draftToResume = action.payload;
        const remainingDrafts = state.parkedSales.filter(d => d.id !== draftToResume.id);
        safeSetItem('parked_sales', JSON.stringify(remainingDrafts));
        
        return {
            ...state,
            parkedSales: remainingDrafts,
            currentSale: draftToResume
        };

    case 'DELETE_PARKED_SALE':
        const filteredDrafts = state.parkedSales.filter(d => d.id !== action.payload);
        safeSetItem('parked_sales', JSON.stringify(filteredDrafts));
        return { ...state, parkedSales: filteredDrafts };

    default:
        return state;
  }
};

export const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<any>;
  isDbLoaded: boolean;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  googleSignIn: (options?: { forceConsent?: boolean }) => void;
  googleSignOut: () => void;
  syncData: () => Promise<void>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
    const [isDbLoaded, setIsDbLoaded] = useState(false);
    const tokenClientRef = useRef<any>(null);
    const stateRef = useRef(state);

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
        dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    }, []);

    useEffect(() => {
        const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
        const handleOffline = () => {
            dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
            showToast("You are offline. Sync and AI features are unavailable.", "info");
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    useEffect(() => {
        const loadData = async () => {
            const customers = await db.getAll('customers');
            const suppliers = await db.getAll('suppliers');
            const products = await db.getAll('products');
            const sales = await db.getAll('sales');
            const purchases = await db.getAll('purchases');
            const returns = await db.getAll('returns');
            const expenses = await db.getAll('expenses');
            const quotes = await db.getAll('quotes');
            const customFonts = await db.getAll('custom_fonts');
            const app_metadata = await db.getAll('app_metadata');
            const notifications = await db.getAll('notifications');
            const profileData = await db.getAll('profile');
            const audit_logs = await db.getAll('audit_logs');
            const trash = await db.getAll('trash');

            const pinMeta = app_metadata.find(m => m.id === 'securityPin') as any;
            const pin = pinMeta ? pinMeta.pin : null;
            
            const invSettings = app_metadata.find(m => m.id === 'invoiceSettings') as AppMetadataInvoiceSettings;
            const navOrderMeta = app_metadata.find(m => m.id === 'navOrder') as AppMetadataNavOrder;
            const quickActionsMeta = app_metadata.find(m => m.id === 'quickActions') as AppMetadataQuickActions;
            const themeMeta = app_metadata.find(m => m.id === 'themeSettings') as AppMetadataTheme;
            const uiPrefsMeta = app_metadata.find(m => m.id === 'uiPreferences') as AppMetadataUIPreferences;

            const invoiceTemplate = (app_metadata.find(m => m.id === 'invoiceTemplateConfig') as InvoiceTemplateConfig) || initialState.invoiceTemplate;
            const estimateTemplate = (app_metadata.find(m => m.id === 'estimateTemplateConfig') as InvoiceTemplateConfig) || initialState.estimateTemplate;
            const debitNoteTemplate = (app_metadata.find(m => m.id === 'debitNoteTemplateConfig') as InvoiceTemplateConfig) || initialState.debitNoteTemplate;
            const receiptTemplate = (app_metadata.find(m => m.id === 'receiptTemplateConfig') as InvoiceTemplateConfig) || initialState.receiptTemplate;
            const reportTemplate = (app_metadata.find(m => m.id === 'reportTemplateConfig') as InvoiceTemplateConfig) || initialState.reportTemplate;

            const loadedTheme = themeMeta?.theme || state.theme;
            const loadedColor = themeMeta?.color || state.themeColor;
            const loadedHeaderColor = themeMeta?.headerColor || state.headerColor;
            const loadedFont = themeMeta?.font || state.font;
            let loadedGradient = themeMeta?.gradient;
            
            if (loadedGradient === undefined) {
               loadedGradient = state.themeGradient;
            }

            dispatch({
                type: 'SET_STATE',
                payload: {
                    customers, suppliers, products, sales, purchases, returns, expenses, quotes, customFonts,
                    app_metadata, notifications, audit_logs, trash,
                    profile: profileData[0] || null,
                    pin,
                    invoiceSettings: invSettings,
                    navOrder: navOrderMeta ? navOrderMeta.order : DEFAULT_NAV_ORDER,
                    quickActions: quickActionsMeta ? quickActionsMeta.actions : DEFAULT_QUICK_ACTIONS,
                    invoiceTemplate, estimateTemplate, debitNoteTemplate, receiptTemplate, reportTemplate,
                    uiPreferences: uiPrefsMeta || DEFAULT_UI_PREFS,
                    theme: loadedTheme,
                    themeColor: loadedColor,
                    headerColor: loadedHeaderColor,
                    themeGradient: loadedGradient,
                    font: loadedFont
                }
            });
            setIsDbLoaded(true);
        };
        loadData();
    }, []);

    const handleGoogleLoginResponse = async (response: any) => {
        if (response.access_token) {
            const userInfo = await getUserInfo(response.access_token);
            const expiresAt = Date.now() + (response.expires_in * 1000);
            
            const user: GoogleUser = {
                name: userInfo.name,
                email: userInfo.email,
                picture: userInfo.picture,
                accessToken: response.access_token,
                expiresAt: expiresAt
            };
            dispatch({ type: 'SET_GOOGLE_USER', payload: user });
            showToast("Signed in successfully!", 'success');
    
            // If signing in from onboarding (no profile), attempt a restore.
            // Otherwise, perform a normal background sync.
            const profileExists = stateRef.current.profile && stateRef.current.profile.name;
            
            if (!profileExists) {
                showToast("Checking for cloud backup...", 'info');
                try {
                    const cloudData = await DriveService.read(user.accessToken);
                    if (cloudData && cloudData.profile && cloudData.profile.length > 0) {
                        showToast("Backup found! Restoring data...", 'success');
                        await db.importData(cloudData); // Wipes local and imports
                        // Robustly reload to ensure all state is correctly initialized
                        setTimeout(() => window.location.reload(), 1500);
                    } else {
                        showToast("No cloud backup found. Please complete the setup.", 'info');
                    }
                } catch (e) {
                    console.error("Restore on sign-in failed", e);
                    showToast("Failed to check for backup. Please complete setup.", 'error');
                }
            } else {
                // Regular sync for existing users
                setTimeout(() => syncData(), 1000);
            }
        }
    };

    const googleSignIn = (options?: { forceConsent?: boolean }) => {
        if (!tokenClientRef.current) {
            loadGoogleScript()
                .then(() => {
                    tokenClientRef.current = initGoogleAuth(handleGoogleLoginResponse);
                    const prompt = options?.forceConsent ? 'consent' : ''; 
                    tokenClientRef.current.requestAccessToken({ prompt });
                })
                .catch(err => {
                    console.error("Failed to load Google Script", err);
                    showToast("Failed to load Google Sign-In.", 'error');
                });
        } else {
             const prompt = options?.forceConsent ? 'consent' : ''; 
             tokenClientRef.current.requestAccessToken({ prompt });
        }
    };

    const googleSignOut = () => {
        if ((window as any).google) {
            (window as any).google.accounts.oauth2.revoke(state.googleUser?.accessToken, () => {
                console.log('Consent revoked');
            });
        }
        dispatch({ type: 'SET_GOOGLE_USER', payload: null });
        showToast("Signed out.", 'info');
    };

    const syncData = async () => {
        if (!stateRef.current.googleUser || !stateRef.current.googleUser.accessToken) {
            showToast("Please sign in to sync.", 'error');
            return;
        }

        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        try {
            // 1. Read Cloud Data
            const cloudData = await DriveService.read(stateRef.current.googleUser.accessToken);
            
            // 2. Merge Strategies
            if (cloudData) {
                await db.mergeData(cloudData);
            }

            // 3. Re-read Local Data to reflect merges
            // Re-fetch everything from DB after merge to get current state for upload
            const freshData = await db.exportData();
            
            // 4. Write to Cloud
            await DriveService.write(stateRef.current.googleUser.accessToken, freshData);
            
            // 5. Update State UI
            const time = Date.now();
            dispatch({ type: 'SET_LAST_SYNC_TIME', payload: time });
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
            
            if (cloudData) {
                showToast("Sync complete! Applying changes...", 'success');
                // Reloading the app is the most robust way to ensure all state is updated from the newly merged DB.
                setTimeout(() => {
                    window.location.reload();
                }, 1500); // Give user a moment to see the toast.
            } else {
                // If no cloud data, we just wrote local data to cloud, no need to reload.
                showToast("Sync complete!", 'success');
            }

        } catch (error: any) {
            console.error("Sync failed", error);

            // Handle Auth Errors (401/403)
            const errMsg = error?.message || '';
            if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Token')) {
                dispatch({ type: 'SET_GOOGLE_USER', payload: null });
                showToast("Session expired. Please sign in again.", 'error');
                dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
                return;
            }

            dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
            showToast("Sync failed. Check connection.", 'error');
        }
    };

    // ... restore function implementation ...
    const restoreFromFileId = async (fileId: string) => {
        if (!stateRef.current.googleUser?.accessToken) return;
        try {
            const data = await downloadFile(stateRef.current.googleUser.accessToken, fileId);
            if (data) {
                await db.importData(data);
                window.location.reload();
            }
        } catch (e) {
            console.error(e);
            showToast("Restore failed", 'error');
        }
    };

    return (
        <AppContext.Provider value={{ state: { ...state, restoreFromFileId }, dispatch, isDbLoaded, showToast, googleSignIn, googleSignOut, syncData }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
