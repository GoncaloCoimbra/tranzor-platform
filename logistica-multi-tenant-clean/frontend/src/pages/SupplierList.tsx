import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

interface Supplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  nif: string;
  address?: string;
  city?: string;
  state?: string;
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

const asList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

// 🔧 FUNÇÃO MELHORADA para extrair mensagens de error do backend
const getErrorMessage = (error: any, defaultMessage: string): string => {
  console.log('[ERROR DEBUG] Estrutura completa do error:', error);
  console.log('[ERROR DEBUG] error.response:', error?.response);
  console.log('[ERROR DEBUG] error.response.data:', error?.response?.data);
  
  if (!error) return defaultMessage;
  
  // 1️⃣ Tentar extrair de error.response.data
  if (error.response?.data) {
    const date = error.response.data;
    console.log('📦 [ERROR DEBUG] date type:', typeof date);
    console.log('📦 [ERROR DEBUG] date.message:', date.message);
    
    // Se date é string diretamente
    if (typeof date === 'string') {
      console.log(' [ERROR DEBUG] Retornando date como string');
      return date;
    }
    
    // Se date.message existe
    if (date.message) {
      // Se é array (validação do NestJS)
      if (Array.isArray(date.message)) {
        console.log(' [ERROR DEBUG] Retornando primeiro item do array');
        return date.message[0] || defaultMessage;
      }
      // Se é string
      if (typeof date.message === 'string') {
        console.log(' [ERROR DEBUG] Retornando date.message');
        return date.message;
      }
      // Se é objeto (pode ter nested message)
      if (typeof date.message === 'object' && date.message.message) {
        console.log(' [ERROR DEBUG] Retornando date.message.message');
        return date.message.message;
      }
    }
    
    // Se date.error existe e é string
    if (date.error && typeof date.error === 'string') {
      console.log(' [ERROR DEBUG] Retornando date.error');
      return date.error;
    }

    // Se date.error é objeto
    if (date.error && typeof date.error === 'object') {
      if (date.error.message) {
        console.log(' [ERROR DEBUG] Retornando date.error.message');
        return date.error.message;
      }
      // Tentar JSON.stringify como último recurso
      try {
        const errorStr = JSON.stringify(date.error);
        if (errorStr !== '{}') {
          console.log(' [ERROR DEBUG] Retornando JSON.stringify(date.error)');
          return errorStr;
        }
      } catch (e) {
        console.log('⚠️ [ERROR DEBUG] Failure ao stringify error.response.data.error');
      }
    }

    // 🆕 Tentar statusText do response
    if (error.response.statusText) {
      console.log(' [ERROR DEBUG] Retornando statusText');
      return error.response.statusText;
    }
  }
  
  // 2️⃣ Tentar error.message
  if (error.message && typeof error.message === 'string') {
    console.log(' [ERROR DEBUG] Retornando error.message');
    return error.message;
  }
  
  // 3️⃣ Se nada funcionar, retornar mensagem padrão
  console.log('⚠️ [ERROR DEBUG] Retornando mensagem padrão');
  return defaultMessage;
};

