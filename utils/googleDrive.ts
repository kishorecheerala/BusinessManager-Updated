
// NOTE: You must replace this with your own Client ID from Google Cloud Console
// Go to https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID -> Web Application
// Add your Vercel URL (https://kishore-business-manager.vercel.app) to "Authorized JavaScript origins"
// ENSURE NO TRAILING SLASH at the end of the URL in Google Console (e.g., use .app NOT .app/).
const DEFAULT_CLIENT_ID = '732045270886-84cr2t9q71lgttqgdn1jqu9f7ub5qfo3.apps.googleusercontent.com'.trim(); 

export const getClientId = () => {
    return localStorage.getItem('google_client_id') || DEFAULT_CLIENT_ID;
};

// Updated Scopes: Includes Drive File access, User Profile, Full Calendar, AND SPREADSHEETS
// switched calendar.events to calendar for broader compatibility if needed
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets';

// Folder name in Google Drive
const APP_FOLDER_NAME = 'BusinessManager_AppData';

// Helper to generate daily filename
const getDailyBackupFilename = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `BusinessManager_Backup_${year}-${month}-${day}.json`;
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
        // Trigger app-level error handling first
        if (errorCallback) errorCallback(err);

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

export const findLatestFile = async (accessToken: string, folderId: string) => {
  const q = `'${folderId}' in parents and mimeType='application/json' and trashed=false`;
  // Order by modifiedTime desc to get the absolute latest file regardless of name
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1`, {
    headers: getHeaders(accessToken),
    cache: 'no-store'
  });
  if (!response.ok) await handleApiError(response, "Search Latest File Failed");
  const data = await safeJsonParse(response);
  return data && data.files && data.files.length > 0 ? data.files[0] : null;
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

// RESUMABLE UPLOAD IMPLEMENTATION (Required for large files/images > 5MB)
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

  // 1. Initiate Resumable Session
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
        // 'X-Upload-Content-Type': contentType,
        // 'X-Upload-Content-Length': new Blob([fileContent]).size.toString()
    },
    body: JSON.stringify(metadata)
  });

  if (!initResponse.ok) await handleApiError(initResponse, "Init Upload Failed");
  
  const sessionUri = initResponse.headers.get('Location');
  if (!sessionUri) throw new Error("Resumable upload initiation failed: No Location header");

  // 2. Upload Actual Content
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

export const renameFile = async (accessToken: string, fileId: string, newName: string) => {
    console.log(`Renaming file ${fileId} to ${newName}`);
    const metadata = { name: newName };
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'PATCH',
        headers: getHeaders(accessToken),
        body: JSON.stringify(metadata)
    });
    if (!response.ok) await handleApiError(response, "Rename Failed");
    return await safeJsonParse(response);
};

export const deleteFile = async (accessToken: string, fileId: string) => {
    console.log(`Deleting file ${fileId}`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (!response.ok) await handleApiError(response, "Delete Failed");
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
  // Basic Validation
  if (!data || (typeof data !== 'object')) {
      console.warn("Downloaded data is not a valid object");
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

    if (folders.length > 0) {
        console.log(`Found ${folders.length} candidate folders. Checking for content...`);
        
        // Smart Selection: The "newest" folder (folders[0]) might be an empty duplicate 
        // created by another device. We should prioritize the folder that actually 
        // contains the most recent backup file.
        
        let bestFolder = folders[0];
        let latestFileTimestamp = 0;

        // Check up to 5 most recent folders to avoid excessive API calls
        const foldersToCheck = folders.slice(0, 5);

        for (const folder of foldersToCheck) {
            try {
                const latestFile = await findLatestFile(accessToken, folder.id);
                if (latestFile) {
                    const fileTime = new Date(latestFile.modifiedTime).getTime();
                    // If this folder has a file newer than what we've seen, pick this folder
                    if (fileTime > latestFileTimestamp) {
                        latestFileTimestamp = fileTime;
                        bestFolder = folder;
                    }
                }
            } catch (e) {
                console.warn(`Failed to check files in folder ${folder.id}`, e);
            }
        }

        activeFolderId = bestFolder.id;
        console.log(`Selected active folder: ${bestFolder.name} (ID: ${activeFolderId})`);

    } else {
        console.log("No app folder found. Creating new one.");
        // No folder exists at all. Create one.
        activeFolderId = await createFolder(accessToken);
    }

    return { folderId: activeFolderId };
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
     * It finds the most recently modified JSON file in the folder.
     */
    async read(accessToken: string): Promise<any | null> {
        try {
            const { folderId } = await locateDriveConfig(accessToken);
            if (!folderId) return null;
            
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);

            // Find the most recent backup file regardless of name
            const latestFile = await findLatestFile(accessToken, folderId);

            if (latestFile) {
                console.log("Attempting to read latest backup:", latestFile.name);
                try {
                    const data = await downloadFile(accessToken, latestFile.id);
                    if (data) return data; // Success
                    console.warn("Backup file was empty or invalid.");
                } catch (e) {
                    console.error("Error reading backup file:", e);
                }
            } else {
                console.log("No backup files found.");
            }

            return null; 
        } catch (e: any) {
            console.error("DriveService.read failed", e);
            throw e;
        }
    },

    /**
     * Writes data to Drive using Daily File Strategy.
     * Creates a file named 'BusinessManager_Backup_YYYY-MM-DD.json'.
     * Updates the file if it already exists for today.
     * Uses RESUMABLE UPLOAD for robust large file handling.
     */
    async write(accessToken: string, data: any): Promise<void> {
        let folderId = localStorage.getItem('gdrive_folder_id');

        // Re-validate folder ID presence or find it if missing
        if (!folderId) {
             const config = await locateDriveConfig(accessToken);
             folderId = config.folderId;
             if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
        }

        if (!folderId) throw new Error("Could not locate or create Drive folder.");

        try {
            const filename = getDailyBackupFilename();
            console.log(`Preparing backup: ${filename}`);
            
            // Check if today's backup file already exists
            const existingFile = await findFileByName(accessToken, folderId, filename);

            if (existingFile) {
                console.log("Updating today's existing backup file...");
                await uploadFile(accessToken, folderId, data, filename, existingFile.id);
            } else {
                console.log("Creating new daily backup file...");
                await uploadFile(accessToken, folderId, data, filename);
            }
            
            console.log("Backup successful.");
        } catch (e: any) {
            // If folder ID is stale (404), recover
            if (e.message && e.message.includes('404')) {
                 console.warn("Folder 404, retrying with discovery...", e);
                 localStorage.removeItem('gdrive_folder_id');
                 // Recursive retry once
                 return this.write(accessToken, data);
            }
            throw e;
        }
    }
};