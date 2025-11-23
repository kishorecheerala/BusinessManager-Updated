
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState, useRef } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, Payment, BeforeInstallPromptEvent, Notification, ProfileData, Page, AppMetadata, AppMetadataPin, Theme, GoogleUser, AuditLogEntry, SyncStatus } from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';
import { searchFolder, createFolder, searchFile, uploadFile, downloadFile, initGoogleAuth, getUserInfo, loadGoogleScript } from '../utils/googleDrive';

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
  app_metadata: AppMetadata[];
  notifications: Notification[];
  audit_logs: AuditLogEntry[];
  profile: ProfileData | null;
  toast: ToastState;
  selection: { page: Page; id: string; action?: 'edit' } | null;
  installPromptEvent: BeforeInstallPromptEvent | null;
  pin: string | null;
  theme: Theme;
  googleUser: GoogleUser | null;
  syncStatus: SyncStatus;
  lastLocalUpdate: number; // Timestamp of last user-initiated change to trigger sync
}

type Action =
  | { type: 'SET_STATE'; payload: Partial<AppState> }
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_PROFILE'; payload: ProfileData | null }
  | { type: 'SET_PIN'; payload: string }
  | { type: 'REMOVE_PIN' }
  | { type: 'SET_REVENUE_GOAL'; payload: number }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'ADD_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT'; payload: Product }
  | { type: 'UPDATE_PRODUCT_STOCK'; payload: { productId: string; change: number } }
  | { type: 'ADD_SALE'; payload: Sale }
  | { type: 'UPDATE_SALE'; payload: { oldSale: Sale, updatedSale: Sale } }
  | { type: 'DELETE_SALE'; payload: string } // saleId
  | { type: 'ADD_PURCHASE'; payload: Purchase }
  | { type: 'UPDATE_PURCHASE'; payload: { oldPurchase: Purchase, updatedPurchase: Purchase } }
  | { type: 'DELETE_PURCHASE'; payload: string } // purchaseId
  | { type: 'ADD_RETURN'; payload: Return }
  | { type: 'UPDATE_RETURN'; payload: { oldReturn: Return, updatedReturn: Return } }
  | { type: 'ADD_PAYMENT_TO_SALE'; payload: { saleId: string; payment: Payment } }
  | { type: 'ADD_PAYMENT_TO_PURCHASE'; payload: { purchaseId: string; payment: Payment } }
  | { type: 'SHOW_TOAST'; payload: { message: string; type?: 'success' | 'info' } }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_LAST_BACKUP_DATE'; payload: string }
  | { type: 'SET_SELECTION'; payload: { page: Page; id: string; action?: 'edit' } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_INSTALL_PROMPT_EVENT'; payload: BeforeInstallPromptEvent | null }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'MARK_NOTIFICATION_AS_READ'; payload: string } // id
  | { type: 'MARK_ALL_NOTIFICATIONS_AS_READ' }
  | { type: 'REPLACE_COLLECTION'; payload: { storeName: StoreName, data: any[] } }
  | { type: 'SET_GOOGLE_USER'; payload: GoogleUser | null }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLogEntry }
  | { type: 'RESET_APP' };


