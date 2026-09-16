import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../api/config';

interface Product {
  id: string;
  internalCode: string;
  description: string;
  quantity: number;
  unit: string;
  totalWeight?: number;
  totalVolume?: number;
  currentLocation?: string;
  status: string;
  supplierId?: string;
  supplier?: {
    id: string;
    name: string;
    nif: string;
  };
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

interface CreateProductDto {
  internalCode: string;
  description: string;
  quantity: number;
  unit: string;
  totalWeight?: number;
  totalVolume?: number;
  currentLocation?: string;
  supplierId?: string;
  observations?: string;
}

interface UpdateProductStatusDto {
  newStatus: string;
  quantity?: number;
  location?: string;
  reason?: string;
}

export function useProducts(filters?: { status?: string; supplierId?: string; search?: string; location?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      // Remove empty/undefined filters to avoid 400 errors
      const cleanFilters = Object.fromEntries(
        Object.entries(filters || {}).filter(([_, value]) => value !== '' && value !== undefined && value !== null)
      );
      
      console.log('[useProducts] Clean filters:', cleanFilters);
      try {
        const response = await apiClient.get<PaginatedResponse<Product>>('/products', { params: cleanFilters });
        console.log('[useProducts] Success:', response.data);
        const payload = response.data as any;
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.items)) return payload.items;
        return [];
      } catch (err: any) {
        console.error('[useProducts] Error:', {
          message: err.message,
          status: err.response?.status,
          statusText: err.response?.statusText,
          errorDetail: err.response?.data,
        });
        throw err;
      }
    },
    staleTime: 0,
    gcTime: 0,
  });
}

export function useProduct(id: string) {
  return useQuery({
    queryKey: ['products', id],
    queryFn: async () => {
      const response = await apiClient.get<Product>(`/products/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useProductWithMovements(id: string) {
  return useQuery({
    queryKey: ['products', id, 'movements'],
    queryFn: async () => {
      const response = await apiClient.get(`/products/${id}/movements`);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useProductStats() {
  return useQuery({
    queryKey: ['products', 'stats'],
    queryFn: async () => {
      const response = await apiClient.get('/products/stats');
      return response.data;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProductDto) => {
      const response = await apiClient.post<Product>('/products', data);
      return response.data;
    },
    onSuccess: (newProduct) => {
      // Invalidate all product queries
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // Force immediate refetch of main products list
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['products', undefined] });
      }, 500);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateProductDto> }) => {
      const response = await apiClient.patch<Product>(`/products/${id}`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', variables.id] });
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProductStatusDto }) => {
      const response = await apiClient.patch<Product>(`/products/${id}/status`, data);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products', variables.id] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}