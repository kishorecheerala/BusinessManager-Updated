


import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useCallback, useRef } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, BeforeInstallPromptEvent, Notification, ProfileData, Page, AppMetadata, Theme, GoogleUser, AuditLogEntry, SyncStatus, Expense, Quote, AppMetadataInvoiceSettings, InvoiceTemplateConfig, CustomFont, PurchaseItem, AppMetadataNavOrder, AppMetadataQuickActions, AppMetadataTheme } from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';
import { DriveService, initGoogleAuth, getUserInfo, loadGoogleScript, downloadFile } from '../utils/googleDrive';

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
  toast: ToastState;
  selection: { page: Page; id: string; action?: 'edit' | 'new'; data?: any } | null;
  installPromptEvent: BeforeInstallPromptEvent | null;
  pin: string | null;
  theme: Theme;
  themeColor: string;
  themeGradient: string;
  googleUser: GoogleUser | null;
  syncStatus: SyncStatus;
  lastSyncTime: number | null;
  lastLocalUpdate: number;
  devMode: boolean;
  performanceMode: boolean;
  navOrder: string[]; // List of page IDs in order
  quickActions: string[]; // List of Quick Action IDs
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
  | { type: 'SET_THEME_GRADIENT'; payload: string }
  | { type: 'SET_PIN'; payload: string }
  | { type: 'SET_SELECTION'; payload: { page: Page; id: string; action?: 'edit' | 'new' } | null }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'info' | 'error' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_INSTALL_PROMPT_EVENT'; payload: BeforeInstallPromptEvent | null }
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
  | { type: 'CLEANUP_OLD_DATA' }
  | { type: 'REPLACE_COLLECTION'; payload: { storeName: StoreName; data: any[] } };

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
    'DASHBOARD', 'CUSTOMERS', 'SALES', 'PURCHASES', 
    'INSIGHTS', 'REPORTS', 'PRODUCTS', 'EXPENSES', 'RETURNS', 'QUOTATIONS', 'INVOICE_DESIGNER', 'SYSTEM_OPTIMIZER'
];

const DEFAULT_QUICK_ACTIONS = [
    'add_sale', 'add_customer', 'add_expense', 'add_purchase', 'add_quote', 'add_return'
];

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
    toast: { message: '', show: false, type: 'info' },
    selection: null,
    installPromptEvent: null,
    pin: null,
    theme: 'light',
    themeColor: '#0d9488',
    themeGradient: 'linear-gradient(135deg, #0d9488 0%, #2563eb 100%)', // Default Oceanic Gradient
    googleUser: null,
    syncStatus: 'idle',
    lastSyncTime: null,
    lastLocalUpdate: 0,
    devMode: false,
    performanceMode: false,
    navOrder: DEFAULT_NAV_ORDER,
    quickActions: DEFAULT_QUICK_ACTIONS
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