const getInitialTheme = (): Theme => {
  try {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme) return savedTheme;
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch (e) {
    // ignore
  }
  return 'light';
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

const initialState: AppState = {
  customers: [],
  suppliers: [],
  products: [],
  sales: [],
  purchases: [],
  returns: [],
  app_metadata: [],
  notifications: [],
  audit_logs: [],
  profile: null,
  toast: { message: '', show: false, type: 'info' },
  selection: null,
  installPromptEvent: null,
  pin: null,
  theme: getInitialTheme(),
  googleUser: getInitialGoogleUser(),
  syncStatus: 'idle',
  lastLocalUpdate: 0,
};

const appReducer = (state: AppState, action: Action): AppState => {
  const touch = { lastLocalUpdate: Date.now() };
  switch (action.type) {
    case 'SET_STATE':
        return { ...state, ...action.payload };
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    case 'RESET_APP':
        return { ...initialState, theme: state.theme, installPromptEvent: state.installPromptEvent };
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
    googleSignIn: () => void;
    googleSignOut: () => void;
    syncData: () => Promise<void>;
}

const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => null,
  showToast: () => null,
  isDbLoaded: false,
  googleSignIn: () => {},
  googleSignOut: () => {},
  syncData: async () => {},
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
    if (['ADD_SALE', 'UPDATE_SALE', 'ADD_PURCHASE', 'UPDATE_PURCHASE', 'ADD_CUSTOMER', 'UPDATE_CUSTOMER', 'ADD_PAYMENT_TO_SALE'].includes(action.type)) {
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
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
      showToast(`Signed in as ${user.name}`);
    } catch (error) {
      console.error("Login failed", error);
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
      showToast("Google Sign-In failed", 'info');
    }
  };

  const performSync = async (accessToken: string) => {
    if (isSyncingRef.current) return;
    isSyncingRef.current = true;

    try {
        let folderId = localStorage.getItem('gdrive_folder_id');
        let fileId = localStorage.getItem('gdrive_file_id');

        // 1. Ensure Folder Exists
        if (!folderId) {
            folderId = await searchFolder(accessToken);
            if (!folderId) {
                folderId = await createFolder(accessToken);
            }
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
        }

        // 2. Look for backup file
        let remoteFileId = fileId;
        if (!remoteFileId && folderId) {
             const remoteFile = await searchFile(accessToken, folderId);
             remoteFileId = remoteFile ? remoteFile.id : null;
             if (remoteFileId) localStorage.setItem('gdrive_file_id', remoteFileId);
        }

        // 3. Pull (Download & Merge)
        let remoteData = null;
        if (remoteFileId) {
            try {
                showToast("Found backup, restoring...", 'info');
                remoteData = await downloadFile(accessToken, remoteFileId);
                if (!remoteData) {
                    throw new Error("Backup file found but returned empty content.");
                }
            } catch (e) {
                // CRITICAL FIX: If we found an ID but failed to download, DO NOT continue.
                // Continuing would cause the 'else if' block to run, potentially uploading empty local state
                // and destroying the cloud backup on the next sync.
                console.error("Failed to download remote file:", e);
                showToast("Restore Failed: Found backup but could not download. Check connection.", 'info');
                // Rethrow so we exit the sync process entirely
                throw e; 
            }
        }

        if (remoteData) {
            // MERGE MODE
            await db.importData(remoteData, true);
            
            // Reload state
            const mergedData = await db.exportData() as any;
            
            // Normalize
            const normalize = (data: any) => {
                if (data.profile && Array.isArray(data.profile)) {
                    data.profile = data.profile.length > 0 ? data.profile[0] : null;
                }
                if (data.sales) {
                    data.sales = data.sales.map((s: any) => ({ ...s, payments: s.payments || [] }));
                }
                if (data.purchases) {
                    data.purchases = data.purchases.map((p: any) => ({ ...p, payments: p.payments || [] }));
                }
                return data;
            };
            
            const finalState = normalize(mergedData);
            // Update state without triggering lastLocalUpdate (to avoid infinite loop)
            dispatch({ type: 'SET_STATE', payload: finalState });

            // 4. Push (Upload combined)
            // Only push if we have a valid folderId
            if (folderId) {
                try {
                    await uploadFile(accessToken, folderId, finalState, remoteFileId || undefined);
                } catch(e: any) {
                    if (e.message && e.message.includes('404')) {
                        const result = await uploadFile(accessToken, folderId, finalState);
                        if (result && result.id) localStorage.setItem('gdrive_file_id', result.id);
                    } else {
                        throw e;
                    }
                }
            }
        } else if (folderId) {
            // No remote file found -> Upload Local (Only if it's truly a new setup)
            const currentData = await db.exportData();
            const hasLocalData = (currentData.customers && currentData.customers.length > 0) || 
                                 (currentData.sales && currentData.sales.length > 0) ||
                                 (currentData.products && currentData.products.length > 0);

            if (hasLocalData) {
                const result = await uploadFile(accessToken, folderId, currentData);
                if (result && result.id) localStorage.setItem('gdrive_file_id', result.id);
            }
        }
    } catch (e: any) {
        console.error("Sync failed", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
        
        if (e.message && (e.message.includes('401') || e.message.includes('403'))) {
             showToast("Sync Error: Authentication failed. Please sign in again.", 'info');
        }
    } finally {
        isSyncingRef.current = false;
    }
  };

  const syncData = async () => {
      if (!state.googleUser?.accessToken) return;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
          const accessToken = state.googleUser.accessToken;
          await performSync(accessToken);
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
          showToast("Cloud Sync Complete");
      } catch (e) {
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
          console.error("Manual sync failed", e);
      }
  };

  const googleSignIn = () => {
    if (tokenClient.current) {
      tokenClient.current.requestAccessToken();
    } else {
      showToast("Google Auth not initialized", 'info');
    }
  };

  const googleSignOut = async () => {
    await db.clearDatabase();
    dispatch({ type: 'RESET_APP' });
    localStorage.removeItem('googleUser');
    localStorage.removeItem('gdrive_folder_id'); // Clear sync cache
    localStorage.removeItem('gdrive_file_id');
    dispatch({ type: 'SET_GOOGLE_USER', payload: null });
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
    showToast("Signed out. Local data cleared.");
  };

  // Auto-Sync Effect
  useEffect(() => {
      // Trigger sync only when local data changes (tracked by lastLocalUpdate)
      // This prevents infinite loops where sync-down triggers sync-up triggers sync-down...
      if (state.googleUser && isDbLoaded && state.lastLocalUpdate > 0) {
          const handler = setTimeout(() => {
              syncData();
          }, 5000); // Debounce 5s
          return () => clearTimeout(handler);
      }
  }, [state.lastLocalUpdate]);


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
        const [customers, suppliers, products, sales, purchases, returns, app_metadata, notifications, profile, audit_logs] = await Promise.all([
          db.getAll('customers'),
          db.getAll('suppliers'),
          db.getAll('products'),
          db.getAll('sales'),
          db.getAll('purchases'),
          db.getAll('returns'),
          db.getAll('app_metadata'),
          db.getAll('notifications'),
          db.getAll('profile'),
          db.getAll('audit_logs'),
        ]);

        const validatedMetadata = Array.isArray(app_metadata) ? app_metadata : [];
        const pinData = validatedMetadata.find(m => m.id === 'securityPin') as AppMetadataPin | undefined;

        const validatedState: Partial<AppState> = {
            customers: Array.isArray(customers) ? customers : [],
            suppliers: Array.isArray(suppliers) ? suppliers : [],
            products: Array.isArray(products) ? products : [],
            sales: (Array.isArray(sales) ? sales : []).map((s: any) => ({ ...s, payments: s.payments || [] })),
            purchases: (Array.isArray(purchases) ? purchases : []).map((p: any) => ({ ...p, payments: p.payments || [] })),
            returns: Array.isArray(returns) ? returns : [],
            app_metadata: validatedMetadata,
            audit_logs: Array.isArray(audit_logs) ? audit_logs : [],
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
  useEffect(() => { if (isDbLoaded) db.saveCollection('app_metadata', state.app_metadata); }, [state.app_metadata, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('notifications', state.notifications); }, [state.notifications, isDbLoaded]);
  useEffect(() => { if (isDbLoaded && state.profile) db.saveCollection('profile', [state.profile]); }, [state.profile, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('audit_logs', state.audit_logs); }, [state.audit_logs, isDbLoaded]);

  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  };

  return <AppContext.Provider value={{ state, dispatch: dispatchWithLogging, showToast, isDbLoaded, googleSignIn, googleSignOut, syncData }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
