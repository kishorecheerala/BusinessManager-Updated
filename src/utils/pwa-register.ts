
/**
 * Production-ready PWA registration utility
 * Handles all edge cases and common failures
 */

declare global {
  interface Window {
    PWADebug: any;
  }
}

export class PWAManager {
  private static instance: PWAManager;
  public deferredPrompt: any = null;
  public isInstalled = false;
  public swRegistration: ServiceWorkerRegistration | null = null;
  private retryCount = 0;
  private maxRetries = 3;
  private readonly CONFIG = {
    SW_PATH: 'service-worker.js', // Changed to just filename, resolution logic moved to method
    LOG_PREFIX: '[PWA]'
  };

  private constructor() {
    // Private constructor to enforce singleton
  }

  public static getInstance(): PWAManager {
    if (!PWAManager.instance) {
      PWAManager.instance = new PWAManager();
    }
    return PWAManager.instance;
  }

  /**
   * Check if we are in a development environment
   */
  public isDevMode(): boolean {
    return (
      window.location.hostname === 'localhost' || 
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.startsWith('192.168.') || // Local network
      window.location.port === '5173' || // Vite default
      window.location.port === '3000' ||
      window.location.port === '8080'
    );
  }

  /**
   * Initialize PWA features
   * Call this once on app startup
   */
  async init() {
    if (typeof window === 'undefined') return;

    console.log(this.CONFIG.LOG_PREFIX + ' Initializing... Dev Mode:', this.isDevMode());

    // Expose debug tools
    this.setupDebugTools();

    // Check if already installed
    await this.checkInstallStatus();

    // Register service worker with retry logic
    await this.registerServiceWorker();

    // Setup install prompt listener
    this.setupInstallPrompt();

    // Check for updates periodically
    this.setupUpdateCheck();

    console.log(this.CONFIG.LOG_PREFIX + ' Initialization complete');
  }

  /**
   * Register service worker with exponential backoff retry
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn(this.CONFIG.LOG_PREFIX + ' Service Workers not supported');
      return;
    }

    // Check for secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
       console.warn(this.CONFIG.LOG_PREFIX + ' Skipped: Service Workers require a secure context (HTTPS).');
       return;
    }

    try {
      // Unregister any old 'sw.js' if it exists to avoid conflicts
      try {
        // Some restricted environments throw synchronously on getRegistrations access
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                if (reg.active && reg.active.scriptURL.includes('/sw.js')) { 
                    console.log(this.CONFIG.LOG_PREFIX + ' Unregistering legacy sw.js');
                    await reg.unregister();
                }
            }
        }
      } catch (e) {
        console.warn(this.CONFIG.LOG_PREFIX + " Could not check existing registrations:", e);
      }

      // Resolve SW URL against current window location to avoid Base Tag origin mismatch issues
      // This forces the URL to match the current origin, fixing issues in some preview environments
      const swUrlBase = new URL(this.CONFIG.SW_PATH, window.location.href).href;
      
      // Add cache buster for development
      const finalSwUrl = this.isDevMode() 
        ? `${swUrlBase}?v=${Date.now()}`
        : swUrlBase;

      this.swRegistration = await navigator.serviceWorker.register(
        finalSwUrl,
        {
          scope: './',
          updateViaCache: 'none'
        }
      );

      console.log(this.CONFIG.LOG_PREFIX + ' Service Worker registered:', this.swRegistration);

      // Listen for controller change (updates app when new SW takes over)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log(this.CONFIG.LOG_PREFIX + ' 🔄 Controller changed - reloading page');
          window.location.reload();
        }
      });

      // Handle updates found
      this.swRegistration.addEventListener('updatefound', () => {
        this.onSwUpdateFound();
      });
      
      // Handle messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data && event.data.type === 'CACHE_UPDATED') {
              console.log(this.CONFIG.LOG_PREFIX + ' Cache updated to version:', event.data.version);
              if (!this.isDevMode()) {
                  // Could trigger a toast here if desired
              }
          }
      });

      this.retryCount = 0; // Reset retry count on success

    } catch (error) {
      // Log as warning in preview environments to avoid alarming red errors in console
      console.warn(this.CONFIG.LOG_PREFIX + ' Service Worker registration failed (likely due to preview environment restrictions):', error);

      // Retry logic - only if it's likely a network issue, not a security/origin issue
      // Simply checking message for now
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('origin') && !msg.includes('security') && this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000;
        console.log(this.CONFIG.LOG_PREFIX + ` Retrying registration in ${delay}ms (attempt ${this.retryCount})`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.registerServiceWorker();
      }
    }
  }

  /**
   * Setup beforeinstallprompt event listener
   */
  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
      console.log(this.CONFIG.LOG_PREFIX + ' beforeinstallprompt fired');

