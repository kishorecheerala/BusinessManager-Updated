
import { useEffect, useState } from 'react';
import { apiClient } from '../utils/api-client';

export const useRecommendations = () => {
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        const result = await apiClient.get('/api/recommendations');
        const data = result.data as any;
        setRecommendations(data.recommendations || []);
      } catch (err) {
        console.error('[Recommendations] Failed:', err);
      }
    };

    loadRecommendations();
  }, []);

  return recommendations;
};