import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/config';

interface Transport {
  id: string;
  origin: string;
  destination: string;
  expectedDate: string;
  departureDate?: string;
  estimatedArrival?: string;
  driver?: string;
  totalWeight?: number;
  notes?: string;
  status: string;
  vehicleId?: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface CreateTransportDto {
  origin: string;
  destination: string;
  expectedDate: string;
  departureDate?: string;
  estimatedArrival?: string;
  driver?: string;
  totalWeight?: number;
  notes?: string;
  vehicleId?: string;
  productIds?: string[];
}

export function useTransports(filters?: { status?: string; vehicleId?: string }) {
  return useQuery({
    queryKey: ['transports', filters],
    queryFn: async () => {
      const response = await apiClient.get<PaginatedResponse<Transport>>('/transports', { params: filters });
      return response.data.data;
    },
  });
}

export function usePendingTransports() {
  return useQuery({
    queryKey: ['transports', 'pending'],
    queryFn: async () => {
      const response = await apiClient.get<Transport[]>('/transports/pending');
      return response.data;
    },
  });
}

export function useInTransitTransports() {
  return useQuery({
    queryKey: ['transports', 'in-transit'],
    queryFn: async () => {
      const response = await apiClient.get<Transport[]>('/transports/in-transit');
      return response.data;
    },
  });
}

export function useTransport(id: string) {
  return useQuery({
    queryKey: ['transports', id],
    queryFn: async () => {
      const response = await apiClient.get<Transport>(`/transports/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateTransport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateTransportDto) => {
      const response = await apiClient.post<Transport>('/transports', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
    },
  });
}

export function useUpdateTransport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTransportDto> }) => {
      const response = await apiClient.patch<Transport>(`/transports/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
      queryClient.invalidateQueries({ queryKey: ['transports', variables.id] });
    },
  });
}

export function useUpdateTransportStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiClient.patch<Transport>(`/transports/${id}/status`, { status });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
    },
  });
}

export function useDeleteTransport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/transports/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transports'] });
    },
  });
}