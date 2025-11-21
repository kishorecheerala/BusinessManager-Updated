
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Customer, Supplier, Product, Sale, Purchase, Return, Notification, ProfileData, AppMetadata } from '../types';
import { AppState } from '../context/AppContext';

const DB_NAME = 'business-manager-db';
const DB_VERSION = 4; // Bump version for schema change

export type StoreName = 'customers' | 'suppliers' | 'products' | 'sales' | 'purchases' | 'returns' | 'app_metadata' | 'notifications' | 'profile';
const STORE_NAMES: StoreName[] = ['customers', 'suppliers', 'products', 'sales', 'purchases', 'returns', 'app_metadata', 'notifications', 'profile'];

interface BusinessManagerDB extends DBSchema {
  customers: { key: string; value: Customer; };
  suppliers: { key: string; value: Supplier; };
  products: { key: string; value: Product; };
  sales: { key: string; value: Sale; };
  purchases: { key: string; value: Purchase; };
  returns: { key: string; value: Return; };
  app_metadata: { key: string; value: AppMetadata; };
  notifications: { key: string; value: Notification; };
  profile: { key: string; value: ProfileData; };
}

let dbPromise: Promise<IDBPDatabase<BusinessManagerDB>>;

function getDb(): Promise<IDBPDatabase<BusinessManagerDB>> {
    if (!dbPromise) {
        dbPromise = openDB<BusinessManagerDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion) {
                for (const storeName of STORE_NAMES) {
                    if (!db.objectStoreNames.contains(storeName)) {
                        db.createObjectStore(storeName, { keyPath: 'id' });
                    }
                }
            },
        });
    }
    return dbPromise;
}

export async function getAll<T extends StoreName>(storeName: T): Promise<BusinessManagerDB[T]['value'][]> {
  const db = await getDb();
  return db.getAll(storeName);
}

export async function saveCollection<T extends StoreName>(storeName: T, data: BusinessManagerDB[T]['value'][]) {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, 'readwrite');
    await tx.objectStore(storeName).clear();
    await Promise.all(data.map(item => tx.objectStore(storeName).put(item)));
    await tx.done;
  } catch (error) {
    console.error(`Failed to save collection ${storeName}:`, error);
  }
}

export async function getLastBackupDate(): Promise<string | null> {
    const db = await getDb();
    const result = await db.get('app_metadata', 'lastBackup');
    // Type guard to ensure we are accessing a property on the correct object type
    if (result && result.id === 'lastBackup') {
        return result.date;
    }
    return null;
}

export async function setLastBackupDate(): Promise<void> {
    const db = await getDb();
    const now = new Date().toISOString();
    await db.put('app_metadata', { id: 'lastBackup', date: now });
}

export async function exportData(): Promise<Omit<AppState, 'toast' | 'selection' | 'pin'>> {
    const db = await getDb();
    const data: any = {};
    for (const storeName of STORE_NAMES) {
        // Exclude notifications from the main data backup
        if (storeName === 'notifications') continue;
        data[storeName] = await db.getAll(storeName);
    }
    return data as Omit<AppState, 'toast' | 'selection' | 'pin'>;
}

export async function importData(data: Omit<AppState, 'toast' | 'selection' | 'pin'>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    
    await Promise.all(STORE_NAMES.map(async (storeName) => {
        // Exclude notifications from the main data import
        if (storeName === 'notifications') return;
        
        await tx.objectStore(storeName).clear();
        const items = (data as any)[storeName] || [];
        for (const item of items) {
            if (item && 'id' in item) {
                await tx.objectStore(storeName).put(item);
            }
        }
    }));
    
    await tx.done;
}
