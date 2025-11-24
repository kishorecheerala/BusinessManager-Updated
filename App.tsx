
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
import DeveloperToolsModal from './components/DeveloperToolsModal';
import CloudDebugModal from './components/CloudDebugModal';
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
        ? "bg-primary text-white px-6 py-3 rounded-full shadow-xl animate-fade-in-up font-medium flex items-center gap-2"
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
      className={`group flex flex-col items-center justify-center w-full pt-3 pb-2 px-0.5 rounded-2xl transition-all duration-300 ${
        isActive 
          ? 'text-primary transform -translate-y-1' 
          : 'text-gray-400 dark:text-gray-500 md:hover:text-gray-600 dark:md:hover:text-gray-300'
      }`}
    >
      <div className={`p-1 rounded-full transition-all duration-300 ${isActive ? 'bg-primary/10 scale-110' : 'group-hover:bg-gray-100 dark:group-hover:bg-slate-800'}`}>
        <Icon 
            className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'fill-primary/20 -rotate-6' : 'group-hover:scale-110'}`} 
            strokeWidth={isActive ? 2.5 : 2} 
        />
      </div>
      <span className={`text-[9px] sm:text-[10px] font-semibold mt-1 transition-all duration-300 truncate w-full text-center leading-tight ${isActive ? 'opacity-100' : 'opacity-70'}`}>{label}</span>
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
                        <div className={`p-2 rounded-lg bg-gray-50 dark:bg-slate-700 group-hover:bg-white dark:group-hover:bg-slate-600 shadow-sm ${action.color} transition-transform group-hover:scale-110`}>
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
    if (!user) return <CloudOff className="w-5 h-5 text-white/50" />;
    
    if (status === 'syncing') return <RefreshCw className="w-5 h-5 text-white animate-spin" />;
    
    const isError = status === 'error';
    const dotColor = isError ? 'bg-red-500' : 'bg-green-400';
    
    return (
        <div className="relative flex items-center justify-center">
            <Cloud className="w-5 h-5 text-white" />
            <span 
                className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-transparent ${dotColor}`}
            />
        </div>
    );
};

