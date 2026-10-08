import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useProduct, useProductWithMovements } from '../hooks/useProducts';
import { apiClient } from '../api/config';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { statusLabels, getStatusBadgeClass } from '../theme.config';

interface Product {
  id: string;
  internalCode: string;
  description: string;
  quantity: number;
  unit: string;
  status: string;
  totalWeight?: number;
  totalVolume?: number;
  supplier?: {
    id: string;
    name: string;
    nif: string;
  };
  currentLocation?: string;
  observations?: string;
  receivedAt: string;
  lastMovedAt: string;
  movements?: Movement[];
}

interface Movement {
  id: string;
  previousStatus: string | null;
  newStatus: string;
  quantity: number;
  location?: string;
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface ActiveFilter {
  type: 'supplier' | 'vehicle' | 'status' | 'location';
  label: string;
  value: string;
}

const filterLabels: Record<string, string> = {
  supplier: 'Supplier',
  vehicle: 'Vehicle',
  status: 'Status',
  location: 'Location',
};

const ProductDetails: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data: product, isLoading: loading, error } = useProductWithMovements(id!);
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([]);
  const [showAddFilter, setShowAddFilter] = useState(false);
  const [newFilterType, setNewFilterType] = useState<'supplier' | 'vehicle' | 'status' | 'location'>('supplier');
  const [newFilterValue, setNewFilterValue] = useState('');

  // States to delete product
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Load filters from URL params
  const loadFiltersFromURL = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    const filters: ActiveFilter[] = [];

    // Parse supplier filter
    const supplier = params.get('supplier');
    if (supplier) {
      filters.push({ type: 'supplier', label: 'Supplier', value: supplier });
    }

    // Parse vehicle filter
    const vehicle = params.get('vehicle');
    if (vehicle) {
      filters.push({ type: 'vehicle', label: 'Vehicle', value: vehicle });
    }

    // Parse status filter
    const status = params.get('status');
    if (status) {
      filters.push({ type: 'status', label: 'Status', value: status });
    }

    // Parse location filter
    const location = params.get('location');
    if (location) {
      filters.push({ type: 'location', label: 'Location', value: location });
    }

    setActiveFilters(filters);
  }, [searchParams]);

  useEffect(() => {
    loadFiltersFromURL();
  }, [id, loadFiltersFromURL]);

  // Function to delete product
  const handleDeleteProduct = async () => {
    if (!product) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete(`/products/${product.id}`);

      // Success - redirect to products list
      navigate('/products', {
        state: {
          message: `Product "${product.description}" was successfully deleted!`,
          type: 'success'
        }
      });
    } catch (error: any) {
      console.error('Error deleting product:', error);
      console.error('Full response:', error.response);

      // Capture error message from API - ensure it is always a string
      let errorMessage = 'Error deleting product. Please try again.';

      if (error.response) {
        const { status, data } = error.response;

        // Handle 403 (Forbidden) specifically
        if (status === 403) {
          errorMessage = '🔒 You do not have permission to delete this product. Please check your access permissions.';
        }
        // Handle 400 (Bad Request) - backend validation
        else if (status === 400 && data) {
          if (typeof data.message === 'string') {
            errorMessage = data.message;
          } else if (typeof data.message === 'object' && data.message.message) {
            errorMessage = data.message.message;
          } else if (typeof data.error === 'string') {
            errorMessage = data.error;
          }
        }
        // Other errors
        else if (data) {
          if (typeof data.message === 'string') {
            errorMessage = data.message;
          } else if (typeof data.message === 'object' && data.message.message) {
            errorMessage = data.message.message;
          } else if (typeof data.error === 'string') {
            errorMessage = data.error;
          } else if (typeof data === 'string') {
            errorMessage = data;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      setDeleteError(errorMessage);
      setDeleting(false);
    }
  };

  const handleAddFilter = () => {
    if (!newFilterValue.trim()) {
      alert('Please enter a value for the filter');
      return;
    }

    const filterLabels = {
      supplier: 'Supplier',
      vehicle: 'Vehicle',
      status: 'Status',
      location: 'Location'
    };

    const newFilter: ActiveFilter = {
      type: newFilterType,
      label: filterLabels[newFilterType],
      value: newFilterValue.trim()
    };

    setActiveFilters([...activeFilters, newFilter]);
    setShowAddFilter(false);
    setNewFilterValue('');
  };

  const handleRemoveFilter = (index: number) => {
    setActiveFilters(activeFilters.filter((_: ActiveFilter, i: number) => i !== index));
  };

  const handleBackToList = () => {
    const params = new URLSearchParams();

    activeFilters.forEach((filter: ActiveFilter) => {
      params.append(filter.type, filter.value);
    });

    const queryString = params.toString();
    navigate(`/products${queryString ? `?${queryString}` : ''}`);
  };

  // Check if can delete
  const canDelete = product?.status === 'RECEIVED';

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-2xl)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          <span className="ml-3 text-amber-300">Loading details...</span>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div style={{ padding: 'var(--space-2xl)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <div className="flex flex-col items-center justify-center h-64">
          <svg className="w-16 h-16 text-red-400/50 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-red-400 font-medium text-lg">Product not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="product-page p-8 bg-gradient-to-br from-[#0f172a] to-[#1e293b] min-h-screen text-amber-100">
      {/* Back Button */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={handleBackToList}
          className="text-amber-400 hover:text-amber-300 flex items-center gap-2 font-medium hover:bg-amber-900/30 px-4 py-2 rounded-lg transition-all border border-amber-500/30"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to List
        </button>

        {/* Delete Button */}
        <button
          onClick={() => setShowDeleteModal(true)}
          disabled={!canDelete}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all border ${
            canDelete
              ? 'bg-red-600/20 border-red-500/50 text-red-400 hover:bg-red-600/30 hover:border-red-500'
              : 'bg-gray-700/20 border-gray-600/30 text-gray-500 cursor-not-allowed'
          }`}
          title={!canDelete ? 'Only products in "Received" status can be deleted' : 'Delete product'}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          Delete Product
        </button>
      </div>

      {/* Warning if cannot delete */}
      {!canDelete && (
        <div className="bg-amber-900/20 border-2 border-amber-500/50 rounded-lg p-4 mb-6 flex items-start gap-3">
          <svg className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-amber-300 font-semibold">Product cannot be deleted</p>
            <p className="text-amber-200/80 text-sm mt-1">
              Only products in <strong>"Received"</strong> status can be deleted. Current status: <strong>{statusLabels.product[product.status] || product.status}</strong>
            </p>
          </div>
        </div>
      )}

      {/* Active Filters */}
      {(activeFilters.length > 0 || showAddFilter) && (
        <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <h3 className="text-lg font-semibold text-white">Active Filters</h3>
            <button
              onClick={() => setShowAddFilter(!showAddFilter)}
              className="text-sm bg-gradient-to-r from-amber-500 to-amber-600 text-white px-4 py-2 rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all border border-amber-500/30 shadow-lg font-medium"
            >
              {showAddFilter ? 'Cancel' : 'Add Filter'}
            </button>
          </div>

          <div className="flex flex-wrap gap-3 mb-6">
            {activeFilters.map((filter, index) => (
              <div
                key={index}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-900/40 to-amber-800/30 text-amber-300 px-4 py-2 rounded-full border border-amber-500/30"
              >
                <span className="font-medium">{filter.label}:</span>
                <span>"{filter.value}"</span>
                <button
                  onClick={() => handleRemoveFilter(index)}
                  className="ml-2 hover:bg-amber-500/30 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                  title="Remove filter"
                >
                  <span className="text-sm font-semibold">×</span>
                </button>
              </div>
            ))}
          </div>

          {showAddFilter && (
            <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-6 rounded-lg border border-amber-500/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-amber-300 mb-2">
                    Filter Type
                  </label>
                  <select
                    value={newFilterType}
                    onChange={(e) => setNewFilterType(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white"
                  >
                    <option value="supplier" className="bg-[#1e293b]">Supplier</option>
                    <option value="vehicle" className="bg-[#1e293b]">Vehicle</option>
                    <option value="status" className="bg-[#1e293b]">Status</option>
                    <option value="location" className="bg-[#1e293b]">Location</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-amber-300 mb-2">
                    Value
                  </label>
                  <Input type="text"
                    value={newFilterValue}
                    onChange={(e) => setNewFilterValue(e.target.value)}
                    placeholder="Enter a value..."
                    className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white placeholder-amber-300/50"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFilter()}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleAddFilter}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-white px-6 py-2.5 rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all border border-amber-500/30 shadow-lg font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Product Info Header */}
      <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-8 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold text-white mb-3">{product.description}</h2>
            <p style={{ color: 'var(--color-text-muted)' }}>Code: {product.internalCode}</p>
          </div>
          <span className={`px-5 py-2.5 rounded-full font-semibold text-sm ${getStatusBadgeClass('product', product.status)}`}>
            {statusLabels.product[product.status] || product.status}
          </span>
        </div>
      </div>

      {/* Product Details */}
      <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-8 mb-8">
        <h3 className="text-xl font-semibold text-white mb-6">📋 Product Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Quantity</p>
            <p className="text-xl font-medium text-white">{product.quantity} {product.unit}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Supplier</p>
            <p className="text-xl font-medium text-white">{product.supplier?.name || '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Current Location</p>
            <p className="text-xl font-medium text-white">{product.currentLocation || '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Total Weight</p>
            <p className="text-xl font-medium text-white">{product.totalWeight ? `${product.totalWeight} kg` : '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Total Volume</p>
            <p className="text-xl font-medium text-white">{product.totalVolume ? `${product.totalVolume} m³` : '—'}</p>
          </div>
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Reception Date</p>
            <p className="text-xl font-medium text-white">
              {product.receivedAt ? new Date(product.receivedAt).toLocaleDateString('en-GB') : '—'}
            </p>
          </div>
          <div className="col-span-2 bg-gradient-to-br from-amber-900/20 to-amber-900/10 p-4 rounded-lg border border-amber-500/20">
            <p className="text-sm text-amber-300 mb-1">Observations</p>
            <p className="text-lg text-white">{product.observations || '—'}</p>
          </div>
        </div>
      </div>

      {/* Movement History */}
      <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-8">
        <h3 className="text-xl font-semibold text-white mb-6">📜 Movement History</h3>

        {!product.movements || product.movements.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-amber-500/30 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-amber-300/70">No movements recorded</p>
          </div>
        ) : (
          <div className="space-y-4">
            {product.movements.map((movement: Movement) => (
              <div
                key={movement.id}
                className="bg-gradient-to-br from-amber-900/20 to-amber-900/10 rounded-lg p-4 border border-amber-500/20 hover:border-amber-500/40 transition-all"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="mb-3">
                      <span className="font-medium text-white">
                        {movement.previousStatus
                          ? `${statusLabels.product[movement.previousStatus]} → `
                          : ''}
                        <span className="text-amber-400">
                          {statusLabels.product[movement.newStatus]}
                        </span>
                      </span>
                      <div className="text-sm text-amber-300 mt-2">
                        <span className="font-medium">By:</span> {movement.user.name} ({movement.user.email})
                      </div>
                      {movement.location && (
                        <div className="text-sm text-amber-300 mt-1">
                          <span className="font-medium">Location:</span> {movement.location}
                        </div>
                      )}
                    </div>
                    {movement.reason && (
                      <div className="mt-3 text-sm text-amber-200 bg-amber-900/30 p-3 rounded border border-amber-500/20 italic">
                        "{movement.reason}"
                      </div>
                    )}
                  </div>
                  <div className="text-sm text-amber-400/70 ml-4 whitespace-nowrap">
                    {new Date(movement.createdAt).toLocaleString('en-GB')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => !deleting && setShowDeleteModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-red-500/50 rounded-xl shadow-2xl w-full max-w-md">
              <div style={{ padding: '1.5rem' }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-red-500/20 p-3 rounded-full">
                    <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold text-white">Confirm Deletion</h3>
                </div>

                <p className="text-amber-200 mb-4">
                  Are you sure you want to delete the product <strong style={{ color: 'var(--color-text)' }}>"{product.description}"</strong>?
                </p>

                <div className="bg-amber-900/20 border border-amber-500/30 rounded-lg p-3 mb-6">
                  <p className="text-sm text-amber-300">
                    <strong>Code:</strong> {product.internalCode}<br />
                    <strong>Status:</strong> {statusLabels.product[product.status]}
                  </p>
                </div>

                {deleteError && (
                  <div className="bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 mb-4">
                    <p className="text-red-300 text-sm">{deleteError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 border-2 border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-900/20 transition-all font-bold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteProduct}
                    disabled={deleting}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Yes, Delete
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ProductDetails;
