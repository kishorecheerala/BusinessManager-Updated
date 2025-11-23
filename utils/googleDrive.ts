
// NOTE: You must replace this with your own Client ID from Google Cloud Console
// Go to https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID -> Web Application
// Add your Vercel URL (https://kishore-business-manager.vercel.app) to "Authorized JavaScript origins"
// ENSURE NO TRAILING SLASH at the end of the URL in Google Console (e.g., use .app NOT .app/).
const CLIENT_ID = '732045270886-84cr2t9q71lgttqgdn1jqu9f7ub5qfo3.apps.googleusercontent.com'.trim(); 

// Updated Scopes: Includes Drive File access AND User Profile/Email access
// Note: drive.file only allows access to files created by THIS app.
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

// Folder name in Google Drive
const APP_FOLDER_NAME = 'BusinessManager_AppData';
const BACKUP_FILE_NAME = 'backup.json';

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

export const initGoogleAuth = (callback: (response: any) => void) => {
  return (window as any).google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    ux_mode: 'popup',
    callback: callback,
    error_callback: (err: any) => {
        console.error("Google Auth Error:", err);
        const currentOrigin = window.location.origin;
        
        let msg = `Google Sign-In Error: ${err.type || 'Unknown Error'}\n\n`;
        
        if (err.message) {
             msg += `Details: ${err.message}\n\n`;
        }

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

// Helper for safe JSON parsing to avoid "Unexpected end of input"
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
        // fallback to text if json fails
        try {
             const text = await response.text();
             if(text) details = text;
        } catch(e2) {}
    }
    const msg = `${context}: ${response.status} (${details})`;
    console.error(msg);
    throw new Error(msg);
}

// --- Low Level Operations ---

// Helper to get ALL candidate folders
export const getCandidateFolders = async (accessToken: string) => {
  // IMPORTANT: 'trashed=false' is critical.
  const q = `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`;
  // Order by createdTime descending to check newest folders first
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc`, {
    headers: getHeaders(accessToken),
    cache: 'no-store' // Force network request
  });
  if (!response.ok) {
      await handleApiError(response, "Search Folders Failed");
  }
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

export const searchFile = async (accessToken: string, folderId: string) => {
  // We add orderBy modifiedTime desc to get the most recent backup if duplicates exist
  const q = `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });
  if (!response.ok) await handleApiError(response, "Search File Failed");
  const data = await safeJsonParse(response);
  return data && data.files && data.files.length > 0 ? data.files[0] : null;
};

export const uploadFile = async (accessToken: string, folderId: string, content: any, existingFileId?: string) => {
  const fileContent = JSON.stringify(content);
  const metadata = {
    name: BACKUP_FILE_NAME,
    mimeType: 'application/json',
    parents: existingFileId ? undefined : [folderId],
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  let url = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  let method = 'POST';

  if (existingFileId) {
    url = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
    method = 'PATCH';
  }

  const response = await fetch(url, {
    method: method,
    headers: { 'Authorization': `Bearer ${accessToken}` },
    body: form,
    cache: 'no-store'
  });
  
  if (!response.ok) await handleApiError(response, "Upload Failed");
  
  return await safeJsonParse(response);
};

export const downloadFile = async (accessToken: string, fileId: string) => {
  console.log(`Downloading file content for ID: ${fileId}`);
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
    cache: 'no-store'
  });
  
  if (!response.ok) {
      if (response.status === 404) {
          throw new Error(`Download Failed: 404 Not Found (File ID: ${fileId})`);
      }
      await handleApiError(response, "Download Failed");
  }
  
  const data = await safeJsonParse(response);
  if (data === null) {
      console.warn("Downloaded file but parsing failed (empty or invalid).");
      return null;
  }
  console.log("Download successful, data keys:", Object.keys(data));
  return data;
};

export const getUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
    }
    const data = await safeJsonParse(response);
    return data || { name: 'Google User', email: 'User', picture: '' };
  } catch (e) {
    console.error("Error fetching user info:", e);
    return { name: 'Google User', email: 'User', picture: '' }; 
  }
};

// --- High Level Drive Service ---

async function locateDriveConfig(accessToken: string) {
    // 1. Find all folders with the App Name, sorted by newest first
    console.log("Locating app folder in Drive...");
    const folders = await getCandidateFolders(accessToken);
    
    let activeFolderId = null;
    let activeFileId = null;

    if (folders.length > 0) {
        console.log(`Found ${folders.length} candidate folders.`);
        // We have candidates. Iterate to find one containing the backup file.
        // This fixes issues where multiple folders exist (e.g. one empty, one with data).
        for (const folder of folders) {
            const file = await searchFile(accessToken, folder.id);
            if (file) {
                activeFolderId = folder.id;
                activeFileId = file.id;
                console.log("Found active backup in folder:", folder.id, "File ID:", file.id);
                break; // Found the data! Stop searching.
            }
        }

        // If we iterated all and found no file, default to the newest folder (first in list)
        if (!activeFolderId) {
            activeFolderId = folders[0].id;
            console.log("No backup file found in any folder. Using newest folder:", activeFolderId);
        }
    } else {
        console.log("No app folder found. Creating new one.");
        // No folder exists at all. Create one.
        activeFolderId = await createFolder(accessToken);
    }

    return { folderId: activeFolderId, fileId: activeFileId };
}

