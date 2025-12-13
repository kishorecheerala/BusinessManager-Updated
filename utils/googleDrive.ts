
// NOTE: You must replace this with your own Client ID from Google Cloud Console
// Go to https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID -> Web Application
// Add your Vercel URL (https://kishore-business-manager.vercel.app) to "Authorized JavaScript origins"
// ENSURE NO TRAILING SLASH at the end of the URL in Google Console (e.g., use .app NOT .app/).
const DEFAULT_CLIENT_ID = '647430742620-e9ev2ravu25cj170o42gvvbpqqq4cmhc.apps.googleusercontent.com'.trim();

export const getClientId = () => {
    return localStorage.getItem('google_client_id') || DEFAULT_CLIENT_ID;
};

// Updated Scopes: Includes Drive File access, User Profile, Calendar, and Spreadsheets
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets';

// Folder name in Google Drive
const APP_FOLDER_NAME = 'BusinessManager_AppData';

// Helper to generate daily filenames
const getDailyFilenames = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return {
        core: `BusinessManager_Core_${year}-${month}-${day}.json`,
        assets: `BusinessManager_Assets_${year}-${month}-${day}.json`,
        legacy: `BusinessManager_Backup_${year}-${month}-${day}.json`
    };
};

export const loadGoogleScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if ((window as any).google) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = reject;
        document.body.appendChild(script);
    });
};

export const initGoogleAuth = (callback: (response: any) => void, errorCallback?: (error: any) => void) => {
    return (window as any).google.accounts.oauth2.initTokenClient({
        client_id: getClientId(),
        scope: SCOPES,
        ux_mode: 'popup',
        callback: callback,
        error_callback: (err: any) => {
            if (errorCallback) errorCallback(err);
            console.error("Google Auth Error:", err);
            const currentOrigin = window.location.origin;
            let msg = `Google Sign-In Error: ${err.type || 'Unknown Error'}\n\n`;
            if (err.message) msg += `Details: ${err.message}\n\n`;

            if (err.type === 'popup_closed') {
                console.warn("Google Sign-In popup closed by user.");
                return;
            } else if (err.type === 'access_denied' || (err.error && err.error === 'access_denied')) {
                msg += "ACCESS DENIED: TEST USER RESTRICTION\n\n";
                msg += "Your app is in 'Testing' mode. Only emails listed as 'Test Users' can sign in.\n\n";
                msg += "1. Go to Google Cloud Console > OAuth Consent Screen.\n";
                msg += "2. Scroll down to the 'Test users' section.\n";
                msg += "3. Click 'Add Users', enter your email address, and Save.\n";
                msg += "4. OR click 'Publish App' to allow anyone.";
            } else {
                msg += "CONFIGURATION ERROR\n\n";
                msg += "If you see 'Error 400: invalid_request':\n";
                msg += "1. Ensure the URL below is in Google Cloud Console > Authorized JavaScript origins:\n";
                msg += `${currentOrigin}\n\n`;
                msg += "2. Ensure there is NO trailing slash (/) at the end of the URL in the console.\n";
                msg += "3. Wait 10 minutes if you recently changed settings.";
            }
            alert(msg);
        }
    });
};

// --- Drive API Helpers ---

const getHeaders = (accessToken: string) => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
});

const safeJsonParse = async (response: Response) => {
    try {
        const text = await response.text();
        if (!text || text.trim() === '') return null;
        return JSON.parse(text);
    } catch (e) {
        console.warn("JSON Parse Error:", e);
        return null;
    }
};

const filesList = async (accessToken: string, params: Record<string, string>) => {
    const query = new URLSearchParams(params).toString();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
        headers: getHeaders(accessToken),
        cache: 'no-store'
    });
    if (!response.ok) await handleApiError(response, "List Files Failed");
    const data = await safeJsonParse(response);
    return data && data.files ? data.files : [];
};

const handleApiError = async (response: Response, context: string) => {
    let details = response.statusText;
    try {
        const body = await response.json();
        if (body.error) {
            details = body.error.message || JSON.stringify(body.error);
        }
    } catch (e) {
        try {
            const text = await response.text();
            if (text) details = text;
        } catch (e2) { }
    }
    const msg = `${context}: ${response.status} (${details})`;
    console.error(msg);
    throw new Error(msg);
}

