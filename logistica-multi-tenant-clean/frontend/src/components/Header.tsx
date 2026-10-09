import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import NotificationPanel from './NotificationPanel';
import { SITE_FULL_NAME } from '../site.config';
import { usePrivateAvatar } from '../hooks/usePrivateAvatar';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const privateAvatarUrl = usePrivateAvatar(user?.avatarUrl);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getAvatarUrl = () => {
    return privateAvatarUrl;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'Super Administrator';
      case 'ADMIN':       return 'Administrator';
      case 'OPERATOR':    return 'Operator';
      default:            return role;
    }
  };

  // ── Calendar helpers ──────────────────────────────────────────────
  const MONTHS = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December',
  ];

  const getDiasCalendario = (mes: Date) => {
    const primeiro   = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const ultimo     = new Date(mes.getFullYear(), mes.getMonth() + 1, 0);
    const diasNoMes  = ultimo.getDate();
    const iniciaSem  = primeiro.getDay();
    const dias: (Date | null)[] = [];
    for (let i = 0; i < iniciaSem; i++) dias.push(null);
    for (let d = 1; d <= diasNoMes; d++)
      dias.push(new Date(mes.getFullYear(), mes.getMonth(), d));
    return dias;
  };

  const mesmosDias = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  const mudarMes = (dir: number) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + dir, 1));

  const handleSelectDate = (date: Date) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  return (
    <header
      className="sticky top-0 z-50 bg-gradient-to-r from-slate-900 to-black border-b-2 border-amber-500/20"
      style={{ minHeight: 72 }}
    >
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center" style={{ minHeight: 72 }}>

          {/* ── Logo ─────────────────────────────────────────────── */}
          <Link to="/dashboard" className="flex items-center group py-2">
            <span className="sr-only">{SITE_FULL_NAME}</span>
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 shadow-lg" />
          </Link>

          {/* ── Right section ────────────────────────────────────── */}
          <div className="flex items-center gap-1">

            {/* Notifications */}
            <NotificationPanel />

            {/* Calendar button */}
            <div className="relative">
              <button
                onClick={() => setShowCalendar(!showCalendar)}
                title="Calendar"
                className="p-2 rounded-xl text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 border border-transparent hover:border-amber-500/30 transition-all"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              {showCalendar && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowCalendar(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border-2 border-amber-500/30 z-20 overflow-hidden">

                    {/* Calendar header */}
                    <div className="bg-gradient-to-r from-slate-900 to-black px-4 py-3 border-b-2 border-amber-500/20">
                      <div className="flex items-center justify-between mb-1">
                        <button
                          onClick={e => { e.stopPropagation(); mudarMes(-1); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <h3 className="text-sm font-bold text-white">
                          {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                        </h3>
                        <button
                          onClick={e => { e.stopPropagation(); mudarMes(1); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-amber-900/20 transition-all"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-amber-400/70 text-center">
                        Selected: {selectedDate.toLocaleDateString('en-US')}
                      </p>
                    </div>

                    {/* Days grid */}
                    <div className="p-4">
                      <div className="grid grid-cols-7 gap-1 mb-2">
                        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
                          <div key={d} className="h-7 flex items-center justify-center text-xs font-bold text-amber-500/50">
                            {d}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-1">
                        {getDiasCalendario(currentMonth).map((dia, idx) => {
                          if (!dia) return <div key={`e-${idx}`} className="h-9" />;
                          const hoje        = new Date();
                          const ehHoje      = mesmosDias(dia, hoje);
                          const ehSel       = mesmosDias(dia, selectedDate);
                          const ehMesAtual  = dia.getMonth() === currentMonth.getMonth();
                          return (
                            <button
                              key={idx}
                              onClick={e => { e.stopPropagation(); handleSelectDate(dia); }}
                              disabled={!ehMesAtual}
                              className={`h-9 flex items-center justify-center text-xs rounded-xl transition-all font-medium ${
                                ehSel
                                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white font-bold shadow-lg scale-105'
                                  : ehHoje
                                  ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/40'
                                  : ehMesAtual
                                  ? 'text-slate-300 hover:bg-amber-900/20 hover:text-amber-300 hover:border hover:border-amber-500/20'
                                  : 'text-slate-600 cursor-not-allowed'
                              }`}
                            >
                              {dia.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-gradient-to-r from-slate-900 to-black px-4 py-3 border-t-2 border-amber-500/20 flex justify-between items-center">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const hoje = new Date();
                          setCurrentMonth(hoje);
                          setSelectedDate(hoje);
                          setShowCalendar(false);
                        }}
                        className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        Today
                      </button>
                      <p className="text-xs text-slate-500">Logistics Management System</p>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* ── User menu ──────────────────────────────────────── */}
            {user && (
              <div className="flex items-center gap-2 pl-3 ml-1 border-l-2 border-amber-500/20">
                {/* Name + role */}
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-slate-200 leading-tight">{user.name}</p>
                  <p className="text-xs text-slate-400 leading-tight">{getRoleLabel(user.role)}</p>
                </div>

                {/* Avatar + dropdown */}
                <div className="relative group">
                  <button className="flex items-center gap-1">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center ring-2 ring-amber-500/30 group-hover:ring-amber-500/60 transition-all overflow-hidden"
                      style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                    >
                      {getAvatarUrl() ? (
                        <img src={getAvatarUrl()!} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white font-bold text-sm">
                          {user.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <svg className="w-3.5 h-3.5 text-slate-500 hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-52 bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl shadow-2xl border-2 border-amber-500/30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 overflow-hidden">
                    {/* User info */}
                    <div className="px-4 py-3 bg-gradient-to-r from-slate-900 to-black border-b-2 border-amber-500/20">
                      <p className="text-sm font-bold text-white">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>

                    {/* Links */}
                    <div className="py-2">
                      <Link
                        to="/profile"
                        className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-amber-400 hover:bg-amber-900/20 flex items-center gap-2.5 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="9" strokeWidth={2} />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M12 12a3 3 0 100-6 3 3 0 000 6zM6.5 18.5c1.2-2.2 3.2-3.5 5.5-3.5s4.3 1.3 5.5 3.5" />
                        </svg>
                        Profile
                      </Link>
                      {/* Only show settings/configurations for Admin and SuperAdmin */}
                      {(user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') && (
                        <Link
                          to="/configuracoes"
                          className="w-full text-left px-4 py-2.5 text-sm text-slate-300 hover:text-amber-400 hover:bg-amber-900/20 flex items-center gap-2.5 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          Configurations
                        </Link>
                      )}
                    </div>

                    {/* Logout */}
                    <div className="border-t-2 border-amber-500/20 py-2">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 flex items-center gap-2.5 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;