
import { useState, useCallback } from 'react';
import { Product } from '../types';
import { useAppContext } from '../context/AppContext';

export const useProductBatchOperations = () => {
  const { dispatch } = useAppContext();
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
  
  const batchDelete = useCallback(async (products: Product[]) => {
      // This is a placeholder for actual deletion logic which might need context access
      // In a real app, this would dispatch a batch delete action
      // For now, we can simulate it or return IDs for the component to handle
      return Array.from(selectedItems);
  }, [selectedItems]);

  return {
    selectedItems,
    selectionCount: selectedItems.size,
    toggleSelection,
    selectAll,
    clearSelection,
    loading,
    setLoading
  };
};
