import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme } from '../theme.config';
import { SITE_FULL_NAME } from '../site.config';
import { usePrivateAvatar } from '../hooks/usePrivateAvatar';

const SuperAdminProfile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUserData, logout } = useAuth();
  const privateAvatarUrl = usePrivateAvatar(user?.avatarUrl);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  // Profile form
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');
    setProfileLoading(true);

    try {
      const response = await api.put('/auth/profile', { name, email });
      updateUserData(response.data.user);
      setProfileSuccess('Perfil atualizado com success!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Error ao update perfil');
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('As passwords não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('A nova password deve ter pelo menos 6 caracteres');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setPasswordSuccess('Password alterada com success!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Error ao alterar password');
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Por favor, selecione uma imagem');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('A imagem deve ter no máximo 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setAvatarLoading(true);
    setProfileError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-date' }
      });

      updateUserData(response.data.user);
      setProfileSuccess('Avatar atualizado com success!');
      setAvatarPreview(null);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Error ao fazer upload');
      setAvatarPreview(null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Tem certeza que deseja remove o avatar?')) return;

    setAvatarLoading(true);
    try {
      await api.delete('/auth/avatar');
      updateUserData({ avatarUrl: undefined });
      setProfileSuccess('Avatar removido com success!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Error ao remove avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    return privateAvatarUrl;
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Profile content uses the shared header, including language and account actions. */}
      <div className="hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/superadmin-home')}
            className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300"
            title="Voltar ao Dashboard"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-2 rounded-lg">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-amber-400 to-amber-300 bg-clip-text text-transparent">{SITE_FULL_NAME}</h1>
        </div>

        {/* Ícone do Perfil com Logout */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">
            {user?.name || 'Super Administrador'}
          </span>
          <div className="relative group">
            <button className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-600 rounded-full flex items-center justify-center text-white font-semibold hover:from-amber-600 hover:to-amber-700 transition-all">
              {user?.name?.charAt(0).toUpperCase() || 'S'}
            </button>

            {/* Dropdown Menu */}
            <div className="absolute right-0 mt-2 w-48 bg-slate-800 rounded-lg shadow-lg py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 border border-slate-700">
              <button
                onClick={() => navigate('/superadmin/profile')}
                className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700/50 flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Perfil
              </button>
              <button
                onClick={logout}
                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-900/30 flex items-center gap-2 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Conteúdo Principal - Perfil com tema escuro */}
      <main className={`flex-1 ${theme.backgrounds.page} py-8 px-4 sm:px-6 lg:px-8`}>
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 relative">
            <button
              type="button"
              onClick={() => navigate('/superadmin-home')}
              className="absolute right-0 top-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              aria-label="Close profile"
              title="Close"
            >
              <span className="text-2xl leading-none">×</span>
            </button>
            <h1 className="text-3xl font-bold text-white">Meu Perfil</h1>
            <p className="text-slate-400 mt-2">Gerir as suas informações pessoais</p>
          </div>

          {/* Avatar Card */}
          <div className={`${theme.cards.base} p-8 mb-6 border border-slate-700/50`}>
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Avatar */}
              <div className="relative">
                <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center border-4 border-slate-800 shadow-lg">
                  {getAvatarUrl() ? (
                    <img
                      src={getAvatarUrl()!}
                      alt="Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-5xl font-bold text-white">
                      {user?.name.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {avatarLoading && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
                  </div>
                )}
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
                <p className="text-slate-400 mt-1">{user?.email}</p>
                <div className="flex items-center justify-center md:justify-start gap-2 mt-3">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-purple-600/20 to-purple-700/20 text-purple-400 border border-purple-500/30">
                    Super Administrador
                  </span>
                </div>
              </div>

              {/* Avatar Actions */}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="hidden"
                />
                <button
                  onClick={handleAvatarClick}
                  disabled={avatarLoading}
                  className={`${theme.buttons.primary} text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2`}
                >
                  {avatarLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    'Alterar Foto'
                  )}
                </button>
                {user?.avatarUrl && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={avatarLoading}
                    className="px-4 py-2 bg-red-900/30 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors text-sm font-medium disabled:opacity-50 border border-red-700/30"
                  >
                    Remove Foto
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className={`${theme.cards.base} border border-slate-700/50 overflow-hidden`}>
            <div className="border-b border-slate-700">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('profile')}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                    activeTab === 'profile'
                      ? 'border-b-2 border-amber-500 text-amber-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Informações Pessoais
                </button>
                <button
                  onClick={() => setActiveTab('password')}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                    activeTab === 'password'
                      ? 'border-b-2 border-amber-500 text-amber-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  Alterar Password
                </button>
              </nav>
            </div>

            <div style={{ padding: '2rem' }}>
              {/* Tab: Profile */}
              {activeTab === 'profile' && (
                <form onSubmit={handleUpdateProfile}>
                  {profileError && (
                    <div className="mb-4 p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 rounded">
                      {profileError}
                    </div>
                  )}
                  {profileSuccess && (
                    <div className="mb-4 p-4 bg-emerald-900/30 border-l-4 border-emerald-500 text-emerald-300 rounded">
                      {profileSuccess}
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Name Completo
                      </label>
                      <Input type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={`${theme.inputs.base} w-full`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Email
                      </label>
                      <Input type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={`${theme.inputs.base} w-full`}
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={profileLoading}
                        className={`${theme.buttons.primary} flex items-center gap-2`}
                      >
                        {profileLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            A guardar...
                          </>
                        ) : (
                          'Guardar Alterações'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Tab: Password */}
              {activeTab === 'password' && (
                <form onSubmit={handleChangePassword}>
                  {passwordError && (
                    <div className="mb-4 p-4 bg-red-900/30 border-l-4 border-red-500 text-red-300 rounded">
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="mb-4 p-4 bg-emerald-900/30 border-l-4 border-emerald-500 text-emerald-300 rounded">
                      {passwordSuccess}
                    </div>
                  )}

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Password Atual
                      </label>
                      <Input type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className={`${theme.inputs.base} w-full`}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Nova Password
                      </label>
                      <Input type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className={`${theme.inputs.base} w-full`}
                        required
                        minLength={6}
                      />
                      <p className="text-xs text-slate-500 mt-1">Mínimo 6 caracteres</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Confirmar Nova Password
                      </label>
                      <Input type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`${theme.inputs.base} w-full`}
                        required
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={passwordLoading}
                        className={`${theme.buttons.primary} flex items-center gap-2`}
                      >
                        {passwordLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            A alterar...
                          </>
                        ) : (
                          'Alterar Password'
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer - Ajustar para tema escuro */}
      <div className={`${theme.backgrounds.header} border-t border-slate-700`}>
      </div>
    </div>
  );
};

export default SuperAdminProfile;
