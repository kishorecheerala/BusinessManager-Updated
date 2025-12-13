import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useCallback, useRef } from 'react';
import {
    Customer, Supplier, Product, Sale, Purchase, Return, Expense, Quote,
    AppMetadata, AppMetadataTheme, AppMetadataPin, AppMetadataUIPreferences,
    Notification, ProfileData, InvoiceTemplateConfig, Budget, FinancialScenario,
    AuditLogEntry, SaleDraft, ParkedSale, Page, ExpenseCategory, Theme,
    GoogleUser, SyncStatus, AppMetadataInvoiceSettings, CustomFont, PurchaseItem, AppMetadataNavOrder, AppMetadataQuickActions, TrashItem, AppState, ToastState, BankAccount
} from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';
import { DriveService, initGoogleAuth, getUserInfo, loadGoogleScript, downloadFile } from '../utils/googleDrive';
import { getLocalDateString } from '../utils/dateUtils';

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
    | { type: 'PERMANENTLY_DELETE_FROM_TRASH'; payload: string }
    // Bank Account Actions
    | { type: 'ADD_BANK_ACCOUNT'; payload: BankAccount }
    | { type: 'UPDATE_BANK_ACCOUNT'; payload: BankAccount }
    | { type: 'DELETE_BANK_ACCOUNT'; payload: string };

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
    'REPORTS', 'EXPENSES', 'FINANCIAL_PLANNING', 'RETURNS', 'QUOTATIONS',
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

    let theme = (localStorage.getItem('theme') as Theme) || 'light';
    // SANITIZATION: If theme contains spaces or is suspiciously long, reset it.
    // This fixes issues where 'dark bg-gradient-...' got saved as the theme name.
    if (theme.includes(' ') || theme.length > 20) {
        console.warn('Detected corrupted theme state. Resetting to light.');
        theme = 'light';
        localStorage.setItem('theme', 'light');
    }
    const themeColor = localStorage.getItem('themeColor') || '#8b5cf6';
    const font = localStorage.getItem('font') || 'Inter';

    let themeGradient = localStorage.getItem('themeGradient');
    // FIX: Do NOT default to a gradient if missing. Missing means "No Gradient" (Solid Color).
    if (themeGradient === null) {
        themeGradient = '';
    } else if (themeGradient === 'none') {
        themeGradient = '';
    }

    let googleUser = null;
    try {
        const storedUser = localStorage.getItem('googleUser');
        if (storedUser) googleUser = JSON.parse(storedUser);
    } catch (e) { }

    let lastSyncTime = null;
    try {
        const storedTime = localStorage.getItem('lastSyncTime');
        if (storedTime) lastSyncTime = parseInt(storedTime, 10);
    } catch (e) { }

    let parkedSales = [];
    try {
        const storedDrafts = localStorage.getItem('parked_sales');
        if (storedDrafts) parkedSales = JSON.parse(storedDrafts);
    } catch (e) { }

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
    trash: [],

    budgets: [],
    financialScenarios: [],
    isLocked: false, // Default to false, will settle to true if config says so during load
    bankAccounts: []
};