// --- Data Splitting Optimization Logic ---

const splitStateData = (data: any) => {
    const core = JSON.parse(JSON.stringify(data)); // Deep clone
    const assets: Record<string, any> = { products: {}, expenses: {} };
    let hasAssets = false;

    // Split Product Images
    if (core.products) {
        core.products = core.products.map((p: any) => {
            if (p.image || (p.additionalImages && p.additionalImages.length)) {
                hasAssets = true;
                assets.products[p.id] = {
                    image: p.image,
                    additionalImages: p.additionalImages
                };
                const { image, additionalImages, ...rest } = p;
                return rest;
            }
            return p;
        });
    }

    // Split Expense Receipts
    if (core.expenses) {
        core.expenses = core.expenses.map((e: any) => {
            if (e.receiptImage) {
                hasAssets = true;
                assets.expenses[e.id] = e.receiptImage;
                const { receiptImage, ...rest } = e;
                return rest;
            }
            return e;
        });
    }

    return { core, assets, hasAssets };
};

const mergeStateData = (core: any, assets: any) => {
    if (!assets) return core;

    if (core.products && assets.products) {
        core.products = core.products.map((p: any) => {
            const asset = assets.products[p.id];
            if (asset) {
                return { ...p, ...asset };
            }
            return p;
        });
    }

    if (core.expenses && assets.expenses) {
        core.expenses = core.expenses.map((e: any) => {
            const img = assets.expenses[e.id];
            if (img) return { ...e, receiptImage: img };
            return e;
        });
    }

    return core;
};

// --- Low Level Operations ---

export const getCandidateFolders = async (accessToken: string) => {
    const q = `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc&fields=files(id,name,createdTime,modifiedTime)`, {
        headers: getHeaders(accessToken),
        cache: 'no-store'
    });
    if (!response.ok) await handleApiError(response, "Search Folders Failed");
    const data = await safeJsonParse(response);
    return data && data.files ? data.files : [];
};

export const getFolderById = async (accessToken: string, folderId: string) => {
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,createdTime,modifiedTime,capabilities`, {
            headers: getHeaders(accessToken),
            cache: 'no-store'
        });
        if (!response.ok) return null; // Likely 404 or 403
        return await safeJsonParse(response);
    } catch (e) {
        return null;
    }
};

export const createFolder = async (accessToken: string) => {
    console.log("Creating new app folder...");
    const metadata = {
        name: APP_FOLDER_NAME,
        mimeType: 'application/vnd.google-apps.folder',
    };
    const response = await fetch('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: getHeaders(accessToken),
        body: JSON.stringify(metadata),
        cache: 'no-store'
    });
    if (!response.ok) await handleApiError(response, "Create Folder Failed");
    const file = await safeJsonParse(response);
    return file ? file.id : null;
};

export const findFileByName = async (accessToken: string, folderId: string, filename: string) => {
    // Fetch ALL files with this name, sorted by newest first
    const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc`, {
        headers: getHeaders(accessToken),
        cache: 'no-store'
    });

    if (!response.ok) await handleApiError(response, "Search File Failed");
    const data = await safeJsonParse(response);

    if (data && data.files && data.files.length > 0) {
        // The first file is the newest one (Live Sync File)
        const newestFile = data.files[0];

        // If duplicates exist, DELETE the older ones to fix "Split Brain"
        if (data.files.length > 1) {
            console.warn(`[Sync Fix] Found ${data.files.length} duplicates for ${filename}. Keeping newest (${newestFile.id}), deleting others...`);

            // Delete older files in background
            const duplicates = data.files.slice(1);
            Promise.all(duplicates.map((file: any) => {
                console.log(`[Sync Fix] Deleting duplicate: ${file.id}`);
                return fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                    method: 'DELETE',
                    headers: getHeaders(accessToken)
                }).catch(e => console.error("Failed to delete duplicate", e));
            }));
        }

        return newestFile;
    }

    return null;
};

