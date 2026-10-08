import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import { Button, Input, Card, Badge, Alert } from '../components/common';

interface Referral {
  id: string;
  clientName: string;
  contactInfo: string;
  referralSource: string;
  status: 'new' | 'contacted' | 'converted' | 'lost';
  projectType: 'freight' | 'logistics' | 'storage' | 'customs' | 'other';
  estimatedValue: number;
  referralDate: string;
  notes?: string;
  referredBy: string;
  commission?: number;
  companyId: string;
}

interface User {
  id: string;
  companyId: string;
  role: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
}

const Referrals: React.FC = () => {
  const { user, updateUserData } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [referrals, setReferrals] = useState<Referral[]>([]);

  const [loadingReferrals, setLoadingReferrals] = useState<boolean>(false);
  const [referralsError, setReferralsError] = useState<string>('');
  const [creatingSamples, setCreatingSamples] = useState<boolean>(false);
  const [sampleMessage, setSampleMessage] = useState<string>('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [referralToDelete, setReferralToDelete] = useState<string | null>(null);

  const [creatingReferral, setCreatingReferral] = useState<boolean>(false);
  const [editingReferral, setEditingReferral] = useState<boolean>(false);
  const [deletingReferralLoading, setDeletingReferralLoading] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    clientName: '',
    contactInfo: '',
    referralSource: '',
    status: 'new' as Referral['status'],
    projectType: 'freight' as Referral['projectType'],
    estimatedValue: 0,
    referralDate: new Date().toISOString().split('T')[0],
    notes: '',
    referredBy: '',
    commission: 0,
  });

  const loadReferrals = useCallback(async () => {
    try {
      setLoadingReferrals(true);
      setReferralsError('');
      setSampleMessage('');

      try {
        const cRes = await api.get('/companies/public');
        setCompanies(Array.isArray(cRes.data) ? cRes.data : []);
        if (cRes.data && cRes.data.length > 0 && !selectedCompanyId) setSelectedCompanyId(cRes.data[0].id);
      } catch (e) {
        console.warn('Could not load companies/public:', e);
      }

      const params = new URLSearchParams();
      if (user?.role === 'SUPER_ADMIN') {
        if (selectedCompanyId) params.set('companyId', selectedCompanyId);
      } else if (user?.companyId) {
        params.set('companyId', user.companyId);
      }

      const rRes = await api.get(`/referrals?${params.toString()}`);
      setReferrals(Array.isArray(rRes.data) ? rRes.data : []);
    } catch (err) {
      console.error('Error loading referrals from backend:', err);
      setReferralsError('Live date unavailable. Enable the backend or use sample date.');
    } finally {
      setLoadingReferrals(false);
    }
  }, [selectedCompanyId, user]);

  const toggleAdminMode = () => {
    if (!user || !updateUserData) return;
    const newRole = user.role === 'SUPER_ADMIN' ? 'ADMIN' : 'SUPER_ADMIN';
    updateUserData({ role: newRole });
  };

  useEffect(() => {
    loadReferrals();
  }, [loadReferrals]);

  const filteredReferrals = referrals.filter(referral => {
    if (user?.role === 'SUPER_ADMIN') {
      return !selectedCompanyId || referral.companyId === selectedCompanyId;
    } else {
      return referral.companyId === user?.companyId;
    }
  });

  const createSampleReferrals = async () => {
    if (!window.confirm('Create 3 sample referrals?')) return;

    let targetCompanyId = '';
    if (user?.role === 'SUPER_ADMIN') {
      if (!selectedCompanyId) { alert('Please select a company first.'); return; }
      targetCompanyId = selectedCompanyId;
    } else {
      targetCompanyId = user?.companyId || '';
    }

    try {
      setCreatingSamples(true);
      setReferralsError('');

      const newSamples: Referral[] = [
        {
          id: `ref-${Date.now()}-1`,
          clientName: 'New Company X',
          contactInfo: 'companyx@example.com | +351 911 111 111',
          referralSource: 'Recommendation',
          status: 'new',
          projectType: 'freight',
          estimatedValue: 1500,
          referralDate: new Date().toISOString().split('T')[0],
          notes: 'New sample referral',
          referredBy: 'Peter Alves',
          commission: calculateCommission(1500),
          companyId: targetCompanyId
        },
        {
          id: `ref-${Date.now()}-2`,
          clientName: 'New Company Y',
          contactInfo: 'companyy@example.com | +351 922 222 222',
          referralSource: 'Partner',
          status: 'contacted',
          projectType: 'logistics',
          estimatedValue: 4200,
          referralDate: new Date().toISOString().split('T')[0],
          notes: 'Sample referral for logistics',
          referredBy: 'Sofia Martins',
          commission: calculateCommission(4200),
          companyId: targetCompanyId
        },
        {
          id: `ref-${Date.now()}-3`,
          clientName: 'New Company Z',
          contactInfo: 'companyz@example.com | +351 933 333 333',
          referralSource: 'Client',
          status: 'new',
          projectType: 'storage',
          estimatedValue: 900,
          referralDate: new Date().toISOString().split('T')[0],
          notes: 'Sample for storage',
          referredBy: 'Rui Fernandes',
          commission: calculateCommission(900),
          companyId: targetCompanyId
        }
      ];

      await new Promise(resolve => setTimeout(resolve, 1000));
      setReferrals(prev => [...prev, ...newSamples]);
      setSampleMessage('3 sample referrals created successfully!');

    } catch (err) {
      console.error('Error creating samples:', err);
      setReferralsError('Failed to create sample referrals.');
    } finally {
      setCreatingSamples(false);
      setTimeout(() => setSampleMessage(''), 6000);
    }
  };

  const handleCreateReferral = async () => {
    if (!formData.clientName || !formData.contactInfo || !formData.referredBy) {
      alert('Please fill in all required fields!');
      return;
    }

    let targetCompanyId = '';
    if (user?.role === 'SUPER_ADMIN') {
      if (!selectedCompanyId) { alert('Please select a company first.'); return; }
      targetCompanyId = selectedCompanyId;
    } else {
      targetCompanyId = user?.companyId || 'company-1';
    }

    const newReferral: Referral = {
      id: `ref-${Date.now()}`,
      clientName: formData.clientName,
      contactInfo: formData.contactInfo,
      referralSource: formData.referralSource,
      status: formData.status,
      projectType: formData.projectType,
      estimatedValue: formData.estimatedValue,
      referralDate: formData.referralDate,
      notes: formData.notes,
      referredBy: formData.referredBy,
      commission: formData.commission || calculateCommission(formData.estimatedValue),
      companyId: targetCompanyId
    };

    try {
      setCreatingReferral(true);
      setReferralsError('');
      await new Promise(resolve => setTimeout(resolve, 500));
      setReferrals(prev => [...prev, newReferral]);
      setSampleMessage('Referral created successfully!');
    } catch (err) {
      console.error('Error creating referral:', err);
      setReferralsError('Failed to create referral.');
    } finally {
      setCreatingReferral(false);
      setShowCreateModal(false);
      resetForm();
      setTimeout(() => setSampleMessage(''), 5000);
    }
  };

  const handleEditReferral = async () => {
    if (!formData.clientName || !formData.contactInfo || !formData.referredBy) {
      alert('Please fill in all required fields!');
      return;
    }

    if (selectedReferral) {
      const updatedReferral: Referral = {
        ...selectedReferral,
        ...formData,
        commission: formData.commission || calculateCommission(formData.estimatedValue)
      };

      try {
        setEditingReferral(true);
        setReferralsError('');
        await new Promise(resolve => setTimeout(resolve, 500));
        setReferrals(prev => prev.map(r => r.id === selectedReferral.id ? updatedReferral : r));
        setSampleMessage('Referral updated successfully!');
      } catch (err) {
        console.error('Error updating referral:', err);
        setReferralsError('Failed to update referral.');
      } finally {
        setEditingReferral(false);
        setShowEditModal(false);
        setSelectedReferral(null);
        resetForm();
        setTimeout(() => setSampleMessage(''), 5000);
      }
    }
  };

  const calculateCommission = (value: number): number => value * 0.05;

  const updateReferralStatus = async (referralId: string, newStatus: Referral['status']) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      setReferrals(prev =>
        prev.map(referral =>
          referral.id === referralId
            ? {
                ...referral,
                status: newStatus,
                commission: newStatus === 'converted'
                  ? (referral.commission || calculateCommission(referral.estimatedValue))
                  : referral.commission
              }
            : referral
        )
      );
      setSampleMessage(`Status updated to ${getStatusLabel(newStatus)}`);
      setTimeout(() => setSampleMessage(''), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      setReferralsError('Failed to update status.');
    }
  };

  const handleDeleteReferral = async (referralId: string) => {
    try {
      setDeletingReferralLoading(true);
      setReferralsError('');
      await new Promise(resolve => setTimeout(resolve, 500));
      setReferrals(prev => prev.filter(referral => referral.id !== referralId));
      setSampleMessage('Referral deleted successfully!');
    } catch (err) {
      console.error('Error deleting referral:', err);
      setReferralsError('Failed to delete referral.');
    } finally {
      setDeletingReferralLoading(false);
      setShowViewModal(false);
      setShowDeleteConfirm(false);
      setSelectedReferral(null);
      setReferralToDelete(null);
      setTimeout(() => setSampleMessage(''), 5000);
    }
  };

  const confirmDelete = (referralId: string) => {
    setReferralToDelete(referralId);
    setShowDeleteConfirm(true);
    setShowViewModal(false);
  };

  const openEditModal = (referral: Referral) => {
    setSelectedReferral(referral);
    setFormData({
      clientName: referral.clientName,
      contactInfo: referral.contactInfo,
      referralSource: referral.referralSource,
      status: referral.status,
      projectType: referral.projectType,
      estimatedValue: referral.estimatedValue,
      referralDate: referral.referralDate,
      notes: referral.notes || '',
      referredBy: referral.referredBy,
      commission: referral.commission || 0,
    });
    setShowEditModal(true);
  };

  const openViewModal = (referral: Referral) => {
    setSelectedReferral(referral);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({
      clientName: '',
      contactInfo: '',
      referralSource: '',
      status: 'new',
      projectType: 'freight',
      estimatedValue: 0,
      referralDate: new Date().toISOString().split('T')[0],
      notes: '',
      referredBy: '',
      commission: 0,
    });
  };

  const getStatusBadgeClass = (status: Referral['status']) => {
    switch (status) {
      case 'new':       return 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-2 border-amber-500 text-amber-300';
      case 'contacted': return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      case 'converted': return 'bg-gradient-to-r from-emerald-900/30 to-emerald-800/20 border-2 border-emerald-500 text-emerald-300';
      case 'lost':      return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      default:          return 'bg-gray-800 border-gray-600 text-gray-300';
    }
  };

  const getProjectTypeBadgeClass = (type: Referral['projectType']) => {
    switch (type) {
      case 'freight':  return 'bg-gradient-to-r from-orange-900/30 to-orange-800/20 border-2 border-orange-500 text-orange-300';
      case 'logistics':return 'bg-gradient-to-r from-purple-900/30 to-purple-800/20 border-2 border-purple-500 text-purple-300';
      case 'storage':  return 'bg-gradient-to-r from-cyan-900/30 to-cyan-800/20 border-2 border-cyan-500 text-cyan-300';
      case 'customs':  return 'bg-gradient-to-r from-indigo-900/30 to-indigo-800/20 border-2 border-indigo-500 text-indigo-300';
      case 'other':    return 'bg-gradient-to-r from-gray-900/30 to-gray-800/20 border-2 border-gray-500 text-gray-300';
      default:         return 'bg-gray-800 border-gray-600 text-gray-300';
    }
  };

  const getStatusLabel = (status: Referral['status']) => {
    const labels = { new: 'New', contacted: 'Contacted', converted: 'Converted', lost: 'Lost' };
    return labels[status];
  };

  const getProjectTypeLabel = (type: Referral['projectType']) => {
    const labels = { freight: 'Freight', logistics: 'Logistics', storage: 'Storage', customs: 'Customs', other: 'Other' };
    return labels[type];
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-US');

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(value);

  const totalValue      = filteredReferrals.reduce((sum, ref) => sum + ref.estimatedValue, 0);
  const totalCommission = filteredReferrals.reduce((sum, ref) => sum + (ref.commission || 0), 0);
  const convertedCount  = filteredReferrals.filter(ref => ref.status === 'converted').length;
  const conversionRate  = filteredReferrals.length > 0
    ? (convertedCount / filteredReferrals.length * 100).toFixed(1)
    : '0';

  // -- Shared input class ------------------------------------------------------
  const inputCls = 'w-full px-4 py-2 bg-slate-900 border-2 border-purple-500/30 rounded-lg text-white focus:border-purple-500 focus:outline-none';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#1e293b', padding: '1.5rem' }}>

      {/* -- Page Header -- */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">References</h1>
          <p className="text-sm text-slate-300 mt-1">Referral and lead management (Local Mode)</p>

          {/* Role toggle */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={toggleAdminMode}
              className={`px-3 py-1 rounded text-sm font-bold ${user?.role === 'SUPER_ADMIN' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-300'}`}
            >
              {user?.role === 'SUPER_ADMIN' ? '?? SUPER ADMIN' : '?? NORMAL USER'}
            </button>
            <span className="text-xs text-slate-400">
              {user?.role === 'SUPER_ADMIN' ? 'Admin mode (sees all companies)' : 'Normal mode (sees own company only)'}
            </span>
          </div>

          {/* Super admin company picker */}
          {user?.role === 'SUPER_ADMIN' && (
            <div className="mt-3 bg-gradient-to-r from-red-900/20 to-red-800/10 border-2 border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">SUPER ADMIN</span>
                <span className="text-sm text-slate-300 font-medium">Select a company to view referrals</span>
              </div>
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-slate-900 border-2 border-red-500/30 rounded-lg text-white focus:border-red-500 focus:outline-none"
              >
                <option value="">All companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Error bar */}
          {referralsError && (
            <div className="mt-3 px-4 py-2 bg-amber-900/20 border-l-4 border-amber-500 text-amber-200 rounded">
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm">{referralsError}</div>
                <div className="flex items-center gap-2">
                  <button onClick={loadReferrals} className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">
                    Reload
                  </button>
                  <button
                    onClick={createSampleReferrals}
                    disabled={creatingSamples}
                    className={`px-3 py-1 ${creatingSamples ? 'bg-purple-400/60 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'} text-white rounded text-sm flex items-center gap-2`}
                  >
                    {creatingSamples ? (
                      <><svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>Creating...</>
                    ) : 'Create sample date'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {sampleMessage && (
            <div className="mt-3 px-4 py-2 bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-200 rounded">
              {sampleMessage}
            </div>
          )}

          {/* Mode badge */}
          <div className="mt-3 px-4 py-2 bg-slate-900/50 border-2 border-slate-700 rounded-lg">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-slate-300">Local mode: In-memory mock date</span>
              <span className="text-xs text-slate-500 ml-2">({filteredReferrals.length} referrals)</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => { resetForm(); setShowCreateModal(true); }}
          className="px-6 py-3 bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700 hover:from-purple-600 hover:via-purple-700 hover:to-purple-800 text-white rounded-lg transition-all font-bold shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Referral
        </button>
      </div>

      {/* -- Stats -- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Referrals',    value: filteredReferrals.length, color: 'purple', fmt: 'num',
            icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
          { label: 'Total Estimated Value', value: totalValue, color: 'emerald', fmt: 'cur',
            icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
          { label: 'Conversion Rate',    value: conversionRate, color: 'blue', fmt: 'pct',
            icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
          { label: 'Commissions Due',    value: totalCommission, color: 'orange', fmt: 'cur',
            icon: 'M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z' },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-${s.color}-500/30 rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">{s.label}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {s.fmt === 'cur' ? formatCurrency(s.value as number)
                    : s.fmt === 'pct' ? `${s.value}%`
                    : s.value}
                </p>
              </div>
              <div className={`w-12 h-12 bg-gradient-to-br from-${s.color}-500 to-${s.color}-600 rounded-lg flex items-center justify-center`}>
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={s.icon} />
                </svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* -- Table -- */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg overflow-hidden border-2 border-purple-500/30 hover:border-purple-500/50 transition-all">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-900 to-black">
              <tr>
                {['Client', 'Type', 'Status', 'Value', 'Referred By', 'Date', 'Actions'].map((h, i) => (
                  <th key={h} className={`px-6 py-4 ${i === 6 ? 'text-right' : 'text-left'} text-xs font-black text-purple-400 uppercase tracking-widest border-b-2 border-purple-500/30`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-purple-500/20">
              {filteredReferrals.map((referral) => (
                <tr key={referral.id} className="hover:bg-purple-900/10 transition-colors border-b border-purple-500/10">
                  <td className="px-6 py-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md mt-1">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-bold text-white">{referral.clientName}</div>
                        <div className="text-xs text-purple-300 mt-1">{referral.contactInfo}</div>
                        <div className="text-xs text-gray-400 mt-1">Source: {referral.referralSource}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getProjectTypeBadgeClass(referral.projectType)}`}>
                      {getProjectTypeLabel(referral.projectType)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(referral.status)}`}>
                      {getStatusLabel(referral.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">{formatCurrency(referral.estimatedValue)}</div>
                    {(referral.commission || 0) > 0 && (
                      <div className="text-xs text-orange-400 mt-1">
                        Commission: {formatCurrency(referral.commission || 0)}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-xs font-bold text-white">
                          {referral.referredBy.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-2 text-sm font-bold text-white">{referral.referredBy}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-white">{formatDate(referral.referralDate)}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {Math.floor((new Date().getTime() - new Date(referral.referralDate).getTime()) / (1000 * 3600 * 24))} days ago
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openViewModal(referral)} title="View"
                        className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={() => openEditModal(referral)} title="Edit"
                        className="p-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      {referral.status !== 'converted' && referral.status !== 'lost' && (
                        <button onClick={() => updateReferralStatus(referral.id, 'converted')} title="Mark as Converted"
                          className="p-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredReferrals.length === 0 && (
          <div className="text-center py-12 text-purple-500/70">
            <svg className="w-16 h-16 mx-auto mb-4 text-purple-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-lg font-bold text-purple-400">No referrals found</p>
            <p className="text-sm mt-1">Click "New Referral" to get started</p>
          </div>
        )}
      </div>

      {/* -- Summary cards -- */}
      {filteredReferrals.length > 0 && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500/30 rounded-xl p-4">
            <h3 className="text-lg font-bold text-purple-400 mb-3">Distribution by Status</h3>
            <div className="space-y-3">
              {[
                { label: 'New',       color: 'bg-amber-500',   filter: (r: Referral) => r.status === 'new' },
                { label: 'Contacted', color: 'bg-red-500',    filter: (r: Referral) => r.status === 'contacted' },
                { label: 'Converted', color: 'bg-emerald-500', filter: (r: Referral) => r.status === 'converted' },
                { label: 'Lost',      color: 'bg-red-500',     filter: (r: Referral) => r.status === 'lost' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${s.color} rounded-full`} />
                    <span className="text-sm text-slate-300">{s.label}</span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {filteredReferrals.filter(s.filter).length} referrals
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-cyan-500/30 rounded-xl p-4">
            <h3 className="text-lg font-bold text-cyan-400 mb-3">Distribution by Type</h3>
            <div className="space-y-3">
              {[
                { label: 'Freight',   color: 'bg-orange-500', filter: (r: Referral) => r.projectType === 'freight' },
                { label: 'Logistics', color: 'bg-purple-500', filter: (r: Referral) => r.projectType === 'logistics' },
                { label: 'Storage',   color: 'bg-cyan-500',   filter: (r: Referral) => r.projectType === 'storage' },
                { label: 'Customs',   color: 'bg-indigo-500', filter: (r: Referral) => r.projectType === 'customs' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 ${s.color} rounded-full`} />
                    <span className="text-sm text-slate-300">{s.label}</span>
                  </div>
                  <span className="text-sm font-bold text-white">
                    {filteredReferrals.filter(s.filter).length} referrals
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -- Create Modal -- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500/30 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-purple-400 mb-4">New Referral</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user?.role === 'SUPER_ADMIN' && (
                <div className="md:col-span-2 bg-gradient-to-r from-red-900/20 to-red-800/10 border-2 border-red-500/30 rounded-lg p-4 mb-2">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">SUPER ADMIN</span>
                    <span className="text-sm text-slate-300 font-medium">Select the company to create the referral for</span>
                  </div>
                  <label className="block text-sm font-bold text-slate-300 mb-2">Company *</label>
                  <select required value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-900 border-2 border-red-500/30 rounded-lg text-white focus:border-red-500 focus:outline-none">
                    <option value="">Select a company...</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Client Name *</label>
                <Input type="text"  value={formData.clientName} placeholder="Company / contact name"
                  onChange={(e) => setFormData({...formData, clientName: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Contact *</label>
                <Input type="text"  value={formData.contactInfo} placeholder="Email | Phone"
                  onChange={(e) => setFormData({...formData, contactInfo: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referral Source</label>
                <Input type="text"  value={formData.referralSource} placeholder="e.g. Client, Partner, Website"
                  onChange={(e) => setFormData({...formData, referralSource: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as Referral['status']})} className={inputCls}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Project Type</label>
                <select value={formData.projectType} onChange={(e) => setFormData({...formData, projectType: e.target.value as Referral['projectType']})} className={inputCls}>
                  <option value="freight">Freight</option>
                  <option value="logistics">Logistics</option>
                  <option value="storage">Storage</option>
                  <option value="customs">Customs</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Estimated Value (�)</label>
                <Input type="number"  value={formData.estimatedValue} placeholder="0"
                  onChange={(e) => setFormData({...formData, estimatedValue: parseFloat(e.target.value) || 0})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referred By *</label>
                <Input type="text"  value={formData.referredBy} placeholder="Name of the person referring"
                  onChange={(e) => setFormData({...formData, referredBy: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referral Date</label>
                <input type="date" value={formData.referralDate}
                  onChange={(e) => setFormData({...formData, referralDate: e.target.value})} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-300 mb-2">Notes</label>
                <textarea value={formData.notes} rows={3} placeholder="Additional information about this referral..."
                  onChange={(e) => setFormData({...formData, notes: e.target.value})} className={inputCls} />
              </div>
              {formData.estimatedValue > 0 && (
                <div className="md:col-span-2 bg-gradient-to-br from-orange-900/20 to-orange-800/10 border-2 border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">Calculated Commission</p>
                      <p className="text-xl font-bold text-orange-400">{formatCurrency(calculateCommission(formData.estimatedValue))}</p>
                    </div>
                    <div className="text-xs text-slate-400">(5% of estimated value)</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleCreateReferral} disabled={creatingReferral}
                className={`flex-1 px-4 py-2 ${creatingReferral ? 'bg-purple-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'} text-white rounded-lg transition-all font-bold`}>
                {creatingReferral ? 'Creating...' : 'Create Referral'}
              </button>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Edit Modal -- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500/30 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-purple-400 mb-4">Edit Referral</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Client Name *</label>
                <Input type="text"  value={formData.clientName} onChange={(e) => setFormData({...formData, clientName: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Contact *</label>
                <Input type="text"  value={formData.contactInfo} onChange={(e) => setFormData({...formData, contactInfo: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referral Source</label>
                <Input type="text"  value={formData.referralSource} onChange={(e) => setFormData({...formData, referralSource: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Status</label>
                <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as Referral['status']})} className={inputCls}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="converted">Converted</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Project Type</label>
                <select value={formData.projectType} onChange={(e) => setFormData({...formData, projectType: e.target.value as Referral['projectType']})} className={inputCls}>
                  <option value="freight">Freight</option>
                  <option value="logistics">Logistics</option>
                  <option value="storage">Storage</option>
                  <option value="customs">Customs</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Estimated Value (�)</label>
                <Input type="number"  value={formData.estimatedValue} onChange={(e) => setFormData({...formData, estimatedValue: parseFloat(e.target.value) || 0})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referred By *</label>
                <Input type="text"  value={formData.referredBy} onChange={(e) => setFormData({...formData, referredBy: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">Referral Date</label>
                <input type="date" value={formData.referralDate} onChange={(e) => setFormData({...formData, referralDate: e.target.value})} className={inputCls} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-300 mb-2">Notes</label>
                <textarea value={formData.notes} rows={3} onChange={(e) => setFormData({...formData, notes: e.target.value})} className={inputCls} />
              </div>
              {formData.estimatedValue > 0 && (
                <div className="md:col-span-2 bg-gradient-to-br from-orange-900/20 to-orange-800/10 border-2 border-orange-500/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-300">Commission</p>
                      <Input type="number"  value={formData.commission}
                        onChange={(e) => setFormData({...formData, commission: parseFloat(e.target.value) || 0})}
                        className="w-48 px-4 py-2 bg-slate-900 border-2 border-orange-500/30 rounded-lg text-white focus:border-orange-500 focus:outline-none"
                        placeholder="Commission value" />
                    </div>
                    <div className="text-xs text-slate-400">Suggested: {formatCurrency(calculateCommission(formData.estimatedValue))}</div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleEditReferral} disabled={editingReferral}
                className={`flex-1 px-4 py-2 ${editingReferral ? 'bg-purple-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'} text-white rounded-lg transition-all font-bold`}>
                {editingReferral ? 'Saving...' : 'Save Changes'}
              </button>
              <button onClick={() => { setShowEditModal(false); setSelectedReferral(null); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- View Modal -- */}
      {showViewModal && selectedReferral && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-500/30 rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-purple-400">Referral Details</h2>
              <button onClick={() => confirmDelete(selectedReferral.id)} title="Delete referral"
                className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Client</label>
                  <p className="text-white text-lg font-bold">{selectedReferral.clientName}</p>
                  <p className="text-purple-300 text-sm">{selectedReferral.contactInfo}</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Referred By</label>
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md">
                      <span className="text-sm font-bold text-white">
                        {selectedReferral.referredBy.split(' ').map(n => n[0]).join('')}
                      </span>
                    </div>
                    <p className="text-white font-bold">{selectedReferral.referredBy}</p>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Source</label>
                  <p style={{ color: 'var(--color-text)' }}>{selectedReferral.referralSource}</p>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Referral Date</label>
                  <p style={{ color: 'var(--color-text)' }}>{formatDate(selectedReferral.referralDate)}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">Status</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusBadgeClass(selectedReferral.status)}`}>
                      {getStatusLabel(selectedReferral.status)}
                    </span>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">Type</label>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getProjectTypeBadgeClass(selectedReferral.projectType)}`}>
                      {getProjectTypeLabel(selectedReferral.projectType)}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Estimated Value</label>
                  <p className="text-white text-xl font-bold">{formatCurrency(selectedReferral.estimatedValue)}</p>
                </div>
                {selectedReferral.commission && selectedReferral.commission > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-slate-300 mb-1">Commission</label>
                    <p className="text-orange-400 text-xl font-bold">{formatCurrency(selectedReferral.commission)}</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">Days since referral</label>
                  <p style={{ color: 'var(--color-text)' }}>
                    {Math.floor((new Date().getTime() - new Date(selectedReferral.referralDate).getTime()) / (1000 * 3600 * 24))} days
                  </p>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-slate-300 mb-1">Notes</label>
                <div className="bg-slate-900/50 border-2 border-purple-500/20 rounded-lg p-4">
                  <p style={{ color: 'var(--color-text)' }}>{selectedReferral.notes || 'No additional notes'}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowViewModal(false); openEditModal(selectedReferral); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all font-bold">
                Edit
              </button>
              {selectedReferral.status !== 'converted' && (
                <button onClick={() => { updateReferralStatus(selectedReferral.id, 'converted'); setShowViewModal(false); }}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all font-bold">
                  Mark as Converted
                </button>
              )}
              <button onClick={() => { setShowViewModal(false); setSelectedReferral(null); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Delete Confirm Modal -- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-red-500/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-400">Confirm Deletion</h2>
                <p className="text-sm text-slate-300">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete this referral? All date will be permanently removed.
            </p>
            <div className="flex gap-2">
              <button onClick={() => referralToDelete && handleDeleteReferral(referralToDelete)} disabled={deletingReferralLoading}
                className={`flex-1 px-4 py-2 ${deletingReferralLoading ? 'bg-red-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'} text-white rounded-lg transition-all font-bold`}>
                {deletingReferralLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setReferralToDelete(null); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Referrals;

