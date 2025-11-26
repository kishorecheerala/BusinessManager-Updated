
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useRef } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, Payment, BeforeInstallPromptEvent, Notification, ProfileData, Page, AppMetadata, AppMetadataPin, Theme, GoogleUser, AuditLogEntry, SyncStatus, AppMetadataTheme, Expense, Quote, AppMetadataInvoiceSettings, InvoiceTemplateConfig, DocumentType, CustomFont, InvoiceLabels } from '../types';
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
  restoreFromFileId?: (fileId: string) => Promise<void>;
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_THEME_COLOR'; payload: string }
  | { type: 'SET_THEME_GRADIENT'; payload: string }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_PROFILE'; payload: ProfileData | null }
  | { type: 'SET_PIN'; payload: string }
  | { type: 'REMOVE_PIN' }
  | { type: 'SET_REVENUE_GOAL'; payload: number }
  | { type: 'UPDATE_METADATA_TIMESTAMP'; payload: number }
  | { type: 'SET_INVOICE_TEMPLATE'; payload: InvoiceTemplateConfig }
  | { type: 'SET_DOCUMENT_TEMPLATE'; payload: { type: DocumentType, config: InvoiceTemplateConfig } }
  | { type: 'UPDATE_INVOICE_SETTINGS'; payload: { terms: string, footer: string, showQr: boolean } }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT_STOCK'; payload: { productId: string; change: number } }
  | { type: 'ADD_SALE'; payload: Sale }
  | { type: 'UPDATE_SALE'; payload: { oldSale: Sale, updatedSale: Sale } }
  | { type: 'DELETE_SALE'; payload: string }
  | { type: 'ADD_PURCHASE'; payload: Purchase }
  | { type: 'UPDATE_PURCHASE'; payload: { oldPurchase: Purchase, updatedPurchase: Purchase } }
  | { type: 'DELETE_PURCHASE'; payload: string }
  | { type: 'ADD_RETURN'; payload: Return }
  | { type: 'UPDATE_RETURN'; payload: { oldReturn: Return, updatedReturn: Return } }
  | { type: 'ADD_EXPENSE'; payload: Expense }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'ADD_QUOTE'; payload: Quote }
  | { type: 'UPDATE_QUOTE'; payload: Quote }
  | { type: 'DELETE_QUOTE'; payload: string }
  | { type: 'ADD_CUSTOM_FONT'; payload: CustomFont }
  | { type: 'REMOVE_CUSTOM_FONT'; payload: string }
  | { type: 'ADD_PAYMENT_TO_SALE'; payload: { saleId: string; payment: Payment } }
  | { type: 'ADD_PAYMENT_TO_PURCHASE'; payload: { purchaseId: string; payment: Payment } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'info' | 'error' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_LAST_BACKUP_DATE'; payload: string }
  | { type: 'SET_SELECTION'; payload: { page: Page; id: string; action?: 'edit' | 'new'; data?: any } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_INSTALL_PROMPT_EVENT'; payload: BeforeInstallPromptEvent | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_AS_READ'; payload: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_AS_READ' }
  | { type: 'REPLACE_COLLECTION'; payload: { storeName: StoreName, data: any[] } }
  | { type: 'SET_GOOGLE_USER'; payload: GoogleUser | null }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'SET_LAST_SYNC_TIME'; payload: number }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLogEntry }
  | { type: 'TOGGLE_DEV_MODE' }
  | { type: 'RESET_APP' };


const getInitialTheme = (): Theme => {
  try {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) return savedTheme;
    
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
  } catch (e) {
    // ignore
  }
  return 'light';
};

const getInitialThemeColor = (): string => {
    return localStorage.getItem('themeColor') || '#0d9488';
};

const getInitialThemeGradient = (): string => {
    return localStorage.getItem('themeGradient') || '';
};