// Find latest file starting with a prefix
export const findLatestFileByPrefix = async (accessToken: string, folderId: string, prefix: string) => {
    const q = `name contains '${prefix}' and '${folderId}' in parents and trashed=false`;
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1`, {
        headers: getHeaders(accessToken),
        cache: 'no-store'
    });
    if (!response.ok) await handleApiError(response, "Search File Prefix Failed");
    const data = await safeJsonParse(response);
    return data && data.files && data.files.length > 0 ? data.files[0] : null;
};

export const uploadFile = async (accessToken: string, folderId: string, content: any, filename: string, existingFileId?: string) => {
    const fileContent = JSON.stringify(content);
    const contentType = 'application/json';

    const metadata: any = {
        name: filename,
        mimeType: contentType
    };

    if (!existingFileId) {
        metadata.parents = [folderId];
    }

    let initUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
    let method = 'POST';

    if (existingFileId) {
        initUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=resumable`;
        method = 'PATCH';
    }

    const initResponse = await fetch(initUrl, {
        method: method,
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata)
    });

    if (!initResponse.ok) await handleApiError(initResponse, "Init Upload Failed");

    const sessionUri = initResponse.headers.get('Location');
    if (!sessionUri) throw new Error("Resumable upload initiation failed: No Location header");

    const uploadResponse = await fetch(sessionUri, {
        method: 'PUT',
        headers: {
            'Content-Type': contentType,
        },
        body: fileContent
    });

    if (!uploadResponse.ok) await handleApiError(uploadResponse, "File Data Upload Failed");

    return await safeJsonParse(uploadResponse);
};

export const downloadFile = async (accessToken: string, fileId: string) => {
    console.log(`Downloading file content for ID: ${fileId}`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        cache: 'no-store'
    });

    if (!response.ok) {
        if (response.status === 404) throw new Error(`Download Failed: 404 Not Found (File ID: ${fileId})`);
        await handleApiError(response, "Download Failed");
    }

    const data = await safeJsonParse(response);
    return data;
};

export const getUserInfo = async (accessToken: string) => {
    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            cache: 'no-store'
        });
        if (!response.ok) throw new Error(`Failed to fetch user info: ${response.status}`);
        const data = await safeJsonParse(response);
        return data || { name: 'Google User', email: 'User', picture: '' };
    } catch (e) {
        console.error("Error fetching user info:", e);
        return { name: 'Google User', email: 'User', picture: '' };
    }
};

// --- High Level Drive Service ---

// --- High Level Drive Service ---

async function locateDriveConfig(accessToken: string) {
    console.log("Locating app folder in Drive...");

    // Use the unified constant APP_FOLDER_NAME
    const folders = await filesList(accessToken, {
        q: `mimeType = 'application/vnd.google-apps.folder' and name = '${APP_FOLDER_NAME}' and trashed = false`,
        fields: 'files(id, name, createdTime)'
    });

    let activeFolderId = null;

    if (folders && folders.length > 0) {
        // PERMANENT FIX: Handle Duplicate Folders
        // Sort by creation time (Oldest is Truth)
        folders.sort((a: any, b: any) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());

        const primaryFolder = folders[0];
        activeFolderId = primaryFolder.id;
        console.log(`Selected Master Folder: ${primaryFolder.name} (ID: ${activeFolderId})`);

        // If there are duplicate folders, we just ignore them for now to avoid complex migration risks.
        // We strict-lock to the OLDEST folder to ensure consistency across devices.
        if (folders.length > 1) {
            console.warn(`[Sync Warning] Found ${folders.length} app folders. Locked to oldest: ${primaryFolder.id}`);
            // Future enhancement: Move files from other folders to this one and delete them.
        }
    } else {
        console.log("No app folder found. Creating new one.");
        activeFolderId = await createFolder(accessToken);
    }
    return { folderId: activeFolderId };
}

