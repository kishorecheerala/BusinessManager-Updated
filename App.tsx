
import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, Suspense } from 'react';
import { 
  Home, Users, ShoppingCart, Package, Menu, Plus, UserPlus, PackagePlus, 
  Receipt, Undo2, FileText, BarChart2, Settings, PenTool, Gauge, Search, 
  Sparkles, Bell, HelpCircle, Cloud, CloudOff, RefreshCw, Layout, Edit,
  X, Download, Sun, Moon, CalendarClock, WifiOff, Database, PauseCircle, Trash2
} from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';
import { Page } from './types';

// Components (Eager Load - Critical for App Skeleton)
import Card from './components/Card';
import Button from './components/Button';
import OnboardingScreen from './components/OnboardingScreen';
import DevineLoader from './components/DevineLoader';
import Toast from './components/Toast';

// Components (Lazy Load - Load only when app is fully interactive or needed)
const MenuPanel = React.lazy(() => import('./components/MenuPanel'));
const NotificationsPanel = React.lazy(() => import('./components/NotificationsPanel'));
const AskAIModal = React.lazy(() => import('./components/AskAIModal'));
const HelpModal = React.lazy(() => import('./components/HelpModal'));
const UniversalSearch = React.lazy(() => import('./components/UniversalSearch'));
const DeveloperToolsModal = React.lazy(() => import('./components/DeveloperToolsModal'));
const CloudDebugModal = React.lazy(() => import('./components/CloudDebugModal'));
const ProfileModal = React.lazy(() => import('./components/ProfileModal'));
const NavCustomizerModal = React.lazy(() => import('./components/NavCustomizerModal'));
const ChangeLogModal = React.lazy(() => import('./components/ChangeLogModal'));
const SignInModal = React.lazy(() => import('./components/SignInModal'));
const PinModal = React.lazy(() => import('./components/PinModal'));

// Hooks
import { useOnClickOutside } from './hooks/useOnClickOutside';
import { useHotkeys } from './hooks/useHotkeys';
import { logPageView } from './utils/analyticsLogger';
import { APP_VERSION } from './utils/changelogData';

