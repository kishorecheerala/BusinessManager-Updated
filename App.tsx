
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Home, Users, ShoppingCart, Package, FileText, Undo2, Boxes, Search, HelpCircle, Bell, Menu, Plus, UserPlus, PackagePlus, Download, X, Sun, Moon, Cloud, CloudOff, RefreshCw, Sparkles } from 'lucide-react';

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
import { BeforeInstallPromptEvent, Notification, Page, AppMetadataBackup, Theme, SyncStatus } from './types';
import { useOnClickOutside } from './hooks/useOnClickOutside';
import { useSwipe } from './hooks/useSwipe';
import ConfirmationModal from './components/ConfirmationModal';

const Toast = () => {
    const { state } = useAppContext();

    if (!state.toast.show) return null;

    const isSuccess = state.toast.type === 'success';

    const containerClasses = "fixed top-5 inset-x-0 flex justify-center z-[60]";

    const toastClasses = isSuccess
        ? "bg-green-600 text-white px-4 py-2 rounded-full shadow-lg animate-fade-in-out"
        : "bg-gray-800 bg-opacity-90 text-white px-5 py-3 rounded-full shadow-lg animate-fade-in-out";

    return (
        <div className={containerClasses} style={{ pointerEvents: 'none' }}>
            <div className={toastClasses} style={{ pointerEvents: 'auto' }}>
                {state.toast.message}
            </div>
        </div>
    );
};

