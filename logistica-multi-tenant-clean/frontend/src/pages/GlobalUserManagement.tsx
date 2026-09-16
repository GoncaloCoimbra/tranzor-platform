import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';
import CreateGlobalUserModal from '../components/CreateGlobalUserModal';
import EditGlobalUserModal from '../components/EditGlobalUserModal';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme } from '../theme.config';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  createdAt: string;
  company: {
    id: string;
    name: string;
    nif: string;
  } | null; 
}

interface Company {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Administrator',
  OPERATOR: 'Operator'
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-900/30 text-purple-400 border border-purple-700/30',
  ADMIN: 'bg-red-900/30 text-red-400 border border-red-700/30',
  OPERATOR: 'bg-emerald-900/30 text-emerald-400 border border-emerald-700/30'
};

// Helper to safely extract a string message from an error response
const extractErrorMessage = (err: any, fallback: string): string => {
  if (err.response?.data?.message) {
    return typeof err.response.data.message === 'string'
      ? err.response.data.message
      : JSON.stringify(err.response.data.message);
  }
  if (err.response?.data?.error) {
    return typeof err.response.data.error === 'string'
      ? err.response.data.error
      : JSON.stringify(err.response.data.error);
  }
  if (err.message) {
    return String(err.message);
  }
  return fallback;
};

const GlobalUserManagement: React.FC = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [users, setUsers] = useState<User[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [usersResponse, companiesResponse] = await Promise.all([
        api.get('/superadmin/users'),
        api.get('/superadmin/companies')
      ]);
      setUsers(usersResponse.data);
      setCompanies(companiesResponse.data);
    } catch (error) {
      console.error('Error loading date:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDelete = async (user: User) => {
    if (user.role === 'SUPER_ADMIN') {
      alert('Cannot delete a Super Administrator');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the user "${user.name}"?`)) {
      try {
        await api.delete(`/superadmin/users/${user.id}`);
        await loadData();
      } catch (error: any) {
        alert(extractErrorMessage(error, 'Error deleting user'));
      }
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.company?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesCompany = !filterCompany || user.company?.id === filterCompany;
    const matchesRole = !filterRole || user.role === filterRole;

    return matchesSearch && matchesCompany && matchesRole;
  });

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${theme.backgrounds.page}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${theme.backgrounds.page}`}>
      <div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/superadmin-home')}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-white">{t('headerUsers')}</h1>
                <p className="text-sm text-slate-400 mt-1">{users.length} {t('headerUsers').toLowerCase()}</p>
              </div>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className={`${theme.buttons.primary} bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 flex items-center gap-2`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {t('newUser')}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className={`${theme.cards.base} p-4 mb-6 border border-slate-700/50`}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <Input type="text" 
                placeholder={t('searchUser')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`${theme.inputs.base} pl-10 w-full`}
              />
            </div>

            {/* Filter by Company */}
            <select
              value={filterCompany}
              onChange={(e) => setFilterCompany(e.target.value)}
              className={`${theme.inputs.base} w-full`}
            >
              <option value="">{t('allCompanies')}</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>

            {/* Filter by Role */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className={`${theme.inputs.base} w-full`}
            >
              <option value="">{t('allRoles')}</option>
              <option value="ADMIN">{t('administrators')}</option>
              <option value="OPERATOR">{t('operators')}</option>
            </select>
          </div>

          {/* Active Filters */}
          {(searchTerm || filterCompany || filterRole) && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-700/50">
              <span className="text-sm text-slate-400">{t('activeFilters')}</span>
              {searchTerm && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {t('search')}: {searchTerm}
                  <button onClick={() => setSearchTerm('')} className="ml-2 hover:text-slate-200">�</button>
                </span>
              )}
              {filterCompany && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {t('company')}: {companies.find(c => c.id === filterCompany)?.name}
                  <button onClick={() => setFilterCompany('')} className="ml-2 hover:text-slate-200">�</button>
                </span>
              )}
              {filterRole && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                  {t('role')}: {ROLE_LABELS[filterRole]}
                  <button onClick={() => setFilterRole('')} className="ml-2 hover:text-slate-200">�</button>
                </span>
              )}
              <button
                onClick={() => { setSearchTerm(''); setFilterCompany(''); setFilterRole(''); }}
                className="text-sm text-amber-400 hover:text-amber-300 font-medium"
              >
                {t('clearAll')}
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className={theme.cards.stat}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-xl p-3 shadow-lg text-purple-400 border border-purple-500/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{filteredUsers.length}</p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-400">{t('totalUsersLabel')}</p>
          </div>

          <div className={theme.cards.stat}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-gradient-to-br from-red-500/20 to-red-600/20 rounded-xl p-3 shadow-lg text-red-400 border border-red-500/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'ADMIN').length}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-400">{t('administrators')}</p>
          </div>

          <div className={theme.cards.stat}>
            <div className="flex items-center justify-between mb-4">
              <div className="bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 rounded-xl p-3 shadow-lg text-emerald-400 border border-emerald-500/30">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {users.filter(u => u.role === 'OPERATOR').length}
                </p>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-400">{t('operators')}</p>
          </div>
        </div>

        {/* Table */}
        <div className={`${theme.cards.base} border border-slate-700/50 overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('headerUsers')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('company')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('role')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">{t('creationDate')}</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-500">
                        <svg className="w-16 h-16 mb-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <p className="text-lg font-medium text-slate-400">{t('noUsers')}</p>
                        <p className="text-sm text-slate-500">{t('adjustUserFilters')}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-500/20 to-purple-600/20 rounded-full flex items-center justify-center border border-purple-500/30">
                            <span className="text-purple-400 font-bold text-sm">
                              {user.name.substring(0, 2).toUpperCase()}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-white">{user.name}</div>
                            <div className="text-sm text-slate-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.company ? (
                          <>
                            <div className="text-sm text-white font-medium">{user.company.name}</div>
                            <div className="text-sm text-slate-400">NIF: {user.company.nif}</div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500 italic">{t('noCompany')}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${ROLE_COLORS[user.role]}`}>
                          {ROLE_LABELS[user.role]}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {new Date(user.createdAt).toLocaleDateString('en-US')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={t('edit')}
                            disabled={user.role === 'SUPER_ADMIN' || !user.company}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-900/20 rounded disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            title={t('delete')}
                            disabled={user.role === 'SUPER_ADMIN'}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateGlobalUserModal
          companies={companies}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => { loadData(); setShowCreateModal(false); }}
        />
      )}

      {showEditModal && selectedUser && selectedUser.company && (
        <EditGlobalUserModal
          user={selectedUser as User & { company: { id: string; name: string; nif: string } }}
          companies={companies}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSuccess={() => { loadData(); setShowEditModal(false); setSelectedUser(null); }}
        />
      )}

      {/* Footer Status */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-6 border-t border-slate-700/50 mt-8">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span>Global user system</span>
          </div>
          <div>
            <span>Last update: {new Date().toLocaleDateString('en-US')}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalUserManagement;

