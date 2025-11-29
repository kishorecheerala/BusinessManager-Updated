
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Customer, Supplier, Product, Sale, Purchase, Return, Notification, ProfileData, AppMetadata, AuditLogEntry, Expense, Quote, CustomFont, Snapshot } from '../types';
import { AppState } from '../context/AppContext';

const DB_NAME = 'business-manager-db';
const DB_VERSION = 10; // Bumped for Snapshots

export type StoreName = 'customers' | 'suppliers' | 'products' | 'sales' | 'purchases' | 'returns' | 'app_metadata' | 'notifications' | 'profile' | 'audit_logs' | 'expenses' | 'quotes' | 'custom_fonts' | 'snapshots';
const STORE_NAMES: StoreName[] = ['customers', 'suppliers', 'products', 'sales', 'purchases', 'returns', 'app_metadata', 'notifications', 'profile', 'audit_logs', 'expenses', 'quotes', 'custom_fonts', 'snapshots'];

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
  audit_logs: { key: string; value: AuditLogEntry; };
  expenses: { key: string; value: Expense; };
  quotes: { key: string; value: Quote; };
  custom_fonts: { key: string; value: CustomFont; };
  snapshots: { key: string; value: Snapshot; };
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

export async function mergeCollection<T extends StoreName>(storeName: T, data: BusinessManagerDB[T]['value'][]) {
  try {
    const db = await getDb();
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    
    for (const item of data) {
        const existing = await store.get(item.id);
        // Only add if it doesn't exist (Local Wins Conflict Strategy to protect unsaved work)
        if (!existing) {
            await store.put(item);
        }
    }
    await tx.done;
  } catch (error) {
    console.error(`Failed to merge collection ${storeName}:`, error);
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

export async function exportData(): Promise<Omit<AppState, 'toast' | 'selection' | 'pin' | 'googleUser' | 'syncStatus'>> {
    const db = await getDb();
    const data: any = {};
    for (const storeName of STORE_NAMES) {
        // Exclude notifications and snapshots from the main data export to keep it clean
        if (storeName === 'notifications' || storeName === 'snapshots') continue;
        data[storeName] = await db.getAll(storeName);
    }
    return data;
}

export async function mergeData(cloudData: any): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    
    for (const storeName of STORE_NAMES) {
        if (storeName === 'notifications' || storeName === 'snapshots') continue;
        
        const remoteItems = cloudData[storeName];
        // Basic validation
        if (!remoteItems || !Array.isArray(remoteItems)) continue;
        
        const store = tx.objectStore(storeName);
        
        for (const item of remoteItems) {
            if (item && item.id) {
                const localItem = await store.get(item.id);
                if (!localItem) {
                    await store.put(item);
                }
                // If localItem exists, we keep local version (Priority: Local)
            }
        }
    }
    await tx.done;
}

export async function importData(data: any, merge: boolean = false): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');
    
    // Execute sequentially for stores to keep logic clean, but parallelize items within store for robustness
    for (const storeName of STORE_NAMES) {
        if (storeName === 'notifications' || storeName === 'snapshots') continue;
        
        const store = tx.objectStore(storeName);
        
        // If not merging, clear the existing data first (overwrite mode)
        if (!merge) {
            await store.clear();
        }
        
        let items = (data as any)[storeName] || [];

        // Normalize single objects to array (Fix for Cloud Backup where profile is an object)
        if (!Array.isArray(items) && items && typeof items === 'object') {
            items = [items];
        }
        
        if (Array.isArray(items) && items.length > 0) {
            // Use Promise.all to ensure all put operations are queued within the transaction efficiently
            await Promise.all(items.map(item => {
                // Check if item is valid object with ID before putting
                if (item && typeof item === 'object' && 'id' in item) {
                    return store.put(item);
                }
                return Promise.resolve();
            }));
        }
    }
    
    await tx.done;
}

export async function clearDatabase(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAMES, 'readwrite');
  await Promise.all(STORE_NAMES.map(storeName => tx.objectStore(storeName).clear()));
  await tx.done;
}

// --- Snapshot Functions ---

export async function createSnapshot(name: string = 'Auto Checkpoint'): Promise<string> {
    const data = await exportData();
    const db = await getDb();
    const id = `snap-${Date.now()}`;
    const snapshot: Snapshot = {
        id,
        timestamp: new Date().toISOString(),
        name,
        data
    };
    await db.put('snapshots', snapshot);
    return id;
}

export async function getSnapshots(): Promise<Snapshot[]> {
    const db = await getDb();
    const snaps = await db.getAll('snapshots');
    return snaps.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export async function restoreSnapshot(id: string): Promise<void> {
    const db = await getDb();
    const snap = await db.get('snapshots', id);
    if (snap) {
        // Snapshot restores are destructive (overwrite) by nature to get back to exact state
        await importData(snap.data, false); 
    } else {
        throw new Error("Snapshot not found");
    }
}

export async function deleteSnapshot(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('snapshots', id);
}
