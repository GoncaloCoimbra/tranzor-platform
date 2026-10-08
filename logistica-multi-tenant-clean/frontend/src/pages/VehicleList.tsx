import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/api';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import FilterSelector from '../components/FilterSelector';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme, getStatusBadgeClass, statusLabels } from '../theme.config';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

interface Vehicle {
  id: string;
  licensePlate: string;
  model: string;
  brand: string;
  year: number;
  capacity: number;
  type: string;
  status: 'available' | 'in_use' | 'maintenance';
  createdAt: string;
  companyId: string;
}

interface User {
  id: string;
  companyId: string;
  role: string;
}

interface Company {
  id: string;
  name: string;
}

// ?? FUN��O MELHORADA para extrair mensagens de error do backend
const extractErrorMessage = (error: any, defaultMessage: string): string => {
  console.log('?? [ERROR DEBUG] Estrutura completa do error:', error);
  console.log('?? [ERROR DEBUG] error.response:', error?.response);
  console.log('?? [ERROR DEBUG] error.response.data:', error?.response?.data);

  if (!error) return defaultMessage;

  // 1?? Tentar extrair de error.response.data
  if (error.response?.data) {
    const date = error.response.data;
    console.log('?? [ERROR DEBUG] date type:', typeof date);
    console.log('?? [ERROR DEBUG] date.message:', date.message);

    // Se date � string diretamente
    if (typeof date === 'string') {
      console.log(' [ERROR DEBUG] Retornando date como string');
      return date;
    }

    // Se date.message existe
    if (date.message) {
      // Se � array (valida��o do NestJS)
      if (Array.isArray(date.message)) {
        console.log(' [ERROR DEBUG] Retornando primeiro item do array');
        return date.message[0] || defaultMessage;
      }
      // Se � string
      if (typeof date.message === 'string') {
        console.log(' [ERROR DEBUG] Retornando date.message');
        return date.message;
      }
      // Se � objeto (pode ter nested message)
      if (typeof date.message === 'object' && date.message.message) {
        console.log(' [ERROR DEBUG] Retornando date.message.message');
        return date.message.message;
      }
    }

    // Se date.error existe e � string
    if (date.error && typeof date.error === 'string') {
      console.log(' [ERROR DEBUG] Retornando date.error');
      return date.error;
    }

    // ?? Tentar statusText do response
    if (error.response.statusText) {
      console.log(' [ERROR DEBUG] Retornando statusText');
      return error.response.statusText;
    }
  }

  // 2?? Tentar error.message
  if (error.message && typeof error.message === 'string') {
    console.log(' [ERROR DEBUG] Retornando error.message');
    return error.message;
  }

  // 3?? Se nada funcionar, retornar mensagem padr�o
  console.log('?? [ERROR DEBUG] Retornando mensagem padr�o');
  return defaultMessage;
};

