import React, { useState, useRef, useEffect } from 'react';
import { 
  Home, Users, ShoppingCart, Package, Menu, Plus, UserPlus, PackagePlus, 
  Receipt, Undo2, FileText, BarChart2, Settings, PenTool, Gauge, Search, 
  Sparkles, Bell, HelpCircle
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
import FloatingActionButton from './components/FloatingActionButton';
import UniversalSearch from './components/UniversalSearch';
import DeveloperToolsModal from './components/DeveloperToolsModal';
import CloudDebugModal from './components/CloudDebugModal';
import ProfileModal from './components/ProfileModal';
import AppSkeletonLoader from './components/AppSkeletonLoader';
import { useSwipe } from './hooks/useSwipe';
import { useOnClickOutside } from './hooks/useOnClickOutside';

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
    const { state, dispatch, isDbLoaded } = useAppContext();
    const [currentPage, setCurrentPage] = useState<Page>('DASHBOARD');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isAskAIOpen, setIsAskAIOpen] = useState(false);
    const [isHelpOpen, setIsHelpOpen] = useState(false);
    const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
    const [isCloudDebugOpen, setIsCloudDebugOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const [isMobileQuickAddOpen, setIsMobileQuickAddOpen] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    const moreMenuRef = useRef<HTMLDivElement>(null);
    const mobileQuickAddRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);

    useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));
    useOnClickOutside(mobileQuickAddRef, () => setIsMobileQuickAddOpen(false));
    useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));

    // Handle initial selection from context if any
    useEffect(() => {
        if (state.selection && state.selection.page) {
            setCurrentPage(state.selection.page);
        }
    }, [state.selection]);

    // Apply Theme
    useEffect(() => {
        // 1. Dark Mode Class
        if (state.theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        
        const root = document.documentElement;
        
        // 2. Dynamic Primary Color (Convert Hex to RGB for Tailwind opacity)
        // Tailwind config uses: rgb(var(--primary-color) / <alpha-value>)
        const hex = state.themeColor.replace(/^#/, '');
        if (/^[0-9A-F]{6}$/i.test(hex)) {
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            root.style.setProperty('--primary-color', `${r} ${g} ${b}`);
        } else {
            // Fallback default teal if invalid
            root.style.setProperty('--primary-color', '13 148 136'); 
        }

        // 3. Header Background (Gradient or Solid)
        if (state.themeGradient) {
            root.style.setProperty('--header-bg', state.themeGradient);
            root.style.setProperty('--theme-gradient', state.themeGradient);
        } else {
            root.style.setProperty('--header-bg', state.themeColor);
            root.style.setProperty('--theme-gradient', `linear-gradient(135deg, ${state.themeColor} 0%, ${state.themeColor} 100%)`);
        }

        // 4. Persist to LocalStorage (for index.html script to pick up on reload)
        localStorage.setItem('theme', state.theme);
        localStorage.setItem('themeColor', state.themeColor);
        if (state.themeGradient) {
            localStorage.setItem('themeGradient', state.themeGradient);
        } else {
            localStorage.removeItem('themeGradient');
        }

    }, [state.theme, state.themeColor, state.themeGradient]);

    // Handle Unsaved Changes
    const handleNavigation = (page: Page) => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                setIsDirty(false);
                setCurrentPage(page);
            }
        } else {
            setCurrentPage(page);
        }
    };

    // Nav Items Configuration
    const mainNavItems = [
        { page: 'DASHBOARD', label: 'Home', icon: Home },
        { page: 'CUSTOMERS', label: 'Customers', icon: Users },
        { page: 'SALES', label: 'Sales', icon: ShoppingCart },
        { page: 'PURCHASES', label: 'Purchases', icon: Package },
        { page: 'INSIGHTS', label: 'Insights', icon: BarChart2 },
    ];

    const moreNavItems = [
        { page: 'PRODUCTS', label: 'Products', icon: Package }, // Use Package or similar
        { page: 'REPORTS', label: 'Reports', icon: FileText },
        { page: 'EXPENSES', label: 'Expenses', icon: Receipt },
        { page: 'RETURNS', label: 'Returns', icon: Undo2 },
        { page: 'QUOTATIONS', label: 'Estimates', icon: FileText },
        { page: 'INVOICE_DESIGNER', label: 'Designer', icon: PenTool },
        { page: 'SYSTEM_OPTIMIZER', label: 'System', icon: Gauge },
    ];

    const mobileMoreItems = [
        { page: 'PRODUCTS', label: 'Products', icon: Package },
        { page: 'REPORTS', label: 'Reports', icon: FileText },
        { page: 'EXPENSES', label: 'Expenses', icon: Receipt },
        { page: 'QUOTATIONS', label: 'Estimates', icon: FileText },
        { page: 'RETURNS', label: 'Returns', icon: Undo2 },
        { page: 'INSIGHTS', label: 'Insights', icon: BarChart2 },
        { page: 'INVOICE_DESIGNER', label: 'Designer', icon: PenTool },
        { page: 'SYSTEM_OPTIMIZER', label: 'System', icon: Gauge },
    ];

    const isMoreBtnActive = mobileMoreItems.some(item => item.page === currentPage);

    // Swipe handlers for mobile navigation
    useSwipe({
        onSwipeLeft: () => {
            // Find current index in mainNavItems
            const idx = mainNavItems.findIndex(i => i.page === currentPage);
            if (idx >= 0 && idx < mainNavItems.length - 1) {
                handleNavigation(mainNavItems[idx + 1].page as Page);
            }
        },
        onSwipeRight: () => {
            const idx = mainNavItems.findIndex(i => i.page === currentPage);
            if (idx > 0) {
                handleNavigation(mainNavItems[idx - 1].page as Page);
            }
        }
    });

    if (!isDbLoaded) return <AppSkeletonLoader />;

    return (
        <div className={`min-h-screen bg-background dark:bg-slate-950 text-text dark:text-slate-200 font-sans transition-colors duration-300 pb-20 md:pb-0 ${state.theme}`}>
            
            {/* Header - Hidden on Invoice Designer to maximize space */}
            {currentPage !== 'INVOICE_DESIGNER' && (
                <header className="fixed top-0 left-0 right-0 h-16 bg-theme text-white shadow-lg z-40 px-4 flex items-center justify-between transition-all duration-300">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsMenuOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <Menu size={24} />
                        </button>
                        <h1 className="text-xl font-bold tracking-tight truncate max-w-[200px]">
                            {state.profile?.name || 'Business Manager'}
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSearchOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <Search size={20} />
                        </button>
                        <div className="relative" ref={notificationsRef}>
                            <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 hover:bg-white/20 rounded-full transition-colors relative">
                                <Bell size={20} />
                                {state.notifications.some(n => !n.read) && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                                )}
                            </button>
                            <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={handleNavigation} />
                        </div>
                        <button onClick={() => setIsAskAIOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors hidden sm:block">
                            <Sparkles size={20} />
                        </button>
                        <button onClick={() => setIsHelpOpen(true)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                            <HelpCircle size={20} />
                        </button>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className={`flex-grow h-screen overflow-y-auto custom-scrollbar ${currentPage !== 'INVOICE_DESIGNER' ? 'pt-16' : ''}`}>
                <div className={`mx-auto ${currentPage === 'INVOICE_DESIGNER' ? 'h-full' : 'p-4 max-w-7xl'}`}>
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
                </div>
            </main>

            {/* Modals & Overlays */}
            <MenuPanel 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                onProfileClick={() => setIsProfileModalOpen(true)}
                onNavigate={handleNavigation}
                onOpenDevTools={() => setIsDevToolsOpen(true)}
            />
            <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={handleNavigation} />
            <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} />
            <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
            <DeveloperToolsModal isOpen={isDevToolsOpen} onClose={() => setIsDevToolsOpen(false)} onOpenCloudDebug={() => setIsCloudDebugOpen(true)} />
            <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
            <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
            
            {/* Floating Action Button (Mobile) - Hidden if Invoice Designer */}
            {currentPage !== 'INVOICE_DESIGNER' && <FloatingActionButton onNavigate={handleNavigation} />}

            {/* Bottom Navigation */}
            {currentPage !== 'INVOICE_DESIGNER' && (
            <nav className="fixed bottom-0 left-0 right-0 glass pb-[env(safe-area-inset-bottom)] z-50 border-t border-gray-200/50 dark:border-slate-700/50">
                {/* Desktop View - Scrollable */}
                <div className="hidden md:flex w-full overflow-x-auto custom-scrollbar">
                    <div className="flex flex-nowrap mx-auto items-center gap-2 lg:gap-6 p-2 px-6 min-w-max">
                        {[...mainNavItems, ...moreNavItems].map(item => (
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

                {/* Mobile View - Custom Layout with Reordered Items and End FAB */}
                <div className="flex md:hidden justify-between items-end px-1 pt-2 pb-2 mx-auto w-full max-w-md">
                    <NavItem page={'DASHBOARD'} label={'Home'} icon={Home} onClick={() => handleNavigation('DASHBOARD')} isActive={currentPage === 'DASHBOARD' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
                    <NavItem page={'CUSTOMERS'} label={'Customers'} icon={Users} onClick={() => handleNavigation('CUSTOMERS')} isActive={currentPage === 'CUSTOMERS' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
                    <NavItem page={'SALES'} label={'Sales'} icon={ShoppingCart} onClick={() => handleNavigation('SALES')} isActive={currentPage === 'SALES' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
                    <NavItem page={'PURCHASES'} label={'Purchases'} icon={Package} onClick={() => handleNavigation('PURCHASES')} isActive={currentPage === 'PURCHASES' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
                    
                    {/* More Menu */}
                    <div className="relative flex flex-col items-center justify-center w-full" ref={moreMenuRef}>
                        <button
                            onClick={() => { setIsMoreMenuOpen(prev => !prev); setIsMobileQuickAddOpen(false); }}
                            className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 group ${
                                isMoreBtnActive 
                                ? 'text-primary transform -translate-y-1' 
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                            >
                            <div className={`p-1 rounded-full transition-all duration-300 ${isMoreBtnActive ? 'bg-primary/10 scale-110' : ''}`}>
                                <Menu className={`w-6 h-6 transition-transform duration-300 ${isMoreBtnActive ? 'rotate-90' : ''}`} strokeWidth={isMoreBtnActive ? 2.5 : 2} />
                            </div>
                            <span className="text-[9px] sm:text-[10px] font-semibold mt-1 leading-tight">More</span>
                        </button>

                        {isMoreMenuOpen && (
                            <div className="absolute bottom-[calc(100%+16px)] right-0 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 z-50 animate-scale-in origin-bottom-right overflow-hidden ring-1 ring-black/5">
                                <div className="p-1.5 grid gap-1">
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
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Quick Add at the end */}
                    <div className="relative flex flex-col items-center justify-center w-full" ref={mobileQuickAddRef}>
                        <button 
                            onClick={() => { setIsMobileQuickAddOpen(!isMobileQuickAddOpen); setIsMoreMenuOpen(false); }}
                            className="flex flex-col items-center justify-center w-full pt-2 pb-2 group"
                        >
                            <div className={`w-10 h-10 rounded-full bg-theme text-white shadow-lg shadow-primary/25 flex items-center justify-center transition-all duration-300 ${isMobileQuickAddOpen ? 'rotate-45 scale-110' : 'group-active:scale-95'}`}>
                                <Plus size={22} strokeWidth={3} />
                            </div>
                            <span className={`text-[9px] sm:text-[10px] font-bold mt-1 leading-tight ${isMobileQuickAddOpen ? 'text-primary' : 'text-gray-500 dark:text-gray-400'}`}>Quick Add</span>
                        </button>
                        {isMobileQuickAddOpen && (
                            <div className="absolute bottom-[calc(100%+4px)] right-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-2 animate-scale-in origin-bottom-right z-50 ring-1 ring-black/5">
                                {[
                                    { icon: UserPlus, label: 'Add Customer', page: 'CUSTOMERS' as Page, action: 'new' },
                                    { icon: ShoppingCart, label: 'New Sale', page: 'SALES' as Page },
                                    { icon: PackagePlus, label: 'New Purchase', page: 'PURCHASES' as Page, action: 'new' },
                                    { icon: Receipt, label: 'Add Expense', page: 'EXPENSES' as Page },
                                    { icon: Undo2, label: 'New Return', page: 'RETURNS' as Page },
                                ].map((action, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => { 
                                            dispatch({ type: 'SET_SELECTION', payload: { page: action.page, id: action.action || 'new' } }); 
                                            handleNavigation(action.page);
                                            setIsMobileQuickAddOpen(false);
                                        }}
                                        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 rounded-xl transition-colors text-left group/item"
                                    >
                                        <div className="p-2 bg-gray-100 dark:bg-slate-700 group-hover/item:bg-white dark:group-hover/item:bg-slate-600 rounded-lg text-primary shadow-sm transition-transform group-hover/item:scale-110">
                                            <action.icon size={18} />
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{action.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            )}
        </div>
    );
};

const App: React.FC = () => {
    return (
        <AppProvider>
            <DialogProvider>
                <AppContent />
            </DialogProvider>
        </AppProvider>
    );
};

export default App;