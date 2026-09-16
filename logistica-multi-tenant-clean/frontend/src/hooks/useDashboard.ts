import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/config';

export function useDashboardOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/overview');
      return response.data;
    },
  });
}

export function useDashboardProductStats(period = '30d', startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ['dashboard', 'products', 'stats', period, startDate, endDate],
    queryFn: async () => {
      const params = startDate && endDate ? { startDate, endDate } : { period };
      const response = await apiClient.get('/dashboard/stats', { params });
      return response.data;
    },
  });
}

export function useDashboardTransportStats() {
  return useQuery({
    queryKey: ['dashboard', 'transports', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/transports/stats');
      return response.data;
    },
  });
}

export function useDashboardActivity(limit: number = 10) {
  return useQuery({
    queryKey: ['dashboard', 'activity', limit],
    queryFn: async () => {
      const response = await apiClient.get('/dashboard/recent-activity', {
        params: { limit },
      });
      return response.data;
    },
  });
}