      // Prevent the default install prompt from showing immediately
      event.preventDefault();

      // Store the deferred prompt for later use
      this.deferredPrompt = event;

      // Dispatch custom event for UI to listen to
      window.dispatchEvent(
        new CustomEvent('pwa-install-ready', {
          detail: { canInstall: true }
        })
      );
    });

    window.addEventListener('appinstalled', () => {
      console.log(this.CONFIG.LOG_PREFIX + ' App installed successfully');
      this.isInstalled = true;
      this.deferredPrompt = null;

      // Clear custom install UI
      window.dispatchEvent(
        new CustomEvent('pwa-installed', {
          detail: { installed: true }
        })
      );
    });
  }

  /**
   * Trigger the install prompt
   * Must be called from user gesture (click event)
   */
  async promptInstall() {
    if (!this.deferredPrompt) {
      console.warn(this.CONFIG.LOG_PREFIX + ' Install prompt not available');
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log(this.CONFIG.LOG_PREFIX + ' User accepted installation');
        this.isInstalled = true;
      } else {
        console.log(this.CONFIG.LOG_PREFIX + ' User dismissed installation');
      }

      this.deferredPrompt = null;
      return true;

    } catch (error) {
      console.error(this.CONFIG.LOG_PREFIX + ' Installation prompt error:', error);
      return false;
    }
  }

  /**
   * Check if app is already installed
   */
  async checkInstallStatus() {
    // getInstalledRelatedApps is only supported in top-level browsing contexts.
    // Skip check if we are inside an iframe (e.g. Preview Environment)
    if (window.self !== window.top) {
       // console.log(this.CONFIG.LOG_PREFIX + ' Skipping install check (iframe detected)');
       return;
    }

    if ('getInstalledRelatedApps' in navigator) {
      try {
        const apps = await (navigator as any).getInstalledRelatedApps();
        this.isInstalled = apps.length > 0;
        console.log(this.CONFIG.LOG_PREFIX + ' App installed:', this.isInstalled);
      } catch (error) {
        console.warn(this.CONFIG.LOG_PREFIX + ' Could not check install status:', error);
      }
    }
  }

  /**
   * Handle service worker updates
   */
  onSwUpdateFound() {
    if (!this.swRegistration) return;
    const newSW = this.swRegistration.installing;

    if (newSW) {
        newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            console.log(this.CONFIG.LOG_PREFIX + ' New service worker available');

            // Notify user about update
            window.dispatchEvent(
            new CustomEvent('pwa-update-available', {
                detail: { registration: this.swRegistration }
            })
            );
        }
        });
    }
  }

  /**
   * Clear all caches and unregister SW (Debug tool)
   */
  async clearAllCaches() {
      console.log(this.CONFIG.LOG_PREFIX + ' Clearing all caches');
      if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
              type: 'CLEAR_CACHE'
          });
      }
      console.log(this.CONFIG.LOG_PREFIX + ' ✅ All caches cleared');
  }

  /**
   * Setup global debug tools
   */
  setupDebugTools() {
      window.PWADebug = {
          isDevMode: () => this.isDevMode(),
          clearCache: () => this.clearAllCaches(),
          reloadApp: async () => {
              await this.clearAllCaches();
              window.location.reload();
          },
          getRegistration: () => this.swRegistration
      };
      console.log(this.CONFIG.LOG_PREFIX + ' Debug tools available at window.PWADebug');
  }

  /**
   * Check for updates periodically
   */
  setupUpdateCheck() {
    // In dev mode check frequently, in prod check hourly
    const interval = this.isDevMode() ? 10000 : 60 * 60 * 1000;
    
    setInterval(() => {
      if (this.swRegistration) {
        this.swRegistration.update().catch(err => {
          // console.error('[PWA] Update check failed:', err); // Silent fail is fine
        });
      }
    }, interval);
  }
}

// Export singleton instance
export const pwaManager = PWAManager.getInstance();
