
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useRef } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, Payment, BeforeInstallPromptEvent, Notification, ProfileData, Page, AppMetadata, AppMetadataPin, Theme, GoogleUser, AuditLogEntry, SyncStatus, AppMetadataTheme, Expense } from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';
import { DriveService, initGoogleAuth, getUserInfo, loadGoogleScript, downloadFile } from '../utils/googleDrive';

interface ToastState {
  message: string;
  show: boolean;
  type: 'success' | 'info';
}

export interface AppState {
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  sales: Sale[];
  purchases: Purchase[];
  returns: Return[];
  expenses: Expense[];
  app_metadata: AppMetadata[];
  notifications: Notification[];
  audit_logs: AuditLogEntry[];
  profile: ProfileData | null;
  toast: ToastState;
  selection: { page: Page; id: string; action?: 'edit' } | null;
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
  | { type: 'ADD_PAYMENT_TO_SALE'; payload: { saleId: string; payment: Payment } }
  | { type: 'ADD_PAYMENT_TO_PURCHASE'; payload: { purchaseId: string; payment: Payment } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'info' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_LAST_BACKUP_DATE'; payload: string }
  | { type: 'SET_SELECTION'; payload: { page: Page; id: string; action?: 'edit' } }
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

const initialState: AppState = {
  customers: [],
  suppliers: [],
  products: [],
  sales: [],
  purchases: [],
  returns: [],
  expenses: [],
  app_metadata: [],
  notifications: [],
  audit_logs: [],
  profile: null,
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

interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    showToast: (message: string, type?: 'success' | 'info') => void;
    isDbLoaded: boolean;
    googleSignIn: (options?: { forceConsent?: boolean }) => void;
    googleSignOut: () => void;
    syncData: (options?: { silent?: boolean }) => Promise<void>;
    restoreFromFileId: (fileId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => null,
  showToast: () => null,
  isDbLoaded: false,
  googleSignIn: () => {},
  googleSignOut: () => {},
  syncData: async () => {},
  restoreFromFileId: async () => {},
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isDbLoaded, setIsDbLoaded] = useState(false);
  const tokenClient = useRef<any>(null);
  const isSyncingRef = useRef(false);

  // Audit Logging Wrapper
  const dispatchWithLogging = (action: Action) => {
    dispatch(action);
    
    // Auto-log specific actions
    if (['ADD_SALE', 'UPDATE_SALE', 'ADD_PURCHASE', 'UPDATE_PURCHASE', 'ADD_CUSTOMER', 'UPDATE_CUSTOMER', 'ADD_PAYMENT_TO_SALE', 'ADD_EXPENSE'].includes(action.type)) {
        const logEntry: AuditLogEntry = {
            id: `LOG-${Date.now()}`,
            timestamp: new Date().toISOString(),
            user: state.googleUser ? state.googleUser.email : 'Local User',
            action: action.type.replace(/_/g, ' '),
            details: 'payload' in action ? JSON.stringify((action.payload as any).id || 'item') : 'N/A',
        };
        dispatch({ type: 'ADD_AUDIT_LOG', payload: logEntry });
    }
  };

  // Load Google Scripts
  useEffect(() => {
    loadGoogleScript()
      .then(() => {
        tokenClient.current = initGoogleAuth((response: any) => {
          if (response && response.access_token) {
            handleGoogleLoginSuccess(response.access_token);
          }
        });
      })
      .catch(err => console.error("Failed to load Google Scripts", err));
  }, []);

  const handleGoogleLoginSuccess = async (accessToken: string) => {
    try {
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      const userInfo = await getUserInfo(accessToken);
      
      const user: GoogleUser = {
        name: userInfo.name,
        email: userInfo.email,
        picture: userInfo.picture,
        accessToken: accessToken
      };
      
      localStorage.setItem('googleUser', JSON.stringify(user));
      dispatch({ type: 'SET_GOOGLE_USER', payload: user });
      await performSync(accessToken);
      // syncStatus is set inside performSync
      showToast(`Signed in as ${user.name}`);
    } catch (error) {
      console.error("Login failed", error);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      showToast("Google Sign-In failed", 'info');
    }
  };

  const performRestore = async (data: any, accessToken: string) => {
      await db.importData(data, true); // Merge
            
      // Reload state from DB to ensure we have the full picture (Arrays)
      const mergedData = await db.exportData() as any;
      
      // Normalize for App State (React)
      const normalizeForState = (d: any) => {
          const stateData = { ...d };
          if (stateData.profile && Array.isArray(stateData.profile)) {
              stateData.profile = stateData.profile.length > 0 ? stateData.profile[0] : null;
          }
          if (stateData.sales) {
              stateData.sales = stateData.sales.map((s: any) => ({ ...s, payments: s.payments || [] }));
          }
          if (stateData.purchases) {
              stateData.purchases = stateData.purchases.map((p: any) => ({ ...p, payments: p.payments || [] }));
          }
          // Apply Theme from Metadata
          const meta = d.app_metadata || [];
          const themeMeta = meta.find((m: any) => m.id === 'themeSettings');
          if (themeMeta) {
              stateData.theme = themeMeta.theme;
              stateData.themeColor = themeMeta.color;
              stateData.themeGradient = themeMeta.gradient;
          }
          return stateData;
      };
      
      // We create a separate object for state to not mutate mergedData which is used for upload
      const finalState = normalizeForState(mergedData);
      
      // Update React State
      dispatch({ type: 'SET_STATE', payload: finalState });
      showToast("Data restored from cloud.", 'success');

      // Push back to update timestamp on current active file
      try {
          await DriveService.write(accessToken, mergedData);
      } catch(e: any) {
          console.error("Upload failed during sync", e);
      }
  };

  const performSync = async (accessToken: string) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
        // 1. Pull (Download) using DriveService
        let remoteData = null;
        try {
            // showToast("Checking cloud...", 'info'); // Silenced to avoid spam
            remoteData = await DriveService.read(accessToken);
        } catch (e) {
            console.error("Failed to download remote file:", e);
            // If download fails completely (network/auth), abort sync
            throw e; 
        }

        // 2. Timestamp Check
        const currentLocalData = await db.exportData();
        const localMeta = (currentLocalData.app_metadata || []) as AppMetadata[];
        // @ts-ignore
        const localTs = localMeta.find(m => m.id === 'lastModified')?.timestamp || 0;
        
        const remoteMeta = (remoteData?.app_metadata || []) as AppMetadata[];
        // @ts-ignore
        const remoteTs = remoteMeta.find(m => m.id === 'lastModified')?.timestamp || 0;

        console.log(`Sync Check: LocalTS=${localTs}, RemoteTS=${remoteTs}`);

        if (remoteData && remoteTs > localTs) {
            console.log("Remote is newer. Restoring...");
            await performRestore(remoteData, accessToken);
        } else if (localTs > remoteTs || !remoteData) {
             console.log("Local is newer (or remote empty). Uploading...");
             // Upload local data to cloud (currentLocalData has arrays, so it's safe)
             await DriveService.write(accessToken, currentLocalData);
        } else {
             // Timestamps equal.
             // Legacy Case Check: If both 0, and local is empty but remote has data, restore.
             const localHasData = (currentLocalData.customers || []).length > 0;
             const remoteHasData = (remoteData?.customers || []).length > 0;
             
             if (localTs === 0 && remoteTs === 0 && !localHasData && remoteHasData) {
                 console.log("Legacy Sync: Local empty, remote has data. Restoring...");
                 await performRestore(remoteData, accessToken);
             } else {
                 console.log("Data is up to date.");
             }
        }
        
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
        dispatch({ type: 'SET_LAST_SYNC_TIME', payload: Date.now() });

    } catch (e: any) {
        console.error("Sync failed", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        
        if (e.message && (e.message.includes('401') || e.message.includes('403'))) {
             showToast("Session Expired. Tap Cloud icon to reconnect.", 'info');
        } else if (e.message && e.message.includes('Access Not Configured')) {
             showToast("Sync Error: Drive API not enabled. See Diagnostics.", 'info');
        }
    } finally {
        isSyncingRef.current = false;
    }
  };

  const restoreFromFileId = async (fileId: string) => {
      if (!state.googleUser?.accessToken) return;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
          showToast("Forcing restore from selected file...", 'info');
          const data = await downloadFile(state.googleUser.accessToken, fileId);
          if (data) {
              await performRestore(data, state.googleUser.accessToken);
              // Update cache to point to this file for future
              localStorage.setItem('gdrive_file_id', fileId);
              dispatch({ type: 'SET_LAST_SYNC_TIME', payload: Date.now() });
          } else {
              showToast("File was empty.", 'info');
          }
      } catch (e) {
          console.error("Force restore failed", e);
          showToast("Restore failed. See console.", 'info');
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      } finally {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
      }
  };