export const debugDriveState = async (accessToken: string) => {
    const logs: string[] = [];
    const details: any[] = [];

    logs.push("🔍 Starting Drive Diagnostic Scan...");
    logs.push(`📂 Target App Folder Name: '${APP_FOLDER_NAME}'`);

    const localFolderId = localStorage.getItem('gdrive_folder_id');
    const localFileId = localStorage.getItem('gdrive_sync_file_id');

    logs.push(`💾 Local Cache Folder ID: ${localFolderId || 'None'}`);
    logs.push(`💾 Local Cache File ID:   ${localFileId || 'None'}`);

    // 1. Find Folders
    const folders = await filesList(accessToken, {
        q: `mimeType = 'application/vnd.google-apps.folder' and name = '${APP_FOLDER_NAME}' and trashed = false`,
        fields: 'files(id, name, createdTime)'
    });

    if (!folders || folders.length === 0) {
        logs.push("❌ CRITICAL: No App Folder Found in Drive.");
        return { logs, details };
    }

    // Sort to find Master
    folders.sort((a: any, b: any) => new Date(a.createdTime).getTime() - new Date(b.createdTime).getTime());
    const masterFolder = folders[0];

    logs.push(`✅ Found ${folders.length} app folder(s).`);
    logs.push(`👑 MASTER FOLDER: ${masterFolder.id} (Created: ${masterFolder.createdTime})`);

    if (localFolderId && localFolderId !== masterFolder.id) {
        logs.push(`⚠️ WARNING: Local device is linked to a DIFFERENT folder than Master!`);
        logs.push(`👉 Expected: ${masterFolder.id}`);
        logs.push(`👉 Actual:   ${localFolderId}`);
        logs.push(`🔧 Auto-Fix Recommended: Run a Sync or Re-Auth.`);
    } else if (localFolderId) {
        logs.push(`✅ Device is correctly linked to Master Folder.`);
    }

    if (folders.length > 1) {
        logs.push(`⚠️ WARNING: ${folders.length - 1} Duplicate Folders found! (Split Brain Risk)`);
        folders.slice(1).forEach((f: any) => logs.push(`   - Duplicate: ${f.id} (Created: ${f.createdTime})`));
    }

    // 2. Scan Master Folder Content
    const files = await filesList(accessToken, {
        q: `'${masterFolder.id}' in parents and trashed = false`,
        fields: 'files(id, name, createdTime, modifiedTime, size)'
    });

    if (files) {
        logs.push(`📄 Found ${files.length} files in Master Folder.`);
        details.push({ folder: masterFolder, files: files });

        const syncFile = files.find((f: any) => f.name === STABLE_SYNC_FILENAME);
        if (syncFile) {
            logs.push(`✅ Live Sync File Found: ${syncFile.id}`);
            if (localFileId && localFileId !== syncFile.id) {
                logs.push(`⚠️ WARNING: Local File ID mismatch!`);
                logs.push(`👉 Server: ${syncFile.id}`);
                logs.push(`👉 Local:  ${localFileId}`);
            } else {
                logs.push(`✅ File Link Verified.`);
            }
        } else {
            logs.push(`⚠️ No Live Sync File ('${STABLE_SYNC_FILENAME}') found yet.`);
        }
    }

    return { logs, details };
};

// Fixed filename for stable sync
const STABLE_SYNC_FILENAME = 'BusinessManager_LiveSync.json';
const STABLE_ASSETS_FILENAME = 'BusinessManager_Assets.json';

