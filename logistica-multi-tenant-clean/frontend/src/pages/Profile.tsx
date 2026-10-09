import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import { Button, Input, Card, Badge, Alert } from '../components/common';
import { theme, statusLabels, getStatusBadgeClass } from '../theme.config';
import { usePrivateAvatar } from '../hooks/usePrivateAvatar';

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUserData } = useAuth();
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
      setProfileSuccess('Profile updated successfully. Returning to dashboard...');
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Error updating profile');
    } finally {
      setProfileLoading(false);
    }
  };

  const cancelProfileEdit = () => {
    setName(user?.name || '');
    setEmail(user?.email || '');
    setProfileError('');
    setProfileSuccess('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters');
      return;
    }

    setPasswordLoading(true);

    try {
      await api.put('/auth/change-password', { 
        currentPassword, 
        newPassword 
      });
      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error: any) {
      setPasswordError(error.response?.data?.error || 'Error changing password');
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

    // Validate type
    if (!file.type.startsWith('image/')) {
      setProfileError('Please select an image');
      return;
    }

    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Image must be no larger than 5MB');
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setAvatarLoading(true);
    setProfileError('');

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const response = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-date' }
      });

      updateUserData(response.data.user);
      setProfileSuccess('Avatar updated successfully!');
      setAvatarPreview(null);
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Upload error');
      setAvatarPreview(null);
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove the avatar?')) return;

    setAvatarLoading(true);
    try {
      await api.delete('/auth/avatar');
      updateUserData({ avatarUrl: undefined });
      setProfileSuccess('Avatar removed successfully!');
      setTimeout(() => setProfileSuccess(''), 3000);
    } catch (error: any) {
      setProfileError(error.response?.data?.error || 'Error removing avatar');
    } finally {
      setAvatarLoading(false);
    }
  };

  const getAvatarUrl = () => {
    if (avatarPreview) return avatarPreview;
    return privateAvatarUrl;
  };

  const getRoleLabel = (role?: string) => {
    return statusLabels.user[role as keyof typeof statusLabels.user] || role;
  };

  return (
    <div className={theme.backgrounds.page}>
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 relative">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="absolute right-0 top-0 p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            aria-label="Close profile"
            title="Close"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
          <h1 className="text-3xl font-bold text-white">My Profile</h1>
          <p className={theme.colors.secondary.text}>Manage your personal information</p>
        </div>

        {/* Avatar Card */}
        <div className={theme.cards.base}>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#dc2626] via-[#b91c1c] to-[#991b1b] flex items-center justify-center border-4 border-[#dc2626] shadow-2xl">
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
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1 text-center md:text-left">
              <h2 className="text-2xl font-bold text-white">{user?.name}</h2>
              <p className={theme.colors.secondary.text}>{user?.email}</p>
              <div className="flex items-center justify-center md:justify-start gap-2 mt-3">
                <span className={getStatusBadgeClass('user', user?.role || 'OPERATOR')}>
                  {getRoleLabel(user?.role)}
                </span>
                {user?.companyName && (
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-medium bg-[#1e293b]/70 text-[#cbd5e1] border border-[#334155]">
                    {user.companyName}
                  </span>
                )}
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
                className={theme.buttons.primary}
              >
                Change Photo
              </button>
              {user?.avatarUrl && (
                <button
                  onClick={handleRemoveAvatar}
                  disabled={avatarLoading}
                  className={theme.buttons.danger}
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl shadow-lg border border-[#334155]/50 overflow-hidden mt-6">
          <div className="border-b border-[#334155]/50">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('profile')}
                className={activeTab === 'profile' ? theme.tabs.active : theme.tabs.inactive}
              >
                Personal Information
              </button>
              <button
                onClick={() => setActiveTab('password')}
                className={activeTab === 'password' ? theme.tabs.active : theme.tabs.inactive}
              >
                Change Password
              </button>
            </nav>
          </div>

          <div style={{ padding: '2rem' }}>
            {/* Tab: Profile */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                {profileError && (
                  <div className={theme.alerts.error}>
                    {profileError}
                  </div>
                )}
                {profileSuccess && (
                  <div className={theme.alerts.success}>
                    {profileSuccess}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Full Name
                    </label>
                    <Input type="text" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className={theme.inputs.base}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Email
                    </label>
                    <Input type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={theme.inputs.base}
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <button type="button" onClick={cancelProfileEdit} className={theme.buttons.secondary} disabled={profileLoading}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={profileLoading}
                      className={`${theme.buttons.primary} flex items-center gap-2`}
                    >
                      {profileLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Saving...
                        </>
                      ) : (
                        'Save Changes'
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
                  <div className={theme.alerts.error}>
                    {passwordError}
                  </div>
                )}
                {passwordSuccess && (
                  <div className={theme.alerts.success}>
                    {passwordSuccess}
                  </div>
                )}

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Current Password
                    </label>
                    <Input type="password" 
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className={theme.inputs.base}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      New Password
                    </label>
                    <Input type="password" 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className={theme.inputs.base}
                      required
                      minLength={6}
                    />
                    <p className="text-xs text-[#64748b] mt-1">Minimum 6 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#cbd5e1] mb-2">
                      Confirm New Password
                    </label>
                    <Input type="password" 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={theme.inputs.base}
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
                          Changing...
                        </>
                      ) : (
                        'Change Password'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
