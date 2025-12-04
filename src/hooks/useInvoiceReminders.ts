
import { useEffect, useState } from 'react';
import { apiClient } from '../utils/api-client';
import { usePersistentState } from './usePersistentState';

export const useInvoiceReminders = () => {
  const [reminders, setReminders] = usePersistentState<any[]>('invoice-reminders', []);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadReminders = async () => {
      try {
        const result = await apiClient.get('/api/invoices/reminders');
        setReminders(result.data as any[]);
      } catch (err) {
        console.error('[Reminders] Failed:', err);
      } finally {
        setLoading(false);
      }
    };

    loadReminders();
    
    const interval = setInterval(loadReminders, 60 * 60 * 1000); // Hourly
    return () => clearInterval(interval);
  }, [setReminders]);

  return { reminders, loading };
};