const getInitialGoogleUser = (): GoogleUser | null => {
  try {
    const stored = localStorage.getItem('googleUser');
    if (stored) {
        return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse stored google user", e);
  }
  return null;
};

const getInitialSyncTime = (): number | null => {
    try {
        const stored = localStorage.getItem('lastSyncTime');
        return stored ? parseInt(stored) : null;
    } catch (e) {
        return null;
    }
};

const getInitialDevMode = (): boolean => {
    try {
        return localStorage.getItem('devMode') === 'true';
    } catch (e) {
        return false;
    }
}

const defaultLabels: InvoiceLabels = {
    billedTo: "Billed To",
    date: "Date",
    invoiceNo: "Invoice No",
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
};

const defaultInvoiceTemplate: InvoiceTemplateConfig = {
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
        }
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
        showAmountInWords: false,
        showStatusStamp: false,
        showTaxBreakdown: false,
        showGst: true,
        labels: defaultLabels,
        qrType: 'INVOICE_ID',
        bankDetails: ''
    }
};

const defaultEstimateTemplate: InvoiceTemplateConfig = {
    ...defaultInvoiceTemplate,
    id: 'estimateTemplateConfig',
    colors: {
        ...defaultInvoiceTemplate.colors,
        primary: '#4f46e5', // Indigo for Estimates
        tableHeaderBg: '#4f46e5',
        bannerBg: '#4f46e5'
    },
    content: {
        ...defaultInvoiceTemplate.content,
        titleText: 'ESTIMATE / QUOTATION',
        footerText: 'Valid for 7 days.',
        labels: { ...defaultLabels, invoiceNo: "Estimate No", balance: "Total Due" },
        showGst: true
    }
};

const defaultDebitNoteTemplate: InvoiceTemplateConfig = {
    ...defaultInvoiceTemplate,
    id: 'debitNoteTemplateConfig',
    colors: {
        ...defaultInvoiceTemplate.colors,
        primary: '#000000', // Black for Debit Notes usually
        tableHeaderBg: '#333333',
        bannerBg: '#333333'
    },
    content: {
        ...defaultInvoiceTemplate.content,
        titleText: 'DEBIT NOTE',
        showTerms: false,
        footerText: '',
        labels: { ...defaultLabels, invoiceNo: "Debit Note No", billedTo: "To Supplier" },
        showGst: true
    }
};

const defaultReceiptTemplate: InvoiceTemplateConfig = {
    ...defaultInvoiceTemplate,
    id: 'receiptTemplateConfig',
    colors: {
        ...defaultInvoiceTemplate.colors,
        primary: '#000000', // Typically black for thermal
        secondary: '#000000',
        tableHeaderBg: '#ffffff', // No background typically
        tableHeaderText: '#000000'
    },
    fonts: {
        headerSize: 12,
        bodySize: 8,
        titleFont: 'helvetica',
        bodyFont: 'helvetica'
    },
    layout: {
        margin: 2, // Small margin for 80mm paper
        logoSize: 15,
        logoPosition: 'center',
        logoOffsetX: 0,
        logoOffsetY: 0,
        headerAlignment: 'center',
        headerStyle: 'standard',
        showWatermark: false,
        watermarkOpacity: 0.1,
        tableOptions: {
            hideQty: false,
            hideRate: false,
            stripedRows: false,
            bordered: false,
            compact: false
        }
    },
    content: {
        titleText: 'TAX INVOICE',
        showTerms: true,
        showQr: true,
        termsText: '',
        footerText: 'Thank You! Visit Again.',
        showBusinessDetails: true,
        showCustomerDetails: true,
        showSignature: false,
        signatureText: '',
        labels: defaultLabels,
        qrType: 'INVOICE_ID',
        showGst: true
    }
};

