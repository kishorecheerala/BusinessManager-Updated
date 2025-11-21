
import React, { createContext, useReducer, useContext, useEffect, ReactNode, useState } from 'react';
import { Customer, Supplier, Product, Sale, Purchase, Return, Payment, BeforeInstallPromptEvent, Notification, ProfileData, Page, AppMetadata, AppMetadataPin, Theme } from '../types';
import * as db from '../utils/db';
import { StoreName } from '../utils/db';

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
  profile: ProfileData | null;
  toast: ToastState;
  selection: { page: Page; id: string; action?: 'edit' } | null;
  installPromptEvent: BeforeInstallPromptEvent | null;
  pin: string | null;
  theme: Theme;
}

type Action =
  | { type: 'SET_STATE'; payload: Omit<AppState, 'toast' | 'selection' | 'installPromptEvent' | 'notifications' | 'profile' | 'pin' | 'theme'> }
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
  | { type: 'REPLACE_COLLECTION'; payload: { storeName: StoreName, data: any[] } };


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
  profile: null,
  toast: { message: '', show: false, type: 'info' },
  selection: null,
  installPromptEvent: null,
  pin: null,
  theme: getInitialTheme(),
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_STATE':
        return { ...state, ...action.payload };
    case 'SET_THEME':
        return { ...state, theme: action.payload };
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

        const stockChanges = new Map<string, number>();

        // Add back stock from the old sale items
        oldSale.items.forEach(item => {
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + item.quantity);
        });

        // Subtract stock for the updated sale items
        updatedSale.items.forEach(item => {
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) - item.quantity);
        });

        const updatedProducts = state.products.map(p => {
            if (stockChanges.has(p.id)) {
                return {
                    ...p,
                    quantity: p.quantity + (stockChanges.get(p.id) || 0),
                };
            }
            return p;
        });
        
        const updatedSales = state.sales.map(s => s.id === updatedSale.id ? updatedSale : s);

        return {
            ...state,
            sales: updatedSales,
            products: updatedProducts,
        };
    }
    case 'DELETE_SALE': {
      const saleToDelete = state.sales.find(s => s.id === action.payload);
      if (!saleToDelete) return state;

      const stockChanges = new Map<string, number>();
      saleToDelete.items.forEach(item => {
        const currentChange = stockChanges.get(item.productId) || 0;
        stockChanges.set(item.productId, currentChange + item.quantity); // Add stock back
      });

      let updatedProducts = state.products;
      stockChanges.forEach((change, productId) => {
        updatedProducts = updatedProducts.map(p =>
          p.id === productId ? { ...p, quantity: p.quantity + change } : p
        );
      });

      return {
        ...state,
        sales: state.sales.filter(s => s.id !== action.payload),
        products: updatedProducts,
      };
    }
    case 'ADD_PURCHASE':
      return { ...state, purchases: [...state.purchases, action.payload] };
    case 'UPDATE_PURCHASE': {
        const { oldPurchase, updatedPurchase } = action.payload;

        let tempProducts = [...state.products];

        // Create a set of all product IDs involved for easier lookup
        const allProductIds = new Set([
            ...oldPurchase.items.map(i => i.productId),
            ...updatedPurchase.items.map(i => i.productId)
        ]);

        allProductIds.forEach(productId => {
            const oldItem = oldPurchase.items.find(i => i.productId === productId);
            const newItem = updatedPurchase.items.find(i => i.productId === productId);
            const existingProductIndex = tempProducts.findIndex(p => p.id === productId);

            const oldQty = oldItem ? oldItem.quantity : 0;
            const newQty = newItem ? newItem.quantity : 0;
            const stockChange = newQty - oldQty;

            if (existingProductIndex > -1) {
                // Product exists, update it
                const updatedProduct = { ...tempProducts[existingProductIndex] };
                updatedProduct.quantity += stockChange;
                if (newItem) { // Update product details from the new item
                    updatedProduct.purchasePrice = newItem.price;
                    updatedProduct.salePrice = newItem.saleValue;
                    updatedProduct.gstPercent = newItem.gstPercent;
                }
                tempProducts[existingProductIndex] = updatedProduct;
            } else if (newItem) {
                // This case handles a new product being added during the edit
                tempProducts.push({
                    id: newItem.productId,
                    name: newItem.productName,
                    quantity: newItem.quantity,
                    purchasePrice: newItem.price,
                    salePrice: newItem.saleValue,
                    gstPercent: newItem.gstPercent,
                });
            }
        });
        
        const updatedProducts = tempProducts.map(p => ({ ...p, quantity: Math.max(0, p.quantity) }));
        const updatedPurchases = state.purchases.map(p => p.id === updatedPurchase.id ? updatedPurchase : p);

        return {
            ...state,
            purchases: updatedPurchases,
            products: updatedProducts,
        };
    }
    case 'DELETE_PURCHASE': {
      const purchaseToDelete = state.purchases.find(p => p.id === action.payload);
      if (!purchaseToDelete) return state;

      const stockChanges = new Map<string, number>();
      purchaseToDelete.items.forEach(item => {
        const currentChange = stockChanges.get(item.productId) || 0;
        stockChanges.set(item.productId, currentChange - item.quantity); // Subtract stock
      });
      
      let updatedProducts = state.products;
      stockChanges.forEach((change, productId) => {
        updatedProducts = updatedProducts.map(p =>
          p.id === productId ? { ...p, quantity: Math.max(0, p.quantity + change) } : p
        );
      });
      
      return {
        ...state,
        purchases: state.purchases.filter(p => p.id !== action.payload),
        products: updatedProducts,
      };
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
      const creditPayment: Payment = {
        id: `PAY-RET-${returnPayload.id}`,
        amount: returnPayload.amount,
        date: returnPayload.returnDate,
        method: 'RETURN_CREDIT',
      };
      let updatedSales = state.sales;
      let updatedPurchases = state.purchases;
      if (returnPayload.type === 'CUSTOMER') {
        updatedSales = state.sales.map(sale =>
          sale.id === returnPayload.referenceId
            ? { ...sale, payments: [...(sale.payments || []), creditPayment] }
            : sale
        );
      } else {
        updatedPurchases = state.purchases.map(purchase =>
          purchase.id === returnPayload.referenceId
            ? { ...purchase, payments: [...(purchase.payments || []), creditPayment] }
            : purchase
        );
      }
      return {
        ...state,
        products: updatedProducts,
        sales: updatedSales,
        purchases: updatedPurchases,
        returns: [...state.returns, returnPayload],
      };
    }
    case 'UPDATE_RETURN': {
        const { oldReturn, updatedReturn } = action.payload;

        const stockChanges = new Map<string, number>();

        // Reverse old stock changes
        oldReturn.items.forEach(item => {
            const change = oldReturn.type === 'CUSTOMER' ? -item.quantity : +item.quantity;
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + change);
        });

        // Apply new stock changes
        updatedReturn.items.forEach(item => {
            const change = updatedReturn.type === 'CUSTOMER' ? +item.quantity : -item.quantity;
            stockChanges.set(item.productId, (stockChanges.get(item.productId) || 0) + change);
        });

        const updatedProducts = state.products.map(p => {
            if (stockChanges.has(p.id)) {
                return { ...p, quantity: p.quantity + (stockChanges.get(p.id) || 0) };
            }
            return p;
        });

        let updatedSales = state.sales;
        let updatedPurchases = state.purchases;
        const creditPaymentId = `PAY-RET-${updatedReturn.id}`;

        if (updatedReturn.type === 'CUSTOMER') {
            updatedSales = updatedSales.map(sale => {
                if (sale.id === updatedReturn.referenceId) {
                    const updatedPayments = sale.payments.map(p => {
                        if (p.id === creditPaymentId) {
                            return { ...p, amount: updatedReturn.amount, date: updatedReturn.returnDate };
                        }
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
                        if (p.id === creditPaymentId) {
                            return { ...p, amount: updatedReturn.amount, date: updatedReturn.returnDate };
                        }
                        return p;
                    });
                    return { ...purchase, payments: updatedPayments };
                }
                return purchase;
            });
        }
        
        const updatedReturns = state.returns.map(r => r.id === updatedReturn.id ? updatedReturn : r);

        return {
            ...state,
            products: updatedProducts,
            sales: updatedSales,
            purchases: updatedPurchases,
            returns: updatedReturns,
        };
    }
    case 'ADD_PAYMENT_TO_SALE':
      return {
        ...state,
        sales: state.sales.map(sale =>
          sale.id === action.payload.saleId
            ? { ...sale, payments: [...(sale.payments || []), action.payload.payment] }
            : sale
        ),
      };
    case 'ADD_PAYMENT_TO_PURCHASE':
      return {
        ...state,
        purchases: state.purchases.map(purchase =>
          purchase.id === action.payload.purchaseId
            ? { ...purchase, payments: [...(purchase.payments || []), action.payload.payment] }
            : purchase
        ),
      };
    case 'SHOW_TOAST':
        return { ...state, toast: { message: action.payload.message, show: true, type: action.payload.type || 'info' } };
    case 'HIDE_TOAST':
        return { ...state, toast: { ...state.toast, show: false } };
    case 'SET_LAST_BACKUP_DATE':
      const otherMeta = state.app_metadata.filter(m => m.id !== 'lastBackup');
      return {
        ...state,
        app_metadata: [...otherMeta, { id: 'lastBackup', date: action.payload }]
      };
    case 'SET_SELECTION':
      return { ...state, selection: action.payload };
    case 'CLEAR_SELECTION':
      return { ...state, selection: null };
    case 'SET_INSTALL_PROMPT_EVENT':
      return { ...state, installPromptEvent: action.payload };
    case 'ADD_NOTIFICATION':
      // Prevent duplicates by ID
      if (state.notifications.some(n => n.id === action.payload.id)) {
        return state;
      }
      return { ...state, notifications: [action.payload, ...state.notifications] };
    case 'MARK_NOTIFICATION_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => n.id === action.payload ? { ...n, read: true } : n),
      };
    case 'MARK_ALL_NOTIFICATIONS_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, read: true })),
      };
    default:
      return state;
  }
};

