/**
 * Design System Central - Cores, Spacing, Typography
 * Garante consistência visual em toda a aplicação
 */

// ─── Base Colors ───────────────────────────────────────────────────────────
const COLORS = {
  // Backgrounds
  bg: {
    primary: '#111214',          // Fundo principal
    secondary: '#1a1b1e',        // Fundo secundário
    tertiary: '#25272c',         // Hover e overlays
    card: '#1a1b1e',             // Cards e containers
    cardHover: '#25272c',        // Cards ao hover
    input: '#1a1b1e',            // Inputs
    overlay: '#000000cc',        // Overlay semi-transparente
  },

  // Borders
  border: {
    default: '#3f4247',          // Border padrão
    hover: '#9ca3af',            // Border ao hover
    focus: '#dc2626',            // Border ao focus
  },

  // Text
  text: {
    primary: '#ffffff',          // Texto principal
    secondary: '#d1d5db',        // Texto secundário (labels)
    muted: '#9ca3af',            // Texto mutado (hints)
  },

  // Accents & Actions
  accent: {
    primary: '#dc2626',          // Vermelho principal (Login/Register)
    secondary: '#b91c1c',        // Vermelho escuro (Dashboard)
    tertiary: '#991b1b',         // Vermelho mais profundo (SuperAdmin)
    hover: '#b91c1c',            // Hover do vermelho
  },

  // Semantic
  semantic: {
    success: '#10b981',          // Entrega confirmada / OK
    warning: '#f59e0b',          // Atraso / atenção
    danger: '#f87171',           // Vermelho (error)
    info: '#dc2626',             // Vermelho (informação)
    purple: '#8b5cf6',           // Gráficos secundários
    orange: '#f59e0b',           // Compatibilidade: atenção
  },
};

// ─── Design Tokens por Página ──────────────────────────────────────────────
export const DESIGN_TOKENS = {
  // Login & Register - Vermelho principal
  auth: {
    bg: COLORS.bg.primary,
    bgCard: COLORS.bg.card,
    bgInput: COLORS.bg.input,
    border: COLORS.border.default,
    borderFocus: COLORS.border.focus,
    accent: COLORS.accent.primary,
    accentHover: COLORS.accent.hover,
    textPrimary: COLORS.text.primary,
    textSecondary: COLORS.text.secondary,
    textMuted: COLORS.text.muted,
    success: COLORS.semantic.success,
    danger: COLORS.semantic.danger,
    warning: COLORS.semantic.warning,
  },

  // Dashboard - Vermelho escuro
  dashboard: {
    bg: COLORS.bg.primary,
    bgCard: COLORS.bg.card,
    bgCardHover: COLORS.bg.cardHover,
    bgInput: COLORS.bg.input,
    border: COLORS.border.default,
    borderHover: COLORS.border.hover,
    accent: COLORS.accent.secondary,    // Vermelho escuro - mesmo tema
    accentGlow: 'rgba(220,38,38,0.15)',
    textPrimary: COLORS.text.primary,
    textSecondary: COLORS.text.secondary,
    textMuted: COLORS.text.muted,
    success: COLORS.semantic.success,
    warning: COLORS.semantic.warning,
    danger: COLORS.semantic.danger,
    purple: COLORS.semantic.purple,
    orange: COLORS.semantic.orange,
  },

  // SuperAdmin - Vermelho profundo
  superAdmin: {
    bg: COLORS.bg.primary,
    bgCard: COLORS.bg.card,
    bgInput: COLORS.bg.input,
    border: COLORS.border.default,
    accent: COLORS.accent.tertiary,     // Vermelho profundo - mesmo tema
    textPrimary: COLORS.text.primary,
    textSecondary: COLORS.text.secondary,
    textMuted: COLORS.text.muted,
    success: COLORS.semantic.success,
    danger: COLORS.semantic.danger,
    warning: COLORS.semantic.warning,
  },

  // Filters & Advanced - Mesmo do Dashboard
  filters: {
    bg: COLORS.bg.primary,
    bgCard: COLORS.bg.card,
    bgInput: COLORS.bg.input,
    border: COLORS.border.default,
    accent: COLORS.accent.secondary,    // Roxo
    textPrimary: COLORS.text.primary,
    textSecondary: COLORS.text.secondary,
    textMuted: COLORS.text.muted,
    success: COLORS.semantic.success,
    danger: COLORS.semantic.danger,
  },
};

// ─── Spacing ───────────────────────────────────────────────────────────────
export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  xxl: '32px',
};

// ─── Typography ────────────────────────────────────────────────────────────
export const TYPOGRAPHY = {
  fontFamily: "'Outfit', -apple-system, sans-serif",
  monoFamily: "'DM Mono', monospace",
  
  heading: {
    h1: { size: '32px', weight: '700' },
    h2: { size: '28px', weight: '600' },
    h3: { size: '24px', weight: '600' },
  },
  
  body: {
    large: { size: '16px', weight: '400' },
    regular: { size: '14px', weight: '400' },
    small: { size: '12px', weight: '400' },
  },
  
  label: { size: '12px', weight: '600', textTransform: 'uppercase', letterSpacing: 'wider' },
};

// ─── Component Classes ────────────────────────────────────────────────────
export const COMPONENT_CLASSES = {
  inputBase: `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none`,
  
  inputAuth: `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
    bg-[#0a0e17] border border-[#1a2234] text-[#f0f4ff] placeholder-[#3a4d63]
    focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/10`,
  
  inputDashboard: `w-full rounded-xl px-4 py-3 text-sm transition-all duration-200 outline-none
    bg-[#0a0e17] border border-[#1a2234] text-[#f0f4ff] placeholder-[#3a4d63]
    focus:border-[#dc2626] focus:ring-2 focus:ring-[#dc2626]/10`,
  
  labelClass: `block text-xs font-semibold uppercase tracking-wider mb-2`,
  
  buttonPrimary: `font-medium py-3 rounded-xl transition-all duration-200 text-sm`,
  buttonSecondary: `font-medium py-2 px-4 rounded-lg transition-all duration-200 text-xs`,
};

// ─── Gradients ────────────────────────────────────────────────────────────
export const GRADIENTS = {
  authBg: 'linear-gradient(135deg, #07090f 0%, #0a0d16 100%)',
  dashboardBg: 'linear-gradient(135deg, #07090f 0%, #0f0f1a 100%)',
  accentAuth: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  accentDashboard: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
  accentSuper: 'linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)',
};

// ─── Shadows ────────────────────────────────────────────────────────────
export const SHADOWS = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.5)',
  md: '0 4px 6px rgba(0, 0, 0, 0.5)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.6)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.7)',
};

// ─── Export Presets ────────────────────────────────────────────────────────
export default {
  colors: COLORS,
  tokens: DESIGN_TOKENS,
  spacing: SPACING,
  typography: TYPOGRAPHY,
  components: COMPONENT_CLASSES,
  gradients: GRADIENTS,
  shadows: SHADOWS,
};