  const syncData = async (options: { silent?: boolean } = {}) => {
      if (!state.googleUser?.accessToken) return;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
          const accessToken = state.googleUser.accessToken;
          await performSync(accessToken);
          if (!options.silent) showToast("Cloud Sync Complete");
      } catch (e) {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          console.error("Manual sync failed", e);
      }
  };

  const googleSignIn = (options?: { forceConsent?: boolean }) => {
    if (tokenClient.current) {
      if (options?.forceConsent) {
          tokenClient.current.requestAccessToken({ prompt: 'consent' });
      } else {
          tokenClient.current.requestAccessToken();
      }
    } else {
      showToast("Google Auth not initialized", 'info');
    }
  };

  const googleSignOut = async () => {
    // Fail-safe: Attempt to sync/backup before wiping data
    if (state.googleUser?.accessToken && navigator.onLine) {
        try {
            showToast("Backing up before sign out...", "info");
            // We await the sync to ensure upload completes if needed
            await syncData({ silent: true });
        } catch (e) {
            console.warn("Pre-signout sync failed:", e);
            // Proceed with signout anyway, assuming user wants to leave
        }
    }

    await db.clearDatabase();
    
    // Explicitly clear theme settings from localStorage so RESET_APP doesn't pick them up
    localStorage.removeItem('theme');
    localStorage.removeItem('themeColor');
    localStorage.removeItem('themeGradient');
    
    dispatch({ type: 'RESET_APP' });
    
    localStorage.removeItem('googleUser');
    localStorage.removeItem('gdrive_folder_id'); // Clear sync cache
    localStorage.removeItem('gdrive_file_id');
    localStorage.removeItem('lastSyncTime');
    dispatch({ type: 'SET_GOOGLE_USER', payload: null });
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
    showToast("Signed out. Local data cleared.");
  };

  // Update Metadata Timestamp when local data changes
  // This is crucial for the sync logic to work
  useEffect(() => {
      if (isDbLoaded && state.lastLocalUpdate > 0) {
          dispatch({ type: 'UPDATE_METADATA_TIMESTAMP', payload: state.lastLocalUpdate });
      }
  }, [state.lastLocalUpdate, isDbLoaded]);

  // Auto-Sync Effect (Data Changes)
  useEffect(() => {
      // Trigger sync only when local data changes (tracked by lastLocalUpdate)
      // This prevents infinite loops where sync-down triggers sync-up triggers sync-down...
      if (state.googleUser && isDbLoaded && state.lastLocalUpdate > 0) {
          const handler = setTimeout(() => {
              syncData({ silent: true }); // Silent sync for background updates
          }, 5000); // Debounce 5s
          return () => clearTimeout(handler);
      }
  }, [state.lastLocalUpdate]);

  // Daily Backup / Connection Recovery Logic
  useEffect(() => {
      if (!isDbLoaded || !state.googleUser) return;

      const runDailyCheck = () => {
          if (!navigator.onLine) return;
          
          const lastSync = state.lastSyncTime;
          const now = new Date();
          
          // Check if last sync was on a different day (or never)
          let needsBackup = false;
          if (!lastSync) {
              needsBackup = true;
          } else {
              const lastSyncDate = new Date(lastSync);
              // Compare Year, Month, Date to see if it's a new day
              if (
                  lastSyncDate.getDate() !== now.getDate() ||
                  lastSyncDate.getMonth() !== now.getMonth() ||
                  lastSyncDate.getFullYear() !== now.getFullYear()
              ) {
                  needsBackup = true;
              }
          }

          if (needsBackup) {
              console.log("Performing Daily Backup/Sync...");
              syncData({ silent: true });
          }
      };

      // 1. Check immediately on load
      runDailyCheck();

      // 2. Check when network comes online
      const handleOnline = () => runDailyCheck();
      window.addEventListener('online', handleOnline);

      // 3. Check when app comes to foreground
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible') {
              runDailyCheck();
          }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 4. Check periodically (every hour) if app stays open to catch date changes
      const interval = setInterval(runDailyCheck, 60 * 60 * 1000);

      return () => {
          window.removeEventListener('online', handleOnline);
          document.removeEventListener('visibilitychange', handleVisibilityChange);
          clearInterval(interval);
      };
  }, [isDbLoaded, state.googleUser, state.lastSyncTime]);


  useEffect(() => {
    const deferredPrompt = (window as any).deferredInstallPrompt;
    if (deferredPrompt) {
        dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: deferredPrompt as BeforeInstallPromptEvent });
    }
    const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: e as BeforeInstallPromptEvent });
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [dispatch]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customers, suppliers, products, sales, purchases, returns, expenses, app_metadata, notifications, profile, audit_logs] = await Promise.all([
          db.getAll('customers'),
          db.getAll('suppliers'),
          db.getAll('products'),
          db.getAll('sales'),
          db.getAll('purchases'),
          db.getAll('returns'),
          db.getAll('expenses'),
          db.getAll('app_metadata'),
          db.getAll('notifications'),
          db.getAll('profile'),
          db.getAll('audit_logs'),
        ]);

        const validatedMetadata = Array.isArray(app_metadata) ? app_metadata : [];
        const pinData = validatedMetadata.find(m => m.id === 'securityPin') as AppMetadataPin | undefined;
        const themeData = validatedMetadata.find(m => m.id === 'themeSettings') as AppMetadataTheme | undefined;

        const validatedState: Partial<AppState> = {
            customers: Array.isArray(customers) ? customers : [],
            suppliers: Array.isArray(suppliers) ? suppliers : [],
            products: Array.isArray(products) ? products : [],
            sales: (Array.isArray(sales) ? sales : []).map((s: any) => ({ ...s, payments: s.payments || [] })),
            purchases: (Array.isArray(purchases) ? purchases : []).map((p: any) => ({ ...p, payments: p.payments || [] })),
            returns: Array.isArray(returns) ? returns : [],
            expenses: Array.isArray(expenses) ? expenses : [],
            app_metadata: validatedMetadata,
            audit_logs: Array.isArray(audit_logs) ? audit_logs : [],
            theme: themeData?.theme || getInitialTheme(),
            themeColor: themeData?.color || getInitialThemeColor(),
            themeGradient: themeData?.gradient || getInitialThemeGradient(),
        };
        dispatch({ type: 'SET_STATE', payload: validatedState });
        if (pinData?.pin) {
            dispatch({ type: 'SET_PIN', payload: pinData.pin });
        }
        dispatch({ type: 'SET_NOTIFICATIONS', payload: Array.isArray(notifications) ? notifications : [] });
        dispatch({ type: 'SET_PROFILE', payload: (Array.isArray(profile) && profile.length > 0) ? profile[0] : null });
      } catch (error) {
        console.error("Could not load data from IndexedDB", error);
      } finally {
        setIsDbLoaded(true);
      }
    };
    loadData();
  }, []);
  
  useEffect(() => { if (isDbLoaded) db.saveCollection('customers', state.customers); }, [state.customers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('suppliers', state.suppliers); }, [state.suppliers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('products', state.products); }, [state.products, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('sales', state.sales); }, [state.sales, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('purchases', state.purchases); }, [state.purchases, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('returns', state.returns); }, [state.returns, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('expenses', state.expenses); }, [state.expenses, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('app_metadata', state.app_metadata); }, [state.app_metadata, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('notifications', state.notifications); }, [state.notifications, isDbLoaded]);
  useEffect(() => { if (isDbLoaded && state.profile) db.saveCollection('profile', [state.profile]); }, [state.profile, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('audit_logs', state.audit_logs); }, [state.audit_logs, isDbLoaded]);
  
  useEffect(() => { 
      if (state.lastSyncTime) {
          localStorage.setItem('lastSyncTime', state.lastSyncTime.toString());
      }
  }, [state.lastSyncTime]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  };

  // Inject helper into state for easy access via context hook in components
  const extendedState = { ...state, restoreFromFileId };

  return <AppContext.Provider value={{ state: extendedState, dispatch: dispatchWithLogging, showToast, isDbLoaded, googleSignIn, googleSignOut, syncData, restoreFromFileId }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