const SupplierList: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const { activeFilters, addFilter, removeFilter, clearAllFilters, getFilter } = useFilters();
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  
  const [searchTerm, setSearchTerm] = useState(getFilter('search'));
  
  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
  });

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadCompanies();
    }
  }, [user]);

  useEffect(() => {
    loadSuppliers();
  }, [activeFilters]);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Error ao load usuário:', error);
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(asList<Company>(response.data));
    } catch (error) {
      console.error('Error loading companies:', error);
    }
  };

  const loadSuppliers = async () => {
    try {
      setError('');
      
      const params = new URLSearchParams();
      activeFilters.forEach(filter => {
        params.append(filter.key, filter.value);
      });
      
      const queryString = params.toString();
      const url = `/suppliers${queryString ? `?${queryString}` : ''}`;
      
      const response = await api.get(url);
      setSuppliers(asList<Supplier>(response.data));
    } catch (error: any) {
      console.error('Error loading suppliers:', error);
      setError(getErrorMessage(error, 'Error loading suppliers'));
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value) {
      addFilter('search', value);
    } else {
      removeFilter('search');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (!formData.name || !formData.email || !formData.phone || !formData.nif) {
        setError('Por favor, preencha todos os campos obrigatórios');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        setError('Por favor, insira um email válido');
        return;
      }

      const companyIdToUse = user?.role === 'SUPER_ADMIN' 
        ? (editingId ? user?.companyId : selectedCompanyId)
        : user?.companyId;

      if (user?.role === 'SUPER_ADMIN' && !editingId && !selectedCompanyId) {
        setError('Please select a company');
        return;
      }

      const dataToSend = {
        name: formData.name.trim(),
        nif: formData.nif.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        address: formData.address?.trim() || null,
        city: formData.city?.trim() || null,
        state: formData.state?.trim() || null,
        companyId: companyIdToUse
      };

      if (editingId) {
        await api.patch(`/suppliers/${editingId}`, dataToSend);
      } else {
        await api.post('/suppliers', dataToSend);
      }
      
      await loadSuppliers();
      resetForm();
    } catch (error: any) {
        console.error(' Error saving supplier:', error);
      setError(getErrorMessage(error, 'Error saving supplier'));
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setFormData({
      name: supplier.name,
      nif: supplier.nif,
      email: supplier.email || '',
      phone: supplier.phone || '',
      address: supplier.address || '',
      city: supplier.city || '',
      state: supplier.state || '',
    });
    setEditingId(supplier.id);
    setShowForm(true);
    setError('');
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Do you really want to delete this supplier?')) {
      try {
        setError('');
        console.log('🗑️ Trying to delete supplier:', id);
        await api.delete(`/suppliers/${id}`);
        console.log(' Supplier deleted successfully');
        await loadSuppliers();
      } catch (error: any) {
        console.error(' Error deleting supplier:', error);
        console.error(' Status do error:', error?.response?.status);
        console.error(' Date do error:', error?.response?.data);
        
        const errorMsg = getErrorMessage(error, 'Error deleting supplier');
        console.log('📝 Mensagem de error extraída:', errorMsg);
        setError(errorMsg);
        
        // 🔔 Scroll suave para o topo para mostrar o error
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      nif: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
    });
    setEditingId(null);
    setShowForm(false);
    setError('');
    setSelectedCompanyId('');
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-2xl)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{ animation: 'spin 1s linear infinite', width: '32px', height: '32px', borderRadius: '50%', borderTop: '2px solid var(--color-brand-red)' }}></div>
          <span style={{ marginLeft: 'var(--space-md)', color: 'var(--color-text-muted)' }}>{t('loadingVehicles')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="operations-page" style={{ padding: 'var(--space-lg)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'bold', color: 'var(--color-text)', margin: 0 }}>{t('suppliers')}</h1>
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>{t('supplierManagement')}</p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) resetForm();
          }}
          variant={showForm ? 'danger' : 'primary'}
          style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
        >
          {showForm ? (
            <>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Supplier
            </>
          )}
        </Button>
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError('')} style={{ marginBottom: 'var(--space-lg)' }}>
          ⚠️ {error}
        </Alert>
      )}

      {/* FilterChips */}
      <FilterChips
        filters={activeFilters}
        onRemove={removeFilter}
        onClearAll={clearAllFilters}
      />

      {/* Barra de Pesquisa */}
      <Card style={{ marginBottom: 'var(--space-lg)' }}>
        <Input type="text" 
          placeholder="Name ou NIF..."
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          label="Search Supplier"
        />
      </Card>

      {showForm && (
        <Card style={{ marginBottom: 'var(--space-lg)', borderWidth: '2px', borderColor: 'var(--color-border)' }}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', color: 'var(--color-text)' }}>
            {editingId ? (
              <>
                <svg style={{ width: '24px', height: '24px', color: 'var(--color-brand-red)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit Supplier
              </>
            ) : (
              <>
                <svg style={{ width: '24px', height: '24px', color: 'var(--color-success)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Supplier
              </>
            )}
          </h2>
          <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            {user?.role === 'SUPER_ADMIN' && !editingId && (
              <Card style={{ gridColumn: '1 / -1', backgroundColor: 'var(--color-surface-hover)', marginBottom: 'var(--space-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', marginBottom: 'var(--space-md)' }}>
                  <Badge variant="info">SUPER ADMIN</Badge>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--color-text)', fontWeight: '600' }}>
                    Select the company to create the supplier
                  </span>
                </div>
                <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 'bold', marginBottom: 'var(--space-xs)', color: 'var(--color-text)' }}>
                  Company *
                </label>
                <select
                  required
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-sm)',
                    backgroundColor: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    border: `1px solid var(--color-border)`,
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <option value="">Select a company...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </Card>
            )}

            <Input type="text" 
              label="Name Completo *"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Supplier XYZ Ltd."
            />
            <Input type="text" 
              label="NIF/NIPC *"
              required
              value={formData.nif}
              onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
              placeholder="Ex: 123456789"
              maxLength={9}
            />
            <Input type="email" 
              label="Email *"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
            />
            <Input
              type="tel"
              label="Phone *"
              required
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="+351 912 345 678"
            />
            <div style={{ gridColumn: '1 / -1' }}>
              <Input type="text" 
                label="Address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, andar"
              />
            </div>
            <Input type="text" 
              label="City"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              placeholder="Ex: Porto"
            />
            <Input type="text" 
              label="País"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              placeholder="Ex: Portugal"
            />
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 'var(--space-md)', justifyContent: 'flex-end', paddingTop: 'var(--space-lg)', borderTop: `1px solid var(--color-border)` }}>
              <Button
                type="button"
                onClick={resetForm}
                variant="ghost"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {editingId ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card style={{ borderWidth: '2px', borderColor: 'var(--color-border)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%' }}>
            <thead style={{ backgroundColor: 'var(--color-surface-hover)' }}>
              <tr>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'left', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>Name</th>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'left', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>NIF</th>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'left', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>Email</th>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'left', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>Phone</th>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'left', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>City</th>
                <th style={{ padding: 'var(--space-lg)', textAlign: 'right', fontSize: 'var(--fs-xs)', fontWeight: '900', color: 'var(--color-brand-red)', textTransform: 'uppercase', letterSpacing: '0.1em', borderBottom: `2px solid var(--color-border)` }}>Actions</th>
              </tr>
            </thead>
            <tbody style={{ borderTop: `1px solid var(--color-border)` }}>
              {suppliers.map((supplier) => (
                <tr key={supplier.id} style={{ borderBottom: `1px solid var(--color-border)` }}>
                  <td style={{ padding: 'var(--space-lg)', fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--color-text)' }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', background: 'linear-gradient(135deg, var(--color-brand-red), var(--color-warning))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}>
                        <span style={{ color: 'white', fontWeight: 'bold', fontSize: 'var(--fs-sm)' }}>
                          {supplier.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div style={{ marginLeft: 'var(--space-md)' }}>
                        <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--color-text)' }}>{supplier.name}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-lg)', fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--color-text)', borderLeft: `1px solid var(--color-border)` }}>{supplier.nif}</td>
                  <td style={{ padding: 'var(--space-lg)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)', borderLeft: `1px solid var(--color-border)` }}>{supplier.email || '-'}</td>
                  <td style={{ padding: 'var(--space-lg)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)', borderLeft: `1px solid var(--color-border)` }}>{supplier.phone || '-'}</td>
                  <td style={{ padding: 'var(--space-lg)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)', borderLeft: `1px solid var(--color-border)` }}>{supplier.city || '-'}</td>
                  <td style={{ padding: 'var(--space-lg)', textAlign: 'right', fontSize: 'var(--fs-sm)', fontWeight: '500', borderLeft: `1px solid var(--color-border)` }}>
                    <button
                      onClick={() => handleEdit(supplier)}
                      style={{ color: 'var(--color-brand-red)', fontWeight: 'bold', marginRight: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer', padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--radius-md)', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(supplier.id)}
                      style={{ color: 'var(--color-error)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)', cursor: 'pointer', padding: 'var(--space-xs) var(--space-sm)', borderRadius: 'var(--radius-md)', transition: 'background-color 0.2s' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        {suppliers.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl)', color: 'var(--color-text-muted)' }}>
            <svg style={{ width: '64px', height: '64px', marginLeft: 'auto', marginRight: 'auto', marginBottom: 'var(--space-md)', opacity: '0.5' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 'bold', color: 'var(--color-text)' }}>{t('noRecords')}</p>
            {activeFilters.length > 0 ? (
              <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-xs)' }}>No suppliers match your filters</p>
            ) : (
              <p style={{ fontSize: 'var(--fs-sm)', marginTop: 'var(--space-xs)' }}>Click "New Supplier" to get started</p>
            )}
          </div>
        )}
      </Card>

      {suppliers.length > 0 && (
        <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)', fontWeight: '500' }}>
          Total: <span style={{ fontWeight: 'bold', color: 'var(--color-text)' }}>{suppliers.length}</span> supplier{suppliers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

export default SupplierList;