// Deep merge helper
const mergeTemplate = (defaultTmpl: InvoiceTemplateConfig, storedTmpl: Partial<InvoiceTemplateConfig>): InvoiceTemplateConfig => {
    return {
        ...defaultTmpl,
        ...storedTmpl,
        colors: { ...defaultTmpl.colors, ...storedTmpl.colors },
        fonts: { ...defaultTmpl.fonts, ...storedTmpl.fonts },
        layout: { 
            ...defaultTmpl.layout, 
            ...storedTmpl.layout,
            tableOptions: { ...defaultTmpl.layout.tableOptions, ...storedTmpl.layout?.tableOptions }
        },
        content: { 
            ...defaultTmpl.content, 
            ...storedTmpl.content,
            labels: { ...defaultTmpl.content.labels, ...storedTmpl.content?.labels }
        }
    };
};

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
  invoiceTemplate: defaultInvoiceTemplate,
  estimateTemplate: defaultEstimateTemplate,
  debitNoteTemplate: defaultDebitNoteTemplate,
  receiptTemplate: defaultReceiptTemplate,
  toast: { message: '', show: false, type: 'info' },
  selection: null,
  installPromptEvent: null,
  pin: null,
  theme: getInitialTheme(),
  themeColor: getInitialThemeColor(),
  themeGradient: getInitialThemeGradient(),
  googleUser: getInitialGoogleUser(),
  syncStatus: 'idle',
  lastSyncTime: getInitialSyncTime(),
  lastLocalUpdate: 0,
  devMode: getInitialDevMode(),
};

// Helper to update theme metadata
const upsertThemeToMetadata = (metadata: AppMetadata[], theme: Theme, color: string, gradient: string): AppMetadata[] => {
    const otherMeta = metadata.filter(m => m.id !== 'themeSettings');
    const themeMeta: AppMetadataTheme = { id: 'themeSettings', theme, color, gradient };
    return [...otherMeta, themeMeta];
};