const VehicleList: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const {
    activeFilters,
    hasFilters,
    addFilter,
    removeFilter,
    clearAllFilters,
    getFilter,
  } = useFilters();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Array<{id: string, name: string}>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentFilterType, setCurrentFilterType] = useState<'status' | 'transport' | null>(null);
  const [formData, setFormData] = useState({
    licensePlate: '',
    model: '',
    brand: '',
    year: new Date().getFullYear(),
    capacity: 0,
    type: 'truck',
    status: 'available' as 'available' | 'in_use' | 'maintenance',
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadCompanies();
    }
  }, [user]);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(response.data);
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadVehicles = useCallback(async () => {
    try {
      setError('');

      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      if (getFilter('status')) params.set('status', getFilter('status')!);
      if (getFilter('transport')) params.set('transportId', getFilter('transport')!);

      const response = await api.get(`/vehicles?${params.toString()}`);
      setVehicles(response.data);
    } catch (error: any) {
      console.error('Error loading vehicles:', error);
      setError(extractErrorMessage(error, 'Error loading vehicles'));
    } finally {
      setLoading(false);
    }
  }, [getFilter, searchTerm]);

  useEffect(() => {
    loadVehicles();
  }, [loadVehicles]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadVehicles();
  };

  const openFilterModal = (type: 'status' | 'transport') => {
    setCurrentFilterType(type);
    setIsModalOpen(true);
  };

  const handleFilterSelect = (id: string, label: string) => {
    if (currentFilterType) {
      addFilter(currentFilterType, id);
    }
  };

  const getNextFilter = () => {
    if (!getFilter('status')) return { type: 'status' as const, label: 'Status' };
    if (!getFilter('transport')) return { type: 'transport' as const, label: 'Transport' };
    return null;
  };

  const nextFilter = getNextFilter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!formData.licensePlate || !formData.model || !formData.brand) {
        setError('Please fill in all required fields');
        return;
      }

      if (formData.capacity <= 0) {
        setError('Capacity must be greater than zero');
        return;
      }

      if (formData.year < 1900 || formData.year > new Date().getFullYear() + 1) {
        setError('Invalid year');
        return;
      }

      const companyIdToUse = user?.role === 'SUPER_ADMIN'
        ? (editingId ? user?.companyId : selectedCompanyId)
        : user?.companyId;

      if (user?.role === 'SUPER_ADMIN' && !editingId && !selectedCompanyId) {
        setError('Please select a company');
        return;
      }

      const capacity = Number(formData.capacity);
      const year = Number(formData.year);

      if (isNaN(capacity) || capacity <= 0) {
        setError('Invalid capacity. Please enter a number greater than zero.');
        return;
      }

      if (isNaN(year) || year < 1900 || year > new Date().getFullYear() + 1) {
        setError('Invalid year. Please enter a valid year');
        return;
      }

      const dataToSend = {
        licensePlate: formData.licensePlate.trim().toUpperCase(),
        model: formData.model.trim(),
        brand: formData.brand.trim(),
        type: formData.type,
        status: formData.status,
        capacity: capacity,
        year: year,
        companyId: companyIdToUse
      };

      console.log('?? Sending vehicle date:', dataToSend);

      if (editingId) {
        await api.patch(`/vehicles/${editingId}`, dataToSend);
      } else {
        await api.post('/vehicles', dataToSend);
      }

      await loadVehicles();
      resetForm();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      const errorMsg = extractErrorMessage(error, 'Error saving vehicle');
      setError(errorMsg);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setFormData({
      licensePlate: vehicle.licensePlate,
      model: vehicle.model,
      brand: vehicle.brand,
      year: vehicle.year,
      capacity: vehicle.capacity,
      type: vehicle.type,
      status: vehicle.status,
    });
    setEditingId(vehicle.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Do you really want to delete this vehicle?')) {
      try {
        setError('');
        console.log('??? Trying to delete vehicle:', id);
        await api.delete(`/vehicles/${id}`);
        console.log('? Vehicle deleted successfully');
        await loadVehicles();
      } catch (error: any) {
        console.error('? Error deleting vehicle:', error);
        console.error(' Status do error:', error?.response?.status);
        console.error(' Date do error:', error?.response?.data);

        const errorMsg = extractErrorMessage(error, 'Error deleting vehicle');
        console.log('?? Extracted error message:', errorMsg);
        setError(errorMsg);

        // ?? Scroll suave para o topo para mostrar o error
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      licensePlate: '',
      model: '',
      brand: '',
      year: new Date().getFullYear(),
      capacity: 0,
      type: 'truck',
      status: 'available',
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
    setSelectedCompanyId('');
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      truck: 'Truck',
      Carrinha: 'Van',
      car: 'Car',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="loading-page flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4"></div>
          <p className="loading-message">{t('loadingVehicles')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`operations-page ${theme.backgrounds.page} p-6 min-h-screen`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-white">{t('headerVehicles')}</h1>
          <p className="text-sm text-[#cbd5e1] mt-1">{t('vehicleFleet')}</p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
          className={`${
            showForm
              ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'
              : 'bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:via-amber-700 hover:to-amber-800'
          } text-white px-6 py-3 rounded-lg transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2`}
        >
          {showForm ? (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {t('cancel')}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('newVehicle')}
            </>
          )}
        </button>
      </div>

      {/* ?? ALERTA DE ERRO MELHORADO */}
      {error && (
        <div className="bg-gradient-to-r from-red-900/40 to-red-900/30 border-2 border-red-500/80 text-red-300 px-6 py-4 rounded-lg mb-6 shadow-2xl backdrop-blur-sm animate-pulse">
          <div className="flex items-start">
            <svg className="w-6 h-6 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-lg text-red-200">Error</p>
              <p className="text-base mt-2 leading-relaxed">{String(error)}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="ml-4 text-red-400 hover:text-red-200 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-3 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <Input type="text"
            placeholder={t('searchVehicles')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-[#1e293b] text-white"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
        >
          {t('search')}
        </button>
      </form>

      {/* Filter Chips */}
      <FilterChips
        filters={activeFilters}
        onRemove={removeFilter}
        onClearAll={clearAllFilters}
      />

      {/* Filter Buttons */}
      {!loading && nextFilter && (
        <button
          onClick={() => openFilterModal(nextFilter.type)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#1e293b]/50 border-2 border-dashed border-slate-600 text-slate-300 rounded-lg hover:border-amber-500 mb-4 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {nextFilter.label}
        </button>
      )}

      {showForm && (
        <div className={`${theme.cards.form} border-2 border-amber-500/50 mb-6`}>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
            {editingId ? (
              <>
                <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Vehicle
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Vehicle
              </>
            )}
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {user?.role === 'SUPER_ADMIN' && !editingId && (
              <div className="col-span-2 bg-gradient-to-r from-[#dc2626]/20 to-[#991b1b]/20 border-2 border-[#dc2626] rounded-lg p-4 mb-2">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`${getStatusBadgeClass('user', 'SUPER_ADMIN')} text-xs`}>
                    SUPER ADMIN
                  </span>
                  <span className="text-sm text-[#cbd5e1] font-medium">
                    Select the company to create the vehicle
                  </span>
                </div>
                <label className="block text-sm font-medium mb-2 text-amber-200">
                  Company *
                </label>
                <select
                  required
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className={theme.inputs.base}
                >
                  <option value="">Select a company...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                License Plate *
              </label>
              <Input type="text"
                required
                value={formData.licensePlate}
                onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value })}
                className={theme.inputs.base}
                placeholder="ABC-1234 ou 00-AB-00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Model *
              </label>
              <Input type="text"
                required
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className={theme.inputs.base}
                placeholder="Ex: Sprinter 415"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Brand *
              </label>
              <Input type="text"
                required
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className={theme.inputs.base}
                placeholder="Ex: Mercedes-Benz"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Year *
              </label>
              <Input type="number"
                required
                min="1900"
                max={new Date().getFullYear() + 1}
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || new Date().getFullYear() })}
                className={theme.inputs.base}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Capacity (kg) *
              </label>
              <Input type="number"
                required
                min="1"
                step="1"
                value={formData.capacity || ''}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 0 })}
                className={theme.inputs.base}
                placeholder="Ex: 3500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Type *
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className={theme.inputs.base}
              >
                <option value="truck">Truck</option>
                <option value="Carrinha">Van</option>
                <option value="car">Car</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium mb-1 text-amber-200">
                Status *
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'available' })}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    formData.status === 'available'
                      ? 'border-emerald-500 bg-emerald-900/30 text-emerald-400'
                      : 'border-[#334155] hover:border-emerald-500/50 text-[#cbd5e1]'
                  }`}
                >
                  Available
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'in_use' })}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    formData.status === 'in_use'
                      ? 'border-[#dc2626] bg-[#1e293b]/50 text-[#dc2626]'
                      : 'border-[#334155] hover:border-[#dc2626]/50 text-[#cbd5e1]'
                  }`}
                >
                  ?? In Use
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, status: 'maintenance' })}
                  className={`px-4 py-2 rounded-lg border-2 transition-all ${
                    formData.status === 'maintenance'
                      ? 'border-amber-500 bg-amber-900/30 text-amber-400'
                      : 'border-[#334155] hover:border-amber-500/50 text-[#cbd5e1]'
                  }`}
                >
                  ?? Maintenance
                </button>
              </div>
            </div>
            <div className="col-span-2 flex gap-2 justify-end pt-4 border-t border-amber-500/30">
              <button
                type="button"
                onClick={resetForm}
                className="px-6 py-2 border-2 border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-900/20 transition-all font-bold hover:border-amber-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl shadow-lg overflow-hidden border-2 border-amber-500/30 hover:border-amber-500/50 transition-all">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-[#0f172a] to-black">
              <tr>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-left text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Vehicle
                </th>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-left text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Brand/Model
                </th>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-left text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Year
                </th>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-left text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Capacity
                </th>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-left text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Status
                </th>
                <th className="bg-gradient-to-r from-[#0f172a] to-black px-8 py-4 text-right text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/20">
              {vehicles.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-amber-900/10 transition-colors border-b border-amber-500/10">
                  <td className="px-8 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md">
                        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-bold text-white">{vehicle.licensePlate}</div>
                        <div className="text-xs text-amber-300">{getTypeLabel(vehicle.type)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-white">{vehicle.brand}</div>
                    <div className="text-xs text-amber-300">{vehicle.model}</div>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm text-amber-300">
                    {vehicle.year}
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-sm font-bold text-white">
                    {vehicle.capacity != null ? vehicle.capacity.toLocaleString() : 'N/A'} kg
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap">
                    <span className={getStatusBadgeClass('vehicle', vehicle.status)}>
                      {statusLabels.vehicle[vehicle.status]}
                    </span>
                  </td>
                  <td className="px-8 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(vehicle)}
                      className="text-amber-400 hover:text-amber-300 font-bold mr-3 inline-flex items-center gap-1 transition-colors hover:bg-amber-900/30 p-2 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(vehicle.id)}
                      className="text-red-400 hover:text-red-300 font-bold inline-flex items-center gap-1 transition-colors hover:bg-red-900/30 p-2 rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vehicles.length === 0 && (
          <div className="text-center py-12 text-amber-500/70">
            <svg className="w-16 h-16 mx-auto mb-4 text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            <p className="text-lg font-bold text-amber-400">{t('noVehicles')}</p>
            <p className="text-sm mt-1">{t('newVehicleHint')}</p>
          </div>
        )}
      </div>

      {vehicles.length > 0 && (
        <div className="mt-4 flex justify-between items-center text-sm text-amber-400/80">
          <div>
            Total: <span className="font-bold text-amber-400">{vehicles.length}</span> vehicle{vehicles.length !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              {vehicles.filter(v => v.status === 'available').length} available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-[#dc2626] rounded-full"></span>
              {vehicles.filter(v => v.status === 'in_use').length} in use
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
              {vehicles.filter(v => v.status === 'maintenance').length} in maintenance
            </span>
          </div>
        </div>
      )}

      {/* Modal de Filtros */}
      {isModalOpen && currentFilterType && (
        <FilterSelector
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setCurrentFilterType(null);
          }}
          type={currentFilterType}
          onSelect={handleFilterSelect}
          currentFilters={{
            status: getFilter('status') || '',
            transportId: getFilter('transport') || '',
          }}
          placeholder={`Search ${currentFilterType === 'status' ? 'statuses' : 'transports'}...`}
        />
      )}
    </div>
  );
};

export default VehicleList;
