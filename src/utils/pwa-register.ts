
/**
 * Production-ready PWA registration utility
 * Handles all edge cases and common failures
 */

export class PWAManager {
  private static instance: PWAManager;
  public deferredPrompt: any = null;
  public isInstalled = false;
  public swRegistration: ServiceWorkerRegistration | null = null;
  private retryCount = 0;
  private maxRetries = 3;

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
   * Initialize PWA features
   * Call this once on app startup
   */
  async init() {
    if (typeof window === 'undefined') return;

    console.log('[PWA] Initializing...');

    // Check if already installed
    await this.checkInstallStatus();

    // Register service worker with retry logic
    await this.registerServiceWorker();

    // Setup install prompt listener
    this.setupInstallPrompt();

    // Check for updates periodically
    this.setupUpdateCheck();

    console.log('[PWA] Initialization complete');
  }

  /**
   * Register service worker with exponential backoff retry
   */
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[PWA] Service Workers not supported');
      return;
    }

    try {
      // Unregister any old 'sw.js' if it exists to avoid conflicts
      try {
        // Some restricted environments throw synchronously on getRegistrations access
        if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) {
                if (reg.active && reg.active.scriptURL.endsWith('/sw.js')) {
                    console.log('[PWA] Unregistering legacy sw.js');
                    await reg.unregister();
                }
            }
        }
      } catch (e) {
        // Only warn, don't block the main registration if getting registrations fails
        // This happens in some restrictive iframe/webview environments
        console.warn("[PWA] Could not check existing registrations (restricted env):", e);
      }

      this.swRegistration = await navigator.serviceWorker.register(
        './service-worker.js',
        {
          scope: './',
          updateViaCache: 'none' // Always check for updates
        }
      );

      console.log('[PWA] Service Worker registered:', this.swRegistration);

      // Wait for service worker to be active
      await navigator.serviceWorker.ready;
      console.log('[PWA] Service Worker is active and ready');

      // Handle updates
      this.swRegistration.addEventListener('updatefound', () => {
        this.onSwUpdateFound();
      });

      this.retryCount = 0; // Reset retry count on success

    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);

      // Retry with exponential backoff
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000;
        console.log(`[PWA] Retrying registration in ${delay}ms (attempt ${this.retryCount})`);
        
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
      console.log('[PWA] beforeinstallprompt fired');

      // Prevent the default install prompt from showing
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
      console.log('[PWA] App installed successfully');
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
      console.warn('[PWA] Install prompt not available');
      return false;
    }

    try {
      // Show the prompt
      this.deferredPrompt.prompt();

      // Get user choice
      const { outcome } = await this.deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        console.log('[PWA] User accepted installation');
        this.isInstalled = true;
      } else {
        console.log('[PWA] User dismissed installation');
      }

      // Clear the deferred prompt
      this.deferredPrompt = null;
      return true;

    } catch (error) {
      console.error('[PWA] Installation prompt error:', error);
      return false;
    }
  }

  /**
   * Check if app is already installed
   */
  async checkInstallStatus() {
    if ('getInstalledRelatedApps' in navigator) {
      try {
        const apps = await (navigator as any).getInstalledRelatedApps();
        this.isInstalled = apps.length > 0;
        console.log('[PWA] App installed:', this.isInstalled);
      } catch (error) {
        console.error('[PWA] Could not check install status:', error);
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
            console.log('[PWA] New service worker available');

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
   * Skip waiting and activate new SW
   */
  skipWaiting() {
    if (this.swRegistration && this.swRegistration.waiting) {
      this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  /**
   * Check for updates periodically (every 1 hour)
   */
  setupUpdateCheck() {
    setInterval(() => {
      if (this.swRegistration) {
        this.swRegistration.update().catch(err => {
          console.error('[PWA] Update check failed:', err);
        });
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Export singleton instance
export const pwaManager = PWAManager.getInstance();
