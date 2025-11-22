
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
  googleUser: null,
  syncStatus: 'idle',
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_STATE':
        return { ...state, ...action.payload };
    case 'SET_THEME':
        return { ...state, theme: action.payload };
    case 'RESET_APP':
        return { ...initialState, theme: state.theme, installPromptEvent: state.installPromptEvent };
    case 'REPLACE_COLLECTION':
        return { ...state, [action.payload.storeName]: action.payload.data };
    case 'SET_NOTIFICATIONS':
        return { ...state, notifications: action.payload };
    case 'SET_PROFILE':
        return { ...state, profile: action.payload };
    case 'SET_PIN':
        const otherMetadata = state.app_metadata.filter(m => m.id !== 'securityPin');
        const newPinMetadata: AppMetadataPin = { id: 'securityPin', pin: action.payload };
        return { ...state, pin: action.payload, app_metadata: [...otherMetadata, newPinMetadata] };
    case 'REMOVE_PIN': {
      const metadataWithoutPin = state.app_metadata.filter(m => m.id !== 'securityPin');
      return { ...state, pin: null, app_metadata: metadataWithoutPin };
    }
    case 'SET_REVENUE_GOAL': {
        const metaWithoutGoal = state.app_metadata.filter(m => m.id !== 'revenueGoal');
        return {
            ...state,
            app_metadata: [...metaWithoutGoal, { id: 'revenueGoal', amount: action.payload }]
        };
    }
    case 'ADD_CUSTOMER':
      return { ...state, customers: [...state.customers, action.payload] };
    case 'UPDATE_CUSTOMER':
      return { ...state, customers: state.customers.map(c => c.id === action.payload.id ? action.payload : c) };
    case 'ADD_SUPPLIER':
      return { ...state, suppliers: [...state.suppliers, action.payload] };
    case 'UPDATE_SUPPLIER':
      return { ...state, suppliers: state.suppliers.map(s => s.id === action.payload.id ? action.payload : s) };
    case 'ADD_PRODUCT':
        const existingProduct = state.products.find(p => p.id === action.payload.id);
        if (existingProduct) {
            return {
                ...state,
                products: state.products.map(p => p.id === action.payload.id ? { ...p, quantity: p.quantity + action.payload.quantity, purchasePrice: action.payload.purchasePrice, salePrice: action.payload.salePrice } : p)
            };
        }
        return { ...state, products: [...state.products, action.payload] };
    case 'UPDATE_PRODUCT':
        return { ...state, products: state.products.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'UPDATE_PRODUCT_STOCK':
        return {
            ...state,
            products: state.products.map(p => p.id === action.payload.productId ? { ...p, quantity: p.quantity + action.payload.change } : p)
        }
    case 'ADD_SALE':
      return { ...state, sales: [...state.sales, action.payload] };
    case 'UPDATE_SALE': {
        const { oldSale, updatedSale } = action.payload;
        // ... (Logic truncated for brevity, keeping existing logic)
        const stockChanges = new Map<string, number>();
        oldSale.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity));
        updatedSale.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) - item.quantity));
        const updatedProducts = state.products.map(p => {
            if (stockChanges.has(p.id)) return { ...p, quantity: p.quantity + (stockChanges.get(p.id) || 0) };
            return p;
        });
        const updatedSales = state.sales.map(s => s.id === updatedSale.id ? updatedSale : s);
        return { ...state, sales: updatedSales, products: updatedProducts };
    }
    case 'DELETE_SALE': {
      const saleToDelete = state.sales.find(s => s.id === action.payload);
      if (!saleToDelete) return state;
      // ... (Logic truncated)
      const stockChanges = new Map<string, number>();
      saleToDelete.items.forEach(item => stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity));
      let updatedProducts = state.products;
      stockChanges.forEach((change, productId) => {
        updatedProducts = updatedProducts.map(p => p.id === productId ? { ...p, quantity: p.quantity + change } : p);
      });
      return { ...state, sales: state.sales.filter(s => s.id !== action.payload), products: updatedProducts };
    }
    case 'ADD_PURCHASE':
      return { ...state, purchases: [...state.purchases, action.payload] };
    case 'UPDATE_PURCHASE': {
        const { oldPurchase, updatedPurchase } = action.payload;
        // ... (Logic truncated, using complex logic from previous version)
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
        return { ...state, purchases: updatedPurchases, products: updatedProducts };
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
      return { ...state, purchases: state.purchases.filter(p => p.id !== action.payload), products: updatedProducts };
    }
    case 'ADD_RETURN': {
      // ... (Logic truncated)
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
      return { ...state, products: updatedProducts, sales: updatedSales, purchases: updatedPurchases, returns: [...state.returns, returnPayload] };
    }
    case 'UPDATE_RETURN': {
       // ... (Logic truncated)
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
        return { ...state, products: updatedProducts, sales: updatedSales, purchases: updatedPurchases, returns: updatedReturns };
    }
    case 'ADD_PAYMENT_TO_SALE':
      return { ...state, sales: state.sales.map(sale => sale.id === action.payload.saleId ? { ...sale, payments: [...(sale.payments || []), action.payload.payment] } : sale) };
    case 'ADD_PAYMENT_TO_PURCHASE':
      return { ...state, purchases: state.purchases.map(purchase => purchase.id === action.payload.purchaseId ? { ...purchase, payments: [...(purchase.payments || []), action.payload.payment] } : purchase) };
    case 'SHOW_TOAST':
        return { ...state, toast: { message: action.payload.message, show: true, type: action.payload.type || 'info' } };
    case 'HIDE_TOAST':
        return { ...state, toast: { ...state.toast, show: false } };
    case 'SET_LAST_BACKUP_DATE':
      const otherMeta = state.app_metadata.filter(m => m.id !== 'lastBackup');
      return { ...state, app_metadata: [...otherMeta, { id: 'lastBackup', date: action.payload }] };
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
    try {
        // 1. Ensure Folder Exists
        let folderId = await searchFolder(accessToken);
        if (!folderId) {
            folderId = await createFolder(accessToken);
        }

        // 2. Look for backup file
        const remoteFile = await searchFile(accessToken, folderId);

        if (remoteFile) {
            // Conflict Resolution: If remote file exists, check if we should pull
            // Ideally we compare timestamps. For now, we ask user or simple overwrite if remote is newer.
            // Simplified: Always pull on initial login to sync state.
            const remoteData = await downloadFile(accessToken, remoteFile.id);
            if (remoteData) {
               // Merge or Replace? Let's replace for consistency in this model
               await db.importData(remoteData);
               // Reload state from DB
               const reloadedData = await db.exportData();
               dispatch({ type: 'SET_STATE', payload: reloadedData });
            }
        } else {
            // Upload current local data
            const currentData = await db.exportData();
            await uploadFile(accessToken, folderId, currentData);
        }
    } catch (e) {
        console.error("Sync failed", e);
        dispatch({ type: 'SET_SYNC_STATUS', payload: 'error' });
    }
  };

  const syncData = async () => {
      if (!state.googleUser?.accessToken) return;
      dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
      try {
          const folderId = await searchFolder(state.googleUser.accessToken);
          if (folderId) {
              const remoteFile = await searchFile(state.googleUser.accessToken, folderId);
              const currentData = await db.exportData();
              await uploadFile(state.googleUser.accessToken, folderId, currentData, remoteFile?.id);
              dispatch({ type: 'SET_SYNC_STATUS', payload: 'success' });
              showToast("Cloud Sync Complete");
          }
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
    // 1. Clear Local Database to implement Clean Slate protocol
    await db.clearDatabase();

    // 2. Reset App State (this clears data in memory)
    dispatch({ type: 'RESET_APP' });

    // 3. Clear User Session
    dispatch({ type: 'SET_GOOGLE_USER', payload: null });
    dispatch({ type: 'SET_SYNC_STATUS', payload: 'idle' });
    
    showToast("Signed out. Local data cleared.");
  };

  // Debounced Auto-Sync on Data Change
  useEffect(() => {
      if (state.googleUser && isDbLoaded) {
          const handler = setTimeout(() => {
              syncData();
          }, 10000); // Auto-sync 10 seconds after last change
          return () => clearTimeout(handler);
      }
  }, [state.customers, state.sales, state.purchases, state.products]);


  // ... (Existing PWA install prompt listener code)
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

  // Load initial data
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
  
  // Persist data
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
