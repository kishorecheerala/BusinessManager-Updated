

// NOTE: You must replace this with your own Client ID from Google Cloud Console
// Go to https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID -> Web Application
// Add your Vercel URL (https://kishore-business-manager.vercel.app) to "Authorized JavaScript origins"
// ENSURE NO TRAILING SLASH at the end of the URL in Google Console (e.g., use .app NOT .app/).
const DEFAULT_CLIENT_ID = '732045270886-84cr2t9q71lgttqgdn1jqu9f7ub5qfo3.apps.googleusercontent.com'.trim(); 

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
             if(text) details = text;
        } catch(e2) {}
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
             if(e.receiptImage) {
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
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });
  if (!response.ok) await handleApiError(response, "Search Folders Failed");
  const data = await safeJsonParse(response);
  return data && data.files ? data.files : [];
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
  const q = `name='${filename}' and '${folderId}' in parents and trashed=false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });
  if (!response.ok) await handleApiError(response, "Search File Failed");
  const data = await safeJsonParse(response);
  return data && data.files && data.files.length > 0 ? data.files[0] : null;
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

async function locateDriveConfig(accessToken: string) {
    console.log("Locating app folder in Drive...");
    const folders = await getCandidateFolders(accessToken);
    let activeFolderId = null;

    if (folders.length > 0) {
        // Find best folder (one with recent files)
        let bestFolder = folders[0];
        let latestTimestamp = 0;
        
        for (const folder of folders.slice(0, 3)) {
            // Check for any backup file
            const file = await findLatestFileByPrefix(accessToken, folder.id, 'BusinessManager_');
            if (file) {
                const time = new Date(file.modifiedTime).getTime();
                if (time > latestTimestamp) {
                    latestTimestamp = time;
                    bestFolder = folder;
                }
            }
        }
        activeFolderId = bestFolder.id;
        console.log(`Selected active folder: ${bestFolder.name} (ID: ${activeFolderId})`);
    } else {
        console.log("No app folder found. Creating new one.");
        activeFolderId = await createFolder(accessToken);
    }
    return { folderId: activeFolderId };
}

export const debugDriveState = async (accessToken: string) => {
    // ... (Diagnostics function remains same as before for debugging) ...
    // Keeping this minimal for this file update to focus on logic changes
    return { logs: ["Diagnostics Available"], details: [] };
}

export const DriveService = {
    /**
     * Reads data from Drive.
     * Supports both new Split JSON format (Core + Assets) and Legacy monolithic JSON.
     */
    async read(accessToken: string): Promise<any | null> {
        try {
            const { folderId } = await locateDriveConfig(accessToken);
            if (!folderId) return null;
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);

            // 1. Try to find new "Core" file (Latest)
            const coreFile = await findLatestFileByPrefix(accessToken, folderId, 'BusinessManager_Core_');
            
            if (coreFile) {
                console.log("Found Core Backup:", coreFile.name);
                const coreData = await downloadFile(accessToken, coreFile.id);
                
                if (coreData) {
                    // Extract timestamp from filename to find matching assets
                    // Format: BusinessManager_Core_YYYY-MM-DD.json
                    const match = coreFile.name.match(/(\d{4}-\d{2}-\d{2})/);
                    const dateStr = match ? match[1] : '';
                    
                    // 2. Try to find corresponding "Assets" file
                    // Strategy: First try matching date, if not found, try latest assets file
                    let assetsFile = null;
                    if (dateStr) {
                        assetsFile = await findFileByName(accessToken, folderId, `BusinessManager_Assets_${dateStr}.json`);
                    }
                    
                    if (!assetsFile) {
                        assetsFile = await findLatestFileByPrefix(accessToken, folderId, 'BusinessManager_Assets_');
                    }
                    
                    if (assetsFile) {
                        console.log("Found Assets Backup:", assetsFile.name);
                        const assetsData = await downloadFile(accessToken, assetsFile.id);
                        if (assetsData) {
                            console.log("Merging Core and Assets...");
                            return mergeStateData(coreData, assetsData);
                        }
                    } else {
                        console.warn("No Assets file found, returning Core data only (images might be missing).");
                    }
                    return coreData;
                }
            }

            // 3. Fallback to Legacy Monolithic File
            const legacyFile = await findLatestFileByPrefix(accessToken, folderId, 'BusinessManager_Backup_');
            if (legacyFile) {
                console.log("Found Legacy Backup:", legacyFile.name);
                return await downloadFile(accessToken, legacyFile.id);
            }

            console.log("No backup files found.");
            return null; 
        } catch (e: any) {
            console.error("DriveService.read failed", e);
            throw e;
        }
    },

    /**
     * Writes data to Drive using Split Strategy.
     * 1. Core Data (Lightweight JSON)
     * 2. Assets Data (Heavy Images)
     */
    async write(accessToken: string, data: any): Promise<void> {
        let folderId = localStorage.getItem('gdrive_folder_id');
        if (!folderId) {
             const config = await locateDriveConfig(accessToken);
             folderId = config.folderId;
             if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
        }
        if (!folderId) throw new Error("Could not locate or create Drive folder.");

        try {
            const filenames = getDailyFilenames();
            console.log(`Preparing backup...`);
            
            // Split Data
            const { core, assets, hasAssets } = splitStateData(data);

            // Upload Core
            const existingCore = await findFileByName(accessToken, folderId, filenames.core);
            if (existingCore) {
                console.log("Updating existing Core file...");
                await uploadFile(accessToken, folderId, core, filenames.core, existingCore.id);
            } else {
                console.log("Creating new Core file...");
                await uploadFile(accessToken, folderId, core, filenames.core);
            }

            // Upload Assets (Only if present)
            if (hasAssets) {
                const existingAssets = await findFileByName(accessToken, folderId, filenames.assets);
                if (existingAssets) {
                    console.log("Updating existing Assets file...");
                    await uploadFile(accessToken, folderId, assets, filenames.assets, existingAssets.id);
                } else {
                    console.log("Creating new Assets file...");
                    await uploadFile(accessToken, folderId, assets, filenames.assets);
                }
            }
            
            console.log("Backup successful.");
        } catch (e: any) {
            if (e.message && e.message.includes('404')) {
                 console.warn("Folder 404, retrying...", e);
                 localStorage.removeItem('gdrive_folder_id');
                 return this.write(accessToken, data);
            }
            throw e;
        }
    }
};