const formatTime = (timestamp: number | null) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return `Synced ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

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
  const [isMobileQuickAddOpen, setIsMobileQuickAddOpen] = useState(false);
  const [isAskAIOpen, setIsAskAIOpen] = useState(false);
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const [isCloudDebugOpen, setIsCloudDebugOpen] = useState(false);
  const [navConfirm, setNavConfirm] = useState<{ show: boolean, page: Page | null }>({ show: false, page: null });
  const [exitAttempt, setExitAttempt] = useState(false);

  const { state, dispatch, isDbLoaded, showToast, googleSignIn, syncData } = useAppContext();
  const { installPromptEvent, theme, themeColor, themeGradient } = state;
  const [isInstallBannerVisible, setIsInstallBannerVisible] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const quickAddRef = useRef<HTMLDivElement>(null);
  const mobileQuickAddRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useOnClickOutside(menuRef, () => setIsMenuOpen(false));
  useOnClickOutside(quickAddRef, () => setIsQuickAddOpen(false));
  useOnClickOutside(mobileQuickAddRef, () => setIsMobileQuickAddOpen(false));
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

  // Apply dynamic theme color with Adaptive Lightening for Dark Mode
  useEffect(() => {
      let r=0, g=0, b=0;
      if (themeColor) {
          // Convert Hex to RGB
          const hex = themeColor.replace('#', '');
          r = parseInt(hex.substring(0, 2), 16);
          g = parseInt(hex.substring(2, 4), 16);
          b = parseInt(hex.substring(4, 6), 16);
          
          // If in dark mode, we might need to lighten the primary color if it's too dark
          // to ensure visibility of text/icons against dark backgrounds.
          if (theme === 'dark') {
              // Calculate relative luminance
              const lum = (0.299 * r + 0.587 * g + 0.114 * b);
              // If luminance is low (dark color), lighten it
              if (lum < 120) {
                  const mix = 0.4; // Blend 40% with white
                  r = Math.round(r + (255 - r) * mix);
                  g = Math.round(g + (255 - g) * mix);
                  b = Math.round(b + (255 - b) * mix);
              }
          }

          document.documentElement.style.setProperty('--primary-color', `${r} ${g} ${b}`);
          localStorage.setItem('themeColor', themeColor);
      }

      // Apply gradient or solid fallback
      if (themeGradient) {
          document.documentElement.style.setProperty('--header-bg', themeGradient);
          localStorage.setItem('themeGradient', themeGradient);
      } else {
          // Fallback to current primary solid color
          document.documentElement.style.setProperty('--header-bg', `rgb(${r} ${g} ${b})`);
          localStorage.removeItem('themeGradient');
      }

  }, [themeColor, theme, themeGradient]);
  
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

  // useSwipe now attaches listeners globally via useEffect in the hook itself.
  // We just need to invoke it here with the desired callbacks.
  useSwipe({
    onSwipeLeft: () => {
        // Placeholder for future swipe left logic (e.g. next tab)
    },
    onSwipeRight: () => {
        // Prevent swipe if menus/modals are open
        if (isMenuOpen || isSearchOpen || isNotificationsOpen || isQuickAddOpen || isMobileQuickAddOpen || isMoreMenuOpen) return;

        if (currentPage !== 'DASHBOARD') {
            setCurrentPage('DASHBOARD');
        } else {
            if (exitAttempt) {
                try {
                    window.close(); // Attempt to close
                } catch(e) {}
                // Fallback navigation out
                window.history.back();
            } else {
                showToast("Swipe again to exit", 'info');
                setExitAttempt(true);
                setTimeout(() => setExitAttempt(false), 3500);
            }
        }
    }
  });

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

  // For Mobile: Purchases is in the main bar now, so mobileMoreItems matches desktop moreNavItems
  const mobileMoreItems = moreNavItems;
  
  const isMoreBtnActive = (mobileMoreItems.some(i => i.page === currentPage) || isMoreMenuOpen) && !isMobileQuickAddOpen;

  return (
    <div 
        className="flex flex-col h-screen font-sans text-slate-800 dark:text-slate-200 bg-transparent touch-pan-y"
    >
      <Toast />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} />
      <DeveloperToolsModal 
        isOpen={isDevToolsOpen} 
        onClose={() => setIsDevToolsOpen(false)} 
        onOpenCloudDebug={() => setIsCloudDebugOpen(true)} 
      />
      <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} />
      <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={(p, id) => { dispatch({ type: 'SET_SELECTION', payload: { page: p, id } }); _setCurrentPage(p); setIsSearchOpen(false); }} />
      <ConfirmationModal isOpen={navConfirm.show} onClose={() => setNavConfirm({ show: false, page: null })} onConfirm={() => { if (navConfirm.page) { setIsDirty(false); _setCurrentPage(navConfirm.page); } setNavConfirm({ show: false, page: null }); }} title="Unsaved Changes">You have unsaved changes. Leave anyway?</ConfirmationModal>
      
      {/* Dynamic Theme Header - Using bg-theme class which uses CSS variable */}
      <header className="bg-theme text-white shadow-lg p-3 px-4 flex items-center justify-between relative z-[60] sticky top-0">
          <div className="flex items-center gap-1">
            <div className="relative" ref={menuRef}>
              <button onClick={() => setIsMenuOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
                  <Menu className={`w-6 h-6 transition-transform duration-300 ${isMenuOpen ? 'rotate-90' : ''}`} />
              </button>
              <MenuPanel 
                isOpen={isMenuOpen} 
                onClose={() => setIsMenuOpen(false)} 
                onProfileClick={() => { setIsMenuOpen(false); setIsProfileOpen(true); }} 
                onNavigate={(page) => { setIsMenuOpen(false); setCurrentPage(page); }} 
                onOpenDevTools={() => { setIsMenuOpen(false); setIsDevToolsOpen(true); }}
              />
            </div>
            <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
              <Search className="w-6 h-6" />
            </button>
          </div>
          
          <button onClick={() => setCurrentPage('DASHBOARD')} className="flex flex-col items-center justify-center min-w-0 mx-2 text-center group">
            <h1 className="text-lg font-bold leading-tight truncate max-w-[200px] drop-shadow-md transition-transform group-active:scale-95">{state.profile?.name || 'Business Manager'}</h1>
            <div className="text-[10px] font-medium flex items-center gap-1 mt-0.5">
                {state.googleUser ? (
                   <>
                     <span className="opacity-90 truncate max-w-[120px]">{state.googleUser.name}</span>
                     <span className="opacity-50">•</span>
                     {state.syncStatus === 'error' ? (
                        <span className="text-red-200 flex items-center gap-0.5 animate-pulse font-bold">
                           <CloudOff size={10} /> Sync Error
                        </span>
                     ) : state.syncStatus === 'syncing' ? (
                        <span className="flex items-center gap-0.5 opacity-90">
                           <RefreshCw size={10} className="animate-spin"/> Syncing...
                        </span>
                     ) : (
                        <span className="opacity-75">
                           {formatTime(state.lastSyncTime)}
                        </span>
                     )}
                   </>
                ) : (
                   <span className="opacity-70 italic">Local Mode (Not Backed Up)</span>
                )}
            </div>
          </button>

          <div className="flex items-center gap-1">
             <button onClick={() => setIsAskAIOpen(true)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95 group relative">
                <Sparkles className="w-6 h-6 text-yellow-300 fill-yellow-300/20 animate-pulse" />
             </button>
             
             {/* Clickable Sync Indicator for Manual Sync or Re-Auth */}
             <button 
                onClick={() => state.syncStatus === 'error' ? googleSignIn() : syncData()} 
                className='flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/20 transition-all active:scale-95'
                title={state.syncStatus === 'error' ? "Session Expired - Click to Reconnect" : "Click to Sync"}
             >
                <SyncIndicator status={state.syncStatus} user={state.googleUser} />
             </button>
             
             {/* Hidden on mobile, visible on desktop */}
             <div className="relative hidden md:block" ref={quickAddRef}>
                <button onClick={() => setIsQuickAddOpen(prev => !prev)} className={`p-2 rounded-full hover:bg-white/20 transition-all active:scale-95 bg-white/10 shadow-sm border border-white/10 ${isQuickAddOpen ? 'rotate-45' : ''}`}>
                    <Plus className="w-6 h-6" strokeWidth={3} />
                </button>
                <QuickAddMenu isOpen={isQuickAddOpen} onNavigate={(page, action) => { dispatch({ type: 'SET_SELECTION', payload: { page, id: 'new' } }); _setCurrentPage(page); setIsQuickAddOpen(false); }} />
            </div>
            <div className="relative" ref={notificationsRef}>
                 <button onClick={() => setIsNotificationsOpen(prev => !prev)} className="p-2 rounded-full hover:bg-white/20 transition-all active:scale-95">
                    <Bell className={`w-6 h-6 transition-transform ${state.notifications.some(n => !n.read) ? 'animate-swing' : ''}`} />
                    {state.notifications.some(n => !n.read) && <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-50 border-2 border-white animate-bounce"></span>}
                </button>
                 <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={(page) => { _setCurrentPage(page); setIsNotificationsOpen(false); }} />
            </div>
          </div>
      </header>

      {installPromptEvent && isInstallBannerVisible && (
        <div className="bg-primary text-white p-3 flex items-center justify-between gap-4 animate-fade-in-up shadow-lg mx-4 mt-4 rounded-xl">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><Download className="w-5 h-5" /></div>
                <p className="font-bold text-sm">Install App for Offline Access</p>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={handleInstallClick} className="bg-white text-primary font-bold py-1.5 px-4 rounded-lg text-xs shadow-md hover:bg-gray-50 transition-colors">Install</button>
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
        {/* Desktop View - unchanged */}
        <div className="hidden md:flex justify-center gap-8 p-2">
            {[...mainNavItems, ...moreNavItems].map(item => <NavItem key={item.page} page={item.page} label={item.label} icon={item.icon} onClick={() => setCurrentPage(item.page)} isActive={currentPage === item.page} />)}
        </div>

        {/* Mobile View - Custom Layout with Reordered Items and End FAB */}
        <div className="flex md:hidden justify-between items-end px-1 pt-2 pb-2 mx-auto w-full max-w-md">
            <NavItem page={'DASHBOARD'} label={'Home'} icon={Home} onClick={() => setCurrentPage('DASHBOARD')} isActive={currentPage === 'DASHBOARD' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
            <NavItem page={'CUSTOMERS'} label={'Customers'} icon={Users} onClick={() => setCurrentPage('CUSTOMERS')} isActive={currentPage === 'CUSTOMERS' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
            <NavItem page={'SALES'} label={'Sales'} icon={ShoppingCart} onClick={() => setCurrentPage('SALES')} isActive={currentPage === 'SALES' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
            <NavItem page={'PURCHASES'} label={'Purchases'} icon={Package} onClick={() => setCurrentPage('PURCHASES')} isActive={currentPage === 'PURCHASES' && !isMoreMenuOpen && !isMobileQuickAddOpen} />
            
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
                                    onClick={() => { setCurrentPage(item.page); setIsMoreMenuOpen(false); }} 
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
                            { icon: Undo2, label: 'New Return', page: 'RETURNS' as Page },
                        ].map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => { 
                                    dispatch({ type: 'SET_SELECTION', payload: { page: action.page, id: action.action || 'new' } }); 
                                    setCurrentPage(action.page);
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
