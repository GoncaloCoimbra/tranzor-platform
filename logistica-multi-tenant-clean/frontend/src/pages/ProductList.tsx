import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProducts } from '../hooks/useProducts';
import { getStatusBadgeClass, statusLabels } from '../theme.config';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import FilterSelector from '../components/FilterSelector';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

const ProductList: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const { activeFilters, addFilter, removeFilter, clearAllFilters, getFilter } = useFilters();

  const [searchTerm, setSearchTerm] = useState(getFilter('search'));
  const [statusFilter, setStatusFilter] = useState(getFilter('status'));
  const [filterLocation, setFilterLocation] = useState(getFilter('location'));
  const [filterDateFrom, setFilterDateFrom] = useState(getFilter('dateFrom'));
  const [filterDateTo, setFilterDateTo] = useState(getFilter('dateTo'));

  const filters = useMemo(() => ({
    search: searchTerm,
    status: statusFilter,
    location: filterLocation,
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
  }), [searchTerm, statusFilter, filterLocation, filterDateFrom, filterDateTo]);

  interface Product {
    id: string;
    internalCode: string;
    description: string;
    quantity: number;
    unit: string;
    status: string;
    supplier?: { id: string; name: string; nif: string };
    currentLocation?: string;
    createdAt: string;
    updatedAt: string;
  }

  const { data: products = [], isLoading: loading, error } = useProducts(filters) as { data?: Product[]; isLoading: boolean; error?: unknown };

  useEffect(() => {
    console.log('[ProductList] Current state:', {
      loading,
      error: error instanceof Error ? error.message : JSON.stringify(error),
      productsCount: products.length,
      products: products,
      filters: filters,
    });
  }, [products, loading, error, filters]);

  const handleProductClick = (productId: string) => {
    navigate(`/products/${productId}`);
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (value) {
      addFilter('search', value);
    } else {
      removeFilter('search');
    }
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    if (value) {
      addFilter('status', value);
    } else {
      removeFilter('status');
    }
  };

  const handleLocationChange = (value: string) => {
    setFilterLocation(value);
    if (value) {
      addFilter('location', value);
    } else {
      removeFilter('location');
    }
  };

  const handleDateFromChange = (value: string) => {
    setFilterDateFrom(value);
    if (value) {
      addFilter('dateFrom', value);
    } else {
      removeFilter('dateFrom');
    }
  };

  const handleDateToChange = (value: string) => {
    setFilterDateTo(value);
    if (value) {
      addFilter('dateTo', value);
    } else {
      removeFilter('dateTo');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 'var(--space-2xl)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '256px' }}>
          <div style={{ animation: 'spin 1s linear infinite', width: '32px', height: '32px', borderRadius: '50%', borderTop: '2px solid var(--color-brand-red)' }}></div>
          <span style={{ marginLeft: 'var(--space-md)', color: 'var(--color-text-muted)' }}>{t('loadingProducts')}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 'var(--space-2xl)', minHeight: '100vh', backgroundColor: 'var(--color-surface)' }}>
        <Alert type="error" title="Erro ao carregar" message={(error as any)?.message || 'Falha na conexão'} />
      </div>
    );
  }

  return (
    <div className="products-page" style={{ padding: 'var(--space-lg)', minHeight: '100vh', backgroundColor: '#111827', color: 'var(--color-text)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-lg)', padding: '0 var(--space-md)' }}>
        <h1 style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'bold', color: 'var(--color-text)' }}>{t('products')}</h1>
        <Button variant="primary" onClick={() => navigate('/products/new')}>+ {t('newProduct')}</Button>
      </div>

      <FilterChips filters={activeFilters} onRemove={removeFilter} onClearAll={clearAllFilters} />

      <Card style={{ marginBottom: 'var(--space-lg)' }} header={<h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: '600' }}>{t('advancedFilters')}</h2>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)' }}>
          <Input label={t('location')} placeholder="Ex: Aisle A" value={filterLocation} onChange={(e) => handleLocationChange(e.target.value)} />
          <Input label={t('fromDate')} type="date" value={filterDateFrom} onChange={(e) => handleDateFromChange(e.target.value)} />
          <Input label={t('toDate')} type="date" value={filterDateTo} onChange={(e) => handleDateToChange(e.target.value)} />
        </div>
      </Card>

      <Card style={{ marginBottom: 'var(--space-lg)' }} header={<h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: '600' }}>{t('searchAndStatus')}</h2>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)' }}>
          <Input label={t('search')} placeholder={t('searchProduct')} value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)} />
          <div>
            <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: '500', marginBottom: 'var(--space-sm)', color: 'var(--color-text-muted)' }}>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: 'var(--fs-sm)',
                fontFamily: 'var(--font-body)',
              }}
            >
              <option value="">{t('allStatuses')}</option>
              {Object.entries(statusLabels.product).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card style={{ marginBottom: 'var(--space-lg)' }} header={<h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: '600' }}>{t('products')}</h2>}>
        {products.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
            <p style={{ fontSize: 'var(--fs-lg)', fontWeight: '600', marginBottom: 'var(--space-md)', color: 'var(--color-text-muted)' }}>{t('noProducts')}</p>
            {activeFilters.length === 0 && (
              <Button variant="secondary" onClick={() => navigate('/products/new')}>{t('createFirstProduct')}</Button>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>{t('code')}</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>Descrição</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>{t('unitQuantity')}</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>Fornecedor</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>Status</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>{t('location')}</th>
                  <th style={{ padding: 'var(--space-md)', textAlign: 'left', fontSize: 'var(--fs-sm)', fontWeight: '600', color: 'var(--color-text-muted)' }}>Data</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product: Product) => (
                  <tr
                    key={product.id}
                    onClick={() => handleProductClick(product.id)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--color-border)',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-surface-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', fontWeight: '500', color: 'var(--color-text)' }}>{product.internalCode}</td>
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>{product.description}</td>
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>{product.quantity} {product.unit}</td>
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>{product.supplier?.name || '—'}</td>
                    <td style={{ padding: 'var(--space-md)' }}>
                      <Badge variant={product.status === 'active' ? 'success' : 'warning'}>{statusLabels.product[product.status] || product.status}</Badge>
                    </td>
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>{product.currentLocation || '—'}</td>
                    <td style={{ padding: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text)' }}>{new Date(product.createdAt).toLocaleDateString('pt-PT')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--fs-sm)', color: 'var(--color-text-muted)' }}>
        {t('showingProducts')} {products.length} {products.length !== 1 ? t('productsLower') : t('product')}
      </div>
    </div>
  );
};

export default ProductList;