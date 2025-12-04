import { sendLocalNotification } from './communication';

type NetworkStatusListener = (isOnline: boolean) => void;

class NetworkManager {
  private static instance: NetworkManager;
  public isOnline: boolean = navigator.onLine;
  private listeners: Set<NetworkStatusListener> = new Set();
  private syncQueue: Array<() => Promise<any>> = [];

  private constructor() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  public static getInstance(): NetworkManager {
    if (!NetworkManager.instance) {
      NetworkManager.instance = new NetworkManager();
    }
    return NetworkManager.instance;
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.notifyListeners();
    this.processQueue();
    sendLocalNotification('Back Online', 'Synchronization resumed.', '/vite.svg');
  };

  private handleOffline = () => {
    this.isOnline = false;
    this.notifyListeners();
    sendLocalNotification('Offline Mode', 'Changes will be saved locally.', '/vite.svg');
  };

  public subscribe(listener: NetworkStatusListener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isOnline));
  }

  // Queue tasks to run when back online
  public enqueueTask(task: () => Promise<any>) {
    if (this.isOnline) {
      task().catch(console.error);
    } else {
      this.syncQueue.push(task);
    }
  }

  private async processQueue() {
    if (this.syncQueue.length === 0) return;

    console.log(`[NetworkManager] Processing ${this.syncQueue.length} queued tasks...`);
    
    // Process sequentially to maintain order
    while (this.syncQueue.length > 0) {
      const task = this.syncQueue.shift();
      if (task) {
        try {
          await task();
        } catch (error) {
          console.error('[NetworkManager] Task failed', error);
          // Optional: re-queue if retry logic is needed
        }
      }
    }
  }
}

export const networkManager = NetworkManager.getInstance();