// Pages (Lazy Load)
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const CustomersPage = React.lazy(() => import('./pages/CustomersPage'));
const SalesPage = React.lazy(() => import('./pages/SalesPage'));
const PurchasesPage = React.lazy(() => import('./pages/PurchasesPage'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const ReturnsPage = React.lazy(() => import('./pages/ReturnsPage'));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage'));
const ExpensesPage = React.lazy(() => import('./pages/ExpensesPage'));
const QuotationsPage = React.lazy(() => import('./pages/QuotationsPage'));
const InvoiceDesigner = React.lazy(() => import('./pages/InvoiceDesigner'));
const SystemOptimizerPage = React.lazy(() => import('./pages/SystemOptimizerPage'));
const SQLAssistantPage = React.lazy(() => import('./pages/SQLAssistantPage'));
const TrashPage = React.lazy(() => import('./pages/TrashPage'));

// Icon Map
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
    'SYSTEM_OPTIMIZER': Gauge,
    'SQL_ASSISTANT': Database,
    'TRASH': Trash2
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
    'SYSTEM_OPTIMIZER': 'System',
    'SQL_ASSISTANT': 'SQL AI',
    'TRASH': 'Recycle Bin'
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

const QUICK_ACTION_SHORTCUTS: Record<string, string> = {
    'add_sale': 'S',
    'add_customer': 'C',
    'add_expense': 'E',
    'add_purchase': 'P',
    'add_quote': 'Q',
    'add_return': 'R',
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
            ? 'text-white transform -translate-y-1' 
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
    >
        <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-white/20 scale-110' : ''}`}>
            <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} strokeWidth={isActive ? 2.5 : 2} />
        </div>
        <span className={`text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight`}>{label}</span>
    </button>
);

const AppContent: React.FC = () => {
    const { state, dispatch, isDbLoaded, syncData, googleSignIn, showToast } = useAppContext();
    
    const [currentPage, setCurrentPage] = useState<Page>(() => {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'new_sale') return 'SALES';
        if (action === 'new_customer') return 'CUSTOMERS';

        try {
            const saved = localStorage.getItem('business_manager_last_page');
            const excludedPages = ['INVOICE_DESIGNER', 'SYSTEM_OPTIMIZER', 'SQL_ASSISTANT', 'TRASH'];
            if (saved && Object.keys(ICON_MAP).includes(saved) && !excludedPages.includes(saved)) {
                return saved as Page;
            }
        } catch(e) {}
        return 'DASHBOARD';
    });

    const [currentDateTime, setCurrentDateTime] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setCurrentDateTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getTimeBasedGreeting = () => {
        const hour = currentDateTime.getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const getGreetingIcon = () => {
        const hour = currentDateTime.getHours();
        if (hour >= 6 && hour < 18) {
            return <Sun className="w-4 h-4 text-yellow-300 animate-[spin_10s_linear_infinite]" />;
        }
        return <Moon className="w-4 h-4 text-blue-200 animate-pulse" />;
    };

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (action === 'new_customer') {
            dispatch({ type: 'SET_SELECTION', payload: { page: 'CUSTOMERS', id: 'new' } });
            try {
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);
            } catch (e) {
                console.warn('Could not clean URL history', e);
            }
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
    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    
    const [parkModalState, setParkModalState] = useState<{ isOpen: boolean, targetPage: Page | null }>({ isOpen: false, targetPage: null });

    const moreMenuRef = useRef<HTMLDivElement>(null);
    const mobileQuickAddRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));
    useOnClickOutside(mobileQuickAddRef, () => setIsMobileQuickAddOpen(false));
    useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));

    useHotkeys('k', () => setIsSearchOpen(true), { ctrl: true });
    useHotkeys('m', () => setIsMenuOpen(prev => !prev), { ctrl: true });

    useEffect(() => {
        if (state.selection && state.selection.page) {
            setCurrentPage(state.selection.page);
        }
    }, [state.selection]);

    useEffect(() => {
        const storedVersion = localStorage.getItem('app_version');
        if (storedVersion !== APP_VERSION) {
            setTimeout(() => setIsChangeLogOpen(true), 1500);
        }
    }, []);

    useEffect(() => {
        // Show onboarding if no profile is set after DB has loaded
        if (isDbLoaded && (!state.profile || !state.profile.name)) {
            // Delay slightly to ensure app skeleton is visible
            const timer = setTimeout(() => setShowOnboarding(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isDbLoaded, state.profile]);

    const handleCloseChangeLog = () => {
        setIsChangeLogOpen(false);
        localStorage.setItem('app_version', APP_VERSION);
    };

    useLayoutEffect(() => {
        localStorage.setItem('business_manager_last_page', currentPage);
        window.scrollTo(0, 0); 
    }, [currentPage]);

    useEffect(() => {
        const safePushState = (data: any, title: string, url?: string | null) => {
            try {
                window.history.pushState(data, title, url);
            } catch (e) {
                console.debug('History pushState restricted');
            }
        };

        safePushState(null, '', null); 

        let backPressCount = 0;
        let backPressTimer: any;

        const handlePopState = (event: PopStateEvent) => {
            backPressCount++;
            
            if (backPressCount === 1) {
                showToast("Press back again to exit", "info");
                safePushState(null, '', null);
                
                backPressTimer = setTimeout(() => {
                    backPressCount = 0;
                }, 2000);
            } else {
                clearTimeout(backPressTimer);
            }
        };

        window.addEventListener('popstate', handlePopState);
        
        return () => {
            window.removeEventListener('popstate', handlePopState);
            clearTimeout(backPressTimer);
        };
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;

        if (state.theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        
        const hex = state.themeColor.replace(/^#/, '');
        if (/^[0-9A-F]{6}$/i.test(hex)) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            root.style.setProperty('--primary-color', `${r} ${g} ${b}`);
        } else {
            root.style.setProperty('--primary-color', '13 148 136'); 
        }

        if (state.themeGradient) {
            root.style.setProperty('--header-bg', state.themeGradient);
            root.style.setProperty('--theme-gradient', state.themeGradient);
        } else {
            root.style.setProperty('--header-bg', state.themeColor);
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${state.themeColor} 0%, ${state.themeColor} 100%)`);
        }

        if (state.font) {
            root.style.setProperty('--app-font', state.font);
        }

        localStorage.setItem('theme', state.theme);
        localStorage.setItem('themeColor', state.themeColor);
        localStorage.setItem('font', state.font);
        if (state.themeGradient) {
            localStorage.setItem('themeGradient', state.themeGradient);
        } else {
            localStorage.removeItem('themeGradient');
        }

        // --- UI Customizer Class Application ---
        // Clear old classes
        body.classList.remove('font-size-small', 'font-size-normal', 'font-size-large', 'compact');
        
        // Add new classes
        if (state.uiPreferences?.fontSize) {
            body.classList.add(`font-size-${state.uiPreferences.fontSize}`);
        }
        if (state.uiPreferences?.density === 'compact') {
            body.classList.add('compact');
        }

        const updateIcons = () => {
            const bg = state.themeColor;
            const svgString = `
                <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="512" height="512" rx="96" fill="${bg}"/>
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="400" font-family="serif" fill="white" font-weight="bold">ॐ</text>
                </svg>
            `.trim();
            
            const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;
            
            const links = document.querySelectorAll("link[rel*='icon']");
            links.forEach(link => (link as HTMLLinkElement).href = dataUrl);

            const metaTheme = document.querySelector("meta[name='theme-color']");
            if (metaTheme) metaTheme.setAttribute("content", bg);
        };
        updateIcons();

    }, [state.theme, state.themeColor, state.themeGradient, state.font, state.uiPreferences]);

    useEffect(() => {
        logPageView(currentPage);
    }, [currentPage]);

    const handleNavigation = (page: Page) => {
        if (currentPage === 'SALES') {
             const { customerId, items } = state.currentSale;
             const hasActiveSale = !!customerId || items.length > 0;
             
             if (hasActiveSale) {
                 setParkModalState({ isOpen: true, targetPage: page });
                 return;
             }
        }

        if (isDirty && currentPage !== 'SALES') {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                setIsDirty(false);
                setCurrentPage(page);
            }
        } else {
            setCurrentPage(page);
        }
    };
    
    // --- Keyboard Shortcuts ---
    Object.keys(QUICK_ACTION_REGISTRY).forEach(actionId => {
        const shortcut = QUICK_ACTION_SHORTCUTS[actionId];
        const action = QUICK_ACTION_REGISTRY[actionId];
        if (shortcut && action) {
            useHotkeys(shortcut, () => {
                showToast(`Quick Add: New ${action.label}`, 'info');
                if (action.action) {
                    dispatch({ type: 'SET_SELECTION', payload: { page: action.page, id: action.action as any } });
                }
                handleNavigation(action.page);
            }, { alt: true, preventDefault: true });
        }
    });

    const { mainNavItems, pinnedItems, mobileMoreItems } = useMemo(() => {
        const order = state.navOrder || [];
        
        const allDesktopItems = order
            .filter(id => id !== 'SYSTEM_OPTIMIZER')
            .map(id => ({
                page: id, label: LABEL_MAP[id], icon: ICON_MAP[id]
            }));

        const pinnedIds = order.slice(0, 4);
        const menuIds = order.slice(4);

        const pinnedItems = pinnedIds.map(id => ({ page: id, label: LABEL_MAP[id], icon: ICON_MAP[id] }));
        const mobileMoreItems = menuIds.map(id => ({ page: id, label: LABEL_MAP[id], icon: ICON_MAP[id] }));

        return { mainNavItems: allDesktopItems, pinnedItems, mobileMoreItems };
    }, [state.navOrder]);

    const isMoreBtnActive = mobileMoreItems.some(item => item.page === currentPage);

    const handleLockApp = () => {
        setIsLocked(true);
        setIsMenuOpen(false);
    };

    const toggleTheme = () => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        dispatch({ type: 'SET_THEME', payload: newTheme });
    };

    const handleParkAction = (action: 'park' | 'discard' | 'cancel') => {
        if (action === 'cancel') {
            setParkModalState({ isOpen: false, targetPage: null });
            return;
        }
        
        if (action === 'park') {
            dispatch({ type: 'PARK_CURRENT_SALE' });
            showToast("Sale parked successfully.", 'success');
        } else if (action === 'discard') {
            dispatch({ type: 'CLEAR_CURRENT_SALE' });
        }
        
        if (parkModalState.targetPage) {
            setCurrentPage(parkModalState.targetPage);
        }
        setParkModalState({ isOpen: false, targetPage: null });
        setIsDirty(false);
    };

    if (!isDbLoaded) return <DevineLoader />;

    const mainClass = currentPage === 'INVOICE_DESIGNER' 
        ? 'h-[100dvh] overflow-hidden' 
        : `min-h-screen pt-[7rem]`;
    
    let navContainerClass = 'bg-theme';

    if (state.uiPreferences?.navStyle === 'floating') {
        navContainerClass += ' bottom-4 left-4 right-4 rounded-2xl shadow-xl';
    } else {
        navContainerClass += ' bottom-0 left-0 right-0 border-t border-white/20';
    }

    return (
        <div className={`min-h-screen flex flex-col bg-background dark:bg-slate-950 text-text dark:text-slate-200 font-sans transition-colors duration-300 ${state.theme}`}>
            <OnboardingScreen isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
            
            {/* Lazy Load Suspense Wrapper for Modals */}
            <Suspense fallback={null}>
                {isLocked && (
                    <div className="fixed inset-0 z-[1000] bg-background dark:bg-slate-950 flex items-center justify-center">
                        <PinModal 
                            mode="enter" 
                            correctPin={state.pin} 
                            onCorrectPin={() => setIsLocked(false)}
                        />
                    </div>
                )}

                <ChangeLogModal isOpen={isChangeLogOpen} onClose={handleCloseChangeLog} />
                <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
                <MenuPanel 
                    isOpen={isMenuOpen} 
                    onClose={() => setIsMenuOpen(false)} 
                    onProfileClick={() => setIsProfileModalOpen(true)}
                    onNavigate={handleNavigation}
                    onOpenDevTools={() => setIsDevToolsOpen(true)}
                    onOpenChangeLog={() => setIsChangeLogOpen(true)}
                    onOpenSignIn={() => setIsSignInModalOpen(true)}
                    onLockApp={handleLockApp}
                />
                <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={handleNavigation} />
                <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} onNavigate={handleNavigation} />
                <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
                <DeveloperToolsModal isOpen={isDevToolsOpen} onClose={() => setIsDevToolsOpen(false)} onOpenCloudDebug={() => setIsCloudDebugOpen(true)} />
                <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
                <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
                <NavCustomizerModal isOpen={isNavCustomizerOpen} onClose={() => setIsNavCustomizerOpen(false)} />
            </Suspense>

            {/* Park Sale Modal (Eager or Lightweight) */}
            {parkModalState.isOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[2000] p-4 animate-fade-in-fast backdrop-blur-sm">
                    <Card className="w-full max-w-sm animate-scale-in border-l-4 border-amber-500">
                        <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-2">Sale in Progress</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                            You have an unsaved sale. Would you like to park it for later or discard the changes?
                        </p>
                        <div className="flex flex-col gap-2">
                            <Button onClick={() => handleParkAction('park')} className="w-full bg-amber-500 hover:bg-amber-600 text-white">
                                <PauseCircle size={18} className="mr-2" /> Park Sale
                            </Button>
                            <Button onClick={() => handleParkAction('discard')} className="w-full bg-red-500 hover:bg-red-600 text-white">
                                <Trash2 size={18} className="mr-2" /> Discard
                            </Button>
                            <Button onClick={() => handleParkAction('cancel')} variant="secondary" className="w-full">
                                Cancel
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            <Toast />
            
            {/* Header */}
            {currentPage !== 'INVOICE_DESIGNER' && (
                <header className="fixed top-0 left-0 right-0 z-40 bg-theme shadow-lg transition-all duration-300">
                    <div className="h-16 px-3 sm:px-4 flex items-center justify-between text-white relative">
                        <div className="flex items-center gap-1 sm:gap-2 z-20">
                            <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Menu (Ctrl+M)">
                                <Menu size={24} />
                            </button>
                            <button onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Search (Ctrl+K)">
                                <Search size={20} />
                            </button>
                            <button onClick={() => setIsAskAIOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="AI Assistant">
                                <Sparkles size={20} />
                            </button>
                        </div>

                        <div className="absolute left-0 right-0 top-0 bottom-0 flex flex-col justify-center items-center pointer-events-none z-10 px-16">
                            <button 
                                onClick={() => handleNavigation('DASHBOARD')}
                                className="pointer-events-auto flex flex-col items-center justify-center hover:opacity-90 transition-opacity"
                            >
                                <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate max-w-[200px] sm:max-w-[300px] leading-tight drop-shadow-sm">
                                    {state.profile?.name || 'Saree Business Manager'}
                                </h1>
                                <div className="flex items-center gap-1.5 mt-0.5 animate-fade-in-fast">
                                    {state.googleUser ? (
                                        <>
                                            <span className="text-[10px] sm:text-xs font-medium text-white/95 truncate max-w-[150px] drop-shadow-sm">
                                                {state.googleUser.name}
                                            </span>
                                            <div className="relative flex h-2 w-2 shrink-0">
                                              {state.syncStatus === 'syncing' && (
                                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                              )}
                                              <span className={`relative inline-flex rounded-full h-2 w-2 ${state.syncStatus === 'error' ? 'bg-red-500' : 'bg-green-400'} shadow-sm`}></span>
                                            </div>
                                            <span className="text-[9px] sm:text-[10px] font-mono text-white/80 font-medium tracking-wide">
                                                {state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleTimeString('en-US', {hour: 'numeric', minute:'2-digit', hour12: true}) : 'Connected'}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-[10px] sm:text-xs text-white/80">Local Mode</span>
                                    )}
                                </div>
                            </button>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2 z-20">
                            {!state.isOnline && (
                                <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-full border border-red-400/50 mr-1 animate-pulse">
                                    <WifiOff size={14} className="text-white" />
                                    <span className="text-[10px] font-bold text-white">Offline</span>
                                </div>
                            )}

                            <button 
                                onClick={toggleTheme}
                                className="p-2 hover:bg-white/20 rounded-full transition-colors hidden sm:block"
                                title="Toggle Theme"
                            >
                                {state.theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                            </button>

                            <button 
                                onClick={(e) => { 
                                    e.stopPropagation();
                                    if (!state.googleUser) {
                                        setIsSignInModalOpen(true);
                                    } else {
                                        syncData(); 
                                    }
                                }} 
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setIsCloudDebugOpen(true);
                                }}
                                className="relative p-2 hover:bg-white/20 rounded-full transition-colors"
                            >
                                {state.syncStatus === 'syncing' ? (
                                    <RefreshCw size={20} className="animate-spin" />
                                ) : state.syncStatus === 'error' ? (
                                    <CloudOff size={20} className="text-red-300" />
                                ) : (
                                    <Cloud size={20} className={!state.googleUser ? "opacity-70" : ""} />
                                )}
                                {state.googleUser && state.syncStatus !== 'syncing' && (
                                    <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full border-2 border-white/20 ${
                                        state.syncStatus === 'success' ? 'bg-green-400' : 
                                        state.syncStatus === 'error' ? 'bg-red-500' : 
                                        'bg-gray-300'
                                    }`}></span>
                                )}
                            </button>

                            <div className="relative" ref={notificationsRef}>
                                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 hover:bg-white/20 rounded-full transition-colors relative">
                                    <Bell size={20} />
                                    {state.notifications.some(n => !n.read) && (
                                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                                    )}
                                </button>
                                <Suspense fallback={null}>
                                    <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={handleNavigation} />
                                </Suspense>
                            </div>

                            <button onClick={() => setIsHelpOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                                <HelpCircle size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="h-10 bg-white/10 backdrop-blur-md border-t border-white/10 flex items-center justify-between px-4 text-white text-xs sm:text-sm font-medium">
                        <div className="flex-1 text-left opacity-90 truncate pr-2 flex items-center gap-2">
                            {getGreetingIcon()}
                            <span>{getTimeBasedGreeting()}, <span className="font-bold">{state.profile?.ownerName || 'Owner'}</span></span>
                        </div>
                        <div className="flex-1 text-right opacity-90 truncate pl-2 flex items-center justify-end gap-2">
                            {!state.isOnline && <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded sm:hidden">OFFLINE</span>}
                            <CalendarClock className="w-4 h-4 text-white/80" />
                            {currentDateTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} {currentDateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className={`flex-grow w-full ${mainClass}`}>
                <div className={`mx-auto ${currentPage === 'INVOICE_DESIGNER' ? 'h-full' : 'p-4 pb-32 max-w-7xl'}`}>
                    <Suspense fallback={<DevineLoader />}>
                        {currentPage === 'DASHBOARD' && <Dashboard setCurrentPage={handleNavigation} />}
                        {currentPage === 'CUSTOMERS' && <CustomersPage setIsDirty={setIsDirty} setCurrentPage={handleNavigation} />}
                        {currentPage === 'SALES' && <SalesPage setIsDirty={setIsDirty} />}
                        {currentPage === 'PURCHASES' && <PurchasesPage setIsDirty={setIsDirty} setCurrentPage={handleNavigation} />}
                        {currentPage === 'PRODUCTS' && <ProductsPage setIsDirty={setIsDirty} />}
                        {currentPage === 'REPORTS' && <ReportsPage setCurrentPage={handleNavigation} />}
                        {currentPage === 'RETURNS' && <ReturnsPage setIsDirty={setIsDirty} />}
                        {currentPage === 'INSIGHTS' && <InsightsPage setCurrentPage={handleNavigation} />}
                        {currentPage === 'EXPENSES' && <ExpensesPage setIsDirty={setIsDirty} />}
                        {currentPage === 'QUOTATIONS' && <QuotationsPage />}
                        {currentPage === 'INVOICE_DESIGNER' && <InvoiceDesigner setIsDirty={setIsDirty} setCurrentPage={handleNavigation} />}
                        {currentPage === 'SYSTEM_OPTIMIZER' && <SystemOptimizerPage />}
                        {currentPage === 'SQL_ASSISTANT' && <SQLAssistantPage setCurrentPage={handleNavigation} />}
                        {currentPage === 'TRASH' && <TrashPage setCurrentPage={handleNavigation} />}
                    </Suspense>
                </div>
            </main>

            {/* Bottom Navigation */}
            {currentPage !== 'INVOICE_DESIGNER' && (
            <nav className={`fixed pb-[env(safe-area-inset-bottom)] z-50 transition-all duration-300 ${navContainerClass}`}>
                {/* Desktop View */}
                <div className="hidden md:flex w-full overflow-x-auto custom-scrollbar">
                    <div className="flex flex-nowrap mx-auto items-center gap-2 lg:gap-6 p-2 px-6 min-w-max">
                        {mainNavItems.map(item => (
                            <div key={item.page} className="w-16 lg:w-20 flex-shrink-0">
                                <NavItem 
                                    page={item.page} 
                                    label={item.label} 
                                    icon={item.icon} 
                                    onClick={() => handleNavigation(item.page as Page)} 
                                    isActive={currentPage === item.page} 
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mobile View */}
                <div className="flex md:hidden justify-between items-end px-3 pb-2 pt-1 mx-auto w-full max-w-md relative">
                    {pinnedItems.map(item => (
                        <NavItem 
                            key={item.page}
                            page={item.page} 
                            label={item.label} 
                            icon={item.icon} 
                            onClick={() => handleNavigation(item.page as Page)} 
                            isActive={currentPage === item.page && !isMoreMenuOpen && !isMobileQuickAddOpen} 
                        />
                    ))}
                    
                    {/* More Menu */}
                    <div className="relative flex flex-col items-center justify-center w-full" ref={moreMenuRef}>
                        <button
                            onClick={() => { setIsMoreMenuOpen(prev => !prev); setIsMobileQuickAddOpen(false); }}
                            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 group ${
                                isMoreBtnActive || isMoreMenuOpen
                                ? 'text-white transform -translate-y-1' 
                                : 'text-white/70 hover:text-white hover:bg-white/10'
                            }`}
                            >
                            <div className={`p-1 rounded-full transition-all duration-300 ${(isMoreBtnActive || isMoreMenuOpen) ? 'bg-white/20 scale-110' : ''}`}>
                                <Menu className={`w-6 h-6 transition-transform duration-300 ${(isMoreBtnActive || isMoreMenuOpen) ? 'rotate-90' : ''}`} strokeWidth={(isMoreBtnActive || isMoreMenuOpen) ? 2.5 : 2} />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight">More</span>
                        </button>

                        {isMoreMenuOpen && (
                            <div className="absolute bottom-[calc(100%+16px)] right-0 w-52 bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 z-50 animate-scale-in origin-bottom-right overflow-hidden ring-1 ring-black/5">
                                <div className="p-1.5 grid gap-1 max-h-[60vh] overflow-y-auto">
                                    {mobileMoreItems.map(item => (
                                        <button 
                                            key={item.page} 
                                            onClick={() => { handleNavigation(item.page as Page); setIsMoreMenuOpen(false); }} 
                                            className={`w-full flex items-center gap-3 p-2.5 text-left rounded-xl transition-all group ${
                                                currentPage === item.page 
                                                    ? 'bg-primary/10 text-primary font-bold' 
                                                    : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-300'
                                            }`}
                                        >
                                            <item.icon className={`w-5 h-5 transition-transform group-hover:scale-110 ${currentPage === item.page ? 'scale-110' : ''}`} />
                                            <span className="text-sm">{item.label}</span>
                                        </button>
                                    ))}
                                    <div className="my-1 border-t dark:border-slate-700/50"></div>
                                    <button 
                                        onClick={() => { setIsNavCustomizerOpen(true); setIsMoreMenuOpen(false); }} 
                                        className="w-full flex items-center gap-3 p-2.5 text-left rounded-xl transition-all hover:bg-gray-50 dark:hover:bg-slate-700/50 text-indigo-600 dark:text-indigo-400 font-medium"
                                    >
                                        <Layout className="w-5 h-5" />
                                        <span className="text-sm">Customize Menu</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Add */}
                    <div className="relative flex flex-col items-center justify-center w-full" ref={mobileQuickAddRef}>
                        <button 
                            onClick={() => { setIsMobileQuickAddOpen(!isMobileQuickAddOpen); setIsMoreMenuOpen(false); }}
                            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 group ${
                                isMobileQuickAddOpen 
                                ? 'text-white transform -translate-y-1' 
                                : 'text-white/70 hover:text-white hover:bg-white/10'
                            }`}
                            aria-label="Quick Add"
                        >
                            <div className={`p-1 rounded-full transition-all duration-300 ${isMobileQuickAddOpen ? 'bg-white/20 scale-110' : ''}`}>
                                <Plus className={`w-6 h-6 transition-transform duration-300 ${isMobileQuickAddOpen ? 'rotate-45' : 'group-hover:scale-105'}`} strokeWidth={isMobileQuickAddOpen ? 2.5 : 2} />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight">Add</span>
                        </button>
                        {isMobileQuickAddOpen && (
                            <div className="absolute bottom-[calc(100%+16px)] right-0 w-[85vw] max-w-[340px] bg-white/95 dark:bg-slate-800/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-gray-100 dark:border-slate-700 p-5 animate-slide-up-fade origin-bottom-right z-50 ring-1 ring-black/5">
                                <div className="flex justify-between items-center mb-4 px-1">
                                    <div className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">Quick Actions</div>
                                    <button 
                                        onClick={() => { setIsNavCustomizerOpen(true); setIsMobileQuickAddOpen(false); }}
                                        className="text-primary hover:text-primary/80 transition-colors p-2 rounded-full hover:bg-primary/10"
                                        title="Edit Quick Actions"
                                    >
                                        <Edit size={16} />
                                    </button>
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    {state.quickActions.map((actionId, idx) => {
                                        const action = QUICK_ACTION_REGISTRY[actionId];
                                        const shortcut = QUICK_ACTION_SHORTCUTS[actionId];
                                        if (!action) return null;
                                        return (
                                            <button
                                                key={idx}
                                                onClick={() => { 
                                                    if (action.action) {
                                                        dispatch({ type: 'SET_SELECTION', payload: { page: action.page, id: action.action as any } }); 
                                                    }
                                                    handleNavigation(action.page);
                                                    setIsMobileQuickAddOpen(false);
                                                }}
                                                className="flex flex-col items-center justify-center w-full py-3 rounded-2xl transition-all duration-200 bg-gray-50/50 dark:bg-slate-700/30 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-gray-200 dark:hover:border-slate-600 shadow-sm hover:shadow-md active:scale-95 group"
                                            >
                                                <div className="relative p-3 rounded-2xl bg-primary/10 text-primary mb-2 shadow-sm ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-300">
                                                    <action.icon className="w-6 h-6" strokeWidth={2.5} />
                                                    {shortcut && (
                                                        <span className="absolute -top-1 -right-1 bg-slate-500 text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full border-2 border-white dark:border-slate-800/95">
                                                            {shortcut}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200 text-center leading-tight">{action.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            )}
        </div>
    );
};

export const App: React.FC = () => (
    <AppProvider>
        <DialogProvider>
            <AppContent />
        </DialogProvider>
    </AppProvider>
);