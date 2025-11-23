
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Users, ShoppingCart, Package, FileText, Undo2, Boxes, Search, HelpCircle, Bell, Menu, Plus, UserPlus, PackagePlus, Download, X, Sun, Moon, Cloud, CloudOff, RefreshCw, Sparkles, BarChart2 } from 'lucide-react';

import { AppProvider, useAppContext } from './context/AppContext';
import { DialogProvider } from './context/DialogContext';
import Dashboard from './pages/Dashboard';
import CustomersPage from './pages/CustomersPage';
import SalesPage from './pages/SalesPage';
import PurchasesPage from './pages/PurchasesPage';
import ReportsPage from './pages/ReportsPage';
import ReturnsPage from './pages/ReturnsPage';
import ProductsPage from './pages/ProductsPage';
import InsightsPage from './pages/InsightsPage';
import UniversalSearch from './components/UniversalSearch';
import HelpModal from './components/HelpModal';
import AppSkeletonLoader from './components/AppSkeletonLoader';
import NotificationsPanel from './components/NotificationsPanel';
import MenuPanel from './components/MenuPanel';
import ProfileModal from './components/ProfileModal';
import AskAIModal from './components/AskAIModal';
import { BeforeInstallPromptEvent, Page, SyncStatus } from './types';
import { useOnClickOutside } from './hooks/useOnClickOutside';
import { useSwipe } from './hooks/useSwipe';
import ConfirmationModal from './components/ConfirmationModal';

const Toast = () => {
    const { state } = useAppContext();
    if (!state.toast.show) return null;
    const isSuccess = state.toast.type === 'success';
    const containerClasses = "fixed top-5 inset-x-0 flex justify-center z-[200]";
    const toastClasses = isSuccess
        ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white px-6 py-3 rounded-full shadow-xl animate-fade-in-up font-medium flex items-center gap-2"
        : "bg-slate-800 text-white px-6 py-3 rounded-full shadow-xl animate-fade-in-up font-medium flex items-center gap-2";

    return (
        <div className={containerClasses} style={{ pointerEvents: 'none' }}>
            <div className={toastClasses} style={{ pointerEvents: 'auto' }}>
                {state.toast.message}
            </div>
        </div>
    );
};

const NavItem: React.FC<{
  page: Page;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  isActive: boolean;
}> = ({ page, label, icon: Icon, onClick, isActive }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full pt-3 pb-2 px-1 rounded-2xl transition-all duration-300 ${
        isActive 
          ? 'text-teal-600 dark:text-teal-400 transform -translate-y-1' 
          : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
      }`}
    >
      <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-teal-50 dark:bg-teal-900/30' : ''}`}>
        <Icon className={`w-6 h-6 ${isActive ? 'fill-teal-600/20 dark:fill-teal-400/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
      </div>
      <span className={`text-[10px] font-semibold mt-1 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
    </button>
);