// New Diagnostic Function for Mobile Debugging
export const debugDriveState = async (accessToken: string) => {
    const logs: string[] = [];
    const log = (msg: string) => logs.push(msg);
    
    try {
        log("--- DIAGNOSTIC START ---");
        log("Fetching User Info...");
        const user = await getUserInfo(accessToken);
        log(`User: ${user.email}`);

        log(`Searching for folders: '${APP_FOLDER_NAME}'`);
        const folders = await getCandidateFolders(accessToken);
        log(`Found ${folders.length} matching folder(s).`);

        const details = [];

        for (const folder of folders) {
            log(`Scanning Folder: ${folder.name} (ID: ...${folder.id.slice(-6)})`);
            log(`Created: ${folder.createdTime || 'Unknown'}`);
            
            // List all JSON files in this folder
            const q = `'${folder.id}' in parents and mimeType='application/json' and trashed=false`;
            const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc`, {
                headers: getHeaders(accessToken),
                cache: 'no-store'
            });
            
            if (!response.ok) {
                let errMsg = `ERROR reading folder: ${response.status}`;
                try {
                    const errBody = await response.json();
                    if (errBody.error && errBody.error.message) {
                        errMsg += ` - ${errBody.error.message}`;
                    }
                } catch(e) {}
                log(`  ${errMsg}`);
                continue;
            }

            const data = await safeJsonParse(response);
            const files = data?.files || [];
            log(`  - Contains ${files.length} JSON file(s).`);
            files.forEach((f: any) => {
                log(`    * ${f.name} (${(Number(f.size)/1024).toFixed(1)}KB) - ${new Date(f.modifiedTime).toLocaleString()}`);
            });
            
            details.push({ folder, files });
        }
        log("--- DIAGNOSTIC END ---");

        return { logs, details };
    } catch (e: any) {
        log(`CRITICAL ERROR: ${e.message}`);
        if (e.message && (e.message.includes("403") || e.message.includes("Access Not Configured"))) {
            log("HINT: This usually means the 'Google Drive API' is not enabled in Google Cloud Console.");
        }
        if (e.message && e.message.includes("Insufficient Permission")) {
            log("HINT: Try 'Force Re-Auth' to grant permissions again.");
        }
        return { logs, details: [] };
    }
}

export const DriveService = {
    /**
     * Reads data from Drive.
     * Always performs a fresh search to guarantee we find the true cloud state
     */
    async read(accessToken: string): Promise<any | null> {
        try {
            // Clean state: ignore local cache to ensure we find the true cloud state
            const { fileId, folderId } = await locateDriveConfig(accessToken);
            
            // Update cache for subsequent writes during this session
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
            if (fileId) localStorage.setItem('gdrive_file_id', fileId);

            if (fileId) {
                console.log("Attempting to download backup file...");
                const data = await downloadFile(accessToken, fileId);
                if (!data) {
                    console.warn("File found but content was empty or null.");
                }
                return data;
            }
            
            console.log("No file ID found during read operation.");
            return null; // Folder exists but no file -> No backup data
        } catch (e: any) {
            console.error("DriveService.read failed", e);
            throw e;
        }
    },

    /**
     * Writes data to Drive.
     * Tries cached config first, but falls back to full search/recovery if upload fails.
     */
    async write(accessToken: string, data: any): Promise<void> {
        let folderId = localStorage.getItem('gdrive_folder_id');
        let fileId = localStorage.getItem('gdrive_file_id');

        // If no cache, resolve config
        if (!folderId) {
             const config = await locateDriveConfig(accessToken);
             folderId = config.folderId;
             fileId = config.fileId;
             if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
             if (fileId) localStorage.setItem('gdrive_file_id', fileId);
        }

        if (!folderId) throw new Error("Could not locate or create Drive folder.");

        try {
            console.log("Uploading backup to Drive...");
            // Attempt upload
            const result = await uploadFile(accessToken, folderId, data, fileId || undefined);
            if (result && result.id) {
                localStorage.setItem('gdrive_file_id', result.id);
                console.log("Upload successful. File ID:", result.id);
            }
        } catch (e: any) {
            // If upload fails (likely 404 on stale fileId), perform full resolution and retry
            console.warn("Upload failed, retrying with full discovery...", e);
            
            const config = await locateDriveConfig(accessToken);
            folderId = config.folderId;
            fileId = config.fileId;
            
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
            if (fileId) localStorage.setItem('gdrive_file_id', fileId);
            else localStorage.removeItem('gdrive_file_id'); // clear stale file id if new folder is empty

            if (!folderId) throw new Error("Recovery failed: Could not locate Drive folder.");

            // Retry upload
            const retryResult = await uploadFile(accessToken, folderId, data, fileId || undefined);
            if (retryResult && retryResult.id) {
                localStorage.setItem('gdrive_file_id', retryResult.id);
            }
        }
    }
};