interface AppContextType {
    state: AppState;
    dispatch: React.Dispatch<Action>;
    showToast: (message: string, type?: 'success' | 'info') => void;
    isDbLoaded: boolean;
}

const AppContext = createContext<AppContextType>({
  state: initialState,
  dispatch: () => null,
  showToast: () => null,
  isDbLoaded: false,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // Set up the PWA install prompt listener.
  useEffect(() => {
    // Check if the event was already captured by the global listener in index.tsx
    const deferredPrompt = (window as any).deferredInstallPrompt;
    if (deferredPrompt) {
        dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: deferredPrompt as BeforeInstallPromptEvent });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: e as BeforeInstallPromptEvent });
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [dispatch]);

  // Load initial data from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        const [customers, suppliers, products, sales, purchases, returns, app_metadata, notifications, profile] = await Promise.all([
          db.getAll('customers'),
          db.getAll('suppliers'),
          db.getAll('products'),
          db.getAll('sales'),
          db.getAll('purchases'),
          db.getAll('returns'),
          db.getAll('app_metadata'),
          db.getAll('notifications'),
          db.getAll('profile'),
        ]);

        const validatedMetadata = Array.isArray(app_metadata) ? app_metadata : [];
        const pinData = validatedMetadata.find(m => m.id === 'securityPin') as AppMetadataPin | undefined;

        const validatedState: Omit<AppState, 'toast' | 'selection' | 'installPromptEvent' | 'notifications' | 'profile' | 'pin' | 'theme'> = {
            customers: Array.isArray(customers) ? customers : [],
            suppliers: Array.isArray(suppliers) ? suppliers : [],
            products: Array.isArray(products) ? products : [],
            sales: (Array.isArray(sales) ? sales : []).map((s: any) => ({ ...s, payments: s.payments || [] })),
            purchases: (Array.isArray(purchases) ? purchases : []).map((p: any) => ({ ...p, payments: p.payments || [] })),
            returns: Array.isArray(returns) ? returns : [],
            app_metadata: validatedMetadata,
        };
        dispatch({ type: 'SET_STATE', payload: validatedState });
        if (pinData?.pin) {
            dispatch({ type: 'SET_PIN', payload: pinData.pin });
        }
        dispatch({ type: 'SET_NOTIFICATIONS', payload: Array.isArray(notifications) ? notifications : [] });
        dispatch({ type: 'SET_PROFILE', payload: (Array.isArray(profile) && profile.length > 0) ? profile[0] : null });
      } catch (error) {
        console.error("Could not load data from IndexedDB, using initial state.", error);
      } finally {
        setIsDbLoaded(true);
      }
    };

    loadData();
  }, []);
  
  // Persist data slices to IndexedDB when they change
  useEffect(() => { if (isDbLoaded) db.saveCollection('customers', state.customers); }, [state.customers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('suppliers', state.suppliers); }, [state.suppliers, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('products', state.products); }, [state.products, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('sales', state.sales); }, [state.sales, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('purchases', state.purchases); }, [state.purchases, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('returns', state.returns); }, [state.returns, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('app_metadata', state.app_metadata); }, [state.app_metadata, isDbLoaded]);
  useEffect(() => { if (isDbLoaded) db.saveCollection('notifications', state.notifications); }, [state.notifications, isDbLoaded]);
  useEffect(() => { if (isDbLoaded && state.profile) db.saveCollection('profile', [state.profile]); }, [state.profile, isDbLoaded]);


  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    setTimeout(() => {
        dispatch({ type: 'HIDE_TOAST' });
    }, 3000);
  };

  return <AppContext.Provider value={{ state, dispatch, showToast, isDbLoaded }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);