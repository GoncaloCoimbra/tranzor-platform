import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme } from '../theme.config';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

interface GlobalStats {
  totalCompanies: number;
  totalUsers: number;
  totalProducts: number;
  totalSuppliers: number;
  totalVehicles: number;
  topCompanies: Array<{
    id: string;
    name: string;
    _count: {
      users: number;
      products: number;
      suppliers: number;
    };
  }>;
}

const SuperAdminHome: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [stats, setStats] = useState<GlobalStats>({
    totalCompanies: 0,
    totalUsers: 0,
    totalProducts: 0,
    totalSuppliers: 0,
    totalVehicles: 0,
    topCompanies: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await api.get('/superadmin/stats');
      setStats(response.data);
    } catch (error: any) {
      console.error('Error loading statistics:', error);
      
      let errorMessage = '';
      
      if (error.response?.status === 404) {
        errorMessage = 'Statistics route not found in backend. Please implement the /superadmin/stats endpoint';
      } else if (error.response?.data?.message && typeof error.response.data.message === 'string') {
        errorMessage = error.response.data.message;
      } else if (error.response?.data?.error && typeof error.response.data.error === 'string') {
        errorMessage = error.response.data.error;
      } else if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
      } else {
        errorMessage = 'Error loading system statistics';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.backgrounds.page}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto mb-4"></div>
          <p className="text-slate-300 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main Content - SuperAdmin Dashboard with dark theme */}
      <main className={`flex-1 ${theme.backgrounds.page}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Show error as warning, do not block dashboard */}
          {error && (
            <div className="mb-6 bg-red-950/40 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-start">
                <svg className="w-6 h-6 text-red-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-red-400">{t('systemWarning')}</h3>
                  <p className="mt-1 text-sm text-red-200">{error}</p>
                  <button
                    onClick={loadStats}
                    className="mt-3 text-sm text-red-400 hover:text-red-300 font-medium underline"
                  >
                    {t('tryLoadingAgain')}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            {/* Total Companies */}
            <div className={theme.cards.stat}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-red-950/40 rounded-xl p-3 shadow-lg text-red-400 border border-red-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats.totalCompanies}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300">{t('totalCompanies')}</p>
            </div>

            {/* Total Users */}
            <div className={theme.cards.stat}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl p-3 shadow-lg text-red-400 border border-red-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300">{t('totalUsers')}</p>
            </div>

            {/* Total Products */}
            <div className={theme.cards.stat}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-3 shadow-lg text-emerald-400 border border-emerald-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats.totalProducts}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300">{t('totalProducts')}</p>
            </div>

            {/* Total Suppliers */}
            <div className={theme.cards.stat}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-xl p-3 shadow-lg text-orange-400 border border-orange-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats.totalSuppliers}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300">{t('totalSuppliers')}</p>
            </div>

            {/* Total Vehicles */}
            <div className={theme.cards.stat}>
              <div className="flex items-center justify-between mb-4">
                <div className="bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 rounded-xl p-3 shadow-lg text-indigo-400 border border-indigo-500/30">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-white">{stats.totalVehicles}</p>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-300">{t('totalVehicles')}</p>
            </div>
          </div>

          {/* Top 5 Companies */}
          <div className={`${theme.cards.base} mb-8`}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-white">{t('topCompanies')}</h3>
              <button
                onClick={() => navigate('/companies')}
                className="text-sm text-red-400 hover:text-red-300 font-medium flex items-center gap-1 transition-colors"
              >
                {t('viewAll')}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {stats.topCompanies.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-slate-700 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <p className="text-slate-400 font-medium mb-2">
                  {error ? t('companiesLoadError') : t('noCompaniesRegistered')}
                </p>
                <button
                  onClick={() => navigate('/companies')}
                  className="text-sm text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  {t('addCompany')} →
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.topCompanies.map((company, index) => (
                  <div
                    key={company.id}
                    className="flex items-center justify-between p-4 hover:bg-slate-800/30 rounded-lg transition-colors cursor-pointer border border-slate-700/50"
                  >
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-full border border-purple-500/30">
                        <span className="text-purple-400 font-bold text-sm">#{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-white">{company.name}</p>
                        <div className="flex items-center gap-4 mt-2">
                          <span className="text-xs text-slate-400">
                            {company._count.users} {t('userCount')}
                          </span>
                          <span className="text-xs text-slate-400">
                            {company._count.products} {t('productCount')}
                          </span>
                          <span className="text-xs text-slate-400">
                            {company._count.suppliers} {t('supplierCount')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-900/30 text-purple-400 border border-purple-500/30">
                        {company._count.products} {t('productCount')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            {/* Company Management */}
            <div className="bg-gradient-to-br from-red-600/20 to-red-700/20 rounded-xl border border-red-500/30 p-6 hover:border-red-400/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('companyQuickTitle')}</h3>
                  <p className="text-red-300 text-sm">
                    {t('companyQuickText')}
                  </p>
                </div>
                <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => navigate('/companies')}
                className={`${theme.buttons.primary} bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 w-full`}
              >
                {t('accessManagementArrow')}
              </button>
            </div>

            {/* User Management */}
            <div className="bg-red-950/20 rounded-xl border border-red-500/30 p-6 hover:border-red-400/50 transition-all">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{t('userManagement')}</h3>
                  <p className="text-red-200 text-sm">
                    {language === 'pt' ? 'Gerir utilizadores de todas as empresas do sistema' : language === 'es' ? 'Gestionar usuarios de todas las empresas del sistema' : 'Manage users from all companies in the system'}
                  </p>
                </div>
                <div className="bg-red-500/20 rounded-lg p-3 border border-red-500/30">
                  <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
              </div>
              <button
                onClick={() => navigate('/users')}
                className={`${theme.buttons.primary} bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 w-full`}
              >
                {t('accessManagement')}
              </button>
            </div>
          </div>

          {/* Footer Status */}
          <div className="mt-8 pt-6 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span>{t('systemRunning')}</span>
              </div>
              <div>
                <span>{t('lastUpdate')}: {new Date().toLocaleDateString(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : 'en-US')}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export default SuperAdminHome;

