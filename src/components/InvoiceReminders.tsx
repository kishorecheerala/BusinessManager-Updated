
import React from 'react';
import { useInvoiceReminders } from '../hooks/useInvoiceReminders';
import Card from './Card';
import { Bell, AlertCircle, Clock, CheckCircle } from 'lucide-react';

export const InvoiceReminders: React.FC<{ onNavigate: (page: any, id: string) => void }> = ({ onNavigate }) => {
  const { reminders } = useInvoiceReminders();

  const overdueReminders = reminders.filter((r: any) => r.daysOverdue > 0);
  const upcomingReminders = reminders.filter((r: any) => r.daysUntilDue < 7 && r.daysUntilDue >= 0);

  if (overdueReminders.length === 0 && upcomingReminders.length === 0) return null;

  return (
    <Card className="border-l-4 border-l-orange-500">
      <div className="flex items-center gap-2 mb-4">
          <Bell className="text-orange-500" size={20} />
          <h3 className="font-bold text-slate-700 dark:text-slate-200">Invoice Reminders</h3>
      </div>

      <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
        {/* Overdue Section */}
        {overdueReminders.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-red-500 uppercase mb-2 flex items-center gap-1">
                <AlertCircle size={12} /> Overdue ({overdueReminders.length})
            </h4>
            <div className="space-y-2">
                {overdueReminders.map((r: any) => (
                    <ReminderItem key={r.id} reminder={r} type="overdue" onClick={() => onNavigate('SALES', r.invoiceId)} />
                ))}
            </div>
          </div>
        )}

        {/* Upcoming Section */}
        {upcomingReminders.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-amber-500 uppercase mb-2 flex items-center gap-1">
                <Clock size={12} /> Due Soon ({upcomingReminders.length})
            </h4>
            <div className="space-y-2">
                {upcomingReminders.map((r: any) => (
                    <ReminderItem key={r.id} reminder={r} type="upcoming" onClick={() => onNavigate('SALES', r.invoiceId)} />
                ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

const ReminderItem = ({ reminder, type, onClick }: any) => (
  <div 
    className={`p-3 rounded-lg border flex justify-between items-center cursor-pointer transition-colors ${
        type === 'overdue' 
        ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/30' 
        : 'bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/30'
    }`}
    onClick={onClick}
  >
    <div>
      <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{reminder.customer}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">Inv #{reminder.invoiceId}</div>
    </div>
    <div className="text-right">
      <div className={`font-bold text-sm ${type === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>
          ₹{reminder.amount.toLocaleString()}
      </div>
      <div className="text-[10px] font-bold opacity-80">
          {type === 'overdue' ? `${reminder.daysOverdue} days late` : `Due in ${reminder.daysUntilDue} days`}
      </div>
    </div>
  </div>
);
