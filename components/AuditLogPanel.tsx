
import React from 'react';
import { Activity, User, Calendar, X } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Card from './Card';

interface AuditLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AuditLogPanel: React.FC<AuditLogPanelProps> = ({ isOpen, onClose }) => {
  const { state } = useAppContext();
  const logs = state.audit_logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50); // Show last 50

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-[100] animate-fade-in-fast" onClick={onClose}>
      <div className="w-full max-w-md bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-slide-in-right" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center bg-theme text-white">
          <h2 className="font-bold text-lg flex items-center gap-2"><Activity size={20} /> Activity Log</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-4">
          {logs.length === 0 ? (
            <p className="text-center text-gray-500">No activity recorded yet.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-3 p-3 rounded-lg bg-gray-50 dark:bg-slate-800 border dark:border-slate-700">
                <div className="mt-1">
                  <User size={16} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm dark:text-gray-200">{log.action}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 break-all">{log.details}</p>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400">
                    <span>{log.user}</span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditLogPanel;