const safeGetItem = (key: string): string | null => {
    try {
        return localStorage.getItem(key);
    } catch (e) {
        console.warn(`Failed to get ${key} from localStorage`, e);
        return null;
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
        db.saveCollection('sales', [...state.sales, newSale]);
        newLog = logAction(state, 'New Sale', `ID: ${newSale.id}, Amt: ${newSale.totalAmount}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
        return { ...state, sales: [...state.sales, newSale], audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'UPDATE_SALE':
        const { oldSale, updatedSale } = action.payload;
        
        // 1. Revert stock for old items
        const stockMap: Record<string, number> = {};
        oldSale.items.forEach(item => {
            stockMap[item.productId] = (stockMap[item.productId] || 0) + item.quantity;
        });
        
        // 2. Deduct stock for new items
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

    case 'DELETE_SALE':
        const saleToDelete = state.sales.find(s => s.id === action.payload);
        if (!saleToDelete) return state;

        // Restore stock
        const restoredProducts = state.products.map(p => {
            const item = saleToDelete.items.find(i => i.productId === p.id);
            return item ? { ...p, quantity: p.quantity + item.quantity } : p;
        });

        const filteredSales = state.sales.filter(s => s.id !== action.payload);
        db.saveCollection('sales', filteredSales);
        db.saveCollection('products', restoredProducts);
        
        newLog = logAction(state, 'Deleted Sale', `ID: ${action.payload}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { ...state, sales: filteredSales, products: restoredProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

    case 'ADD_PAYMENT_TO_SALE':
        const salesWithPayment = state.sales.map(s => 
            s.id === action.payload.saleId 
                ? { ...s, payments: [...(s.payments || []), action.payload.payment] } 
                : s
        );
        db.saveCollection('sales', salesWithPayment);
        return { ...state, sales: salesWithPayment, ...touch };

    case 'ADD_PURCHASE':
        const newPurchase = action.payload;
        // Update Product Stock (logic moved from products page to here for consistency)
        // Note: ProductsPage might also dispatch ADD_PRODUCT, handled idempotently
        const prodsAfterPurchase = state.products.map(p => {
            const item = newPurchase.items.find(i => i.productId === p.id);
            if (item) {
                // Update quantity and costs
                return { 
                    ...p, 
                    quantity: p.quantity + item.quantity,
                    purchasePrice: item.price,
                    salePrice: item.saleValue
                };
            }
            return p;
        });
        
        // Handle strictly new products that don't exist yet
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
        const { oldPurchase, updatedPurchase } = action.payload;
        // Basic update - stock adjustments for edits are complex, assuming simple overwrite for now or handle manually
        const updatedPurchasesList = state.purchases.map(p => p.id === updatedPurchase.id ? updatedPurchase : p);
        db.saveCollection('purchases', updatedPurchasesList);
        return { ...state, purchases: updatedPurchasesList, ...touch };

    case 'DELETE_PURCHASE':
        const purchaseToDelete = state.purchases.find(p => p.id === action.payload);
        if (!purchaseToDelete) return state;
        
        // Reduce stock
        const reducedProducts = state.products.map(p => {
            const item = purchaseToDelete.items.find(i => i.productId === p.id);
            // Ensure non-negative stock? Or allow negative to indicate error?
            return item ? { ...p, quantity: Math.max(0, p.quantity - item.quantity) } : p;
        });

        const filteredPurchases = state.purchases.filter(p => p.id !== action.payload);
        db.saveCollection('purchases', filteredPurchases);
        db.saveCollection('products', reducedProducts);
        newLog = logAction(state, 'Deleted Purchase', `ID: ${action.payload}`);
        db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

        return { ...state, purchases: filteredPurchases, products: reducedProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

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
        // Adjust Stock based on Return Type
        let stockAdjProducts = [...state.products];
        if (newReturn.type === 'CUSTOMER') {
            // Customer returned item -> Increase Stock
            stockAdjProducts = state.products.map(p => {
                const item = newReturn.items.find(i => i.productId === p.id);
                return item ? { ...p, quantity: p.quantity + item.quantity } : p;
            });
        } else {
            // Returned to Supplier -> Decrease Stock
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
        // Complex to handle stock reversion, implementing simple replace for now
        const updatedReturns = state.returns.map(r => r.id === action.payload.updatedReturn.id ? action.payload.updatedReturn : r);
        db.saveCollection('returns', updatedReturns);
        return { ...state, returns: updatedReturns, ...touch };

    case 'ADD_EXPENSE':
        const newExpense = action.payload;
        db.saveCollection('expenses', [...state.expenses, newExpense]);
        return { ...state, expenses: [...state.expenses, newExpense], ...touch };

    case 'DELETE_EXPENSE':
        const filteredExpenses = state.expenses.filter(e => e.id !== action.payload);
        db.saveCollection('expenses', filteredExpenses);
        return { ...state, expenses: filteredExpenses, ...touch };

    case 'ADD_QUOTE':
        const newQuote = action.payload;
        db.saveCollection('quotes', [...state.quotes, newQuote]);
        return { ...state, quotes: [...state.quotes, newQuote], ...touch };

    case 'UPDATE_QUOTE':
        const updatedQuotes = state.quotes.map(q => q.id === action.payload.id ? action.payload : q);
        db.saveCollection('quotes', updatedQuotes);
        return { ...state, quotes: updatedQuotes, ...touch };

    case 'DELETE_QUOTE':
        const filteredQuotes = state.quotes.filter(q => q.id !== action.payload);
        db.saveCollection('quotes', filteredQuotes);
        return { ...state, quotes: filteredQuotes, ...touch };

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

    // Update Theme actions to ALSO save to app_metadata so they sync to cloud
    case 'SET_THEME':
        const themeMeta: AppMetadataTheme = {
            id: 'themeSettings',
            theme: action.payload,
            color: state.themeColor,
            gradient: state.themeGradient
        };
        const metaWithoutTheme = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutTheme, themeMeta]);
        return { ...state, theme: action.payload, app_metadata: [...metaWithoutTheme, themeMeta], ...touch };

    case 'SET_THEME_COLOR':
        const themeMetaColor: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: action.payload,
            gradient: state.themeGradient
        };
        const metaWithoutThemeColor = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeColor, themeMetaColor]);
        return { ...state, themeColor: action.payload, app_metadata: [...metaWithoutThemeColor, themeMetaColor], ...touch };

    case 'SET_THEME_GRADIENT':
        const themeMetaGrad: AppMetadataTheme = {
            id: 'themeSettings',
            theme: state.theme,
            color: state.themeColor,
            gradient: action.payload
        };
        const metaWithoutThemeGrad = state.app_metadata.filter(m => m.id !== 'themeSettings');
        db.saveCollection('app_metadata', [...metaWithoutThemeGrad, themeMetaGrad]);
        return { ...state, themeGradient: action.payload, app_metadata: [...metaWithoutThemeGrad, themeMetaGrad], ...touch };

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

    case 'SET_INSTALL_PROMPT_EVENT':
        return { ...state, installPromptEvent: action.payload };

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
        // In a real app, you might save this to specific stores or a single config store
        // For now, we update state and maybe persist to app_metadata or separate store
        const tmplKey = type === 'INVOICE' ? 'invoiceTemplate' : 
                        type === 'ESTIMATE' ? 'estimateTemplate' :
                        type === 'DEBIT_NOTE' ? 'debitNoteTemplate' :
                        type === 'RECEIPT' ? 'receiptTemplate' : 'reportTemplate';
        
        // Persist to app_metadata for simplicity in this implementation
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

    case 'CLEANUP_OLD_DATA':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const cleanNotifs = state.notifications.filter(n => new Date(n.createdAt) > thirtyDaysAgo);
        const cleanLogs = state.audit_logs.filter(l => new Date(l.timestamp) > thirtyDaysAgo);
        
        db.saveCollection('notifications', cleanNotifs);
        db.saveCollection('audit_logs', cleanLogs);
        
        return { ...state, notifications: cleanNotifs, audit_logs: cleanLogs };

    case 'REPLACE_COLLECTION':
        // Handle bulk import
        const { storeName, data } = action.payload;
        if (storeName && data) {
            db.saveCollection(storeName, data);
            return { ...state, [storeName]: data, ...touch };
        }
        return state;

    default:
        return state;
  }
};

