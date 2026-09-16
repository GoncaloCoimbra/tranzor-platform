import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { theme } from '../theme.config';

interface Company {
  id: string;
  name: string;
}

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
  };
}

interface EditGlobalUserModalProps {
  user: User;
  companies: Company[];
  onClose: () => void;
  onSuccess: () => void;
}

const EditGlobalUserModal: React.FC<EditGlobalUserModalProps> = ({
  user,
  companies,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "OPERATOR" as 'ADMIN' | 'OPERATOR',
    companyId: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role === 'SUPER_ADMIN' ? 'ADMIN' : user.role,
        companyId: user.company.id
      });
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.patch(`/superadmin/users/${user.id}`, {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        companyId: formData.companyId
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`${theme.cards.form} w-full max-w-md max-h-[90vh] overflow-y-auto`}>        
        {/* Header */}
        <div className={`sticky top-0 ${theme.backgrounds.header} px-6 py-4 flex items-center justify-between border-b border-slate-700`}>          
          <h2 className="text-2xl font-bold text-white">Edit User</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2" htmlFor="name">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={theme.inputs.base}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2" htmlFor="email">
              Email *
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={theme.inputs.base}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2" htmlFor="companyId">
              Company *
            </label>
            <select
              id="companyId"
              name="companyId"
              value={formData.companyId}
              onChange={handleChange}
              className={theme.inputs.base}
              required
            >
              <option value="">Select Company</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2" htmlFor="role">
              Role *
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              className={theme.inputs.base}
              required
              disabled={user.role === 'SUPER_ADMIN'}
            >
              <option value="OPERATOR">Operator</option>
              <option value="ADMIN">Administrator</option>
            </select>
            {user.role === 'SUPER_ADMIN' && (
              <p className="text-gray-600 text-xs mt-1">Super Administrators cannot have their role changed</p>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-300 hover:text-white font-medium disabled:opacity-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={theme.buttons.primary + " disabled:opacity-50"}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditGlobalUserModal;