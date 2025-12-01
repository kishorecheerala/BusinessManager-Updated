
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { 
  Home, Users, ShoppingCart, Package, Menu, Plus, UserPlus, PackagePlus, 
  Receipt, Undo2, FileText, BarChart2, Settings, PenTool, Gauge, Search, 
  Sparkles, Bell, HelpCircle, Cloud, CloudOff, RefreshCw, Layout, Edit,
  X, Download
} from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';
import { Page } from './types';

// Pages
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import SalesPage from './pages/SalesPage';
import PurchasesPage from './pages/PurchasesPage';
import ProductsPage from './pages/ProductsPage';
import ReportsPage from './pages/ReportsPage';
import ReturnsPage from './pages/ReturnsPage';
import InsightsPage from './pages/InsightsPage';
import ExpensesPage from './pages/ExpensesPage';
import QuotationsPage from './pages/QuotationsPage';
import InvoiceDesigner from './pages/InvoiceDesigner';
import SystemOptimizerPage from './pages/SystemOptimizerPage';

// Components
import MenuPanel from './components/MenuPanel';
import NotificationsPanel from './components/NotificationsPanel';
import AskAIModal from './components/AskAIModal';
import HelpModal from './components/HelpModal';
import UniversalSearch from './components/UniversalSearch';
import DeveloperToolsModal from './components/DeveloperToolsModal';
import CloudDebugModal from './components/CloudDebugModal';
import ProfileModal from './components/ProfileModal';
import AppSkeletonLoader from './components/AppSkeletonLoader';
import NavCustomizerModal from './components/NavCustomizerModal';
import Toast from './components/Toast';
import ChangeLogModal from './components/ChangeLogModal';
import FloatingActionButton from './components/FloatingActionButton';
import { useOnClickOutside } from './hooks/useOnClickOutside';
import { useHotkeys } from './hooks/useHotkeys';
import { logPageView } from './utils/analyticsLogger';
import { APP_VERSION } from './utils/changelogData';

// Icon Map for dynamic rendering
const ICON_MAP: Record<string, React.ElementType> = {
    'DASHBOARD': Home,
    'CUSTOMERS': Users,
    'SALES': ShoppingCart,
    'PURCHASES': Package,
    'INSIGHTS': BarChart2,
    'PRODUCTS': Package,
    'REPORTS': FileText,
    'EXPENSES': Receipt,
    'RETURNS': Undo2,
    'QUOTATIONS': FileText,
    'INVOICE_DESIGNER': PenTool,
    'SYSTEM_OPTIMIZER': Gauge
};

const LABEL_MAP: Record<string, string> = {
    'DASHBOARD': 'Home',
    'CUSTOMERS': 'Customers',
    'SALES': 'Sales',
    'PURCHASES': 'Purchases',
    'INSIGHTS': 'Insights',
    'PRODUCTS': 'Products',
    'REPORTS': 'Reports',
    'EXPENSES': 'Expenses',
    'RETURNS': 'Returns',
    'QUOTATIONS': 'Estimates',
    'INVOICE_DESIGNER': 'Designer',
    'SYSTEM_OPTIMIZER': 'System'
};

const QUICK_ACTION_REGISTRY: Record<string, { icon: React.ElementType, label: string, page: Page, action?: string }> = {
    'add_sale': { icon: ShoppingCart, label: 'Sale', page: 'SALES', action: 'new' },
    'add_customer': { icon: UserPlus, label: 'Customer', page: 'CUSTOMERS', action: 'new' },
    'add_expense': { icon: Receipt, label: 'Expense', page: 'EXPENSES', action: 'new' },
    'add_purchase': { icon: PackagePlus, label: 'Purchase', page: 'PURCHASES', action: 'new' },
    'add_quote': { icon: FileText, label: 'Estimate', page: 'QUOTATIONS', action: 'new' },
    'add_return': { icon: Undo2, label: 'Return', page: 'RETURNS', action: 'new' },
    'view_products': { icon: Package, label: 'Products', page: 'PRODUCTS' },
    'view_reports': { icon: FileText, label: 'Reports', page: 'REPORTS' },
    'view_insights': { icon: BarChart2, label: 'Insights', page: 'INSIGHTS' },
};

