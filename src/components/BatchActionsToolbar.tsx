
import React from 'react';
import { Mail, CheckCircle, Download, X } from 'lucide-react';

interface BatchActionsToolbarProps {
    batchOps: any;
    totalItems: number;
}

export const BatchActionsToolbar: React.FC<BatchActionsToolbarProps> = ({ batchOps, totalItems }) => {
  const { selectionCount, clearSelection, batchSendReminders, batchMarkAsPaid, batchExport, loading } = batchOps;

  if (selectionCount === 0) return null;

  const handleAction = async (action: () => Promise<any>, label: string) => {
      if (window.confirm(`${label} for ${selectionCount} items?`)) {
          const res = await action();
          if (res.success && res.message) {
              // Assuming we had a toast method passed down, or just native alert for now
              // alert(res.message); 
          }
      }
  };

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-900 text-white p-3 rounded-xl shadow-2xl z-50 flex items-center gap-4 animate-slide-up-fade min-w-[300px] justify-between border border-slate-700">
      <div className="flex items-center gap-3 pl-2">
        <span className="bg-white text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">{selectionCount}</span>
        <span className="text-sm font-medium">Selected</span>
        <button onClick={clearSelection} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => handleAction(batchSendReminders, 'Send Reminders')}
          disabled={loading}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-white"
          title="Send Reminders"
        >
          <Mail size={18} />
        </button>
        <button
          onClick={() => handleAction(batchMarkAsPaid, 'Mark as Paid')}
          disabled={loading}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-green-400"
          title="Mark Paid"
        >
          <CheckCircle size={18} />
        </button>
        <div className="w-px h-6 bg-slate-700 mx-1"></div>
        <button
          onClick={() => handleAction(() => batchExport('csv'), 'Export CSV')}
          disabled={loading}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 hover:text-blue-400"
          title="Export CSV"
        >
          <Download size={18} />
        </button>
      </div>
    </div>
  );
};
