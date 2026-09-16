import React, { useState } from 'react';
import api from '../api/api';
import { theme } from '../theme.config';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

interface CreateCompanyModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const CreateCompanyModal: React.FC<CreateCompanyModalProps> = ({ onClose, onSuccess }) => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createAdmin, setCreateAdmin] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    nif: '',
    email: '',
    phone: '',
    address: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload: any = {
        name: formData.name,
        nif: formData.nif,
        email: formData.email,
        phone: formData.phone || null,
        address: formData.address || null,
      };

      if (createAdmin) {
        payload.adminUser = {
          name: formData.adminName,
          email: formData.adminEmail,
          password: formData.adminPassword,
        };
      }

      await api.post('/superadmin/companies', payload);
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error creating company');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.cards.form} max-w-2xl w-full max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col`}>
        {/* Header */}
        <div className={`sticky top-0 ${theme.backgrounds.header} px-6 py-4 flex items-center justify-between border-b border-slate-700`}>          
          <h2 className="text-xl font-bold text-white">{t('createNewCompany')}</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className={theme.alerts.error + " mb-4"}>
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{error}</span>
              </div>
            </div>
          )}

          {/* Company Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">{t('companyInformation')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                  {t('companyName')} *
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={theme.inputs.base}
                  placeholder="e.g. Logistics Company Ltd"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                  {t('taxId')} *
                </label>
                <input
                  type="text"
                  name="nif"
                  value={formData.nif}
                  onChange={handleChange}
                  required
                  maxLength={9}
                  className={theme.inputs.base}
                  placeholder="123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={theme.inputs.base}
                  placeholder="company@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={theme.inputs.base}
                  placeholder="+351 900 000 000"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                  {t('address')}
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className={theme.inputs.base}
                  placeholder="Street, number, postal code, city"
                />
              </div>
            </div>
          </div>

          {/* Admin User Toggle */}
          <div className="mb-6 border-t border-gray-200 pt-6">
            <div className="flex items-center mb-4">
              <input
                type="checkbox"
                id="createAdmin"
                checked={createAdmin}
                onChange={(e) => setCreateAdmin(e.target.checked)}
                className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
              />
              <label htmlFor="createAdmin" className="ml-2 block text-sm font-medium text-white">
                {t('createAdminUser')}
              </label>
            </div>

            {createAdmin && (
              <div className="space-y-4 p-4 rounded-lg bg-[#1e293b]/50">
                <h3 className="text-sm font-semibold text-white mb-3">{t('administratorDetails')}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Name *
                    </label>
                    <input
                      type="text"
                      name="adminName"
                      value={formData.adminName}
                      onChange={handleChange}
                      required={createAdmin}
                      className={theme.inputs.base}
                      placeholder="Administrator name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="adminEmail"
                      value={formData.adminEmail}
                      onChange={handleChange}
                      required={createAdmin}
                      className={theme.inputs.base}
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] dark:text-[#cbd5e1] mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      name="adminPassword"
                      value={formData.adminPassword}
                      onChange={handleChange}
                      required={createAdmin}
                      minLength={6}
                      className={theme.inputs.base}
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className={`${theme.buttons.secondary} border-0`}
            >
              {t('cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`${theme.buttons.primary} flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{t('creating')}</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{t('createCompany')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCompanyModal;
