
import { useState, useCallback } from 'react';
import { apiClient } from '../utils/api-client';

export const useBatchOperations = () => {
  const [selectedItems, setSelectedItems] = useState(new Set<string>());
  const [loading, setLoading] = useState(false);

  const toggleSelection = useCallback((id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedItems(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  const batchSendReminders = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.post('/api/invoices/batch/send-reminders', {
        invoiceIds: Array.from(selectedItems)
      });
      clearSelection();
      return { success: true, message: `Reminders queued for ${selectedItems.size} invoices` };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [selectedItems, clearSelection]);

  const batchMarkAsPaid = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.post('/api/invoices/batch/mark-paid', {
        invoiceIds: Array.from(selectedItems)
      });
      clearSelection();
      return { success: true, message: `${selectedItems.size} invoices marked as paid` };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [selectedItems, clearSelection]);

  const batchExport = useCallback(async (format = 'csv') => {
    setLoading(true);
    try {
      const result = await apiClient.post(`/api/invoices/batch/export-${format}`, {
        invoiceIds: Array.from(selectedItems)
      });
      
      const csvContent = result.data as string;

      // Basic download trigger
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `export-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      clearSelection();
      return { success: true, message: "Export downloaded" };
    } catch (err: any) {
      console.error('[Batch Export] Failed:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  }, [selectedItems, clearSelection]);

  return {
    selectedItems,
    selectionCount: selectedItems.size,
    toggleSelection,
    selectAll,
    clearSelection,
    batchSendReminders,
    batchMarkAsPaid,
    batchExport,
    loading
  };
};