const appReducer = (state: AppState, action: Action): AppState => {
  const touch = { lastLocalUpdate: Date.now() };
  switch (action.type) {
    case 'SET_STATE':
        return { ...state, ...action.payload };
    case 'SET_THEME': {
        const newMeta = upsertThemeToMetadata(state.app_metadata, action.payload, state.themeColor, state.themeGradient);
        return { ...state, theme: action.payload, app_metadata: newMeta, ...touch };
    }
    case 'SET_THEME_COLOR': {
        const newMeta = upsertThemeToMetadata(state.app_metadata, state.theme, action.payload, state.themeGradient);
        return { ...state, themeColor: action.payload, app_metadata: newMeta, ...touch };
    }
    case 'SET_THEME_GRADIENT': {
        const newMeta = upsertThemeToMetadata(state.app_metadata, state.theme, state.themeColor, action.payload);
        return { ...state, themeGradient: action.payload, app_metadata: newMeta, ...touch };
    }
    case 'TOGGLE_DEV_MODE':
        const newDevMode = !state.devMode;
        localStorage.setItem('devMode', String(newDevMode));
        return { ...state, devMode: newDevMode };
    case 'RESET_APP':
        // Resetting to defaults, NOT preserving old theme state
        return { 
            ...initialState, 
            theme: 'light', 
            themeColor: '#0d9488', 
            themeGradient: '',
            installPromptEvent: state.installPromptEvent, 
            devMode: state.devMode 
        };
    case 'REPLACE_COLLECTION':
        return { ...state, [action.payload.storeName]: action.payload.data, ...touch };
    case 'SET_NOTIFICATIONS':
        return { ...state, notifications: action.payload };
    case 'SET_PROFILE':
        return { ...state, profile: action.payload, ...touch };
    case 'SET_PIN':
        const otherMetadata = state.app_metadata.filter(m => m.id !== 'securityPin');
        const newPinMetadata: AppMetadataPin = { id: 'securityPin', pin: action.payload };
        return { ...state, pin: action.payload, app_metadata: [...otherMetadata, newPinMetadata], ...touch };
    case 'REMOVE_PIN': {
      const metadataWithoutPin = state.app_metadata.filter(m => m.id !== 'securityPin');
      return { ...state, pin: null, app_metadata: metadataWithoutPin, ...touch };
    }
    case 'SET_REVENUE_GOAL': {
        const metaWithoutGoal = state.app_metadata.filter(m => m.id !== 'revenueGoal');
        return {
            ...state,
            app_metadata: [...metaWithoutGoal, { id: 'revenueGoal', amount: action.payload }],
            ...touch
        };
    }
    case 'SET_INVOICE_TEMPLATE': {
        // Fallback legacy action
        const metaWithoutTemplate = state.app_metadata.filter(m => m.id !== 'invoiceTemplateConfig');
        return {
            ...state,
            invoiceTemplate: action.payload,
            app_metadata: [...metaWithoutTemplate, action.payload as any],
            ...touch
        };
    }
    case 'SET_DOCUMENT_TEMPLATE': {
        const { type, config } = action.payload;
        const configId = config.id;
        const metaWithoutThis = state.app_metadata.filter(m => m.id !== configId);
        
        let newState = { ...state };
        if (type === 'INVOICE') newState.invoiceTemplate = config;
        else if (type === 'ESTIMATE') newState.estimateTemplate = config;
        else if (type === 'DEBIT_NOTE') newState.debitNoteTemplate = config;
        else if (type === 'RECEIPT') newState.receiptTemplate = config;

        return {
            ...newState,
            app_metadata: [...metaWithoutThis, config as any],
            ...touch
        };
    }
    case 'UPDATE_INVOICE_SETTINGS': {
        const { terms, footer, showQr } = action.payload;
        const newSettings: AppMetadataInvoiceSettings = { id: 'invoiceSettings', terms, footer, showQr };
        const meta = state.app_metadata.filter(m => m.id !== 'invoiceSettings');
        return {
            ...state,
            invoiceSettings: newSettings,
            app_metadata: [...meta, newSettings],
            ...touch
        }
    }
    case 'UPDATE_METADATA_TIMESTAMP': {
        const timestamp = action.payload;
        const meta = state.app_metadata.filter(m => m.id !== 'lastModified');
        return { ...state, app_metadata: [...meta, { id: 'lastModified', timestamp }] };
    }
    case 'ADD_CUSTOMER':
      return { ...state, customers: [...state.customers, action.payload], ...touch };
    case 'UPDATE_CUSTOMER':
      return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c), ...touch };
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...state.suppliers, action.payload], ...touch };
    case 'UPDATE_SUPPLIER':
      return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s), ...touch };
    case 'ADD_PRODUCT':
        const existingProduct = state.products.find(p => p.id === action.payload.id);
        if (existingProduct) {
            return {
                ...state,
                products: state.products.map(p => p.id === action.payload.id ? { ...p, quantity: p.quantity + action.payload.quantity, purchasePrice: action.payload.purchasePrice, salePrice: action.payload.salePrice } : p),
                ...touch
            };
        }
        return { ...state, products: [...state.products, action.payload], ...touch };
    case 'UPDATE_PRODUCT':
        return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p), ...touch };
    case 'UPDATE_PRODUCT_STOCK':
        return {
            ...state,
            products: state.products.map(p => p.id === action.payload.productId ? { ...p, quantity: p.quantity + action.payload.change } : p),
            ...touch
        }
    case 'ADD_SALE':
      return { ...state, sales: [...state.sales, action.payload], ...touch };
    case 'UPDATE_SALE': {
        const { oldSale, updatedSale } = action.payload;
        const stockChanges = new Map<string, number>();
        oldSale.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity));
        updatedSale.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) - item.quantity));
        const updatedProducts = state.products.map(p => {
            if (stockChanges.has(p.id)) return { ...p, quantity: p.quantity + (stockChanges.get(p.id) || 0) };
            return p;
        });
        const updatedSales = state.sales.map(s => s.id === updatedSale.id ? updatedSale : s);
        return { ...state, sales: updatedSales, products: updatedProducts, ...touch };
    }
    case 'DELETE_SALE': {
      const saleToDelete = state.sales.find(s => s.id === action.payload);
      if (!saleToDelete) return state;
      const stockChanges = new Map<string, number>();
      saleToDelete.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity));
      let updatedProducts = state.products;
      stockChanges.forEach((change, productId) => {
        updatedProducts = updatedProducts.map(p => p.id === productId ? { ...p, quantity: p.quantity + change } : p);
      });
      return { ...state, sales: state.sales.filter(s => s.id !== action.payload), products: updatedProducts, ...touch };
    }
    case 'ADD_PURCHASE':
      return { ...state, purchases: [...state.purchases, action.payload], ...touch };
    case 'UPDATE_PURCHASE': {
        const { oldPurchase, updatedPurchase } = action.payload;
        let tempProducts = [...state.products];
        const allProductIds = new Set([...oldPurchase.items.map(i => i.productId), ...updatedPurchase.items.map(i => i.productId)]);
        allProductIds.forEach(productId => {
            const oldItem = oldPurchase.items.find(i => i.productId === productId);
            const newItem = updatedPurchase.items.find(i => i.productId === productId);
            const existingProductIndex = tempProducts.findIndex(p => p.id === productId);
            const oldQty = oldItem ? oldItem.quantity : 0;
            const newQty = newItem ? newItem.quantity : 0;
            const stockChange = newQty - oldQty;
            if (existingProductIndex > -1) {
                const updatedProduct = { ...tempProducts[existingProductIndex] };
                updatedProduct.quantity += stockChange;
                if (newItem) {
                    updatedProduct.purchasePrice = newItem.price;
                    updatedProduct.salePrice = newItem.saleValue;
                    updatedProduct.gstPercent = newItem.gstPercent;
                }
                tempProducts[existingProductIndex] = updatedProduct;
            } else if (newItem) {
                tempProducts.push({ id: newItem.productId, name: newItem.productName, quantity: newItem.quantity, purchasePrice: newItem.price, salePrice: newItem.saleValue, gstPercent: newItem.gstPercent });
            }
        });
        const updatedProducts = tempProducts.map(p => ({ ...p, quantity: Math.max(0, p.quantity) }));
        const updatedPurchases = state.purchases.map(p => p.id === updatedPurchase.id ? updatedPurchase : p);
        return { ...state, purchases: updatedPurchases, products: updatedProducts, ...touch };
    }
    case 'DELETE_PURCHASE': {
      const purchaseToDelete = state.purchases.find(p => p.id === action.payload);
      if (!purchaseToDelete) return state;
      const stockChanges = new Map<string, number>();
      purchaseToDelete.items.forEach(item => {
        const currentChange = stockChanges.get(item.productId) || 0;
        stockChanges.set(item.productId, currentChange - item.quantity);
      });
      let updatedProducts = state.products;
      stockChanges.forEach((change, productId) => {
        updatedProducts = updatedProducts.map(p => p.id === productId ? { ...p, quantity: Math.max(0, p.quantity + change) } : p);
      });
      return { ...state, purchases: state.purchases.filter(p => p.id !== action.payload), products: updatedProducts, ...touch };
    }
    case 'ADD_RETURN': {
      const returnPayload = action.payload;
      const updatedProducts = state.products.map(product => {
        const itemReturned = returnPayload.items.find(item => item.productId.trim().toLowerCase() === product.id.trim().toLowerCase());
        if (itemReturned) {
          const quantityChange = returnPayload.type === 'CUSTOMER' ? itemReturned.quantity : -itemReturned.quantity;
          return { ...product, quantity: product.quantity + quantityChange };
        }
        return product;
      });
      const creditPayment: Payment = { id: `PAY-RET-${returnPayload.id}`, amount: returnPayload.amount, date: returnPayload.returnDate, method: 'RETURN_CREDIT' };
      let updatedSales = state.sales;
      let updatedPurchases = state.purchases;
      if (returnPayload.type === 'CUSTOMER') {
        updatedSales = state.sales.map(sale => sale.id === returnPayload.referenceId ? { ...sale, payments: [...(sale.payments || []), creditPayment] } : sale);
      } else {
        updatedPurchases = state.purchases.map(purchase => purchase.id === returnPayload.referenceId ? { ...purchase, payments: [...(purchase.payments || []), creditPayment] } : purchase);
      }
      return { ...state, products: updatedProducts, sales: updatedSales, purchases: updatedPurchases, returns: [...state.returns, returnPayload], ...touch };
    }
    case 'UPDATE_RETURN': {
       const { oldReturn, updatedReturn } = action.payload;
        const stockChanges = new Map<string, number>();
        oldReturn.items.forEach(item => {
            const change = oldReturn.type === 'CUSTOMER' ? -item.quantity : +item.quantity;
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + change);
        });
        updatedReturn.items.forEach(item => {
            const change = updatedReturn.type === 'CUSTOMER' ? +item.quantity : -item.quantity;
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + change);
        });
        const updatedProducts = state.products.map(p => {
            if (stockChanges.has(p.id)) return { ...p, quantity: p.quantity + (stockChanges.get(p.id) || 0) };
            return p;
        });
        let updatedSales = state.sales;
        let updatedPurchases = state.purchases;
        const creditPaymentId = `PAY-RET-${updatedReturn.id}`;
        if (updatedReturn.type === 'CUSTOMER') {
            updatedSales = updatedSales.map(sale => {
                if (sale.id === updatedReturn.referenceId) {
                    const updatedPayments = sale.payments.map(p => {
                        if (p.id === creditPaymentId) return { ...p, amount: updatedReturn.amount, date: updatedReturn.returnDate };
                        return p;
                    });
                    return { ...sale, payments: updatedPayments };
                }
                return sale;
            });
        } else { // SUPPLIER
            updatedPurchases = updatedPurchases.map(purchase => {
                if (purchase.id === updatedReturn.referenceId) {
                    const updatedPayments = purchase.payments.map(p => {
                        if (p.id === creditPaymentId) return { ...p, amount: updatedReturn.amount, date: updatedReturn.returnDate };
                        return p;
                    });
                    return { ...purchase, payments: updatedPayments };
                }
                return purchase;
            });
        }
        const updatedReturns = state.returns.map(r => r.id === updatedReturn.id ? updatedReturn : r);
        return { ...state, products: updatedProducts, sales: updatedSales, purchases: updatedPurchases, returns: updatedReturns, ...touch };
    }
    case 'ADD_EXPENSE':
      return { ...state, expenses: [...state.expenses, action.payload], ...touch };
    case 'DELETE_EXPENSE':
      return { ...state, expenses: state.expenses.filter(e => e.id !== action.payload), ...touch };
    case 'ADD_QUOTE':
        return { ...state, quotes: [...state.quotes, action.payload], ...touch };
    case 'UPDATE_QUOTE':
        return { ...state, quotes: state.quotes.map(q => q.id === action.payload.id ? action.payload : q), ...touch };
    case 'DELETE_QUOTE':
        return { ...state, quotes: state.quotes.filter(q => q.id !== action.payload), ...touch };
    case 'ADD_CUSTOM_FONT':
        return { ...state, customFonts: [...state.customFonts, action.payload], ...touch };
    case 'REMOVE_CUSTOM_FONT':
        return { ...state, customFonts: state.customFonts.filter(f => f.id !== action.payload), ...touch };
    case 'ADD_PAYMENT_TO_SALE':
      return { ...state, sales: state.sales.map(sale => sale.id === action.payload.saleId ? { ...sale, payments: [...(sale.payments || []), action.payload.payment] } : sale), ...touch };
    case 'ADD_PAYMENT_TO_PURCHASE':
      return { ...state, purchases: state.purchases.map(purchase => purchase.id === action.payload.purchaseId ? { ...purchase, payments: [...(purchase.payments || []), action.payload.payment] } : purchase), ...touch };
    case 'SHOW_TOAST':
        return { ...state, toast: { message: action.payload.message, show: true, type: action.payload.type || 'info' } };
    case 'HIDE_TOAST':
        return { ...state, toast: { ...state.toast, show: false } };
    case 'SET_LAST_BACKUP_DATE':
      const otherMeta = state.app_metadata.filter(m => m.id !== 'lastBackup');
      return { ...state, app_metadata: [...otherMeta, { id: 'lastBackup', date: action.payload }], ...touch };
    case 'SET_SELECTION':
      return { ...state, selection: action.payload };
    case 'CLEAR_SELECTION':
      return { ...state, selection: null };
    case 'SET_INSTALL_PROMPT_EVENT':
      return { ...state, installPromptEvent: action.payload };
    case 'ADD_NOTIFICATION':
      if (state.notifications.some(n => n.id === action.payload.id)) return state;
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_AS_READ':
      return { ...state, notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n) };
    case 'MARK_ALL_NOTIFICATIONS_AS_READ':
      return { ...state, notifications: state.notifications.map(n => ({ ...n, read: true })) };
    case 'SET_GOOGLE_USER':
      return { ...state, googleUser: action.payload };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.payload };
    case 'SET_LAST_SYNC_TIME':
      return { ...state, lastSyncTime: action.payload };
    case 'ADD_AUDIT_LOG':
      return { ...state, audit_logs: [action.payload, ...state.audit_logs] };
    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  isDbLoaded: boolean;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  googleSignIn: (options?: { forceConsent?: boolean }) => void;
  googleSignOut: () => void;
  syncData: () => Promise<void>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const tokenClient = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 3000);
  };

  // Load Data from DB
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load all stores
        const [
            customers, suppliers, products, sales, purchases, returns, expenses, quotes, customFonts, app_metadata, notifications, profile, audit_logs
        ] = await Promise.all([
            db.getAll('customers'), db.getAll('suppliers'), db.getAll('products'), db.getAll('sales'), 
            db.getAll('purchases'), db.getAll('returns'), db.getAll('expenses'), db.getAll('quotes'), db.getAll('custom_fonts'),
            db.getAll('app_metadata'), db.getAll('notifications'), db.getAll('profile'), db.getAll('audit_logs')
        ]);

        let payload: Partial<AppState> = {
            customers, suppliers, products, sales, purchases, returns, expenses, quotes, customFonts, app_metadata, notifications, audit_logs,
            profile: profile[0] || null
        };

        // Extract settings from metadata
        const pinMeta = app_metadata.find(m => m.id === 'securityPin') as AppMetadataPin | undefined;
        const themeMeta = app_metadata.find(m => m.id === 'themeSettings') as AppMetadataTheme | undefined;
        const invoiceSettingsMeta = app_metadata.find(m => m.id === 'invoiceSettings') as AppMetadataInvoiceSettings | undefined;
        
        const invoiceConfig = app_metadata.find(m => m.id === 'invoiceTemplateConfig') as InvoiceTemplateConfig | undefined;
        const estimateConfig = app_metadata.find(m => m.id === 'estimateTemplateConfig') as InvoiceTemplateConfig | undefined;
        const debitNoteConfig = app_metadata.find(m => m.id === 'debitNoteTemplateConfig') as InvoiceTemplateConfig | undefined;
        const receiptConfig = app_metadata.find(m => m.id === 'receiptTemplateConfig') as InvoiceTemplateConfig | undefined;

        if (pinMeta) payload.pin = pinMeta.pin;
        if (themeMeta) {
            payload.theme = themeMeta.theme;
            payload.themeColor = themeMeta.color;
            payload.themeGradient = themeMeta.gradient;
        }
        if (invoiceSettingsMeta) payload.invoiceSettings = invoiceSettingsMeta;
        
        if (invoiceConfig) payload.invoiceTemplate = mergeTemplate(defaultInvoiceTemplate, invoiceConfig);
        if (estimateConfig) payload.estimateTemplate = mergeTemplate(defaultEstimateTemplate, estimateConfig);
        if (debitNoteConfig) payload.debitNoteTemplate = mergeTemplate(defaultDebitNoteTemplate, debitNoteConfig);
        if (receiptConfig) payload.receiptTemplate = mergeTemplate(defaultReceiptTemplate, receiptConfig);

        dispatch({ type: 'SET_STATE', payload });
        setIsDbLoaded(true);
      } catch (e) {
        console.error("DB Load Error:", e);
        showToast("Error loading data.", 'error');
        setIsDbLoaded(true); // Still let app load to avoid blank screen
      }
    };
    loadData();
  }, []);

  // Persist changes to IndexedDB
  useEffect(() => { if (isDbLoaded) db.saveCollection('customers', state.customers); }, [state.customers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('suppliers', state.suppliers); }, [state.suppliers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('products', state.products); }, [state.products, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('sales', state.sales); }, [state.sales, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('purchases', state.purchases); }, [state.purchases, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('returns', state.returns); }, [state.returns, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('expenses', state.expenses); }, [state.expenses, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('quotes', state.quotes); }, [state.quotes, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('custom_fonts', state.customFonts); }, [state.customFonts, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('notifications', state.notifications); }, [state.notifications, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('audit_logs', state.audit_logs); }, [state.audit_logs, isDbLoaded]);
  
  useEffect(() => { 
      if (isDbLoaded) {
          db.saveCollection('app_metadata', state.app_metadata);
      }
  }, [state.app_metadata, isDbLoaded]);

  useEffect(() => {
      if (isDbLoaded && state.profile) {
          db.saveCollection('profile', [state.profile]);
      }
  }, [state.profile, isDbLoaded]);

  // Google Auth & Sync Logic (Kept as is)
  const googleSignIn = (options?: { forceConsent?: boolean }) => {
      loadGoogleScript().then(() => {
          if (!tokenClient.current) {
              tokenClient.current = initGoogleAuth((response) => {
                  if (response.access_token) {
                      getUserInfo(response.access_token).then(user => {
                          const googleUser = { ...user, accessToken: response.access_token };
                          dispatch({ type: 'SET_GOOGLE_USER', payload: googleUser });
                          localStorage.setItem('googleUser', JSON.stringify(googleUser));
                          showToast(`Signed in as ${user.name}`, 'success');
                          syncData();
                      });
                  }
              });
          }
          
          if (options?.forceConsent) {
              tokenClient.current.requestAccessToken({ prompt: 'consent' });
          } else {
              tokenClient.current.requestAccessToken();
          }
      }).catch(err => {
          console.error("Failed to load Google Script", err);
          showToast("Failed to load Google Auth.", 'error');
      });
  };

  const googleSignOut = () => {
      dispatch({ type: 'SET_GOOGLE_USER', payload: null });
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      localStorage.removeItem('googleUser');
      showToast("Signed out.", 'info');
  };

  const syncData = async () => {
      if (!state.googleUser?.accessToken) {
          showToast("Please sign in to sync.", 'error');
          return;
      }

      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      
      try {
          const { toast, selection, installPromptEvent, googleUser, syncStatus, lastSyncTime, devMode, restoreFromFileId, ...backupData } = state;
          
          await DriveService.write(state.googleUser.accessToken, backupData);
          
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          const now = Date.now();
          dispatch({ type: 'SET_LAST_SYNC_TIME', payload: now });
          localStorage.setItem('lastSyncTime', now.toString());
          showToast("Sync successful (Backup created).", 'success');

      } catch (e: any) {
          console.error("Sync Error:", e);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          
          if (e.message && (e.message.includes('401') || e.message.includes('403'))) {
              showToast("Session expired. Please sign in again.", 'error');
              googleSignOut();
          } else {
              showToast("Sync failed. Check connection.", 'error');
          }
      }
  };
  
  const restoreFromFileId = async (fileId: string) => {
      if (!state.googleUser?.accessToken) return;
      try {
          const data = await downloadFile(state.googleUser.accessToken, fileId);
          if (data) {
              await db.importData(data);
              window.location.reload();
          }
      } catch (e) {
          console.error("Restore error", e);
          showToast("Restore failed.", 'error');
      }
  };

  return (
    <AppContext.Provider value={{ 
        state: { ...state, restoreFromFileId }, 
        dispatch, 
        isDbLoaded, 
        showToast, 
        googleSignIn, 
        googleSignOut, 
        syncData 
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
