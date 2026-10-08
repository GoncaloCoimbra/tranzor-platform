import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import UserManagementTable from '../components/UserManagementTable';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme } from '../theme.config';

interface CompanyInfo {
  id: string;
  name: string;
  nif: string;
  address: string | null;
  email: string | null;
  phone: string | null;
}

const Settings: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'company' | 'users'>('company');
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    address: '',
    email: '',
    phone: '',
  });

  const extractErrorMessage = (err: any, fallback: string): string => {
    return err.response?.data?.message || err.message || fallback;
  };

  const loadCompanyInfo = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.get('/companies/info');
      setCompanyInfo(response.data);
      setFormData({
        name: response.data.name || '',
        nif: response.data.nif || '',
        address: response.data.address || '',
        email: response.data.email || '',
        phone: response.data.phone || '',
      });
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Error loading company information'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      setLoading(false);
      return;
    }
    loadCompanyInfo();
  }, [loadCompanyInfo, user?.role]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // ? PATCH /companies/:id � correct endpoint
      await api.patch(`/companies/${companyInfo?.id}`, formData);
      setSuccess('Information updated successfully!');
      await loadCompanyInfo();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(extractErrorMessage(err, 'Error updating information'));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const isAdmin = user?.role === 'ADMIN';

  if (loading) {
    return (
      <div className={`${theme.backgrounds.page} min-h-screen flex items-center justify-center`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#dc2626] mx-auto mb-4"></div>
          <p className="text-[#cbd5e1] font-medium">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={theme.backgrounds.page}>
      {/* Header */}
      <div className={theme.backgrounds.header}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-white">Settings</h1>
          <p className="text-sm text-[#cbd5e1] mt-1">
            Manage company information and users
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-[#334155]/50 mb-8 bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-t-lg px-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('company')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'company'
                  ? 'border-[#dc2626] text-[#dc2626]'
                  : 'border-transparent text-[#64748b] hover:text-[#cbd5e1] hover:border-[#334155]'
              }`}
            >
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <span>Company Information</span>
              </div>
            </button>

            {isAdmin && (
              <button
                onClick={() => setActiveTab('users')}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'users'
                    ? 'border-[#dc2626] text-[#dc2626]'
                    : 'border-transparent text-[#64748b] hover:text-[#cbd5e1] hover:border-[#334155]'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <span>User Management</span>
                </div>
              </button>
            )}
          </nav>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className={theme.alerts.success}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{success}</span>
            </div>
          </div>
        )}

        {error && (
          <div className={theme.alerts.error}>
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Tab Content */}
        {activeTab === 'company' && (
          <div className={theme.cards.form}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                    Company Name *
                  </label>
                  <Input type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    required
                    className={isAdmin ? theme.inputs.base : theme.inputs.disabled}
                  />
                </div>

                {/* NIF */}
                <div>
                  <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                    Tax ID *
                  </label>
                  <Input type="text"
                    name="nif"
                    value={formData.nif}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    required
                    maxLength={9}
                    pattern="[0-9]{9}"
                    title="Tax ID must have 9 digits"
                    className={isAdmin ? theme.inputs.base : theme.inputs.disabled}
                  />
                  <p className="text-xs text-[#64748b] mt-1">9 digits</p>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                    Email
                  </label>
                  <Input type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    className={isAdmin ? theme.inputs.base : theme.inputs.disabled}
                    placeholder="company@example.com"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    className={isAdmin ? theme.inputs.base : theme.inputs.disabled}
                    placeholder="+351 XXX XXX XXX"
                  />
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                    Address
                  </label>
                  <Input type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    className={isAdmin ? theme.inputs.base : theme.inputs.disabled}
                    placeholder="Street, Number, Postal Code, City"
                  />
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-end pt-4 border-t border-[#334155]/50">
                  <button
                    type="submit"
                    disabled={saving}
                    className={`${theme.buttons.primary} flex items-center space-x-2`}
                  >
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {!isAdmin && (
                <div className={theme.alerts.warning}>
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">Only administrators can edit company information</span>
                  </div>
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'users' && isAdmin && (
          <div className={theme.cards.form}>
            <UserManagementTable />
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