const QuickAddMenu: React.FC<{
  isOpen: boolean;
  onNavigate: (page: Page, action?: 'new') => void;
}> = ({ isOpen, onNavigate }) => {
    if (!isOpen) return null;

    const actions = [
        { icon: UserPlus, label: 'Add Customer', page: 'CUSTOMERS' as Page, action: 'new' as const, color: 'text-blue-500' },
        { icon: ShoppingCart, label: 'New Sale', page: 'SALES' as Page, color: 'text-emerald-500' },
        { icon: PackagePlus, label: 'New Purchase', page: 'PURCHASES' as Page, action: 'new' as const, color: 'text-amber-500' },
        { icon: Undo2, label: 'New Return', page: 'RETURNS' as Page, color: 'text-rose-500' },
    ];

    return (
        <div 
          className="absolute top-full right-0 mt-3 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 animate-scale-in origin-top-right z-40 overflow-hidden ring-1 ring-black/5"
        >
            <div className="p-2">
                {actions.map(action => (
                    <button
                        key={action.page}
                        onClick={() => onNavigate(action.page, action.action)}
                        className="w-full flex items-center gap-3 text-left p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-all duration-200 group"
                    >
                        <div className={`p-2 rounded-lg bg-gray-50 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-600 shadow-sm ${action.color}`}>
                            <action.icon className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const SyncIndicator: React.FC<{ status: SyncStatus, user: any }> = ({ status, user }) => {
    if (!user) return <CloudOff className="w-5 h-5 text-teal-200 opacity-60" />;
    
    if (status === 'syncing') return <RefreshCw className="w-5 h-5 text-white animate-spin" />;
    if (status === 'error') return <CloudOff className="w-5 h-5 text-red-300" />;
    
    return <Cloud className="w-5 h-5 text-white" />;
};

const MainApp: React.FC = () => {
  const [currentPage, _setCurrentPage] = useState<Page>(
    () => (sessionStorage.getItem('currentPage') as Page) || 'DASHBOARD'
  );
  const isDirtyRef = useRef(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [navConfirm, setNavConfirm] = useState<{ show: boolean, page: Page | null }>({ show: false, page: null });

  const { state, dispatch, isDbLoaded } = useAppContext();
  const { installPromptEvent, theme } = state;
  const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setIsMenuOpen(false));
  useOnClickOutside(quickAddRef, () => setIsQuickAddOpen(false));
  useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));
  useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Always set theme-color to light color as requested, regardless of dark mode
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f8fafc');
    
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', payload: newTheme });
  };

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: null });
  };

  useEffect(() => { sessionStorage.setItem('currentPage', currentPage); }, [currentPage]);

  const setIsDirty = (dirty: boolean) => { isDirtyRef.current = dirty; };
  
  const setCurrentPage = (page: Page) => {
    if (page === currentPage) return;
    if (isDirtyRef.current) {
      setNavConfirm({ show: true, page });
    } else {
      _setCurrentPage(page);
    }
  };

  const renderPage = () => {
    const commonProps = { setIsDirty };
    switch (currentPage) {
      case 'DASHBOARD': return <Dashboard setCurrentPage={_setCurrentPage} />;
      case 'CUSTOMERS': return <CustomersPage {...commonProps} setCurrentPage={_setCurrentPage} />;
      case 'SALES': return <SalesPage {...commonProps} />;
      case 'PURCHASES': return <PurchasesPage {...commonProps} setCurrentPage={_setCurrentPage} />;
      case 'REPORTS': return <ReportsPage setCurrentPage={_setCurrentPage} />;
      case 'RETURNS': return <ReturnsPage {...commonProps} />;
      case 'PRODUCTS': return <ProductsPage {...commonProps} />;
      case 'INSIGHTS': return <InsightsPage setCurrentPage={_setCurrentPage} />;
      default: return <Dashboard setCurrentPage={_setCurrentPage} />;
    }
  };
  
  const mainNavItems = [
    { page: 'DASHBOARD' as Page, label: 'Home', icon: Home },
    { page: 'CUSTOMERS' as Page, label: 'Customers', icon: Users },
    { page: 'SALES' as Page, label: 'Sales', icon: ShoppingCart },
    { page: 'PURCHASES' as Page, label: 'Purchases', icon: Package },
  ];

  const moreNavItems = [
      { page: 'PRODUCTS' as Page, label: 'Products', icon: Boxes },
      { page: 'RETURNS' as Page, label: 'Returns', icon: Undo2 },
      { page: 'REPORTS' as Page, label: 'Reports', icon: FileText },
      { page: 'INSIGHTS' as Page, label: 'Insights', icon: BarChart2 },
  ];

  return (
    <div className="flex flex-col h-screen font-sans text-slate-800 dark:text-slate-200 bg-transparent">
      <Toast />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} />
      <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={(p, id) => { dispatch({ type: 'SET_SELECTION', payload: { page: p, id } }); _setCurrentPage(p); setIsSearchOpen(false); }} />
      <ConfirmationModal isOpen={navConfirm.show} onClose={() => setNavConfirm({ show: false, page: null })} onConfirm={() => { if (navConfirm.page) { setIsDirty(false); _setCurrentPage(navConfirm.page); } setNavConfirm({ show: false, page: null }); }} title="Unsaved Changes">You have unsaved changes. Leave anyway?</ConfirmationModal>
      
      <header className="bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg p-3 px-4 flex items-center justify-between relative z-30 sticky top-0">
          <div className="flex items-center gap-1">
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
                  <Menu className="w-6 h-6" />
              </button>
              <MenuPanel isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} onProfileClick={() => { setIsMenuOpen(false); setIsProfileOpen(true); }} onNavigate={(page) => { setIsMenuOpen(false); setCurrentPage(page); }} />
            </div>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
              <Search className="w-6 h-6" />
            </button>
          </div>
          
          <button onClick={() => setCurrentPage('DASHBOARD')} className="flex flex-col items-center justify-center min-w-0 mx-2">
            <h1 className="text-lg font-bold text-center truncate w-32 sm:w-auto leading-tight drop-shadow-md">{state.profile?.name || 'Business Manager'}</h1>
            {state.googleUser && <span className='text-[10px] font-medium bg-white/20 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm'><div className='w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(74,222,128,0.8)]'></div>{state.googleUser.name.split(' ')[0]}</span>}
          </button>

          <div className="flex items-center gap-1">
             <button onClick={() => setIsAskAIOpen(true)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95 group relative">
                <Sparkles className="w-6 h-6 text-yellow-300 fill-yellow-300/20 animate-pulse" />
             </button>
             <div className='flex items-center justify-center w-8 h-8'>
                <SyncIndicator status={state.syncStatus} user={state.googleUser} />
             </div>
             <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
                {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
             <div className="relative" ref={quickAddRef}>
                <button onClick={() => setIsQuickAddOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95 bg-white/10 shadow-sm border border-white/10">
                    <Plus className="w-6 h-6" strokeWidth={3} />
                </button>
                <QuickAddMenu isOpen={isQuickAddOpen} onNavigate={(page, action) => { dispatch({ type: 'SET_SELECTION', payload: { page, id: 'new' } }); _setCurrentPage(page); setIsQuickAddOpen(false); }} />
            </div>
            <div className="relative" ref={notificationsRef}>
                 <button onClick={() => setIsNotificationsOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
                    <Bell className="w-6 h-6" />
                    {state.notifications.some(n => !n.read) && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-white"></span>}
                </button>
                 <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={(page) => { _setCurrentPage(page); setIsNotificationsOpen(false); }} />
            </div>
          </div>
      </header>

      {installPromptEvent && isInstallBannerVisible && (
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 text-white p-3 flex items-center justify-between gap-4 animate-fade-in-up shadow-lg mx-4 mt-4 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><Download className="w-5 h-5" /></div>
                <p className="font-bold text-sm">Install App for Offline Access</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleInstallClick} className="bg-white text-teal-600 font-bold py-1.5 px-4 rounded-lg text-xs shadow-md hover:bg-gray-50 transition-colors">Install</button>
                <button onClick={() => setIsInstallBannerVisible(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
            </div>
        </div>
      )}

      <main className="flex-grow overflow-y-auto p-4 pb-24" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div key={currentPage} className="animate-fade-in-up max-w-6xl mx-auto w-full">
          {renderPage()}
        </div>
      </main>

      {/* Glassmorphism Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 glass pb-[env(safe-area-inset-bottom)] z-50 border-t border-gray-200/50 dark:border-slate-700/50">
        <div className="hidden md:flex justify-center gap-8 p-2">
            {[...mainNavItems, ...moreNavItems].map(item => <NavItem key={item.page} page={item.page} label={item.label} icon={item.icon} onClick={() => setCurrentPage(item.page)} isActive={currentPage === item.page} />)}
        </div>

        <div className="flex md:hidden justify-between items-end px-4 pt-2 pb-2 max-w-md mx-auto">
            {mainNavItems.map(item => <NavItem key={item.page} page={item.page} label={item.label} icon={item.icon} onClick={() => setCurrentPage(item.page)} isActive={currentPage === item.page} />)}
            <div className="relative flex flex-col items-center justify-center w-full" ref={moreMenuRef}>
                 <button
                    onClick={() => setIsMoreMenuOpen(prev => !prev)}
                    className={`flex flex-col items-center justify-center w-full pt-3 pb-2 rounded-2xl transition-all duration-300 ${
                        moreNavItems.some(i => i.page === currentPage) || isMoreMenuOpen 
                        ? 'text-teal-600 dark:text-teal-400 transform -translate-y-1' 
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                    >
                    <div className={`p-1 rounded-full ${moreNavItems.some(i => i.page === currentPage) ? 'bg-teal-50 dark:bg-teal-900/30' : ''}`}>
                         <Menu className="w-6 h-6" strokeWidth={moreNavItems.some(i => i.page === currentPage) ? 2.5 : 2} />
                    </div>
                    <span className="text-[10px] font-semibold mt-1">More</span>
                </button>

                {isMoreMenuOpen && (
                    <div className="absolute bottom-[calc(100%+16px)] right-0 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 z-50 animate-scale-in origin-bottom-right overflow-hidden ring-1 ring-black/5">
                        <div className="p-1.5 grid gap-1">
                            {moreNavItems.map(item => (
                                <button 
                                    key={item.page} 
                                    onClick={() => { setCurrentPage(item.page); setIsMoreMenuOpen(false); }} 
                                    className={`w-full flex items-center gap-3 p-2.5 text-left rounded-xl transition-colors ${
                                        currentPage === item.page 
                                            ? 'bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 font-bold' 
                                            : 'hover:bg-gray-50 dark:hover:bg-slate-700/50 text-gray-600 dark:text-gray-300'
                                    }`}
                                >
                                    <item.icon className="w-5 h-5" />
                                    <span className="text-sm">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </nav>
    </div>
  );
};

const AppContent: React.FC = () => {
    const { isDbLoaded } = useAppContext();
    if (!isDbLoaded) return <AppSkeletonLoader />;
    return <MainApp />;
};

const App: React.FC = () => (
    <AppProvider>
        <DialogProvider>
            <AppContent />
        </DialogProvider>
    </AppProvider>
);

export default App;