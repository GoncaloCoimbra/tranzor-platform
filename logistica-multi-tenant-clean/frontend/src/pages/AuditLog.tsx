import React, { useState, useEffect } from 'react';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';
import api from '../api/api';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import { Button, Input, Card, Badge, Alert } from '../components/common';

interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  ipAddress: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface AuditStats {
  totalActions: number;
  actionsByType: { action: string; count: number }[];
  actionsByEntity: { entity: string; count: number }[];
  topUsers: { userId: string; userName: string; userEmail: string; count: number }[];
}

const AuditLog: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Confirmation dialog for clearing logs
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearingLogs, setClearingLogs] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearSuccess, setClearSuccess] = useState(false);

  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    entity: '',
  });

  useEffect(() => {
    loadData();
  }, [page, filters]);

  const loadData = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '')
        ),
      });

      const [logsRes, statsRes] = await Promise.all([
        api.get(`/audit-log?${params}`),
        api.get('/audit-log/stats'),
      ]);

      setLogs(logsRes.data.logs || []);
      setTotalPages(logsRes.data.pagination?.totalPages || 1);
      setStats(statsRes.data || null);
    } catch (error) {
      console.error('Error loading date:', error);
      // Set default values on error
      setLogs([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLog = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record from history?')) return;
    try {
      await api.delete(`/audit-log/${id}`);
      setLogs(prev => prev.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting record:', error);
      alert('Error deleting record from history');
    }
  };

  const handleClearAllLogs = async () => {
    setClearingLogs(true);
    setClearError(null);

    try {
      await api.post('/audit-log/clear-all');
      setLogs([]);
      setStats(prev => prev ? { ...prev, totalActions: 0 } : null);
      setClearSuccess(true);
      setShowClearModal(false);
      
      // Clear success message after 4 seconds
      setTimeout(() => setClearSuccess(false), 4000);
    } catch (error: any) {
      console.error('Error clearing history:', error);
      
      // Garantir que errorMsg � sempre uma string
      let errorMsg = 'Error clearing history. Please try again later.';
      
      if (error.response?.data) {
        const date = error.response.data;
        if (typeof date.message === 'string') {
          errorMsg = date.message;
        } else if (typeof date.error === 'string') {
          errorMsg = date.error;
        } else if (typeof date === 'string') {
          errorMsg = date;
        }
      } else if (typeof error.message === 'string') {
        errorMsg = error.message;
      }
      
      setClearError(errorMsg);
    } finally {
      setClearingLogs(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      userId: '',
      action: '',
      entity: '',
    });
    setPage(1);
  };

  const getActionBadge = (action: string) => {
    const actionConfig: Record<string, { color: string; label: string }> = {
      CREATE: { 
        color: 'bg-gradient-to-r from-emerald-900/40 to-emerald-800/30 text-emerald-300 border-emerald-500/30',
        label: 'Create'
      },
      UPDATE: { 
        color: 'bg-gradient-to-r from-amber-900/40 to-amber-800/30 text-amber-300 border-amber-500/30',
        label: 'Update'
      },
      DELETE: { 
        color: 'bg-gradient-to-r from-red-900/40 to-red-800/30 text-red-300 border-red-500/30',
        label: 'Delete'
      },
      LOGIN: { 
        color: 'bg-gradient-to-r from-red-900/40 to-red-800/30 text-red-300 border-red-500/30',
        label: 'Login'
      },
      LOGOUT: { 
        color: 'bg-gradient-to-r from-gray-900/40 to-gray-800/30 text-gray-300 border-gray-500/30',
        label: 'Logout'
      },
      RECEIVE: { 
        color: 'bg-gradient-to-r from-purple-900/40 to-purple-800/30 text-purple-300 border-purple-500/30',
        label: 'Receive'
      },
      DISPATCH: { 
        color: 'bg-gradient-to-r from-indigo-900/40 to-indigo-800/30 text-indigo-300 border-indigo-500/30',
        label: 'Send'
      },
      APPROVE: { 
        color: 'bg-gradient-to-r from-green-900/40 to-green-800/30 text-green-300 border-green-500/30',
        label: 'Approve'
      },
      REJECT: { 
        color: 'bg-gradient-to-r from-orange-900/40 to-orange-800/30 text-orange-300 border-orange-500/30',
        label: 'Reject'
      },
      CANCEL: { 
        color: 'bg-gradient-to-r from-slate-900/40 to-slate-800/30 text-slate-300 border-slate-500/30',
        label: 'Cancel'
      },
    };

    const config = actionConfig[action] || { 
      color: 'bg-gradient-to-r from-gray-900/40 to-gray-800/30 text-gray-300 border-gray-500/30',
      label: action
    };

    return (
      <span className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getActionIcon = (action: string) => {
    const iconConfig: Record<string, { gradient: string; borderColor: string; textColor: string; path: JSX.Element }> = {
      CREATE: {
        gradient: 'from-emerald-900/30 to-emerald-900/20',
        borderColor: 'border-emerald-500/30',
        textColor: 'text-emerald-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      },
      UPDATE: {
        gradient: 'from-amber-900/30 to-amber-900/20',
        borderColor: 'border-amber-500/30',
        textColor: 'text-amber-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      },
      DELETE: {
        gradient: 'from-red-900/30 to-red-900/20',
        borderColor: 'border-red-500/30',
        textColor: 'text-red-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      },
      RECEIVE: {
        gradient: 'from-purple-900/30 to-purple-900/20',
        borderColor: 'border-purple-500/30',
        textColor: 'text-purple-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      },
      DISPATCH: {
        gradient: 'from-indigo-900/30 to-indigo-900/20',
        borderColor: 'border-indigo-500/30',
        textColor: 'text-indigo-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      },
      APPROVE: {
        gradient: 'from-green-900/30 to-green-900/20',
        borderColor: 'border-green-500/30',
        textColor: 'text-green-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      },
      REJECT: {
        gradient: 'from-orange-900/30 to-orange-900/20',
        borderColor: 'border-orange-500/30',
        textColor: 'text-orange-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      },
      CANCEL: {
        gradient: 'from-slate-900/30 to-slate-900/20',
        borderColor: 'border-slate-500/30',
        textColor: 'text-slate-400',
        path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
      },
    };

    const config = iconConfig[action] || {
      gradient: 'from-[#1e293b]/50 to-[#0f172a]/50',
      borderColor: 'border-[#dc2626]/30',
      textColor: 'text-[#dc2626]',
      path: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    };

    return (
      <div className={`bg-gradient-to-br ${config.gradient} border ${config.borderColor} rounded-lg p-3`}>
        <svg className={`w-5 h-5 ${config.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {config.path}
        </svg>
      </div>
    );
  };

  if (loading && page === 1) {
    return (
      <div className="loading-page flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="loading-message mt-4">{t('loadingHistory')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page operations-page min-h-screen">
      <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">{t('history')}</h1>
        <p className="mt-2 text-amber-300/70">Complete record of all actions performed in the system</p>

      {/* Clear All Button */}
      {logs.length > 0 && (
        <div className="mb-6 flex justify-end">
          <button
            onClick={() => setShowClearModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-red-900/40 to-red-800/30 text-red-300 border border-red-500/30 rounded-lg hover:from-red-900/60 hover:to-red-800/50 hover:text-red-200 transition-all font-medium text-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Clear All History
          </button>
        </div>
      )}
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-amber-300">Total Actions</p>
                <p className="text-2xl font-bold text-white">{stats.totalActions}</p>
              </div>
              <div className="bg-gradient-to-br from-amber-900/30 to-amber-900/20 border border-amber-500/30 rounded-lg p-3">
                <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
            </div>
          </div>

          {stats.actionsByType?.slice(0, 3).map((item, index) => (
            <div key={index} className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-amber-300">{getActionBadge(item.action)}</p>
                  <p className="text-2xl font-bold text-white mt-2">{item.count}</p>
                </div>
                {getActionIcon(item.action)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Filters</h2>
          <button
            onClick={clearFilters}
            className="text-sm text-amber-400 hover:text-amber-300 font-medium hover:bg-amber-900/30 px-4 py-2 rounded-lg transition-all border border-amber-500/30"
          >
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-amber-300 mb-2">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-300 mb-2">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-300 mb-2">Action</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white"
            >
              <option value="" className="bg-[#1e293b]">All</option>
              <option value="CREATE" className="bg-[#1e293b]">Create</option>
              <option value="UPDATE" className="bg-[#1e293b]">Update</option>
              <option value="DELETE" className="bg-[#1e293b]">Delete</option>
              <option value="LOGIN" className="bg-[#1e293b]">Login</option>
              <option value="LOGOUT" className="bg-[#1e293b]">Logout</option>
              <option value="RECEIVE" className="bg-[#1e293b]">Receive</option>
              <option value="DISPATCH" className="bg-[#1e293b]">Send</option>
              <option value="APPROVE" className="bg-[#1e293b]">Approve</option>
              <option value="REJECT" className="bg-[#1e293b]">Reject</option>
              <option value="CANCEL" className="bg-[#1e293b]">Cancel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-300 mb-2">Entity</label>
            <select
              value={filters.entity}
              onChange={(e) => handleFilterChange('entity', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white"
            >
              <option value="" className="bg-[#1e293b]">All</option>
              <option value="User" className="bg-[#1e293b]">Users</option>
              <option value="Product" className="bg-[#1e293b]">Products</option>
              <option value="Supplier" className="bg-[#1e293b]">Suppliers</option>
              <option value="Vehicle" className="bg-[#1e293b]">Vehicles</option>
              <option value="Transport" className="bg-[#1e293b]">Transports</option>
              <option value="Company" className="bg-[#1e293b]">Company</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-amber-300 mb-2">User</label>
            <Input type="text" 
              placeholder="User ID"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              className="w-full px-4 py-2.5 bg-[#1e293b]/50 border border-amber-500/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 text-white placeholder-amber-300/50"
            />
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-amber-500/10">
            <thead className="bg-gradient-to-r from-amber-900/30 to-amber-900/20">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-amber-300 uppercase tracking-wider">Action</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-amber-300 uppercase tracking-wider">Entity</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-amber-300 uppercase tracking-wider">User</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-amber-300 uppercase tracking-wider">IP</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-amber-300 uppercase tracking-wider">Date/Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/10">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <svg className="w-12 h-12 text-amber-500/30 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <p className="text-amber-300/70">{t('noRecords')}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-amber-900/10 transition-all">
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{log.entity}</div>
                      <div className="text-xs text-amber-300/70 mt-1 bg-amber-900/30 px-2 py-1 rounded inline-block border border-amber-500/20">
                        {log.entityId ? `${log.entityId.substring(0, 8)}...` : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-white">{log.user.name}</div>
                      <div className="text-xs text-amber-300/70">{log.user.email}</div>
                      <div className="text-xs text-amber-400/70 mt-1 bg-amber-900/30 px-2 py-1 rounded inline-block border border-amber-500/20">
                        {log.user.role}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-amber-300 bg-amber-900/30 px-3 py-1.5 rounded border border-amber-500/20 inline-block">
                        {log.ipAddress || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-300">
                      <div className="flex items-center justify-between gap-4">
                        <div>{new Date(log.createdAt).toLocaleString('en-US')}</div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            title="Delete record"
                            className="text-red-400 hover:text-red-300 transition-colors p-1 hover:bg-red-900/20 rounded"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="bg-gradient-to-r from-amber-900/30 to-amber-900/20 px-6 py-4 flex items-center justify-between border-t border-amber-500/30">
            <div className="text-sm text-amber-300">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-900/20 hover:text-amber-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 text-amber-300 border border-amber-500/30 rounded-lg hover:bg-amber-900/20 hover:text-amber-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Additional Statistics */}
      {stats && ((stats.actionsByEntity && stats.actionsByEntity.length > 0) || (stats.topUsers && stats.topUsers.length > 0)) && (
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {stats.actionsByEntity && stats.actionsByEntity.length > 0 && (
            <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Actions by Entity</h3>
              <div className="space-y-3">
                {stats.actionsByEntity.slice(0, 5).map((item, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span style={{ color: 'var(--color-text-muted)' }}>{item.entity}</span>
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-900/40 to-amber-800/30 text-amber-300 rounded-full text-sm font-medium border border-amber-500/30">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.topUsers && stats.topUsers.length > 0 && (
            <div className="bg-gradient-to-br from-[#1e293b]/80 to-[#0f172a]/80 rounded-xl shadow-2xl border border-amber-500/30 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top Users</h3>
              <div className="space-y-3">
                {stats.topUsers.slice(0, 5).map((user, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <div style={{ color: 'var(--color-text)' }}>{user.userName}</div>
                      <div className="text-xs text-amber-300/70">{user.userEmail}</div>
                    </div>
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-900/40 to-amber-800/30 text-amber-300 rounded-full text-sm font-medium border border-amber-500/30">
                      {user.count} actions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Clear History Confirmation Modal */}
      {showClearModal && (
        <>
          <div 
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => !clearingLogs && setShowClearModal(false)}
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
                  <h3 className="text-xl font-bold text-white">Delete All History</h3>
                </div>

                <p className="text-amber-200 mb-4">
                  Are you sure you want to DELETE <strong>ALL HISTORY</strong>?<br />
                  <br />
                  <span style={{ color: '#f87171' }}>This action is irreversible</span> and will remove <strong style={{ color: 'var(--color-text)' }}>{logs.length} records</strong>.
                </p>

                {clearError && (
                  <div className="bg-red-900/30 border-2 border-red-500/50 rounded-lg p-3 mb-4">
                    <p className="text-red-300 text-sm">{clearError}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowClearModal(false)}
                    disabled={clearingLogs}
                    className="flex-1 px-4 py-3 border-2 border-amber-500/50 text-amber-400 rounded-lg hover:bg-amber-900/20 transition-all font-bold disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleClearAllLogs}
                    disabled={clearingLogs}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {clearingLogs ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete All
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Success Message */}
      {clearSuccess && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-green-600 to-green-700 text-white px-6 py-3 rounded-lg shadow-2xl flex items-center gap-3 border border-green-400/50">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>History cleared successfully!</span>
        </div>
      )}
      </div>
    </div>
  );
};

export default AuditLog;


