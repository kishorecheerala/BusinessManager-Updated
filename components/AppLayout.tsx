import React, { useState, useRef, Suspense, useMemo } from 'react';
import {
    Menu, Search, Sparkles, WifiOff, Sun, Moon, RefreshCw, CloudOff, Cloud, Bell, HelpCircle, CalendarClock,
    Plus, X, Settings, ShoppingCart, UserPlus, PackagePlus, Receipt, Undo2, FileText, Package, BarChart2, Layout
} from 'lucide-react';
import { Page, AppMetadata } from '../types';
import { useAppContext } from '../context/AppContext';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import NavItem from './NavItem';
import { ICON_MAP, LABEL_MAP } from '../utils/iconMap';
import { QUICK_ACTION_REGISTRY } from '../utils/quickActions';

// Lazy loaded components for the layout
const MenuPanel = React.lazy(() => import('./MenuPanel'));
const NotificationsPanel = React.lazy(() => import('./NotificationsPanel'));
const AskAIModal = React.lazy(() => import('./AskAIModal'));
const HelpModal = React.lazy(() => import('./HelpModal'));
const UniversalSearch = React.lazy(() => import('./UniversalSearch'));
const DeveloperToolsModal = React.lazy(() => import('./DeveloperToolsModal'));
const CloudDebugModal = React.lazy(() => import('./CloudDebugModal'));
const ProfileModal = React.lazy(() => import('./ProfileModal'));
const NavCustomizerModal = React.lazy(() => import('./NavCustomizerModal'));
const ChangeLogModal = React.lazy(() => import('./ChangeLogModal'));
const SignInModal = React.lazy(() => import('./SignInModal'));
const PinModal = React.lazy(() => import('./PinModal'));
const APIConfigModal = React.lazy(() => import('./APIConfigModal'));

interface AppLayoutProps {
    children: React.ReactNode;
    currentPage: Page;
    onNavigate: (page: Page) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({
    children,
    currentPage,
    onNavigate
}) => {
    const { state, dispatch, syncData, showToast, lockApp } = useAppContext();
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
    const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);

    const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
    const [isAPIConfigOpen, setIsAPIConfigOpen] = useState(false);

    const notificationsRef = useRef<HTMLDivElement>(null);
    useOnClickOutside(notificationsRef, () => setIsNotificationsOpen(false));

