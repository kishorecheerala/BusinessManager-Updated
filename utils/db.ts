
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Customer, Supplier, Product, Sale, Purchase, Return, Notification, ProfileData, AppMetadata, AuditLogEntry, Expense, Quote, CustomFont, Snapshot, TrashItem, Budget, FinancialScenario, AppState } from '../types';

const DB_NAME = 'business-manager-db';
const DB_VERSION = 12; // Bumped for Financial Planning

export type StoreName = 'customers' | 'suppliers' | 'products' | 'sales' | 'purchases' | 'returns' | 'app_metadata' | 'notifications' | 'profile' | 'audit_logs' | 'expenses' | 'quotes' | 'custom_fonts' | 'snapshots' | 'trash' | 'budgets' | 'financial_scenarios';
const STORE_NAMES: StoreName[] = ['customers', 'suppliers', 'products', 'sales', 'purchases', 'returns', 'app_metadata', 'notifications', 'profile', 'audit_logs', 'expenses', 'quotes', 'custom_fonts', 'snapshots', 'trash', 'budgets', 'financial_scenarios'];

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
    trash: { key: string; value: TrashItem; };
    budgets: { key: string; value: Budget; };
    financial_scenarios: { key: string; value: FinancialScenario; };
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
        const store = tx.objectStore(storeName);
        await store.clear();

        const CHUNK_SIZE = 500;
        for (let i = 0; i < data.length; i += CHUNK_SIZE) {
            const chunk = data.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(item => store.put(item)));
        }

        await tx.done;
    } catch (error) {
        console.error(`Failed to save collection ${storeName}:`, error);
    }
}

export async function deleteFromStore<T extends StoreName>(storeName: T, id: string) {
    try {
        const db = await getDb();
        await db.delete(storeName, id);
    } catch (e) {
        console.error(`Failed to delete ${id} from ${storeName}`, e);
    }
}

export async function addToTrash(item: TrashItem) {
    try {
        const db = await getDb();
        await db.put('trash', item);
    } catch (e) {
        console.error("Failed to add to trash", e);
    }
}

export async function getLastBackupDate(): Promise<string | null> {
    const db = await getDb();
    const result = await db.get('app_metadata', 'lastBackup');
    if (result && result.id === 'lastBackup') {
        return (result as any).date;
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
        // Include Trash in backup so deletions sync across devices
        if (storeName === 'notifications' || storeName === 'snapshots') continue;
        data[storeName] = await db.getAll(storeName);
    }
    return data;
}

export async function mergeData(cloudData: any): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');

    // 1. Process Trash First
    // We need to know what has been deleted to ensure we don't re-add it from cloud
    // and to remove it locally if it was deleted on another device.
    const cloudTrash = cloudData['trash'] || [];
    const trashStore = tx.objectStore('trash');

    for (const item of cloudTrash) {
        // Add to local trash
        await trashStore.put(item);

        // If item exists in its original store locally, DELETE it.
        // This syncs the deletion from other devices.
        if (item.originalStore && item.id) {
            try {
                const originalStore = tx.objectStore(item.originalStore as StoreName);
                const exists = await originalStore.get(item.id);
                if (exists) {
                    await originalStore.delete(item.id);
                }
            } catch (e) {
                // Store might not exist or be valid, ignore
            }
        }
    }

    // Get all trash IDs to verify against other collections
    const allTrashKeys = await trashStore.getAllKeys();
    const trashIdSet = new Set(allTrashKeys.map(k => String(k)));

    for (const storeName of STORE_NAMES) {
        if (storeName === 'notifications' || storeName === 'snapshots' || storeName === 'trash') continue;

        const remoteItems = cloudData[storeName];
        if (!remoteItems || !Array.isArray(remoteItems)) continue;

        const store = tx.objectStore(storeName);

        for (const item of remoteItems) {
            if (item && item.id) {
                // CRITICAL: If this item ID is in the trash, DO NOT ADD IT.
                // In fact, ensure it is deleted.
                if (trashIdSet.has(item.id)) {
                    const exists = await store.get(item.id);
                    if (exists) {
                        await store.delete(item.id);
                    }
                    continue;
                }

                const localItem = await store.get(item.id);

                // SMART MERGE STRATEGY (Last Write Wins):
                if (!localItem) {
                    // 1. New item from cloud -> Add it
                    await store.put(item);
                } else {
                    // 2. Conflict: Compare timestamps
                    const remoteTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
                    const localTime = localItem.updatedAt ? new Date(localItem.updatedAt).getTime() : 0;

                    if (remoteTime > localTime) {
                        // Remote is newer -> Overwrite local
                        await store.put(item);
                    }
                    // Else: Local is newer or equal -> Keep local (do nothing)
                }
            }
        }
    }
    await tx.done;
}

export async function importData(data: any, merge: boolean = false): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(STORE_NAMES, 'readwrite');

    for (const storeName of STORE_NAMES) {
        if (storeName === 'notifications' || storeName === 'snapshots') continue;

        const store = tx.objectStore(storeName);

        if (!merge) {
            await store.clear();
        }

        let items = (data as any)[storeName] || [];

        if (!Array.isArray(items) && items && typeof items === 'object') {
            items = [items];
        }

        if (Array.isArray(items) && items.length > 0) {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < items.length; i += CHUNK_SIZE) {
                const chunk = items.slice(i, i + CHUNK_SIZE);
                await Promise.all(chunk.map(item => {
                    if (item && typeof item === 'object' && 'id' in item) {
                        return store.put(item);
                    }
                    return Promise.resolve();
                }));
            }
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
        await importData(snap.data, false);
    } else {
        throw new Error("Snapshot not found");
    }
}

export async function deleteSnapshot(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('snapshots', id);
}