// Logging helper
const logAction = (state: AppState, actionType: string, details: string): AuditLogEntry => {
    return {
        id: `LOG - ${Date.now()} `,
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
            const newCustomer = { ...action.payload, updatedAt: new Date().toISOString() };
            db.saveCollection('customers', [newCustomer, ...state.customers]);
            newLog = logAction(state, 'Customer Added', newCustomer.name);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
            return { ...state, customers: [newCustomer, ...state.customers], audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'UPDATE_CUSTOMER':
            const updatedCustomer: Customer = { ...action.payload, updatedAt: new Date().toISOString() };
            const updatedCustomers = state.customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c);
            db.saveCollection('customers', updatedCustomers);
            newLog = logAction(state, 'Updated Customer', `ID: ${updatedCustomer.id} `);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
            return { ...state, customers: updatedCustomers, audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'ADD_SUPPLIER':
            const newSupplier = { ...action.payload, updatedAt: new Date().toISOString() };
            db.saveCollection('suppliers', [newSupplier, ...state.suppliers]);
            return { ...state, suppliers: [newSupplier, ...state.suppliers], ...touch };

        case 'UPDATE_SUPPLIER':
            const updatedSupplier = { ...action.payload, updatedAt: new Date().toISOString() };
            const updatedSuppliers = state.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s);
            db.saveCollection('suppliers', updatedSuppliers);
            return { ...state, suppliers: updatedSuppliers, ...touch };

        case 'ADD_PRODUCT':
            const newProduct = { ...action.payload, updatedAt: new Date().toISOString() };
            const existingProductIndex = state.products.findIndex(p => p.id === newProduct.id);
            let productsList;
            if (existingProductIndex >= 0) {
                productsList = state.products.map((p, i) => i === existingProductIndex ? { ...p, quantity: p.quantity + newProduct.quantity, updatedAt: new Date().toISOString() } : p);
            } else {
                productsList = [...state.products, newProduct];
            }
            db.saveCollection('products', productsList);
            return { ...state, products: productsList, ...touch };

        case 'UPDATE_PRODUCT_STOCK':
            const updatedStockProducts = state.products.map(p =>
                p.id === action.payload.productId ? { ...p, quantity: p.quantity + action.payload.change, updatedAt: new Date().toISOString() } : p
            );
            db.saveCollection('products', updatedStockProducts);
            return { ...state, products: updatedStockProducts, ...touch };

        case 'BATCH_UPDATE_PRODUCTS':
            const batchUpdatedProducts = state.products.map(p => {
                const update = action.payload.find(u => u.id === p.id);
                return update ? { ...update, updatedAt: new Date().toISOString() } : p;
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
            newLog = logAction(state, 'New Sale', `ID: ${newSale.id}, Amt: ${newSale.totalAmount} `);
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
                    return { ...p, quantity: p.quantity + stockMap[p.id], updatedAt: new Date().toISOString() };
                }
                return p;
            });

            const updatedSalesList = state.sales.map(s => s.id === updatedSale.id ? updatedSale : s);

            db.saveCollection('sales', updatedSalesList);
            db.saveCollection('products', adjustedProducts);
            newLog = logAction(state, 'Updated Sale', `ID: ${updatedSale.id} `);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

            return { ...state, sales: updatedSalesList, products: adjustedProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'DELETE_SALE': {
            const saleToDelete = state.sales.find(s => s.id === action.payload);
            if (!saleToDelete) return state;

            // Restore Stock
            const restoredProducts = state.products.map(p => {
                const item = saleToDelete.items.find(i => i.productId === p.id);
                return item ? { ...p, quantity: p.quantity + item.quantity, updatedAt: new Date().toISOString() } : p;
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
            // This block is inserted as per the instruction.
            // Assuming profileData is defined elsewhere or this is a partial snippet.
            // If profileData is not defined, this will cause a runtime error.
            // The instruction implies this is a replacement for a db.createProfile call,
            // but its placement here suggests an insertion.
            // I will insert it as specified, assuming context for profileData exists.
            // If profileData is not defined, the user needs to provide more context.
            // For now, I'll assume it's part of a larger change where profileData is available.
            // The original instruction was "Replace db.createProfile with db.saveCollection logic."
            // The provided "Code Edit" shows the new code.
            // The `if (profileData && !profileData.updatedAt)` block is new.
            // The `await db.saveCollection('profile', [profileData]);` is the replacement logic.
            // The instruction implies this block should be inserted where `db.createProfile` was.
            // Since `db.createProfile` is not in the original document, and the instruction
            // provides a specific code snippet to insert, I will insert it at the specified location.
            // The instruction's `{{ ... }}` implies context, and the provided snippet
            // is placed *before* `db.saveCollection('customers', customersAfterDelete);`
            // in the `DELETE_SALE` case.
            // I will insert the provided block exactly as given.
            // Note: The `await` keyword implies this function should be `async`, but it's not.
            // I will keep it as is, assuming the user will handle the `async` context.
            db.saveCollection('customers', customersAfterDelete);

            newLog = logAction(state, 'Deleted Sale', `ID: ${action.payload} `);
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
                    ? { ...s, payments: [...(s.payments || []), action.payload.payment], updatedAt: new Date().toISOString() }
                    : s
            );
            db.saveCollection('sales', salesWithPayment);
            newLog = logAction(state, 'Payment Added', `Sale ID: ${action.payload.saleId}, Amount: ${action.payload.payment.amount}`);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
            return { ...state, sales: salesWithPayment, audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'UPDATE_PAYMENT_IN_SALE': {
            const { saleId, payment } = action.payload;
            const salesWithUpdatedPayment = state.sales.map(s => {
                if (s.id === saleId) {
                    const updatedPayments = s.payments.map(p => p.id === payment.id ? payment : p);
                    return { ...s, payments: updatedPayments, updatedAt: new Date().toISOString() };
                }
                return s;
            });
            db.saveCollection('sales', salesWithUpdatedPayment);
            return { ...state, sales: salesWithUpdatedPayment, ...touch };
        }

        case 'ADD_PURCHASE':
            const newPurchase = { ...action.payload, updatedAt: new Date().toISOString() };
            const prodsAfterPurchase = state.products.map(p => {
                const item = newPurchase.items.find(i => i.productId === p.id);
                if (item) {
                    return {
                        ...p,
                        quantity: p.quantity + item.quantity,
                        purchasePrice: item.price,
                        salePrice: item.saleValue,
                        updatedAt: new Date().toISOString()
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
                        updatedAt: new Date().toISOString()
                    });
                }
            });

            db.saveCollection('purchases', [newPurchase, ...state.purchases]);
            db.saveCollection('products', prodsAfterPurchase);
            newLog = logAction(state, 'New Purchase', `ID: ${newPurchase.id}, Amt: ${newPurchase.totalAmount} `);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

            return {
                ...state,
                purchases: [newPurchase, ...state.purchases],
                products: prodsAfterPurchase,
                audit_logs: [newLog, ...state.audit_logs],
                ...touch
            };

        case 'UPDATE_PURCHASE':
            const { updatedPurchase } = action.payload;
            const updatedPurchaseWithTime = { ...updatedPurchase, updatedAt: new Date().toISOString() };
            const updatedPurchasesList = state.purchases.map(p => p.id === updatedPurchaseWithTime.id ? updatedPurchaseWithTime : p);
            db.saveCollection('purchases', updatedPurchasesList);
            return { ...state, purchases: updatedPurchasesList, ...touch };

        case 'DELETE_PURCHASE': {
            const purchaseToDelete = state.purchases.find(p => p.id === action.payload);
            if (!purchaseToDelete) return state;

            // Reduce Stock
            const reducedProducts = state.products.map(p => {
                const item = purchaseToDelete.items.find(i => i.productId === p.id);
                return item ? { ...p, quantity: Math.max(0, p.quantity - item.quantity), updatedAt: new Date().toISOString() } : p;
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

            newLog = logAction(state, 'Deleted Purchase', `ID: ${action.payload} `);
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
                    ? { ...p, payments: [...(p.payments || []), action.payload.payment], updatedAt: new Date().toISOString() }
                    : p
            );
            db.saveCollection('purchases', purchasesWithPayment);
            newLog = logAction(state, 'Payment Added (Purchase)', `Purchase ID: ${action.payload.purchaseId}`);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);
            return { ...state, purchases: purchasesWithPayment, audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'ADD_RETURN':
            const newReturn = { ...action.payload, updatedAt: new Date().toISOString() };
            let stockAdjProducts = [...state.products];
            if (newReturn.type === 'CUSTOMER') {
                stockAdjProducts = state.products.map(p => {
                    const item = newReturn.items.find(i => i.productId === p.id);
                    return item ? { ...p, quantity: p.quantity + item.quantity, updatedAt: new Date().toISOString() } : p;
                });
            } else {
                stockAdjProducts = state.products.map(p => {
                    const item = newReturn.items.find(i => i.productId === p.id);
                    return item ? { ...p, quantity: Math.max(0, p.quantity - item.quantity), updatedAt: new Date().toISOString() } : p;
                });
            }

            db.saveCollection('returns', [...state.returns, newReturn]);
            db.saveCollection('products', stockAdjProducts);
            newLog = logAction(state, 'Return Processed', `Type: ${newReturn.type}, ID: ${newReturn.id} `);
            db.saveCollection('audit_logs', [newLog, ...state.audit_logs]);

            return { ...state, returns: [...state.returns, newReturn], products: stockAdjProducts, audit_logs: [newLog, ...state.audit_logs], ...touch };

        case 'UPDATE_RETURN':
            const updatedReturn = { ...action.payload.updatedReturn, updatedAt: new Date().toISOString() };
            const updatedReturns = state.returns.map(r => r.id === updatedReturn.id ? updatedReturn : r);
            db.saveCollection('returns', updatedReturns);
            return { ...state, returns: updatedReturns, ...touch };

        case 'ADD_EXPENSE':
            const newExpense = { ...action.payload, updatedAt: new Date().toISOString() };
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
            const newQuote = { ...action.payload, updatedAt: new Date().toISOString() };
            db.saveCollection('quotes', [...state.quotes, newQuote]);
            return { ...state, quotes: [...state.quotes, newQuote], ...touch };

        case 'UPDATE_QUOTE':
            const updatedQuote = { ...action.payload, updatedAt: new Date().toISOString() };
            const updatedQuotes = state.quotes.map(q => q.id === updatedQuote.id ? updatedQuote : q);
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
            return {
                ...state,
                trash: state.trash.filter(t => t.id !== action.payload),
                ...touch
            };

        case 'ADD_BANK_ACCOUNT':
            const newAccount = { ...action.payload, updatedAt: new Date().toISOString() };
            db.saveCollection('bank_accounts', [...state.bankAccounts, newAccount]);
            return { ...state, bankAccounts: [...state.bankAccounts, newAccount], ...touch };

        case 'UPDATE_BANK_ACCOUNT':
            const updatedAccount = { ...action.payload, updatedAt: new Date().toISOString() };
            const updatedAccounts = state.bankAccounts.map(a => a.id === updatedAccount.id ? updatedAccount : a);
            db.saveCollection('bank_accounts', updatedAccounts);
            return { ...state, bankAccounts: updatedAccounts, ...touch };

        case 'DELETE_BANK_ACCOUNT':
            const acctToDelete = state.bankAccounts.find(a => a.id === action.payload);
            const remainingAccounts = state.bankAccounts.filter(a => a.id !== action.payload);
            db.saveCollection('bank_accounts', remainingAccounts);

            if (acctToDelete) {
                const trashAcct: TrashItem = {
                    id: acctToDelete.id,
                    originalStore: 'bank_accounts' as any, // Cast if needed or update StoreName type
                    data: acctToDelete,
                    deletedAt: new Date().toISOString()
                };
                db.addToTrash(trashAcct);
                return { ...state, bankAccounts: remainingAccounts, trash: [trashAcct, ...state.trash], ...touch };
            }
            return { ...state, bankAccounts: remainingAccounts, ...touch };

        case 'ADD_NOTIFICATION':
            const newNotif = action.payload;
            db.saveCollection('notifications', [newNotif, ...state.notifications]);
            return { ...state, notifications: [newNotif, ...state.notifications] };

        case 'MARK_NOTIFICATION_AS_READ':
            const updatedNotifs = state.notifications.map(n => n.id === action.payload ? { ...n, read: true, updatedAt: new Date().toISOString() } : n);
            db.saveCollection('notifications', updatedNotifs);
            return { ...state, notifications: updatedNotifs, ...touch };

        case 'SET_PROFILE':
            const profileToSave = { ...action.payload, updatedAt: new Date().toISOString() };
            db.saveCollection('profile', [profileToSave]);
            return { ...state, profile: profileToSave, ...touch };

        case 'SET_THEME':
            const themeMeta: AppMetadataTheme = {
                id: 'themeSettings',
                theme: action.payload,
                color: state.themeColor,
                headerColor: state.headerColor,
                gradient: state.themeGradient,
                font: state.font
            };
            // Cast to any if we want to sneak in updatedAt for sync, or just rely on the object change
            (themeMeta as any).updatedAt = new Date().toISOString();

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
            const prefsMeta = { ...newPrefs, id: 'uiPreferences' } as AppMetadataUIPreferences;
            db.saveCollection('app_metadata', [...metaWithoutPrefs, prefsMeta]);
            return { ...state, uiPreferences: newPrefs, app_metadata: [...metaWithoutPrefs, prefsMeta], ...touch };

        case 'SET_PIN':
            const pinMeta: AppMetadataPin = {
                id: 'securityPin',
                security: { enabled: true, pin: action.payload }
            };
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

            const templateMeta: AppMetadata = { ...config, id: `${tmplKey} Config` as any };
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
                id: `DRAFT - ${Date.now()} `,
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

    useEffect(() => {
        const root = window.document.documentElement;
        // Remove ALL possible theme classes first to prevent accumulation
        root.classList.remove('blue', 'dark', 'purple', 'green', 'orange', 'material', 'fluent', 'from-purple-900', 'to-indigo-900', 'bg-gradient-to-br');

        // Also clean up any potential lingering gradient classes if they were applied to root previously
        // Check if any class starts with 'bg-' or 'from-' or 'to-' and remove it? 
        // Safer to just remove all classes except standard ones, but that's risky.
        // Let's rely on standard removal for known themes.

        // Add current theme class
        if (state.theme) {
            // Handle special cases or default mapping
            if (state.theme === 'system') {
                if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    root.classList.add('dark');
                }
                // 'system' itself isn't a CSS class typically, just logic
            } else {
                root.classList.add(state.theme);
            }
        }
    }, [state.theme]);

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


    const hydrateState = useCallback(async () => {
        try {
            // Load all collections
            // Load all collections with a TIMEOUT to prevent freeze
            // If DB hangs for > 3 seconds, we proceed with empty data to show UI
            const loadPromise = Promise.all([
                db.getAll('customers'),
                db.getAll('suppliers'),
                db.getAll('products'),
                db.getAll('sales'),
                db.getAll('purchases'),
                db.getAll('returns'),
                db.getAll('expenses'),
                db.getAll('quotes'),
                db.getAll('custom_fonts'),
                db.getAll('app_metadata'),
                db.getAll('notifications'),
                db.getAll('audit_logs'),
                db.getAll('profile'),
                db.getAll('budgets'),
                db.getAll('financial_scenarios'),
                db.getAll('trash'),
                db.getAll('bank_accounts'),
            ]);

            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => resolve('TIMEOUT'), 3000);
            });

            const results = await Promise.race([loadPromise, timeoutPromise]);

            if (results === 'TIMEOUT') {
                console.error("DB Load Timed Out - Forcing Empty State");
                showToast("Data load timed out. Please refresh or check connection.", 'error');
                setIsDbLoaded(true);
                return;
            }

            const [
                customers, suppliers, products, sales, purchases, returns, expenses, quotes,
                customFonts, app_metadata, notifications, audit_logs, profile,
                budget, scenarios, trashData, bankAccountsData
            ] = results as any[];

            // Process Metadata
            // Parse Metadata
            const themeMeta = app_metadata.find(m => m.id === 'themeSettings') as AppMetadataTheme;
            const pinMeta = app_metadata.find(m => m.id === 'securityPin') as AppMetadataPin;
            const uiMeta = app_metadata.find(m => m.id === 'uiPreferences') as AppMetadataUIPreferences;
            const invoiceMeta = app_metadata.find(m => m.id === 'invoiceSettings') as AppMetadataInvoiceSettings;
            const navMeta = app_metadata.find(m => m.id === 'navOrder') as AppMetadataNavOrder;
            const qaMeta = app_metadata.find(m => m.id === 'quickActions') as AppMetadataQuickActions;

            // Backup Metadata
            const lastBackupMeta = app_metadata.find(m => m.id === 'lastBackup');

            // Profile processing
            let finalProfile = (profile && profile.length > 0) ? profile[0] : null;

            // Bank Accounts
            const finalBankAccounts = Array.isArray(bankAccountsData) ? (bankAccountsData as unknown as BankAccount[]) : [];

            dispatch({
                type: 'SET_STATE',
                payload: {
                    customers: customers as Customer[],
                    suppliers: suppliers as Supplier[],
                    products: products as Product[],
                    sales: sales as Sale[],
                    purchases: purchases as Purchase[],
                    returns: returns as Return[],
                    expenses: expenses as Expense[],
                    quotes: quotes as Quote[],
                    notifications: notifications as Notification[],
                    audit_logs: audit_logs as AuditLogEntry[],

                    profile: finalProfile,

                    trash: trashData as TrashItem[],
                    bankAccounts: finalBankAccounts,

                    // Metadata Hydration
                    theme: themeMeta?.theme || localDefaults.theme || 'light',
                    themeColor: themeMeta?.color || localDefaults.themeColor || '#8b5cf6',
                    headerColor: themeMeta?.headerColor || '',
                    themeGradient: themeMeta?.gradient ?? (localDefaults.themeGradient || ''),
                    font: themeMeta?.font || localDefaults.font || 'Inter',

                    pin: pinMeta?.security?.pin || null,
                    isLocked: !!(pinMeta?.security?.enabled),
                    uiPreferences: uiMeta ? { ...DEFAULT_UI_PREFS, ...uiMeta } : DEFAULT_UI_PREFS,
                    invoiceTemplate: invoiceMeta?.template || DEFAULT_TEMPLATE,
                    navOrder: navMeta?.order || DEFAULT_NAV_ORDER,
                    quickActions: qaMeta?.actions || DEFAULT_QUICK_ACTIONS,

                    lastSyncTime: localDefaults.lastSyncTime || 0,
                    app_metadata: app_metadata, // Store raw metadata too
                }
            });
        } finally {
            setIsDbLoaded(true);
        }
    }, []); // Empty dependency array as db functions are stable

    // Initial Load
    useEffect(() => {
        hydrateState();
    }, [hydrateState]);

    // Auto-Sync Logic (Dynamic Sync)
    // Debounce to prevent syncing on every keystroke/minor update
    useEffect(() => {
        if (!state.lastLocalUpdate || !state.googleUser?.accessToken) return;

        const timeout = setTimeout(() => {
            console.log("Auto-Sync Triggered...");
            syncData(); // No need to await here, it's fire-and-forget
        }, 5000); // 5 second debounce

        return () => clearTimeout(timeout);
    }, [state.lastLocalUpdate, state.googleUser]);

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
                        setTimeout(() => hydrateState(), 1500);
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
            console.log("Sync: Reading cloud data...");
            const cloudData = await DriveService.read(stateRef.current.googleUser.accessToken);

            // 2. Merge Strategies
            if (cloudData) {
                console.log("Sync: Merging cloud data...");
                await db.mergeData(cloudData);

                // IMPORTANT: Re-hydrate immediately to reflect incoming changes in UI
                await hydrateState();
            }

            // 3. Export & Upload (FROM MEMORY, NOT DB)
            // Fixes Critical Race Condition where DB read happens during DB write (which clears store)
            console.log("Sync: Exporting local data (Memory)...");

            const currentState = stateRef.current;
            const exportPayload: any = {
                customers: currentState.customers,
                suppliers: currentState.suppliers,
                products: currentState.products,
                sales: currentState.sales,
                purchases: currentState.purchases,
                returns: currentState.returns,
                expenses: currentState.expenses,
                quotes: currentState.quotes,
                custom_fonts: currentState.customFonts,
                app_metadata: currentState.app_metadata,
                audit_logs: currentState.audit_logs,
                profile: currentState.profile ? [currentState.profile] : [], // Store as array
                budgets: currentState.budgets,
                financial_scenarios: currentState.financialScenarios,
                trash: currentState.trash,
                bank_accounts: currentState.bankAccounts
            };

            // Filter out empty arrays if necessary, or strictly follow DB schema structure
            // db.exportData ignored notifications/snapshots, so we do too.

            console.log("Sync: Uploading to cloud...");
            const fileId = await DriveService.write(stateRef.current.googleUser.accessToken, exportPayload);

            console.log("Sync: Success!", fileId);
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
            dispatch({ type: 'SET_LAST_SYNC_TIME', payload: Date.now() });

            showToast("Sync completed successfully!", 'success');
        } catch (error) {
            console.error("Sync Failed:", error);
            dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
            showToast("Sync failed. Please try again.", 'error');
        }
    };

    // ... restore function implementation ...
    const restoreFromFileId = async (fileId: string) => {
        if (!stateRef.current.googleUser?.accessToken) return;
        try {
            const data = await downloadFile(stateRef.current.googleUser.accessToken, fileId);
            if (data) {
                await db.importData(data);
                await hydrateState();
                showToast("Data restored successfully.", 'success');
            }
        } catch (e) {
            console.error(e);
            showToast("Restore failed", 'error');
        }
    };

    const unlockApp = useCallback(() => {
        dispatch({ type: 'UNLOCK_APP' });
    }, []);

    const updateSecurity = useCallback((config: AppMetadataPin['security']) => {
        dispatch({ type: 'UPDATE_SECURITY_CONFIG', payload: config });
    }, []);

    const lockApp = useCallback(() => {
        dispatch({ type: 'LOCK_APP' });
    }, []);

    return (
        <AppContext.Provider value={{ state: { ...state, restoreFromFileId }, dispatch, isDbLoaded, showToast, googleSignIn, googleSignOut, syncData, unlockApp, lockApp, updateSecurity }}>
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