// Define NavItem outside the MainApp component to prevent re-creation on every render.
const NavItem: React.FC<{
  page: Page;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  isActive: boolean;
}> = ({ page, label, icon: Icon, onClick, isActive }) => (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-xs transition-colors duration-200 ${
        isActive ? 'text-white scale-[1.02]' : 'text-teal-100 hover:text-white'
      }`}
    >
      <Icon className="w-6 h-6 mb-1" />
      <span>{label}</span>
    </button>
);

const QuickAddMenu: React.FC<{
  isOpen: boolean;
  onNavigate: (page: Page, action?: 'new') => void;
}> = ({ isOpen, onNavigate }) => {
    if (!isOpen) return null;

    const actions = [
        { icon: UserPlus, label: 'Add Customer', page: 'CUSTOMERS' as Page, action: 'new' as const },
        { icon: ShoppingCart, label: 'New Sale', page: 'SALES' as Page },
        { icon: PackagePlus, label: 'New Purchase', page: 'PURCHASES' as Page, action: 'new' as const },
        { icon: Undo2, label: 'New Return', page: 'RETURNS' as Page },
    ];

    return (
        <div 
          className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 text-text dark:text-slate-200 animate-scale-in origin-top-right z-40"
          role="dialog"
          aria-label="Quick Add Menu"
        >
            <div className="p-2">
                {actions.map(action => (
                    <button
                        key={action.page}
                        onClick={() => onNavigate(action.page, action.action)}
                        className="w-full flex items-center gap-3 text-left p-3 rounded-md hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                    >
                        <action.icon className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-sm">{action.label}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

const SyncIndicator: React.FC<{ status: SyncStatus, user: any }> = ({ status, user }) => {
    if (!user) return <CloudOff className="w-5 h-5 text-teal-200 opacity-50" />;
    
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
  const [navConfirm, setNavConfirm] = useState<{ show: boolean, page: Page | null }>({ show: false, page: null });

  const { state, dispatch, isDbLoaded } = useAppContext();
  const { installPromptEvent, theme } = state;
  const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(true);

  const canExitApp = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setIsMenuOpen(false));
  useOnClickOutside(quickAddRef, () => setIsQuickAddOpen(false));
  useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));
  useOnClickOutside(moreMenuRef, () => setIsMoreMenuOpen(false));

  // FIX: Cast the result of find to AppMetadataBackup to satisfy TypeScript, as it cannot infer the discriminated union type from the predicate.
  const lastBackupDate = (state.app_metadata.find(m => m.id === 'lastBackup') as AppMetadataBackup | undefined)?.date;

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.style.backgroundColor = '#0f172a'; // slate-900
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f172a');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.backgroundColor = '#f8fafc'; // slate-50
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0d9488');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);
  
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', payload: newTheme });
  };

  useEffect(() => {
    if (state.profile?.name) {
      document.title = `${state.profile.name} - Manager`;
    } else {
      document.title = 'Business Manager';
    }
  }, [state.profile?.name]);

  const handleInstallClick = async () => {
    if (!installPromptEvent) {
      return;
    }
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    dispatch({ type: 'SET_INSTALL_PROMPT_EVENT', payload: null });
  };

  const handleDismissInstallBanner = () => {
    setIsInstallBannerVisible(false);
  };

  useEffect(() => {
    sessionStorage.setItem('currentPage', currentPage);
  }, [currentPage]);

  const setIsDirty = (dirty: boolean) => {
    isDirtyRef.current = dirty;
  };
  
  // Check for backup reminder on load
  useEffect(() => {
      if (isDbLoaded && state.profile) {
          const lastBackup = state.app_metadata.find(m => m.id === 'lastBackup') as AppMetadataBackup | undefined;
          const now = new Date();
          const sevenDays = 7 * 24 * 60 * 60 * 1000;
          
          if (!lastBackup || (now.getTime() - new Date(lastBackup.date).getTime() > sevenDays)) {
               const id = `backup-reminder-${now.toDateString()}`;
               // Check if we already notified today to avoid spam
               if (!state.notifications.some(n => n.id === id)) {
                   dispatch({
                       type: 'ADD_NOTIFICATION',
                       payload: {
                           id,
                           title: 'Backup Reminder',
                           message: lastBackup ? 'It has been over a week since your last backup. Please backup your data.' : 'Welcome! Please create your first backup to keep your data safe.',
                           read: false,
                           createdAt: now.toISOString(),
                           type: 'backup',
                           actionLink: 'DASHBOARD'
                       }
                   });
               }
          }
      }
  }, [isDbLoaded, state.app_metadata, dispatch, state.profile]);

  // Handle Browser Back Button and Search Modal
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (isSearchOpen) {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isSearchOpen]);

  const openSearch = () => {
    window.history.pushState({ modal: 'search' }, '');
    setIsSearchOpen(true);
  };

  const closeSearch = () => {
    // Robust Close: If history state is correct, go back (popping the state)
    // Otherwise force state update. This fixes "Cancel not working" issues.
    if (window.history.state?.modal === 'search') {
        window.history.back();
    } else {
        setIsSearchOpen(false);
    }
  };

  const setCurrentPage = (page: Page) => {
    if (page === currentPage) {
        return;
    }

    if (isDirtyRef.current) {
      setNavConfirm({ show: true, page });
    } else {
      _setCurrentPage(page);
    }
  };

  const handleSearchResultClick = (page: Page, id: string) => {
    dispatch({ type: 'SET_SELECTION', payload: { page, id } });
    _setCurrentPage(page);
    closeSearch();
  };
  
  const handleNotificationClick = (page: Page) => {
    _setCurrentPage(page);
    setIsNotificationsOpen(false);
  }

  const handleQuickActionNavigate = (page: Page, action?: 'new') => {
    if (action === 'new') {
        dispatch({ type: 'SET_SELECTION', payload: { page, id: 'new' } });
    }
    _setCurrentPage(page);
  };

  // Protect against accidental tab close with unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isDirtyRef.current) {
            e.preventDefault();
            e.returnValue = '';
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);


  const renderPage = () => {
    const commonProps = { setIsDirty };
    switch (currentPage) {
      case 'DASHBOARD':
        return <Dashboard setCurrentPage={_setCurrentPage} />;
      case 'CUSTOMERS':
        return <CustomersPage {...commonProps} setCurrentPage={_setCurrentPage} />;
      case 'SALES':
        return <SalesPage {...commonProps} />;
      case 'PURCHASES':
        return <PurchasesPage {...commonProps} setCurrentPage={_setCurrentPage} />;
      case 'REPORTS':
        return <ReportsPage setCurrentPage={_setCurrentPage} />;
      case 'RETURNS':
        return <ReturnsPage {...commonProps} />;
      case 'PRODUCTS':
        return <ProductsPage {...commonProps} />;
      case 'INSIGHTS':
        return <InsightsPage setCurrentPage={_setCurrentPage} />;
      default:
        return <Dashboard setCurrentPage={_setCurrentPage} />;
    }
  };
  
  const hasUnreadNotifications = state.notifications.some(n => !n.read);

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
  ];

  const allNavItems = [...mainNavItems, ...moreNavItems];
  const isMoreMenuActive = moreNavItems.some(item => item.page === currentPage);

  const navItemsOrder = useMemo(() => allNavItems.map(item => item.page), [allNavItems]);

  const handleSwipe = (direction: 'next' | 'prev') => {
      const currentIndex = navItemsOrder.indexOf(currentPage);
      if (currentIndex === -1) return; 

      let nextIndex;
      if (direction === 'next') { 
          nextIndex = (currentIndex + 1) % navItemsOrder.length;
      } else { 
          nextIndex = (currentIndex - 1 + navItemsOrder.length) % navItemsOrder.length;
      }
      
      setCurrentPage(navItemsOrder[nextIndex]);
  };

  const swipeHandlers = useSwipe({
      onSwipeLeft: () => handleSwipe('next'),
      onSwipeRight: () => handleSwipe('prev'),
  });


  return (
    <div className="flex flex-col h-screen font-sans text-text bg-background dark:bg-slate-900 dark:text-slate-300">
      <Toast />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <UniversalSearch 
        isOpen={isSearchOpen} 
        onClose={closeSearch} 
        onNavigate={handleSearchResultClick} 
      />
      <ConfirmationModal
          isOpen={navConfirm.show}
          onClose={() => setNavConfirm({ show: false, page: null })}
          onConfirm={() => {
              if (navConfirm.page) {
                  setIsDirty(false); 
                  _setCurrentPage(navConfirm.page);
              }
              setNavConfirm({ show: false, page: null });
          }}
          title="Unsaved Changes"
          confirmText="Leave Page"
          cancelText="Stay"
          confirmVariant="danger"
      >
          You have unsaved changes that will be lost. Are you sure you want to leave this page?
      </ConfirmationModal>
      <header className="bg-primary text-white shadow-md p-4 flex items-center justify-between relative z-30">
          <div className="flex items-center gap-2">
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Open menu">
                  <Menu className="w-6 h-6" />
              </button>
              <MenuPanel 
                  isOpen={isMenuOpen}
                  onClose={() => setIsMenuOpen(false)}
                  onProfileClick={() => {
                      setIsMenuOpen(false);
                      setIsProfileOpen(true);
                  }}
                  onNavigate={(page) => {
                      setIsMenuOpen(false);
                      setCurrentPage(page);
                  }}
              />
            </div>
            <button onClick={openSearch} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Open search">
              <Search className="w-6 h-6" />
            </button>
          </div>
          <button onClick={() => setCurrentPage('DASHBOARD')} className="flex-grow min-w-0 px-2 py-1 rounded-md hover:bg-white/10 transition-colors flex flex-col items-center justify-center">
            <h1 className="text-xl font-bold text-center truncate w-full">{state.profile?.name || 'Business Manager'}</h1>
            {state.googleUser && <span className='text-[10px] opacity-80 flex items-center gap-1'><div className='w-1.5 h-1.5 rounded-full bg-green-400'></div>{state.googleUser.name}</span>}
          </button>
          <div className="flex items-center gap-2">
             <div className='flex items-center justify-center w-8 h-8'>
                <SyncIndicator status={state.syncStatus} user={state.googleUser} />
             </div>
             <button onClick={toggleTheme} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
            </button>
             <div className="relative" ref={quickAddRef}>
                <button onClick={() => setIsQuickAddOpen(prev => !prev)} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Open quick add menu">
                    <Plus className="w-6 h-6" />
                </button>
                <QuickAddMenu
                    isOpen={isQuickAddOpen}
                    onNavigate={(page, action) => {
                        handleQuickActionNavigate(page, action);
                        setIsQuickAddOpen(false);
                    }}
                />
            </div>
            <div className="relative" ref={notificationsRef}>
                 <button onClick={() => setIsNotificationsOpen(prev => !prev)} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Open notifications">
                    <Bell className="w-6 h-6" />
                </button>
                {hasUnreadNotifications && (
                    <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-primary ring-white"></span>
                )}
                 <NotificationsPanel 
                    isOpen={isNotificationsOpen} 
                    onClose={() => setIsNotificationsOpen(false)}
                    onNavigate={handleNotificationClick}
                 />
            </div>
          </div>
      </header>

      {installPromptEvent && isInstallBannerVisible && (
        <div className="bg-secondary text-white p-3 flex items-center justify-between gap-4 animate-slide-down-fade shadow-md">
            <div className="flex items-center gap-3">
                <Download className="w-6 h-6 flex-shrink-0" />
                <p className="font-semibold text-sm">Install the app for easy offline access!</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <button 
                    onClick={handleInstallClick} 
                    className="bg-white text-primary font-bold py-1 px-3 rounded-md text-sm hover:bg-gray-100 transition-colors dark:bg-slate-200 dark:text-primary"
                >
                    Install
                </button>
                <button onClick={handleDismissInstallBanner} className="p-1 rounded-full hover:bg-white/20 transition-colors" aria-label="Dismiss install prompt">
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
      )}

      <main {...swipeHandlers} className="flex-grow overflow-y-auto p-4 pb-20" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div key={currentPage} className="animate-slide-up-fade">
          {renderPage()}
        </div>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-primary shadow-lg z-30">
        {/* Desktop nav */}
        <div className="hidden md:flex justify-around max-w-2xl mx-auto">
            {allNavItems.map(item => <NavItem key={item.page} page={item.page} label={item.label} icon={item.icon} onClick={() => setCurrentPage(item.page)} isActive={currentPage === item.page} />)}
        </div>

        {/* Mobile nav */}
        <div className="flex md:hidden justify-around max-w-2xl mx-auto">
            {mainNavItems.map(item => <NavItem key={item.page} page={item.page} label={item.label} icon={item.icon} onClick={() => setCurrentPage(item.page)} isActive={currentPage === item.page} />)}
            <div className="relative flex flex-col items-center justify-center w-full pt-2 pb-1" ref={moreMenuRef}>
                 <button
                    onClick={() => setIsMoreMenuOpen(prev => !prev)}
                    className={`flex flex-col items-center justify-center w-full h-full text-xs transition-colors duration-200 ${
                        isMoreMenuActive ? 'text-white scale-[1.02]' : 'text-teal-100 hover:text-white'
                    }`}
                    aria-haspopup="true"
                    aria-expanded={isMoreMenuOpen}
                    >
                    <Plus className="w-6 h-6 mb-1" />
                    <span>More</span>
                </button>

                {isMoreMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-xl border dark:border-slate-700 text-text dark:text-slate-200 z-40 animate-slide-up-fade">
                        {moreNavItems.map(item => (
                            <button 
                                key={item.page} 
                                onClick={() => {
                                    setCurrentPage(item.page);
                                    setIsMoreMenuOpen(false);
                                }} 
                                className="w-full flex items-center gap-3 p-3 text-left hover:bg-teal-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                <item.icon className="w-5 h-5 text-primary" />
                                <span className={`font-semibold text-sm ${currentPage === item.page ? 'text-primary' : ''}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
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

    if (!isDbLoaded) {
        return <AppSkeletonLoader />;
    }
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