export const DriveService = {
    /**
     * Reads data from Drive.
     */
    async read(accessToken: string): Promise<any | null> {
        try {
            const { folderId } = await locateDriveConfig(accessToken);
            if (!folderId) return null;
            localStorage.setItem('gdrive_folder_id', folderId);

            // 1. Resolve "True" Sync File ID (Prioritize Server Search)
            // We ALWAYS checking by name first to ensure we aren't stuck on a stale cached ID.
            // "findFileByName" handles duplicate deletion internally.
            let stableFile = await findFileByName(accessToken, folderId, STABLE_SYNC_FILENAME);
            let targetFileId = stableFile ? stableFile.id : localStorage.getItem('gdrive_sync_file_id');

            if (stableFile) {
                console.log("Read: Found Live Sync File (Server Truth):", stableFile.id);
                localStorage.setItem('gdrive_sync_file_id', stableFile.id);
                targetFileId = stableFile.id;
            } else if (targetFileId) {
                console.warn("Read: File not found by name, attempting Cached ID:", targetFileId);
            }

            if (targetFileId) {
                try {
                    const coreData = await downloadFile(accessToken, targetFileId);
                    if (coreData) {
                        // Asynchronously check for assets to merge
                        const assetsFile = await findFileByName(accessToken, folderId, STABLE_ASSETS_FILENAME);
                        if (assetsFile) {
                            const assetsData = await downloadFile(accessToken, assetsFile.id);
                            if (assetsData) return mergeStateData(coreData, assetsData);
                        }
                        return coreData;
                    }
                } catch (e) {
                    console.warn("Read failed on target ID, clearing cache.");
                    localStorage.removeItem('gdrive_sync_file_id');
                }
            }

            // 2. Fallback: Daily Core Files (Migration)
            const coreFile = await findLatestFileByPrefix(accessToken, folderId, 'BusinessManager_Core_');
            if (coreFile) {
                console.log("Found Legacy Daily Backup:", coreFile.name);
                return await downloadFile(accessToken, coreFile.id);
            }

            // 3. Fallback: Legacy Monolithic
            const legacyFile = await findLatestFileByPrefix(accessToken, folderId, 'BusinessManager_Backup_');
            if (legacyFile) {
                console.log("Found Legacy Monolithic Backup:", legacyFile.name);
                return await downloadFile(accessToken, legacyFile.id);
            }

            console.log("No backup files found.");
            return null;
        } catch (e: any) {
            console.error("DriveService.read failed", e);
            throw e;
        }
    },

    async write(accessToken: string, data: any): Promise<any> {
        // CRITICAL FIX: Do NOT trust local cache for Folder ID.
        // Always resolve the "Master Folder" (Oldest) from server to prevent split-brain.
        // The previous optimization (checking localStorage first) caused devices to get stuck 
        // writing to different duplicate folders.
        const config = await locateDriveConfig(accessToken);
        const folderId = config.folderId; // config is checking for "Oldest"

        if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
        if (!folderId) throw new Error("Could not locate or create Drive folder.");

        try {
            console.log(`Preparing sync upload...`);
            const { core, assets, hasAssets } = splitStateData(data);

            // 1. Resolve Target ID (Prioritize Server Truth)
            // Always search by name to ensure we write to the one everyone else is reading.
            let stableFile = await findFileByName(accessToken, folderId, STABLE_SYNC_FILENAME);
            let targetFileId = stableFile ? stableFile.id : localStorage.getItem('gdrive_sync_file_id');

            if (stableFile) {
                console.log("Write: Updating existing Server File:", stableFile.id);
                localStorage.setItem('gdrive_sync_file_id', stableFile.id);
                targetFileId = stableFile.id;
            } else if (targetFileId) {
                console.log("Write: File not found by name, trying Cached ID:", targetFileId);
            }

            let finalId = '';

            if (targetFileId) {
                try {
                    const result = await uploadFile(accessToken, folderId, core, STABLE_SYNC_FILENAME, targetFileId);
                    finalId = result.id;
                } catch (e) {
                    console.warn("Write to Target ID failed (deleted?). Creating new...");
                    const result = await uploadFile(accessToken, folderId, core, STABLE_SYNC_FILENAME);
                    finalId = result.id;
                }
            } else {
                console.log("Write: Creating NEW Sync file...");
                const result = await uploadFile(accessToken, folderId, core, STABLE_SYNC_FILENAME);
                finalId = result.id;
            }

            if (finalId) localStorage.setItem('gdrive_sync_file_id', finalId);

            // 2. Upload Assets
            if (hasAssets) {
                const existingAssets = await findFileByName(accessToken, folderId, STABLE_ASSETS_FILENAME);
                const assetId = existingAssets ? existingAssets.id : undefined;
                await uploadFile(accessToken, folderId, assets, STABLE_ASSETS_FILENAME, assetId);
            }

            console.log("Sync successful. ID:", finalId);
            return finalId;
        } catch (e: any) {
            if (e.message && e.message.includes('404')) {
                console.warn("Folder 404, retrying...", e);
                localStorage.removeItem('gdrive_folder_id');
                return DriveService.write(accessToken, data);
            }
            throw e;
        }
    }
};
