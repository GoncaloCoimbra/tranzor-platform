export const theme = {
  colors: {
    // Cor primária (tons de vermelho com gradiente mais quente)
    primary: {
      50: 'bg-red-50',
      100: 'bg-red-100',
      500: 'bg-gradient-to-r from-[#dc2626] to-[#b91c1c]',
      600: 'bg-gradient-to-r from-[#b91c1c] to-[#991b1b]',
      700: 'bg-gradient-to-r from-[#991b1b] to-[#7f1d1d]',
      text: 'text-red-600',
      textDark: 'text-red-800',
      border: 'border-red-500',
      ring: 'ring-red-500',
    },
    
    // Cor secundária (tons escuros navy com melhor constraste)
    secondary: {
      50: 'bg-gray-50',
      100: 'bg-gray-100',
      500: 'bg-gray-500',
      600: 'bg-gray-600',
      700: 'bg-gray-700',
      text: 'text-gray-600',
      textSecondary: 'text-gray-500',
      border: 'border-gray-500',
    },
    
    // Cores de estado com sombras melhoradas
    success: {
      bg: 'bg-emerald-900/20',
      text: 'text-green-600',
      border: 'border-green-500',
      light: '',
    },
    
    warning: {
      bg: 'bg-amber-900/20',
      text: 'text-yellow-600',
      border: 'border-yellow-500',
      light: '',
    },
    
    error: {
      bg: 'bg-gradient-to-br from-red-50 to-red-50',
      text: 'text-red-600',
      border: 'border-red-500',
      light: '',
    },
    
    info: {
      bg: 'bg-gradient-to-br from-red-50 to-cyan-50',
      text: 'text-red-600',
      border: 'border-red-500',
    },
  },

  
  //  BOTÕES COM EFEITOS
  
  buttons: {
    primary: 'px-6 py-3 bg-gradient-to-r from-[#dc2626] to-[#b91c1c] text-white rounded-lg hover:from-[#b91c1c] hover:to-[#991b1b] transition-all duration-300 font-bold shadow-lg hover:shadow-xl active:scale-95',
    secondary: 'px-6 py-3 bg-[#1e293b] border-2 border-[#334155] text-[#cbd5e1] rounded-lg hover:border-[#dc2626] hover:bg-[#334155] transition-all duration-300 font-bold shadow-md focus:ring-2 focus:ring-[#dc2626]/50',
    success: 'px-6 py-3 bg-gradient-to-r from-[#d90429] to-[#8a0118] text-white rounded-lg hover:from-[#ff0a35] hover:to-[#d90429] transition-all duration-300 font-bold shadow-lg hover:shadow-xl',
    danger: 'px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-300 font-bold shadow-lg hover:shadow-xl',
    outline: 'px-6 py-3 border-2 border-[#dc2626]/50 text-[#dc2626] rounded-lg hover:bg-[#dc2626]/10 transition-all duration-300 font-bold hover:border-[#dc2626]',
    icon: 'p-2 hover:bg-[#dc2626]/20 rounded-lg transition-all duration-300 text-[#dc2626] hover:text-[#b91c1c]',
    ghost: 'px-4 py-2 text-[#cbd5e1] rounded-lg hover:bg-[#334155]/50 transition-all duration-300 font-medium',
  },

  
  //  INPUTS E FORMS COM FOCO MELHORADO
  
  inputs: {
    base: 'w-full px-4 py-3 bg-[#0a0e17] border-2 border-[#1a2234] text-[#f0f4ff] rounded-lg focus:ring-2 focus:ring-[#dc2626]/50 focus:border-[#dc2626] transition-all duration-200 placeholder-[#3a4d63] font-medium shadow-sm',
    error: 'w-full px-4 py-3 bg-[#0a0e17] border-2 border-red-500/70 text-[#f0f4ff] rounded-lg focus:ring-2 focus:ring-red-500/50 focus:border-red-400 transition-all duration-200 placeholder-[#3a4d63] shadow-sm',
    disabled: 'w-full px-4 py-3 border-2 border-[#1a2234] rounded-lg bg-[#07090f] cursor-not-allowed text-[#3a4d63] font-medium opacity-60',
    success: 'w-full px-4 py-3 bg-[#0a0e17] border-2 border-[#d90429]/70 text-[#f0f4ff] rounded-lg focus:ring-2 focus:ring-[#d90429]/50 focus:border-[#ff0a35] transition-all duration-200 placeholder-[#3a4d63]',
  },

  
  //  BADGES COM MAIS VARIAÇÕES
  
  badges: {
    productStatus: {
      'RECEIVED': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
      'IN_ANALYSIS': 'bg-gradient-to-r from-amber-900/40 to-amber-900/20 text-amber-400 border border-amber-500/70 font-semibold shadow-sm',
      'REJECTED': 'bg-gradient-to-r from-red-900/40 to-red-900/20 text-red-400 border border-red-500/70 font-semibold shadow-sm',
      'APPROVED': 'bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 text-emerald-400 border border-emerald-500/70 font-semibold shadow-sm',
      'IN_STORAGE': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
      'IN_PREPARATION': 'bg-gradient-to-r from-amber-900/40 to-amber-900/20 text-amber-400 border border-amber-500/70 font-semibold shadow-sm',
      'IN_SHIPPING': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
      'DELIVERED': 'bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 text-emerald-400 border border-emerald-500/70 font-semibold shadow-sm',
      'IN_RETURN': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
      'ELIMINATED': 'bg-[#0f172a] text-[#64748b] border border-[#1e293b] font-bold shadow-sm',
      'CANCELLED': 'bg-gradient-to-r from-red-900/40 to-red-900/20 text-red-400 border border-red-500/70 font-semibold shadow-sm',
      'DISPATCHED': 'bg-gradient-to-r from-amber-900/40 to-amber-900/20 text-amber-400 border border-amber-500/70 font-semibold shadow-sm',
    } as Record<string, string>,
    
    vehicleStatus: {
      'available': 'bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 text-emerald-400 border border-emerald-500/70 font-semibold shadow-sm',
      'in_use': 'bg-gradient-to-r from-amber-900/40 to-amber-900/20 text-amber-400 border border-amber-500/70 font-semibold shadow-sm',
      'maintenance': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
    } as Record<string, string>,
    
    transportStatus: {
      'PENDING': 'bg-gradient-to-r from-amber-900/40 to-amber-900/20 text-amber-400 border border-amber-500/70 font-semibold shadow-sm',
      'IN_TRANSIT': 'bg-[#1e293b]/60 text-[#cbd5e1] border border-[#334155]/50 font-semibold shadow-sm',
      'DELIVERED': 'bg-gradient-to-r from-emerald-900/40 to-emerald-900/20 text-emerald-400 border border-emerald-500/70 font-semibold shadow-sm',
      'CANCELLED': 'bg-gradient-to-r from-red-900/40 to-red-900/20 text-red-400 border border-red-500/70 font-semibold shadow-sm',
    } as Record<string, string>,
    
    userRoles: {
      'SUPER_ADMIN': 'bg-gradient-to-r from-[#dc2626] to-[#b91c1c] text-white font-black px-3 py-1 rounded-lg shadow-md',
      'ADMIN': 'bg-gradient-to-r from-[#b91c1c] to-[#991b1b] text-white font-bold px-3 py-1 rounded-lg shadow-sm',
      'OPERATOR': 'bg-[#1e293b]/70 text-[#cbd5e1] border border-[#334155] font-semibold px-3 py-1 rounded-lg shadow-sm',
    } as Record<string, string>,

    size: {
      sm: 'px-2 py-1 text-xs rounded-md',
      md: 'px-3 py-1 text-sm rounded-lg',
      lg: 'px-4 py-2 text-base rounded-lg',
    },
  },

  
  //  CARDS E CONTAINERS COM MELHOR VISUAL
  
  cards: {
    base: 'bg-gradient-to-br from-[#0d1117] to-[#07090f] rounded-xl shadow-lg border border-[#1a2234] p-6 hover:border-[#dc2626]/30 transition-all duration-300 hover:shadow-xl',
    stat: 'bg-gradient-to-br from-[#0d1117] to-[#07090f] rounded-xl shadow-lg border border-[#1a2234] p-6 hover:shadow-xl hover:border-[#dc2626]/30 transition-all duration-300',
    form: 'bg-gradient-to-br from-[#0d1117] to-[#07090f] rounded-xl shadow-xl p-6 border-2 border-[#dc2626]/50',
    superAdminPrimary: 'bg-gradient-to-br from-[#07090f] to-[#0d1117] rounded-xl shadow-xl p-6 text-[#f0f4ff] border-2 border-[#dc2626]/50',
    superAdminSecondary: 'bg-gradient-to-br from-[#dc2626] to-[#b91c1c] rounded-xl shadow-xl p-6 text-white border-2 border-[#b91c1c]',
    elevated: 'bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl shadow-xl p-6 border border-[#334155]/70 transition-all duration-300',
  },

  
  //  ÍCONES E AVATARES
  
  icons: {
    primary: 'bg-gradient-to-br from-[#dc2626] to-[#b91c1c] rounded-xl p-3 shadow-lg text-white font-bold',
    secondary: 'bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl p-3 shadow-lg text-[#dc2626] border border-[#dc2626]/30',
    success: 'bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl p-3 shadow-lg text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-3 shadow-lg text-slate-900 font-bold',
    danger: 'bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-3 shadow-lg text-white',
    info: 'bg-gradient-to-br from-[#1e293b] to-[#0f172a] rounded-xl p-3 shadow-lg text-[#dc2626] border border-[#334155]',
    avatar: 'w-10 h-10 bg-gradient-to-br from-[#dc2626] to-[#b91c1c] rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md',
    avatarLarge: 'w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-[#dc2626] via-[#b91c1c] to-[#991b1b] flex items-center justify-center border-4 border-[#dc2626] shadow-xl transition-all duration-300',
  },

  
  //  BACKGROUNDS
  
  backgrounds: {
    page: 'min-h-screen bg-[#07090f]',
    pageAlt: 'min-h-screen bg-[#07090f]',
    header: 'bg-[#0d1117] border-b border-[#1a2234] shadow-lg',
    table: 'bg-[#0d1117] rounded-xl shadow-lg overflow-hidden border border-[#1a2234]',
    tableRow: 'hover:bg-[#0a0e17] transition-colors duration-200 border-b border-[#1a2234]',
    overlay: 'fixed inset-0 bg-black/50 backdrop-blur-sm',
  },

  
  // 📐 TABELAS COM MELHOR ESTILO
  
  table: {
    header: 'bg-[#0d1117] px-8 py-4 text-left text-xs font-black text-[#f0f4ff] uppercase tracking-widest border-b border-[#1a2234]',
    cell: 'px-8 py-4 whitespace-nowrap text-sm text-[#f0f4ff] font-medium border-b border-[#1a2234]',
    cellSecondary: 'px-8 py-4 whitespace-nowrap text-sm text-[#7a8fa8] font-medium border-b border-[#1a2234]',
  },

  
  // 🔔 ALERTAS E MENSAGENS
  
  alerts: {
    success: 'bg-[#0d1117] border-l-4 border-[#34d399] text-[#34d399] px-4 py-3 rounded-lg shadow-lg font-semibold',
    error: 'bg-[#0d1117] border-l-4 border-[#f87171] text-[#f87171] px-4 py-3 rounded-lg shadow-lg font-semibold',
    warning: 'bg-[#0d1117] border-l-4 border-[#f59e0b] text-[#f59e0b] px-4 py-3 rounded-lg shadow-lg font-semibold',
    info: 'bg-[#0d1117] border-l-4 border-[#dc2626] text-[#dc2626] px-4 py-3 rounded-lg shadow-lg font-semibold',
  },

  
  // 📑 TABS
  
  tabs: {
    active: 'py-4 px-6 border-b-4 border-[#dc2626] text-[#dc2626] font-black transition-colors uppercase tracking-wide',
    inactive: 'py-4 px-6 border-b-4 border-transparent text-[#7a8fa8] hover:text-[#f0f4ff] hover:border-[#1a2234] font-bold transition-colors uppercase tracking-wide',
  },
};



