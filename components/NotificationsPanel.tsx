import React from 'react';
import { Bell, ShieldAlert } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Button from './Button';
import { Page } from '../types';

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (page: Page) => void;
}

const timeSince = (date: string): string => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " minutes ago";
    return "Just now";
};

const NotificationIcon: React.FC<{ type: 'backup' | 'info' }> = ({ type }) => {
    switch (type) {
        case 'backup':
            return <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />;
        default:
            return <Bell className="w-5 h-5 text-primary flex-shrink-0" />;
    }
};

const NotificationsPanel: React.FC<NotificationsPanelProps> = ({ isOpen, onClose, onNavigate }) => {
    const { state, dispatch } = useAppContext();
    const { notifications } = state;

    const handleMarkAllAsRead = () => {
        // Iterate through notifications and only mark the non-backup ones as read.
        notifications.forEach(n => {
            if (n.type !== 'backup' && !n.read) {
                dispatch({ type: 'MARK_NOTIFICATION_AS_READ', payload: n.id });
            }
        });
    };

    const handleNotificationClick = (id: string, type: 'backup' | 'info', actionLink?: Page) => {
        // Only mark non-backup notifications as read upon click.
        // The backup notification is cleared automatically when a backup is performed.
        if (type !== 'backup') {
            dispatch({ type: 'MARK_NOTIFICATION_AS_READ', payload: id });
        }
        
        if (actionLink) {
            onNavigate(actionLink);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
          className="absolute top-full right-0 mt-2 w-80 max-h-[70vh] flex flex-col bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-gray-200 dark:border-slate-700 text-text dark:text-slate-200 animate-scale-in origin-top-right z-40"
          role="dialog"
          aria-label="Notifications Panel"
        >
            <div className="flex justify-between items-center p-3 border-b dark:border-slate-700">
                <h3 className="font-bold text-lg text-primary">Notifications</h3>
                <Button onClick={handleMarkAllAsRead} variant="secondary" className="px-2 py-1 text-xs">
                    Mark all as read
                </Button>
            </div>
            <div className="flex-grow overflow-y-auto">
                {notifications.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 p-6">No new notifications.</p>
                ) : (
                    <div className="divide-y dark:divide-slate-700">
                        {notifications.map(notification => (
                            <div
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification.id, notification.type, notification.actionLink)}
                                className={`p-3 flex items-start gap-3 transition-colors ${notification.actionLink ? 'cursor-pointer' : ''} ${!notification.read ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/50 dark:hover:bg-purple-900/80' : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'}`}
                            >
                                <NotificationIcon type={notification.type} />
                                <div>
                                    <p className="font-semibold text-sm">{notification.title}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">{notification.message}</p>
                                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeSince(notification.createdAt)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPanel;