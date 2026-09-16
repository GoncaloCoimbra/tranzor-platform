import React, { useState, useEffect } from 'react';
import api from '../api/api';
import { useFilters } from '../hooks/useFilters';
import FilterChips from '../components/FilterChips';
import FilterSelector from '../components/FilterSelector';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { useLanguage, translateText, TRANSLATIONS } from '../i18n';

const extractErrorMessage = (error: any, defaultMessage: string = 'Error processing request'): string => {
  if (!error) return defaultMessage;

  if (error.response?.data) {
    const date = error.response.data;
    if (typeof date === 'string') return date;
    if (date.message) {
      if (Array.isArray(date.message)) return date.message[0] || defaultMessage;
      if (typeof date.message === 'string') return date.message;
    }
    if (date.error && typeof date.error === 'string') return date.error;
  }

  if (error.message && typeof error.message === 'string') return error.message;
  return defaultMessage;
};

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueDate: string;
  assignedTo?: string;
  createdAt: string;
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

const extractList = <T,>(payload: any): T[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
};

const Tasks: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [user, setUser] = useState<User | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loadingTasks, setLoadingTasks] = useState<boolean>(true);
  const [tasksError, setTasksError] = useState<string>('');
  const [taskMessage, setTaskMessage] = useState<string>('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM' as Task['priority'],
    dueDate: '',
    assignedTo: '',
  });

  const [savingTask, setSavingTask] = useState<boolean>(false);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  useEffect(() => { loadUser(); }, []);

  useEffect(() => {
    if (user) {
      loadTasks();
      if (user.role === 'SUPER_ADMIN') loadCompanies();
    }
  }, [user, selectedCompanyId]);

  const loadUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error: any) {
      console.error('Error loading user:', error);
      setTasksError(extractErrorMessage(error, 'Error loading user date'));
    }
  };

  const loadCompanies = async () => {
    try {
      const response = await api.get('/companies');
      setCompanies(extractList<Company>(response.data));
    } catch (error: any) {
      console.error('Error loading companies:', error);
    }
  };

  const loadTasks = async () => {
    try {
      setLoadingTasks(true);
      setTasksError('');
      setTaskMessage('');

      const params = new URLSearchParams();
      if (user?.role === 'SUPER_ADMIN' && selectedCompanyId) {
        params.set('companyId', selectedCompanyId);
      }

      const response = await api.get(`/tasks?${params.toString()}`);
      setTasks(extractList<Task>(response.data));
    } catch (err: any) {
      console.error('Error loading tasks:', err);
      setTasksError(extractErrorMessage(err, 'Error loading tasks'));
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleCreateTask = async () => {
    if (!formData.title || !formData.description || !formData.dueDate) {
      alert(t('requiredFields'));
      return;
    }
    if (user?.role === 'SUPER_ADMIN' && !selectedCompanyId) {
      alert(t('selectCompanyFirst'));
      return;
    }

    const dataToSend = {
      ...formData,
      companyId: user?.role === 'SUPER_ADMIN' ? selectedCompanyId : undefined,
    };

    try {
      setSavingTask(true);
      await api.post('/tasks', dataToSend);
      setTaskMessage(t('taskCreated'));
      await loadTasks();
      setShowCreateModal(false);
      resetForm();
      setTimeout(() => setTaskMessage(''), 5000);
    } catch (err: any) {
      console.error('Error creating task:', err);
      setTasksError(extractErrorMessage(err, 'Error creating task'));
    } finally {
      setSavingTask(false);
    }
  };

  const handleEditTask = async () => {
    if (!formData.title || !formData.description || !formData.dueDate) {
      alert(t('requiredFields'));
      return;
    }
    if (selectedTask) {
      try {
        setSavingTask(true);
        await api.patch(`/tasks/${selectedTask.id}`, formData);
        setTaskMessage(t('taskUpdated'));
        await loadTasks();
        setShowEditModal(false);
        setSelectedTask(null);
        resetForm();
        setTimeout(() => setTaskMessage(''), 5000);
      } catch (err: any) {
        console.error('Error updating task:', err);
        setTasksError(extractErrorMessage(err, 'Error updating task'));
      } finally {
        setSavingTask(false);
      }
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newStatus = task.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      await api.patch(`/tasks/${taskId}/status`, { status: newStatus });
      setTaskMessage(t('taskStatusUpdated'));
      await loadTasks();
      setTimeout(() => setTaskMessage(''), 3000);
    } catch (err: any) {
      console.error('Error updating task status:', err);
      setTasksError(extractErrorMessage(err, 'Error updating status'));
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      setDeletingTaskId(taskId);
      await api.delete(`/tasks/${taskId}`);
      setTaskMessage(t('taskDeleted'));
      await loadTasks();
      setTimeout(() => setTaskMessage(''), 4000);
    } catch (err: any) {
      console.error('Error deleting task:', err);
      setTasksError(extractErrorMessage(err, 'Error deleting task'));
    } finally {
      setDeletingTaskId(null);
      setShowViewModal(false);
      setShowDeleteConfirm(false);
      setSelectedTask(null);
      setTaskToDelete(null);
    }
  };

  const confirmDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setShowDeleteConfirm(true);
    setShowViewModal(false);
  };

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate.split('T')[0],
      assignedTo: task.assignedTo || '',
    });
    setShowEditModal(true);
  };

  const openViewModal = (task: Task) => {
    setSelectedTask(task);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({ title: '', description: '', priority: 'MEDIUM', dueDate: '', assignedTo: '' });
  };

  const getTaskStatusBadgeClass = (status: Task['status']) => {
    switch (status) {
      case 'PENDING':     return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      case 'IN_PROGRESS': return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      case 'COMPLETED':   return 'bg-gradient-to-r from-white/10 to-gray-900/20 border-2 border-white text-white';
      case 'CANCELLED':   return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      default:            return 'bg-gray-800 border-gray-600 text-gray-300';
    }
  };

  const getPriorityBadgeClass = (priority: Task['priority']) => {
    switch (priority) {
      case 'URGENT': return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      case 'HIGH':   return 'bg-gradient-to-r from-red-900/30 to-red-800/20 border-2 border-red-500 text-red-300';
      case 'MEDIUM': return 'bg-gradient-to-r from-red-900/20 to-gray-900/20 border-2 border-red-400 text-red-200';
      case 'LOW':    return 'bg-gradient-to-r from-white/10 to-gray-900/20 border-2 border-white text-white';
      default:       return 'bg-gray-800 border-gray-600 text-gray-300';
    }
  };

  const getPriorityLabel = (priority: Task['priority']) => {
    const labels = { URGENT: t('urgent'), HIGH: t('high'), MEDIUM: t('medium'), LOW: t('low') };
    return labels[priority];
  };

  const getStatusLabel = (status: Task['status']) => {
    const labels = { PENDING: t('pending'), IN_PROGRESS: t('inProgress'), COMPLETED: t('completed'), CANCELLED: t('cancelled') };
    return labels[status];
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString(language === 'pt' ? 'pt-PT' : language === 'es' ? 'es-ES' : 'en-US');

  const inputCls = 'w-full px-4 py-2 bg-slate-900 border-2 border-amber-500/30 rounded-lg text-white focus:border-amber-500 focus:outline-none';

  if (loadingTasks) {
    return (
      <div className="loading-page flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="loading-message">{t('loadingTasks')}</p>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter(task => {
    if (user?.role === 'SUPER_ADMIN') return !selectedCompanyId || task.companyId === selectedCompanyId;
    return task.companyId === user?.companyId;
  });

  return (
    <div className="operations-page" style={{ minHeight: '100vh', backgroundColor: '#111214', padding: '1.5rem' }}>

      {/* -- Page Header -- */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold text-white">{t('tasks')}</h1>
          <p className="text-sm text-slate-300 mt-1">{t('taskManagement')}</p>

          {user?.role === 'SUPER_ADMIN' && (
            <div className="mt-3 bg-gradient-to-r from-red-900/20 to-red-800/10 border-2 border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">SUPER ADMIN</span>
                <span className="text-sm text-slate-300 font-medium">{t('selectCompanyTask')}</span>
              </div>
              <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="w-full md:w-auto px-4 py-2 bg-slate-900 border-2 border-red-500/30 rounded-lg text-white focus:border-red-500 focus:outline-none">
                <option value="">All companies</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {tasksError && (
            <div className="mt-3 px-4 py-2 bg-red-900/20 border-l-4 border-red-500 text-red-200 rounded">
              {tasksError}
            </div>
          )}
          {taskMessage && (
            <div className="mt-3 px-4 py-2 bg-emerald-900/20 border-l-4 border-emerald-500 text-emerald-200 rounded">
              {taskMessage}
            </div>
          )}
        </div>

        <button onClick={() => setShowCreateModal(true)}
          className="shrink-0 w-full sm:w-auto px-4 sm:px-6 py-3 bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 hover:from-amber-600 hover:via-amber-700 hover:to-amber-800 text-white rounded-lg transition-all font-bold shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          {t('newTask')}
        </button>
      </div>

      {/* -- Stats -- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: t('totalTasks'),  value: filteredTasks.length, color: 'red',
            icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
          { label: t('inProgress'),  value: filteredTasks.filter(t => t.status === 'IN_PROGRESS').length, color: 'red',
            icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
          { label: t('completed'),    value: filteredTasks.filter(t => t.status === 'COMPLETED').length, color: 'white',
            icon: 'M5 13l4 4L19 7' },
          { label: t('urgent'),       value: filteredTasks.filter(t => t.priority === 'URGENT').length, color: 'red',
            icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z' },
        ].map((s, i) => (
          <div key={i} className={`bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-${s.color}-500/30 rounded-xl p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-300">{s.label}</p>
                <p className="text-2xl font-bold text-white mt-1">{s.value}</p>
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
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg overflow-hidden border-2 border-amber-500/30 hover:border-amber-500/50 transition-all">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-900 to-black">
              <tr>
                {[t('task'), t('priority'), t('status'), t('dueDate'), t('assignee'), t('actions')].map((h, i) => (
                  <th key={h} className={`px-8 py-4 ${i === 5 ? 'text-right' : 'text-left'} text-xs font-black text-amber-400 uppercase tracking-widest border-b-2 border-amber-500/30`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-500/20">
              {filteredTasks.map((task) => (
                <tr key={task.id} className="hover:bg-amber-900/10 transition-colors border-b border-amber-500/10">
                  <td className="px-8 py-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg flex items-center justify-center shadow-md mt-1">
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <div className="text-sm font-bold text-white">{task.title}</div>
                        <div className="text-xs text-amber-300 mt-1">{task.description}</div>
                        <div className="text-xs text-gray-400 mt-1">{t('created')}: {formatDate(task.createdAt)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getPriorityBadgeClass(task.priority)}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${getTaskStatusBadgeClass(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="px-8 py-4">
                    <div className="text-sm font-bold text-white">{formatDate(task.dueDate)}</div>
                    <div className={`text-xs ${new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'text-red-400' : 'text-gray-400'}`}>
                      {new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? t('overdue') : t('onTrack')}
                    </div>
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-8 w-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-md">
                        <span className="text-xs font-bold text-white">
                          {task.assignedTo?.split(' ').map(n => n[0]).join('')}
                        </span>
                      </div>
                      <div className="ml-2 text-sm font-bold text-white">{task.assignedTo}</div>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => openViewModal(task)} title="View"
                        className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button onClick={() => openEditModal(task)} title="Edit"
                        className="p-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button onClick={() => handleCompleteTask(task.id)}
                        title={task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}
                        className="p-2 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all shadow-md">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTasks.length === 0 && (
          <div className="text-center py-12 text-amber-500/70">
            <svg className="w-16 h-16 mx-auto mb-4 text-amber-500/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-lg font-bold text-amber-400">{t('noTasks')}</p>
            <p className="text-sm mt-1">{t('clickNewTask')}</p>
          </div>
        )}
      </div>

      {/* -- Create Modal -- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-start sm:items-center justify-center z-[9999] px-4 pt-24 pb-6 sm:py-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 rounded-xl p-6 max-w-md w-full max-h-[calc(100vh-8rem)] sm:max-h-[calc(100vh-2rem)] overflow-y-auto my-0">
            <h2 className="text-2xl font-bold text-amber-400 mb-4">{t('newTask')}</h2>
            {user?.role === 'SUPER_ADMIN' && (
              <div className="mb-4 bg-gradient-to-r from-red-900/20 to-red-800/10 border-2 border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 bg-red-500/20 text-red-300 text-xs font-bold rounded">SUPER ADMIN</span>
                  <span className="text-sm text-slate-300 font-medium">{t('selectCompanyCreate')}</span>
                </div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('company')} *</label>
                <select required value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900 border-2 border-red-500/30 rounded-lg text-white focus:border-red-500 focus:outline-none">
                  <option value="">Select a company...</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('title')} *</label>
                <Input type="text"  value={formData.title} placeholder={t('enterTaskTitle')}
                  onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('description')} *</label>
                <textarea value={formData.description} rows={3} placeholder={t('enterTaskDescription')}
                  onChange={(e) => setFormData({...formData, description: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('priority')} *</label>
                <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as Task['priority']})} className={inputCls}>
                  <option value="LOW">{t('low')}</option>
                  <option value="MEDIUM">{t('medium')}</option>
                  <option value="HIGH">{t('high')}</option>
                  <option value="URGENT">{t('urgent')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('dueDate')} *</label>
                <input type="date" value={formData.dueDate}
                  onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('assignee')}</label>
                <Input type="text"  value={formData.assignedTo} placeholder={t('assignee')}
                  onChange={(e) => setFormData({...formData, assignedTo: e.target.value})} className={inputCls} />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 mt-6">
              <button onClick={handleCreateTask} disabled={savingTask}
                className={`w-full sm:flex-1 px-4 py-2 ${savingTask ? 'bg-amber-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'} text-white rounded-lg transition-all font-bold`}>
                {savingTask ? t('creatingTask') : t('createTask')}
              </button>
              <button onClick={() => { setShowCreateModal(false); resetForm(); }}
                className="w-full sm:flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Edit Modal -- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-amber-400 mb-4">{t('editTask')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('title')} *</label>
                <Input type="text"  value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('description')} *</label>
                <textarea value={formData.description} rows={3} onChange={(e) => setFormData({...formData, description: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('priority')} *</label>
                <select value={formData.priority} onChange={(e) => setFormData({...formData, priority: e.target.value as Task['priority']})} className={inputCls}>
                  <option value="LOW">{t('low')}</option>
                  <option value="MEDIUM">{t('medium')}</option>
                  <option value="HIGH">{t('high')}</option>
                  <option value="URGENT">{t('urgent')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('dueDate')} *</label>
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData({...formData, dueDate: e.target.value})} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-2">{t('assignee')}</label>
                <Input type="text"  value={formData.assignedTo} onChange={(e) => setFormData({...formData, assignedTo: e.target.value})} className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleEditTask} disabled={savingTask}
                className={`flex-1 px-4 py-2 ${savingTask ? 'bg-amber-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'} text-white rounded-lg transition-all font-bold`}>
                {savingTask ? t('saving') : t('saveChanges')}
              </button>
              <button onClick={() => { setShowEditModal(false); setSelectedTask(null); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- View Modal -- */}
      {showViewModal && selectedTask && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-amber-500/30 rounded-xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-amber-400">{t('taskDetails')}</h2>
              <button onClick={() => confirmDelete(selectedTask.id)} title="Delete task"
                className="p-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 transition-all">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('title')}</label>
                <p style={{ color: 'var(--color-text)' }}>{selectedTask.title}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('description')}</label>
                <p style={{ color: 'var(--color-text)' }}>{selectedTask.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">{t('status')}</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getTaskStatusBadgeClass(selectedTask.status)}`}>
                    {getStatusLabel(selectedTask.status)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-300 mb-1">{t('priority')}</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getPriorityBadgeClass(selectedTask.priority)}`}>
                    {getPriorityLabel(selectedTask.priority)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('dueDate')}</label>
                <p style={{ color: 'var(--color-text)' }}>{formatDate(selectedTask.dueDate)}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('assignee')}</label>
                <p style={{ color: 'var(--color-text)' }}>{selectedTask.assignedTo || t('unassigned')}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-300 mb-1">{t('createdOn')}</label>
                <p style={{ color: 'var(--color-text)' }}>{formatDate(selectedTask.createdAt)}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => { setShowViewModal(false); openEditModal(selectedTask); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all font-bold">
                {t('edit')}
              </button>
              <button onClick={() => { setShowViewModal(false); setSelectedTask(null); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Delete Confirm Modal -- */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[9999] p-4">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-red-500/30 rounded-xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.998-.833-2.732 0L4.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-red-400">{t('confirmDeletion')}</h2>
                <p className="text-sm text-slate-300">{t('cannotUndo')}</p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">{t('deleteTaskQuestion')}</p>
            <div className="flex gap-2">
              <button onClick={() => taskToDelete && handleDeleteTask(taskToDelete)} disabled={!!deletingTaskId}
                className={`flex-1 px-4 py-2 ${deletingTaskId ? 'bg-red-400/60 cursor-not-allowed' : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'} text-white rounded-lg transition-all font-bold`}>
                {deletingTaskId ? t('deleting') : t('deleteTask')}
              </button>
              <button onClick={() => { setShowDeleteConfirm(false); setTaskToDelete(null); }}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all font-bold">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;