    // Time state
    const [currentDateTime, setCurrentDateTime] = React.useState(new Date());
    React.useEffect(() => {
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

    const toggleTheme = () => {
        const newTheme = state.theme === 'light' ? 'dark' : 'light';
        dispatch({ type: 'SET_THEME', payload: newTheme });
    };

    const handleLockApp = () => {
        lockApp();
        setIsMenuOpen(false);
        showToast("App Locked", 'info');
    };

    // Prepare Nav Items
    const { mainNavItems, pinnedItems, mobilePinnedItems, mobileMoreItems } = useMemo(() => {
        const order = state.navOrder || [];

        const mainNavItems = order
            .filter(id => id !== 'SYSTEM_OPTIMIZER')
            .map(id => ({
                page: id, label: LABEL_MAP[id] || id, icon: ICON_MAP[id]
            }));

        const pinnedIds = order.slice(0, 4);
        const menuIds = order.slice(4);

        // For Desktop: Show 4 pinned
        const pinnedItems = pinnedIds.map(id => ({ page: id, label: LABEL_MAP[id] || id, icon: ICON_MAP[id] }));

        // For Mobile: Show 4 pinned in bar (Index 0, 1, 2, 3)
        // The 5th pinned item (Index 4) moves to "More" for mobile
        const mobilePinnedItems = pinnedIds.slice(0, 4).map(id => ({ page: id, label: LABEL_MAP[id] || id, icon: ICON_MAP[id] }));

        // Mobile More includes the 5th pinned item + rest
        const mobileRestIds = [pinnedIds.slice(4), ...menuIds].flat().filter(Boolean);
        const mobileMoreItems = mobileRestIds.map(id => ({ page: id, label: LABEL_MAP[id] || id, icon: ICON_MAP[id] }));

        return { mainNavItems, pinnedItems, mobilePinnedItems, mobileMoreItems };
    }, [state.navOrder]);

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
        <div className={`min-h-screen flex flex-col bg-background dark:bg-slate-950 text-text dark:text-slate-200 font-sans transition-colors duration-300`}>
            {/* Modals & Overlays */}
            <Suspense fallback={null}>

                <ChangeLogModal isOpen={isChangeLogOpen} onClose={() => setIsChangeLogOpen(false)} />
                <SignInModal isOpen={isSignInModalOpen} onClose={() => setIsSignInModalOpen(false)} />
                <MenuPanel
                    isOpen={isMenuOpen}
                    onClose={() => setIsMenuOpen(false)}
                    onProfileClick={() => setIsProfileModalOpen(true)}
                    onNavigate={onNavigate}
                    onOpenDevTools={() => setIsDevToolsOpen(true)}
                    onOpenChangeLog={() => setIsChangeLogOpen(true)}
                    onOpenSignIn={() => setIsSignInModalOpen(true)}

                    onLockApp={handleLockApp}
                    onOpenAPIConfig={() => setIsAPIConfigOpen(true)}
                    onHelpClick={() => setIsHelpOpen(true)}
                />
                <UniversalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={onNavigate} />
                <AskAIModal isOpen={isAskAIOpen} onClose={() => setIsAskAIOpen(false)} onNavigate={onNavigate} />
                <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
                <DeveloperToolsModal isOpen={isDevToolsOpen} onClose={() => setIsDevToolsOpen(false)} onOpenCloudDebug={() => setIsCloudDebugOpen(true)} onOpenAPIConfig={() => setIsAPIConfigOpen(true)} />
                <CloudDebugModal isOpen={isCloudDebugOpen} onClose={() => setIsCloudDebugOpen(false)} onOpenAPIConfig={() => setIsAPIConfigOpen(true)} />
                <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} />
                <NavCustomizerModal isOpen={isNavCustomizerOpen} onClose={() => setIsNavCustomizerOpen(false)} />
                <APIConfigModal isOpen={isAPIConfigOpen} onClose={() => setIsAPIConfigOpen(false)} />
            </Suspense>

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
                                onClick={() => onNavigate('DASHBOARD')}
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

                                            {/* Last Synced Time */}
                                            <div className="flex flex-col items-end mr-3 hidden sm:flex">
                                                <span className="text-xs font-medium dark:text-gray-200">
                                                    {state.syncStatus === 'syncing' ? 'Syncing...' :
                                                        state.syncStatus === 'error' ? 'Sync Failed' :
                                                            'Cloud Sync'}
                                                </span>
                                                <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                                    {state.syncStatus === 'syncing' ? 'Please wait' :
                                                        state.lastSyncTime ? new Date(state.lastSyncTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) :
                                                            'Not synced yet'}
                                                </span>
                                            </div>
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

                            <div className="flex items-center gap-2">
                                {/* Old Last Synced Block Removed */}
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
                                    title={state.lastSyncTime ? `Last Synced: ${new Date(state.lastSyncTime).toLocaleString()}` : "Sync Data"}
                                >
                                    {state.syncStatus === 'syncing' ? (
                                        <RefreshCw size={20} className="animate-spin" />
                                    ) : state.syncStatus === 'error' ? (
                                        <CloudOff size={20} className="text-red-300" />
                                    ) : (
                                        <Cloud size={20} className={!state.googleUser ? "opacity-70" : ""} />
                                    )}
                                </button>
                            </div>

                            <div className="relative" ref={notificationsRef}>
                                <button onClick={() => setIsNotificationsOpen(!isNotificationsOpen)} className="p-2 hover:bg-white/20 rounded-full transition-colors relative">
                                    <Bell size={20} />
                                    {state.notifications.some(n => !n.read) && (
                                        <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
                                    )}
                                </button>
                                <Suspense fallback={null}>
                                    <NotificationsPanel isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} onNavigate={onNavigate} />
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
                            {currentDateTime.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} {currentDateTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }).toUpperCase()}
                        </div>
                    </div>
                </header>
            )}

            {/* Main Content Area */}
            <main className={`flex-grow w-full ${mainClass}`}>
                {children}
            </main>

            {/* Bottom Navigation for Desktop & Mobile */}
            {currentPage !== 'INVOICE_DESIGNER' && (
                <nav className={`fixed pb-[env(safe-area-inset-bottom)] z-50 transition-all duration-300 ${navContainerClass}`}>
                    <div className="hidden md:flex w-full overflow-x-auto custom-scrollbar">
                        <div className="flex flex-nowrap mx-auto items-center gap-2 lg:gap-6 p-2 px-6 min-w-max">
                            {mainNavItems.map(item => (
                                <div key={item.page} className="w-16 lg:w-20 flex-shrink-0">
                                    <NavItem
                                        page={item.page}
                                        label={item.label}
                                        icon={item.icon}
                                        onClick={() => onNavigate(item.page as Page)}
                                        isActive={currentPage === item.page}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Navigation View */}
                    {/* Mobile Navigation Bar - Now Themed */}
                    <nav
                        className={`md:hidden fixed z-[40] transition-all duration-300 pb-safe ${state.uiPreferences?.navStyle === 'floating' ? 'bottom-4 left-4 right-4 rounded-2xl shadow-xl' : 'bottom-0 left-0 right-0 border-t border-white/20'}`}
                        style={{
                            background: state.themeGradient || state.themeColor || (state.theme === 'dark' ? '#0f172a' : '#ffffff'),
                            backdropFilter: 'blur(12px)',
                        }}
                    >
                        <div className="flex justify-between items-center h-16 px-2">
                            {/* Slots 1-3: Pinned Items */}
                            {mobilePinnedItems.map((item) => {
                                const Icon = item.icon;
                                const isActive = currentPage === item.page;
                                const isThemed = !!(state.themeGradient || state.themeColor);
                                return (
                                    <div key={item.page} className="flex-1 max-w-[4.5rem]">
                                        <button
                                            onClick={() => onNavigate(item.page as Page)}
                                            className={`flex flex-col items-center justify-center w-full pt-2 pb-1 px-1 rounded-xl transition-all duration-300 group ${isActive ? 'scale-105 font-bold' : 'opacity-80 hover:opacity-100'}`}
                                            style={{ color: isThemed ? 'white' : undefined }}
                                        >
                                            <div className={`p-1 rounded-full mb-0.5 transition-colors ${isActive ? (isThemed ? 'bg-white/20' : 'bg-theme/10') : ''}`}
                                            >
                                                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                                            </div>
                                            <span className={`text-[10px] leading-tight truncate w-full text-center ${isActive ? '' : 'font-medium'}`}>{item.label}</span>
                                        </button>
                                    </div>
                                );
                            })}

                            {/* Slot 4: More */}
                            <div className="flex-1 max-w-[4.5rem]">
                                <button
                                    onClick={() => setIsMoreMenuOpen(true)}
                                    className={`flex flex-col items-center justify-center w-full pt-2 pb-1 px-1 rounded-xl transition-all duration-300 group ${isMoreMenuOpen ? 'scale-105 font-bold' : 'opacity-80 hover:opacity-100'}`}
                                    style={{ color: (state.themeGradient || state.themeColor) ? 'white' : undefined }}
                                >
                                    <div className={`p-1 rounded-full mb-0.5 transition-colors ${isMoreMenuOpen ? 'bg-white/20' : ''}`}
                                    >
                                        <Menu size={20} strokeWidth={2} />
                                    </div>
                                    <span className="text-[10px] leading-tight font-medium">More</span>
                                </button>
                            </div>

                            {/* Slot 5: Add (New Style - Tab-like) */}
                            <div className="flex-1 max-w-[4.5rem]">
                                <button
                                    onClick={() => setIsMobileQuickAddOpen(true)}
                                    className={`flex flex-col items-center justify-center w-full pt-2 pb-1 px-1 rounded-xl transition-all duration-300 group ${isMobileQuickAddOpen ? 'scale-105 font-bold' : 'opacity-80 hover:opacity-100'}`}
                                    style={{ color: (state.themeGradient || state.themeColor) ? 'white' : undefined }}
                                >
                                    <div className={`p-1 rounded-full mb-0.5 transition-colors ${isMobileQuickAddOpen ? 'bg-white/20' : ''}`}
                                    >
                                        <Plus size={20} strokeWidth={2} />
                                    </div>
                                    <span className="text-[10px] leading-tight font-medium">Add</span>
                                </button>
                            </div>
                        </div>
                    </nav>

                    {/* Mobile Quick Add VIBRANT FAB Menu (Replaces Sheet) */}
                    {isMobileQuickAddOpen && (
                        <>
                            <div className="fixed inset-0 z-[59] bg-black/20 backdrop-blur-[2px] transition-opacity" onClick={() => setIsMobileQuickAddOpen(false)} />

                            <div className={`fixed z-[60] flex flex-col gap-3 items-end pr-2 ${state.uiPreferences?.navStyle === 'floating' ? 'bottom-24 right-4' : 'bottom-20 right-2'}`}>

                                {/* Customize Quick Actions */}
                                <button
                                    onClick={() => { setIsMobileQuickAddOpen(false); setIsNavCustomizerOpen(true); }}
                                    className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg border border-white/20 hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                >
                                    <span className="font-bold text-sm">Customize Actions</span>
                                    <div className="w-10 h-10 rounded-full bg-gray-50 dark:bg-slate-700 flex items-center justify-center text-gray-400 dark:text-gray-500 shadow-inner">
                                        <Settings size={18} />
                                    </div>
                                </button>

                                {/* Quick Actions Stack */}
                                {Object.entries(QUICK_ACTION_REGISTRY as any).slice(0, 5).reverse().map(([key, action]: [string, any], index) => {
                                    const Icon = action.icon;
                                    const delay = index * 50;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => {
                                                setIsMobileQuickAddOpen(false);
                                                if (action.action) {
                                                    dispatch({ type: 'SET_SELECTION', payload: { page: action.page, id: action.action as any } });
                                                }
                                                onNavigate(action.page);
                                            }}
                                            className="flex items-center gap-3 pl-4 pr-2 py-2 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                            style={{
                                                animationDelay: `${delay}ms`,
                                                background: state.themeGradient || state.themeColor || 'linear-gradient(to right, #10b981, #0d9488)'
                                            }}
                                        >
                                            <span className="font-bold text-sm">{action.label}</span>
                                            <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                                                <Icon size={20} strokeWidth={2.5} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Mobile More Menu Sheet */}
                    {/* Mobile More VIBRANT FAB Menu */}
                    {isMoreMenuOpen && (
                        <>
                            {/* Invisible Overlay for closing */}
                            <div className="fixed inset-0 z-[59] bg-black/20 backdrop-blur-[2px] transition-opacity" onClick={() => setIsMoreMenuOpen(false)} />

                            <div className={`fixed z-[60] flex flex-col gap-3 items-end pr-2 ${state.uiPreferences?.navStyle === 'floating' ? 'bottom-24 right-4' : 'bottom-20 right-2'}`}>

                                {/* Settings */}
                                <button
                                    onClick={() => { setIsMoreMenuOpen(false); setIsMenuOpen(true); }}
                                    className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg border border-white/20 hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                    style={{ animationDelay: '50ms' }}
                                >
                                    <span className="font-bold text-sm">Settings</span>
                                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-600 dark:text-gray-300 shadow-inner">
                                        <Settings size={20} />
                                    </div>
                                </button>

                                {/* Customize Navigation */}
                                <button
                                    onClick={() => { setIsMoreMenuOpen(false); setIsNavCustomizerOpen(true); }}
                                    className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 rounded-full shadow-lg border border-white/20 hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                    style={{ animationDelay: '75ms' }}
                                >
                                    <span className="font-bold text-sm">Customize Nav</span>
                                    <div className="w-10 h-10 rounded-full bg-cyan-50 dark:bg-slate-700 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-inner">
                                        <Layout size={20} />
                                    </div>
                                </button>

                                {/* AI Command Center (Restored & Vibrant) */}
                                <button
                                    onClick={() => { setIsMoreMenuOpen(false); setIsAskAIOpen(true); }}
                                    className="flex items-center gap-3 pl-4 pr-2 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                    style={{ animationDelay: '100ms' }}
                                >
                                    <span className="font-bold text-sm">AI Command Center</span>
                                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shadow-inner">
                                        <Sparkles size={20} fill="currentColor" className="animate-pulse" />
                                    </div>
                                </button>

                                {/* Dynamic More Items */}
                                {mobileMoreItems.map((item, index) => {
                                    const Icon = item.icon;
                                    const delay = (mobileMoreItems.length - index + 2) * 50; // Stagger from bottom
                                    return (
                                        <button
                                            key={item.page}
                                            onClick={() => {
                                                setIsMoreMenuOpen(false);
                                                onNavigate(item.page as Page);
                                            }}
                                            className="flex items-center gap-3 pl-4 pr-2 py-2 bg-white dark:bg-slate-900 text-gray-800 dark:text-gray-100 rounded-full shadow-lg border border-gray-100 dark:border-slate-800 hover:scale-105 active:scale-95 transition-all animate-slide-up origin-right"
                                            style={{ animationDelay: `${delay}ms` }}
                                        >
                                            <span className="font-bold text-sm">{item.label}</span>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm ${currentPage === item.page ? 'bg-theme text-white' : 'bg-gray-50 dark:bg-slate-800 text-theme'}`}>
                                                <Icon size={20} strokeWidth={2.5} />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </nav>
            )}
        </div >
    );
};

export default AppLayout;