const AppContext = createContext<{
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

    // Keep stateRef up to date for async access in token callbacks
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // --- Toast Logic ---
    const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => {
        dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
        // The Toast component handles its own timeout logic
    }, []);

    // --- Load Data from IDB on Mount ---
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

            // Parse Metadata
            const pinMeta = app_metadata.find(m => m.id === 'securityPin') as any;
            const pin = pinMeta ? pinMeta.pin : null;
            
            const invSettings = app_metadata.find(m => m.id === 'invoiceSettings') as AppMetadataInvoiceSettings;
            const navOrderMeta = app_metadata.find(m => m.id === 'navOrder') as AppMetadataNavOrder;
            const quickActionsMeta = app_metadata.find(m => m.id === 'quickActions') as AppMetadataQuickActions;
            const themeMeta = app_metadata.find(m => m.id === 'themeSettings') as AppMetadataTheme;

            // Load Templates from Metadata or default to DEFAULT_TEMPLATE values if missing
            const invoiceTemplate = (app_metadata.find(m => m.id === 'invoiceTemplateConfig') as InvoiceTemplateConfig) || initialState.invoiceTemplate;
            const estimateTemplate = (app_metadata.find(m => m.id === 'estimateTemplateConfig') as InvoiceTemplateConfig) || initialState.estimateTemplate;
            const debitNoteTemplate = (app_metadata.find(m => m.id === 'debitNoteTemplateConfig') as InvoiceTemplateConfig) || initialState.debitNoteTemplate;
            const receiptTemplate = (app_metadata.find(m => m.id === 'receiptTemplateConfig') as InvoiceTemplateConfig) || initialState.receiptTemplate;
            const reportTemplate = (app_metadata.find(m => m.id === 'reportTemplateConfig') as InvoiceTemplateConfig) || initialState.reportTemplate;

            // Restore Google User & Sync Time from LocalStorage safely
            const storedUser = safeGetItem('googleUser');
            const storedSyncTime = safeGetItem('lastSyncTime');
            let googleUser = null;
            let lastSyncTime = null;

            try {
                googleUser = storedUser ? JSON.parse(storedUser) : null;
            } catch(e) { console.error("Failed to parse stored user", e); }

            try {
                // Ensure lastSyncTime is an integer
                lastSyncTime = storedSyncTime ? parseInt(storedSyncTime, 10) : null;
            } catch(e) { console.error("Failed to parse last sync time", e); }

            // Theme Preferences: Prioritize metadata from DB (cloud sync), fall back to localStorage/initial
            // BUT ensure gradient default if null
            const loadedTheme = themeMeta?.theme || state.theme;
            const loadedColor = themeMeta?.color || state.themeColor;
            let loadedGradient = themeMeta?.gradient;
            
            // If DB didn't have preference, and localStorage doesn't either, use Default Oceanic
            if (loadedGradient === undefined) {
               const lsGradient = safeGetItem('themeGradient');
               loadedGradient = lsGradient || initialState.themeGradient;
            }

            dispatch({
                type: 'SET_STATE',
                payload: {
                    customers, suppliers, products, sales, purchases, returns, expenses, quotes, customFonts,
                    app_metadata, notifications, audit_logs,
                    profile: profileData[0] || null,
                    pin,
                    invoiceSettings: invSettings,
                    navOrder: navOrderMeta ? navOrderMeta.order : DEFAULT_NAV_ORDER,
                    quickActions: quickActionsMeta ? quickActionsMeta.actions : DEFAULT_QUICK_ACTIONS,
                    invoiceTemplate, estimateTemplate, debitNoteTemplate, receiptTemplate, reportTemplate,
                    googleUser, lastSyncTime,
                    theme: loadedTheme,
                    themeColor: loadedColor,
                    themeGradient: loadedGradient
                }
            });
            setIsDbLoaded(true);
        };
        loadData();
    }, []);

    // --- Google Drive Sync Logic ---
    const handleGoogleLoginResponse = async (response: any) => {
        if (response.access_token) {
            const userInfo = await getUserInfo(response.access_token);
            // Calculate expiry (expires_in is in seconds, usually 3599)
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
        }
    };

    const googleSignIn = (options?: { forceConsent?: boolean }) => {
        loadGoogleScript().then(() => {
            // Initialize token client if not exists
            if (!tokenClientRef.current) {
                tokenClientRef.current = initGoogleAuth(handleGoogleLoginResponse);
            }
            
            if (options?.forceConsent) {
                // @ts-ignore
                tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
            } else {
                tokenClientRef.current.requestAccessToken();
            }
        }).catch(err => {
            console.error("Google Script Load Error:", err);
            showToast("Failed to load Google Sign-In", 'error');
        });
    };

    const googleSignOut = () => {
        const token = state.googleUser?.accessToken;
        if (token && (window as any).google) {
            (window as any).google.accounts.oauth2.revoke(token, () => {
                console.log('Access token revoked');
            });
        }
        dispatch({ type: 'SET_GOOGLE_USER', payload: null });
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
        showToast("Signed out.");
    };

    // Helper to check token validity and refresh if needed
    const ensureValidToken = async (): Promise<string | null> => {
        const currentUser = stateRef.current.googleUser;
        if (!currentUser) return null;

        // Check if token is expired or about to expire (within 5 mins)
        const isExpired = !currentUser.expiresAt || Date.now() > (currentUser.expiresAt - 5 * 60 * 1000);

        if (!isExpired) {
            return currentUser.accessToken;
        }

        console.log("Token expired, refreshing...");
        
        // Return a promise that resolves when the token callback fires
        return new Promise((resolve) => {
            // Re-init client with a one-time callback for this request
            // Note: This overrides the default callback for this instance.
            // We need to be careful. Ideally use a dedicated flow or the existing client
            // but hijacking the callback is standard for promisifying this.
            
            if (!tokenClientRef.current) {
                 // Should have been initialized if user is logged in, but just in case:
                 loadGoogleScript().then(() => {
                     tokenClientRef.current = initGoogleAuth(handleGoogleLoginResponse);
                     // Retry logic would go here, but let's just fail safe
                     resolve(null); 
                 });
                 return;
            }

            // Create a temporary client override or just leverage the standard flow 
            // and wait for state change? State change is hard to await in a function.
            // Let's use the explicit callback override feature of GIS if available, 
            // or just trigger requestAccessToken and assume the main callback handles state update.
            // But we need the token returned HERE to proceed with sync.
            
            // Hack: GIS `requestAccessToken` doesn't return a promise. 
            // We can rely on the fact that `handleGoogleLoginResponse` updates the state/localStorage.
            // But we need to wait for it.
            
            // Standard approach: Trigger auth, let it fail this sync attempt, user tries again.
            // Improved approach: 
            const originalCallback = tokenClientRef.current.callback;
            
            tokenClientRef.current.callback = async (resp: any) => {
                // Restore original callback for future generic clicks
                tokenClientRef.current.callback = originalCallback;
                
                if (resp.access_token) {
                    // Update state manually here to ensure immediate availability
                    await handleGoogleLoginResponse(resp);
                    resolve(resp.access_token);
                } else {
                    resolve(null);
                }
            };
            
            // Use prompt: 'none' to attempt silent refresh. If it fails, it might trigger error callback.
            tokenClientRef.current.requestAccessToken({ prompt: '' }); 
        });
    };

    const syncData = useCallback(async () => {
        // 1. Check Auth & Refresh if needed
        let accessToken = state.googleUser?.accessToken;
        
        if (!accessToken) {
            showToast("Please sign in to Google first.", 'info');
            return;
        }

        // Check expiration
        if (state.googleUser?.expiresAt && Date.now() > (state.googleUser.expiresAt - 300000)) {
             dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' }); // Show spinner while refreshing
             const newToken = await ensureValidToken();
             if (!newToken) {
                 dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
                 showToast("Session expired. Please sign in again.", 'error');
                 return;
             }
             accessToken = newToken;
        }

        dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
        
        try {
            // 2. Read Cloud Data (Read)
            const cloudData = await DriveService.read(accessToken);
            
            // 3. Merge Cloud Data into Local DB (Merge)
            if (cloudData) {
                console.log("Merging cloud data...");
                await db.mergeData(cloudData);
                
                // Reload state from DB to reflect merged data
                // This is a bit heavy but ensures UI is consistent
                const customers = await db.getAll('customers');
                const sales = await db.getAll('sales');
                const products = await db.getAll('products');
                const purchases = await db.getAll('purchases');
                // ... load other critical stores if needed, or just these major ones
                
                dispatch({ 
                    type: 'SET_STATE', 
                    payload: { customers, sales, products, purchases } 
                });
            }

            // 4. Export merged data (Write Prep)
            const currentData = await db.exportData();
            
            // 5. Upload to Cloud (Write)
            await DriveService.write(accessToken, currentData);
            
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
            dispatch({ type: 'SET_LAST_SYNC_TIME', payload: Date.now() });
            
            // Subtle toast for manual sync
            if (state.syncStatus !== 'syncing') {
                 showToast("Sync Complete!", 'success'); 
            }
        } catch (error: any) {
            console.error("Sync failed:", error);
            
            // Handle 401/403 specifically
            if (error.message && (error.message.includes('401') || error.message.includes('403'))) {
                showToast("Authentication invalid. Please sign in again.", 'error');
                dispatch({ type: 'SET_GOOGLE_USER', payload: null }); // Force logout
            } else {
                showToast("Sync Failed. Check connection.", 'error');
            }
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        }
    }, [state.googleUser]);
    
    // Exposed function for manual restore from Debug Modal
    const restoreFromFileId = async (fileId: string) => {
        if (!state.googleUser?.accessToken) return;
        try {
            const data = await downloadFile(state.googleUser.accessToken, fileId);
            if (data) {
                await db.importData(data);
                window.location.reload();
            }
        } catch(e) {
            console.error("Restore error", e);
            throw e;
        }
    };

    // Inject restore function into state for easy access in modals
    useEffect(() => {
        dispatch({ type: 'SET_STATE', payload: { restoreFromFileId } });
    }, [state.googleUser]); // Re-bind when user changes

    // --- AUTO SYNC LOGIC ---
    useEffect(() => {
        // Only auto-sync if user is logged in and data has changed (lastLocalUpdate > 0)
        // Also prevent sync if already syncing or in error state (wait for manual retry)
        if (state.googleUser && state.lastLocalUpdate > 0 && state.syncStatus !== 'syncing') {
            const timer = setTimeout(() => {
                console.log("Auto-sync triggered due to local changes");
                syncData();
            }, 5000); // 5-second debounce to batch rapid changes

            return () => clearTimeout(timer);
        }
    }, [state.lastLocalUpdate, state.googleUser, syncData, state.syncStatus]);

    return (
        <AppContext.Provider value={{ state: state as any, dispatch, isDbLoaded, showToast, googleSignIn, googleSignOut, syncData }}>
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
