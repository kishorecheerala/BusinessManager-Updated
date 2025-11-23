
// NOTE: You must replace this with your own Client ID from Google Cloud Console
// Go to https://console.cloud.google.com/apis/credentials
// Create an OAuth 2.0 Client ID -> Web Application
// Add your Vercel URL (https://kishore-business-manager.vercel.app) to "Authorized JavaScript origins"
// ENSURE NO TRAILING SLASH at the end of the URL in Google Console (e.g., use .app NOT .app/).
const CLIENT_ID = '732045270886-84cr2t9q71lgttqgdn1jqu9f7ub5qfo3.apps.googleusercontent.com'.trim(); 

// Updated Scopes: Includes Drive File access AND User Profile/Email access
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
             // Popup closed is common, often ignored, but good to log.
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

// --- Low Level Operations ---

// Helper to get ALL candidate folders
export const getCandidateFolders = async (accessToken: string) => {
  const q = `mimeType='application/vnd.google-apps.folder' and name='${APP_FOLDER_NAME}' and trashed=false`;
  // Order by createdTime descending to check newest folders first
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=createdTime desc`, {
    headers: getHeaders(accessToken),
  });
  if (!response.ok) throw new Error(`Search Folders Failed: ${response.status}`);
  const data = await safeJsonParse(response);
  return data && data.files ? data.files : [];
};

// Original searchFolder kept for backward compatibility/single folder find
export const searchFolder = async (accessToken: string) => {
  const folders = await getCandidateFolders(accessToken);
  return folders.length > 0 ? folders[0].id : null;
};

export const createFolder = async (accessToken: string) => {
  const metadata = {
    name: APP_FOLDER_NAME,
    mimeType: 'application/vnd.google-apps.folder',
  };
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: getHeaders(accessToken),
    body: JSON.stringify(metadata),
  });
  if (!response.ok) throw new Error(`Create Folder Failed: ${response.status}`);
  const file = await safeJsonParse(response);
  return file ? file.id : null;
};

export const searchFile = async (accessToken: string, folderId: string) => {
  // We add orderBy modifiedTime desc to get the most recent backup if duplicates exist
  const q = `name='${BACKUP_FILE_NAME}' and '${folderId}' in parents and trashed=false`;
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&orderBy=modifiedTime desc&pageSize=1`, {
    headers: getHeaders(accessToken),
  });
  if (!response.ok) throw new Error(`Search File Failed: ${response.status}`);
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
  });
  
  if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Upload Failed: ${response.status} - ${errText}`);
  }
  
  return await safeJsonParse(response);
};

export const downloadFile = async (accessToken: string, fileId: string) => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  
  if (!response.ok) {
      // 404 implies file gone/deleted remotely
      if (response.status === 404) {
          throw new Error(`Download Failed: 404 Not Found`);
      }
      throw new Error(`Download Failed: ${response.status}`);
  }
  
  return await safeJsonParse(response);
};

export const getUserInfo = async (accessToken: string) => {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch user info: ${response.status}`);
    }
    const data = await safeJsonParse(response);
    return data || { name: 'Google User', email: 'User', picture: '' };
  } catch (e) {
    console.error("Error fetching user info:", e);
    // Return a fallback object to prevent app crashes
    return { name: 'Google User', email: 'User', picture: '' }; 
  }
};

// --- High Level Drive Service ---

export const DriveService = {
    /**
     * Ensures the App Data folder exists. Checks cache first, then Drive. Creates if missing.
     */
    async ensureFolder(accessToken: string): Promise<string> {
        let folderId = localStorage.getItem('gdrive_folder_id');
        
        // Verify or Find
        if (!folderId) {
            folderId = await searchFolder(accessToken);
            if (!folderId) {
                folderId = await createFolder(accessToken);
            }
            if (folderId) localStorage.setItem('gdrive_folder_id', folderId);
        }
        
        if (!folderId) throw new Error("Failed to initialize Google Drive folder.");
        return folderId;
    },

    /**
     * Reads the backup file.
     * - Robustly finds the file by checking cached IDs and searching through folder candidates.
     */
    async read(accessToken: string): Promise<any | null> {
        try {
            // 1. Attempt Fast Read using Cached File ID
            const cachedFileId = localStorage.getItem('gdrive_file_id');
            if (cachedFileId) {
                try {
                    const data = await downloadFile(accessToken, cachedFileId);
                    if (data) return data;
                } catch (e) {
                    console.warn("Cached file download failed, clearing cache and falling back to search.", e);
                    localStorage.removeItem('gdrive_file_id');
                }
            }

            // 2. Search Logic
            // If no cache or cache failed, search for ALL candidate folders.
            // This handles cases where duplicate folders might exist (e.g. one empty, one full).
            const folders = await getCandidateFolders(accessToken);
            
            if (folders.length === 0) return null;

            // Iterate through folders to find one that contains the backup file
            for (const folder of folders) {
                const remoteFile = await searchFile(accessToken, folder.id);
                if (remoteFile) {
                    // Found valid file!
                    console.log("Found backup in folder:", folder.id);
                    
                    // Update Cache to this working pair
                    localStorage.setItem('gdrive_folder_id', folder.id);
                    localStorage.setItem('gdrive_file_id', remoteFile.id);
                    
                    // Download
                    const data = await downloadFile(accessToken, remoteFile.id);
                    return data;
                }
            }
            
            // No file found in any candidate folder
            return null;

        } catch (e: any) {
            console.error("DriveService.read failed", e);
            // Rethrow so the UI knows sync failed
            throw e;
        }
    },

    /**
     * Writes data to the backup file.
     * - Creates new file if none exists.
     * - Updates existing file if ID is known.
     * - Handles 404 by creating a new file.
     */
    async write(accessToken: string, data: any): Promise<void> {
        const folderId = await this.ensureFolder(accessToken);
        
        // Check for file existence if we don't have a cached ID
        let fileId = localStorage.getItem('gdrive_file_id');
        if (!fileId) {
             const remoteFile = await searchFile(accessToken, folderId);
             fileId = remoteFile ? remoteFile.id : null;
        }

        try {
            const result = await uploadFile(accessToken, folderId, data, fileId || undefined);
            if (result && result.id) {
                localStorage.setItem('gdrive_file_id', result.id);
            }
        } catch (e: any) {
            // Handle Stale ID during upload (404)
            if (e.message && e.message.includes('404')) {
                console.warn("Upload target not found, creating new file...");
                localStorage.removeItem('gdrive_file_id');
                // Retry upload as a new file
                const result = await uploadFile(accessToken, folderId, data);
                if (result && result.id) {
                    localStorage.setItem('gdrive_file_id', result.id);
                }
            } else {
                throw e;
            }
        }
    }
};
