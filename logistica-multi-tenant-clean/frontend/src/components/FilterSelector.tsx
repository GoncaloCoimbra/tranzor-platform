import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import api from '../api/api';

interface FilterSelectorProps {
  // Props para modo DROPDOWN (ProductList)
  label?: string;

  // Props para modo MODAL (TransportList, VehicleList)
  open?: boolean;
  onClose?: () => void;

  // Props comuns
  type: 'supplier' | 'product' | 'vehicle' | 'transport' | 'status';
  onSelect: (id: string, name: string) => void;
  currentFilters?: Record<string, string>;
  placeholder?: string;
}

// Helper functions FORA do componente
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    supplier: 'Supplier',
    product: 'Product',
    vehicle: 'Vehicle',
    transport: 'Transport',
    status: 'Status',
  };
  return labels[type] || type;
}

function getItemName(item: any, type: string): string {
  switch (type) {
    case 'supplier':
      return item.name || '';
    case 'product':
      return `${item.internalCode} - ${item.description}`;
    case 'vehicle':
      return `${item.licensePlate} - ${item.model}`;
    case 'transport':
      return `${item.origin} → ${item.destination}`;
    case 'status':
      return item.name || item.id;
    default:
      return '';
  }
}

function renderItemDetails(item: any, type: string) {
  if (type === 'supplier' && item.nif) {
    return <div className="text-sm text-slate-400 mt-1">NIF: {item.nif}</div>;
  }
  if (type === 'product' && item.supplier) {
    return <div className="text-sm text-slate-400 mt-1">Supplier: {item.supplier.name}</div>;
  }
  if (type === 'vehicle' && item.brand) {
    return <div className="text-sm text-slate-400 mt-1">{item.brand} - {item.year}</div>;
  }
  return null;
}

const FilterSelector: React.FC<FilterSelectorProps> = ({
  label,
  open = false,
  onClose,
  type,
  onSelect,
  currentFilters = {},
  placeholder = 'Select...',
}) => {
  // Modo dropdown: usa isOpen interno
  // Modo modal: usa prop open
  const isModalMode = typeof open !== 'undefined' && onClose;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const isOpen = isModalMode ? open : isDropdownOpen;

  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      let endpoint = '';
      let params: any = {};

      switch (type) {
        case 'supplier':
          endpoint = '/suppliers';
          if (currentFilters.vehicleId) {
            endpoint = `/suppliers/by-vehicle/${currentFilters.vehicleId}`;
          }
          break;
        case 'product':
          endpoint = '/products';
          if (currentFilters.supplierId) {
            params.supplierId = currentFilters.supplierId;
          }
          break;
        case 'vehicle':
          endpoint = '/vehicles';
          break;
        case 'transport':
          endpoint = '/transports';
          if (currentFilters.vehicleId) {
            params.vehicleId = currentFilters.vehicleId;
          }
          break;
        case 'status':
          // Para status, criamos opções estáticas
          setItems([
            { id: 'PENDING', name: 'Pending' },
            { id: 'IN_TRANSIT', name: 'Em Trânsito' },
            { id: 'DELIVERED', name: 'Delivered' },
            { id: 'CANCELLED', name: 'Cancelled' },
            { id: 'available', name: 'Disponível' },
            { id: 'in_use', name: 'Em Uso' },
            { id: 'maintenance', name: 'Maintenance' },
          ]);
          setLoading(false);
          return;
      }

      const response = await api.get(endpoint, { params });
      setItems(response.data);
    } catch (error) {
      console.error(`Error loading ${type}:`, error);
    } finally {
      setLoading(false);
    }
  }, [currentFilters, type]);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, loadItems]);

  const filteredItems = items.filter((item) => {
    const searchLower = searchTerm.toLowerCase();
    const name = getItemName(item, type).toLowerCase();
    return name.includes(searchLower);
  });

  const handleSelect = (item: any) => {
    onSelect(item.id, getItemName(item, type));

    if (isModalMode && onClose) {
      onClose();
    } else {
      setIsDropdownOpen(false);
    }

    setSearchTerm('');
  };

  const handleClose = () => {
    if (isModalMode && onClose) {
      onClose();
    } else {
      setIsDropdownOpen(false);
    }
    setSearchTerm('');
  };

  // MODO MODAL (TransportList, VehicleList)
  if (isModalMode) {
    if (!open) return null;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/50 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-amber-500/30">
              <h3 className="text-lg font-bold text-amber-300">
                Selecionar {getTypeLabel(type)}
              </h3>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-amber-400 transition-colors p-1 hover:bg-amber-500/10 rounded-lg"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4 border-b border-amber-500/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="text"
                  placeholder={placeholder || `Search ${getTypeLabel(type)}...`}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-amber-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-96">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-2"></div>
                  <p>Loading...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p>No results found</p>
                </div>
              ) : (
                <div className="divide-y divide-amber-500/10">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full px-4 py-3 text-left hover:bg-amber-500/10 transition-colors text-white"
                    >
                      <div className="font-semibold text-amber-300">{getItemName(item, type)}</div>
                      {renderItemDetails(item, type)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  }

  // MODO DROPDOWN (ProductList)
  return (
    <div className="relative">
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full px-4 py-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-2 border-amber-500/50 rounded-lg text-amber-300 font-semibold hover:border-amber-400 hover:bg-amber-500/20 transition-all flex items-center justify-between group"
      >
        <span className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          {label || getTypeLabel(type)}
        </span>
        <ChevronDown className={`w-5 h-5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {isDropdownOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={handleClose}
          />
          <div className="absolute top-full left-0 right-0 mt-2 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/50 rounded-xl shadow-2xl z-50 max-h-96 overflow-hidden">
            <div className="p-4 border-b border-amber-500/30">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-amber-500" />
                <input
                  type="text"
                  placeholder={placeholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-700/50 border border-amber-500/30 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>

            <div className="overflow-y-auto max-h-64">
              {loading ? (
                <div className="p-8 text-center text-slate-400">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-2"></div>
                  <p>Loading...</p>
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <p>No results found</p>
                </div>
              ) : (
                <div className="divide-y divide-amber-500/10">
                  {filteredItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="w-full px-4 py-3 text-left hover:bg-amber-500/10 transition-colors text-white"
                    >
                      <div className="font-semibold text-amber-300">{getItemName(item, type)}</div>
                      {renderItemDetails(item, type)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default FilterSelector;