interface NavItemProps {
    page: string;
    label: string;
    icon: React.ElementType;
    onClick: () => void;
    isActive: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ page, label, icon: Icon, onClick, isActive }) => (
    <button 
        onClick={onClick}
        className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 group ${
            isActive 
            ? 'text-primary transform -translate-y-1' 
            : 'text-gray-400 dark:text-gray-500 hover:bg-gray-50/50 dark:hover:bg-slate-700/30'
        }`}
    >
        <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/10 scale-110' : ''}`}>
            <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight ${isActive ? 'opacity-100' : 'opacity-80'}`}>{label}</span>
    </button>
);

const AppContent: React.FC = () => {
    const { state, dispatch, isDbLoaded, syncData, googleSignIn, showToast } = useAppContext();
    
    // Initialize currentPage from localStorage or default to DASHBOARD
    const [currentPage, setCurrentPage] = useState<Page>(() => {
        // Check for PWA shortcuts in URL query params
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'new_sale') return 'SALES';
        if (action === 'new_customer') return 'CUSTOMERS';

        try {
            const saved = localStorage.getItem('business_manager_last_page');
            if (saved && Object.keys(ICON_MAP).includes(saved)) {
                return saved as Page;
            }
        } catch(e) {}
        return 'DASHBOARD';
    });

    // Handle PWA shortcut actions on mount (e.g., opening modals)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'new_customer') {
            dispatch({ type: 'SET_SELECTION', payload: { page: 'CUSTOMERS', id: 'new' } });
            // Clean URL
            window.history.replaceState({}, '', '/');
        }
    }, [dispatch]);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isAskAIOpen, setIsAskAIOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
    const [isCloudDebugOpen, setIsCloudDebugOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isNavCustomizerOpen, setIsNavCustomizerOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isMobileQuickAddOpen, setIsMobileQuickAddOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);

    const moreMenuRef = useRef<HTMLDivElement>(null);
    const mobileQuickAddRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));
    useOnClickOutside(mobileQuickAddRef, () => setIsMobileQuickAddOpen(false));
    useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));

    // Global Hotkeys
    useHotkeys('k', () => setIsSearchOpen(true), { ctrl: true });
    useHotkeys('m', () => setIsMenuOpen(prev => !prev), { ctrl: true });

    // Handle initial selection from context if any (override localStorage)
    useEffect(() => {
        if (state.selection && state.selection.page) {
            setCurrentPage(state.selection.page);
        }
    }, [state.selection]);

    // Check for App Updates (Change Log)
    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion !== APP_VERSION) {
            // Small delay to allow initial render settle
            setTimeout(() => setIsChangeLogOpen(true), 1500);
        }
    }, []);

    const handleCloseChangeLog = () => {
        setIsChangeLogOpen(false);
        localStorage.setItem('app_version', APP_VERSION);
    };

    // Persist current page navigation & Scroll to Top
    // Use useLayoutEffect to ensure scroll happens before paint
    useLayoutEffect(() => {
        localStorage.setItem('business_manager_last_page', currentPage);
        window.scrollTo(0, 0); 
    }, [currentPage]);

    // Double Back to Exit Logic & Disable Overscroll Swipe
    useEffect(() => {
        // Push state once to create a history entry we can trap
        window.history.pushState(null, document.title, window.location.href);

        let lastPopTime = 0;

        const handlePopState = (event: PopStateEvent) => {
            const now = Date.now();
            if (now - lastPopTime < 2000) {
                // Allowed to exit (double press detected within 2s)
                // Browser handles going back
            } else {
                // Prevent exit
                lastPopTime = now;
                window.history.pushState(null, document.title, window.location.href);
                showToast("Press back again to exit");
            }
        };

        window.addEventListener('popstate', handlePopState);
        
        // Prevent swipe navigation
        document.body.style.overscrollBehaviorX = 'none';
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
            document.body.style.overscrollBehaviorX = 'auto';
        };
    }, [showToast]);

    // Apply Theme & Dynamic Icon
    useEffect(() => {
        // 1. Dark Mode Class
        if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        const root = document.documentElement;
        
        // 2. Dynamic Primary Color
        const hex = state.themeColor.replace(/^#/, '');
        if (/^[0-9A-F]{6}$/i.test(hex)) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            root.style.setProperty('--primary-color', `${r} ${g} ${b}`);
        } else {
            root.style.setProperty('--primary-color', '13 148 136'); 
        }

        // 3. Header Background
        if (state.themeGradient) {
            root.style.setProperty('--header-bg', state.themeGradient);
            root.style.setProperty('--theme-gradient', state.themeGradient);
        } else {
            root.style.setProperty('--header-bg', state.themeColor);
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${state.themeColor} 0%, ${state.themeColor} 100%)`);
        }

        // 4. Persist to LocalStorage
        localStorage.setItem('theme', state.theme);
        localStorage.setItem('themeColor', state.themeColor);
        if (state.themeGradient) {
            localStorage.setItem('themeGradient', state.themeGradient);
        } else {
            localStorage.removeItem('themeGradient');
        }

        // 5. Dynamic Icons (Favicon, Apple Touch, Manifest)
        const updateIcons = () => {
            const bg = state.themeColor;
            const fill = '#ffffff'; 
            const svgString = `
                <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="96" fill="${bg}"/>
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="280" font-family="serif" fill="${fill}" font-weight="bold">ॐ</text>
                </svg>
            `.trim();
            
            const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
            
            // Update Favicon links
            const links = document.querySelectorAll("link[rel*='icon']");
            links.forEach(link => (link as HTMLLinkElement).href = dataUrl);

            // Update Meta Theme Color
            const metaTheme = document.querySelector("meta[name='theme-color']");
            if (metaTheme) metaTheme.setAttribute("content", bg);
        };
        
        updateIcons();
        
    }, [state.theme, state.themeColor, state.themeGradient]);

    // Navigation Handler with Dirty Check
    const handleNavigate = (page: Page, action?: string) => {
        if (isDirty) {
            if (!window.confirm("You have unsaved changes. Are you sure you want to leave?")) {
                return;
            }
            setIsDirty(false); // Reset dirty flag if user confirms
        }
        
        if (action) {
            // Set action in state to trigger useEffects in target page
            dispatch({ type: 'SET_SELECTION', payload: { page, id: 'new' } });
        }
        setCurrentPage(page);
        logPageView(page);
    };

    if (!isDbLoaded) {
        return <AppSkeletonLoader />;
    }

    // Determine Nav Items based on customization
    const navItems = state.navOrder.slice(0, 4);
    const moreItems = state.navOrder.slice(4);

    return (
        <div className="flex flex-col h-full bg-background dark:bg-slate-900 text-text dark:text-slate-300 overflow-hidden font-sans selection:bg-primary selection:text-white">
            <Toast />
            
            <header className="bg-theme text-white shadow-lg sticky top-0 z-30 transition-all duration-500 bg-cover bg-center shrink-0" style={{ background: state.themeGradient || state.themeColor }}>
                <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center relative">
                    {/* Menu Button */}
                    <button 
                        onClick={() => setIsMenuOpen(true)} 
                        className="p-2 rounded-lg hover:bg-white/20 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-white/50"
                        aria-label="Open Menu"
                    >
                        <Menu className="w-6 h-6" strokeWidth={2.5} />
                    </button>

                    {/* Logo / Brand - Centered */}
                    <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center cursor-pointer group" onClick={() => setCurrentPage('DASHBOARD')}>
                        <div className="flex items-center gap-2">
                            <span className="text-xl font-extrabold tracking-tight drop-shadow-md whitespace-nowrap">
                                {state.profile?.name || 'Business Manager'}
                            </span>
                        </div>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        <button 
                            onClick={() => setIsAskAIOpen(true)} 
                            className="p-2 rounded-lg hover:bg-white/20 active:scale-95 transition-all relative group"
                            aria-label="Ask AI Assistant"
                        >
                            <Sparkles className="w-5 h-5 text-yellow-300 group-hover:animate-pulse" strokeWidth={2.5} />
                        </button>
                        <button 
                            onClick={() => setIsSearchOpen(true)} 
                            className="p-2 rounded-lg hover:bg-white/20 active:scale-95 transition-all"
                            aria-label="Search"
                        >
                            <Search className="w-5 h-5" strokeWidth={2.5} />
                        </button>
                        <div className="relative" ref={notificationsRef}>
                            <button 
                                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} 
                                className="p-2 rounded-lg hover:bg-white/20 active:scale-95 transition-all relative"
                                aria-label="Notifications"
                            >
                                <Bell className="w-5 h-5" strokeWidth={2.5} />
                                {state.notifications.filter(n => !n.read).length > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                                )}
                            </button>
                            <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={(p) => handleNavigate(p)} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-grow overflow-y-auto overflow-x-hidden relative scroll-smooth overscroll-contain">
                <div className="max-w-7xl mx-auto p-4 pb-24 sm:pb-6 min-h-full">
                    {currentPage === 'DASHBOARD' && <Dashboard setCurrentPage={setCurrentPage} />}
                    {currentPage === 'CUSTOMERS' && <CustomersPage setIsDirty={setIsDirty} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'SALES' && <SalesPage setIsDirty={setIsDirty} />}
                    {currentPage === 'PURCHASES' && <PurchasesPage setIsDirty={setIsDirty} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'INSIGHTS' && <InsightsPage setCurrentPage={setCurrentPage} />}
                    {currentPage === 'PRODUCTS' && <ProductsPage setIsDirty={setIsDirty} />}
                    {currentPage === 'REPORTS' && <ReportsPage setCurrentPage={setCurrentPage} />}
                    {currentPage === 'EXPENSES' && <ExpensesPage setIsDirty={setIsDirty} />}
                    {currentPage === 'RETURNS' && <ReturnsPage setIsDirty={setIsDirty} />}
                    {currentPage === 'QUOTATIONS' && <QuotationsPage />}
                    {currentPage === 'INVOICE_DESIGNER' && <InvoiceDesigner setIsDirty={setIsDirty} setCurrentPage={setCurrentPage} />}
                    {currentPage === 'SYSTEM_OPTIMIZER' && <SystemOptimizerPage />}
                </div>
            </main>

            {/* Bottom Navigation Bar */}
            <nav className="md:hidden fixed bottom-0 w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-safe shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-30">
                <div className="flex justify-around items-end h-[60px] px-2 pb-1 relative">
                    
                    {/* Render customized nav items */}
                    {navItems.map(pageId => {
                        const Icon = ICON_MAP[pageId];
                        return (
                            <NavItem 
                                key={pageId}
                                page={pageId}
                                label={LABEL_MAP[pageId]}
                                icon={Icon}
                                onClick={() => handleNavigate(pageId as Page)}
                                isActive={currentPage === pageId}
                            />
                        );
                    })}

                    {/* More Menu Item */}
                    <div className="relative" ref={moreMenuRef}>
                        <button 
                            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 group ${isMoreMenuOpen ? 'text-primary transform -translate-y-1' : 'text-gray-400 dark:text-gray-500'}`}
                        >
                            <div className={`p-1 rounded-full transition-all duration-300 ${isMoreMenuOpen ? 'bg-primary/10 scale-110' : ''}`}>
                                <Layout className={`w-6 h-6 transition-transform duration-300 ${isMoreMenuOpen ? 'scale-110' : 'group-hover:scale-105'}`} strokeWidth={isMoreMenuOpen ? 2.5 : 2} />
                            </div>
                            <span className={`text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight ${isMoreMenuOpen ? 'opacity-100' : 'opacity-80'}`}>More</span>
                        </button>

                        {/* More Menu Dropdown (Upward) */}
                        {isMoreMenuOpen && (
                            <div className="absolute bottom-full right-0 mb-4 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden animate-slide-up-fade origin-bottom-right p-1 z-50">
                                <div className="grid grid-cols-1 gap-0.5">
                                    <button onClick={() => { setIsNavCustomizerOpen(true); setIsMoreMenuOpen(false); }} className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left w-full text-xs font-bold uppercase text-gray-400 tracking-wider">
                                        Customize Menu
                                    </button>
                                    {moreItems.map(pageId => {
                                        const Icon = ICON_MAP[pageId];
                                        return (
                                            <button 
                                                key={pageId}
                                                onClick={() => { handleNavigate(pageId as Page); setIsMoreMenuOpen(false); }}
                                                className={`flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left w-full ${currentPage === pageId ? 'bg-primary/5 text-primary' : 'text-gray-700 dark:text-gray-300'}`}
                                            >
                                                <Icon size={18} />
                                                <span className="font-semibold text-sm">{LABEL_MAP[pageId]}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            {/* Desktop Sidebar (Optional - using simplified responsive layout for now, assuming mobile-first PWA focus) */}
            
            {/* Modals & Panels */}
            <MenuPanel 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                onProfileClick={() => setIsProfileModalOpen(true)}
                onNavigate={handleNavigate}
                onOpenDevTools={() => setIsDevToolsOpen(true)}
                onLockApp={() => {
                    // Logic to lock app (requires re-PIN) - simplistic refresh for now
                    window.location.reload(); 
                }}
                onOpenChangeLog={() => setIsChangeLogOpen(true)}
            />
            
            <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={handleNavigate} />
            <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} />
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            <DeveloperToolsModal isOpen={isDevToolsOpen} onClose={() => setIsDevToolsOpen(false)} onOpenCloudDebug={() => setIsCloudDebugOpen(true)} />
            <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
            <NavCustomizerModal isOpen={isNavCustomizerOpen} onClose={() => setIsNavCustomizerOpen(false)} />
            <ChangeLogModal isOpen={isChangeLogOpen} onClose={handleCloseChangeLog} />

            {/* Floating Action Button */}
            <FloatingActionButton onNavigate={handleNavigate} />

        </div>
    );
};

// Named Export App to match index.tsx import { App }
export const App: React.FC = () => {
  return (
    <AppProvider>
      <DialogProvider>
        <AppContent />
      </DialogProvider>
    </AppProvider>
  );
};