// 🔧 FUNÇÕES AUXILIARES



export function combineThemeClasses(...classes: string[]): string {
  return classes.join(' ');
}

export function getStatusBadgeClass(
  type: 'product' | 'vehicle' | 'transport' | 'user',
  status: string
): string {
  switch (type) {
    case 'product':
      return theme.badges.productStatus[status] || 'bg-[#1e293b]/50 text-[#cbd5e1] border border-[#334155]';
    case 'vehicle':
      return theme.badges.vehicleStatus[status] || 'bg-[#1e293b]/50 text-[#cbd5e1] border border-[#334155]';
    case 'transport':
      return theme.badges.transportStatus[status] || 'bg-[#1e293b]/50 text-[#cbd5e1] border border-[#334155]';
    case 'user':
      return theme.badges.userRoles[status] || 'bg-[#1e293b]/50 text-[#cbd5e1] border border-[#334155]';
    default:
      return 'bg-[#1e293b]/50 text-[#cbd5e1] border border-[#334155]';
  }
}

export const statusLabels = {
  product: {
    'RECEIVED': 'Received',
    'IN_ANALYSIS': 'In Analysis',
    'REJECTED': 'Rejected',
    'APPROVED': 'Approved',
    'IN_STORAGE': 'In Storage',
    'IN_PREPARATION': 'In Preparation',
    'IN_SHIPPING': 'In Shipping',
    'DELIVERED': 'Delivered',
    'IN_RETURN': 'In Return',
    'ELIMINATED': 'Eliminated',
    'CANCELLED': 'Cancelled',
    'DISPATCHED': 'Dispatched',
  } as Record<string, string>,
  vehicle: {
    'available': 'Available',
    'in_use': 'In Use',
    'maintenance': 'Maintenance',
  } as Record<string, string>,
  transport: {
    'PENDING': 'Pending',
    'IN_TRANSIT': 'In Transit',
    'DELIVERED': 'Delivered',
    'CANCELLED': 'Cancelled',
  } as Record<string, string>,
  user: {
    'SUPER_ADMIN': 'Super Admin',
    'ADMIN': 'Administrator',
    'OPERATOR': 'Operator',
  } as Record<string, string>,
};

export const statusColors = {
  product: {
    'RECEIVED': '#6b6460',
    'IN_ANALYSIS': '#ff0a35',
    'REJECTED': '#dc2626',
    'APPROVED': '#ffffff',
    'IN_STORAGE': '#6b6460',
    'IN_PREPARATION': '#d90429',
    'IN_SHIPPING': '#ff0a35',
    'DELIVERED': '#ffffff',
    'IN_RETURN': '#b0aaa7',
    'ELIMINATED': '#000000',
    'CANCELLED': '#991b1b',
    'DISPATCHED': '#d90429',
  } as Record<string, string>,
  vehicle: {
    'available': '#ffffff',
    'in_use': '#d90429',
    'maintenance': '#6b6460',
  } as Record<string, string>,
  transport: {
    'PENDING': '#ff0a35',
    'IN_TRANSIT': '#d90429',
    'DELIVERED': '#ffffff',
    'CANCELLED': '#dc2626',
  } as Record<string, string>,
  user: {
    'SUPER_ADMIN': '#dc2626',
    'ADMIN': '#b91c1c',
    'OPERATOR': '#6b6460',
  } as Record<string, string>,
};

export default theme;
