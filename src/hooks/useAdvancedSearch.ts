
import { useState, useCallback, useMemo } from 'react';
import { apiClient } from '../utils/api-client';

export const useAdvancedSearch = (initialFilters = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>(initialFilters);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const performSearch = useCallback(async () => {
    if (!searchQuery && Object.values(filters).every(v => !v)) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        ...filters
      });

      const result = await apiClient.get(`/api/search?${params.toString()}`);
      setResults(result.data);
    } catch (err) {
      console.error('[Search] Failed:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filters]);

  const addFilter = useCallback((key: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[key];
      return newFilters;
    });
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
    setResults([]);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    addFilter,
    removeFilter,
    clearFilters,
    results,
    loading,
    performSearch
  };
};
