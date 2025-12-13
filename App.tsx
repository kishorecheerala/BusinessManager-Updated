import React, { useState, useRef, useEffect, useMemo, useLayoutEffect, Suspense } from 'react';
import {
    Home, Users, ShoppingCart, Package, Menu, Plus, UserPlus, PackagePlus,
    Receipt, Undo2, FileText, BarChart2, Settings, PenTool, Gauge, Search,
    Sparkles, Bell, HelpCircle, Cloud, CloudOff, RefreshCw, Layout, Edit,
    X, Download, Sun, Moon, CalendarClock, WifiOff, Database, PauseCircle, Trash2
} from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';
import { DialogProvider, useDialog } from './context/DialogContext';
import { Page } from './types';
import { ICON_MAP } from './utils/iconMap';

// Components (Eager Load)
import Card from './components/Card';
import Button from './components/Button';
import OnboardingScreen from './components/OnboardingScreen';
import DevineLoader from './components/DevineLoader';
import Toast from './components/Toast';
import AppLayout from './components/AppLayout';

// Hooks
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
const FinancialPlanningPage = React.lazy(() => import('./pages/FinancialPlanningPage'));


import PinLock from './components/PinLock';

import { QUICK_ACTION_REGISTRY, QUICK_ACTION_SHORTCUTS } from './utils/quickActions';

const AppContent: React.FC = () => {
    const { state, dispatch, isDbLoaded, showToast, unlockApp } = useAppContext();
    const { showConfirm } = useDialog();

    // --- Routing State ---
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
        } catch (e) { }
        return 'DASHBOARD';
    });

    // --- UI State ---
    const [isDirty, setIsDirty] = useState(false);
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [parkModalState, setParkModalState] = useState<{ isOpen: boolean, targetPage: Page | null }>({ isOpen: false, targetPage: null });

    // --- Effects ---

    // Action Params Effect
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

    // Selection Effect
    useEffect(() => {
        if (state.selection && state.selection.page) {
            setCurrentPage(state.selection.page);
        }
    }, [state.selection]);

    // Onboarding Effect
    useEffect(() => {
        if (isDbLoaded && (!state.profile || !state.profile.name)) {
            const timer = setTimeout(() => setShowOnboarding(true), 500);
            return () => clearTimeout(timer);
        }
    }, [isDbLoaded, state.profile]);

    // Persistence Effect
    useLayoutEffect(() => {
        localStorage.setItem('business_manager_last_page', currentPage);
        window.scrollTo(0, 0);
    }, [currentPage]);

    // Remove loader ONLY when DB is loaded
    useEffect(() => {
        if (isDbLoaded) {
            const loader = document.getElementById('initial-loader');
            if (loader) {
                loader.style.opacity = '0';
                loader.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    loader.remove();
                }, 500);
            }
        }
    }, [isDbLoaded]);

    // Back Button Handling
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

    // Theme Effect
    useEffect(() => {
        const root = document.documentElement;
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

        // Apply UI Preferences classes
        const body = document.body;
        body.classList.remove('font-size-small', 'font-size-normal', 'font-size-large', 'compact');
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
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" font-size="400" font-family="serif" fill="${bg}" font-weight="bold" dy="20">ॐ</text>
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

    // Analytics Effect
    useEffect(() => {
        logPageView(currentPage);
    }, [currentPage]);

    // Navigation Handler
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
            (async () => {
                if (await showConfirm('You have unsaved changes. Are you sure you want to leave?', { variant: 'danger' })) {
                    setIsDirty(false);
                    setCurrentPage(page);
                }
            })();
        } else {
            setCurrentPage(page);
        }
    };



    // Shortcuts
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

    // App Lock Screen
    // Safety: If locked but no PIN is set (corruption?), auto-unlock.
    // App Lock Screen
    // Only show PinLock if explicitly locked AND a valid PIN exists.
    // If state.isLocked is true but pin is missing (corruption), we safely fall through to AppLayout.
    /* EMERGENCY UNLOCK: Lock Screen Disabled by User Request
    if (state.isLocked && state.pin) {
        return (
            <PinLock
                mode="unlock"
                storedPin={state.pin}
                onSuccess={unlockApp}
            />
        );
    }
    */

    return (
        <AppLayout
            currentPage={currentPage}
            onNavigate={handleNavigation}
        >
            <OnboardingScreen isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
            <Toast />

            {/* Park Sale Modal */}
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
                    {currentPage === 'FINANCIAL_PLANNING' && <FinancialPlanningPage />}
                    {currentPage === 'QUOTATIONS' && <QuotationsPage />}
                    {currentPage === 'INVOICE_DESIGNER' && <InvoiceDesigner setIsDirty={setIsDirty} setCurrentPage={handleNavigation} />}
                    {currentPage === 'SYSTEM_OPTIMIZER' && <SystemOptimizerPage />}
                    {currentPage === 'SQL_ASSISTANT' && <SQLAssistantPage setCurrentPage={handleNavigation} />}
                    {currentPage === 'TRASH' && <TrashPage setCurrentPage={handleNavigation} />}
                </Suspense>
            </div>


        </AppLayout>
    );
};

// Root Component
const App: React.FC = () => (
    <AppProvider>
        <DialogProvider>
            <AppContent />
        </DialogProvider>
    </AppProvider>
);

export default App;