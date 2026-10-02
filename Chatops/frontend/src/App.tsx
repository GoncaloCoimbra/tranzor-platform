import React, {
  useEffect, useMemo, useRef, useState, useCallback, type ReactNode
} from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import ReactMarkdown from 'react-markdown';
import StockCard from './components/StockCard';
import MiniChart from './components/MiniChart';
import CommandModal from './components/CommandModal';
import SidebarRight from './components/SidebarRight';
import LanguageSwitcher from './components/LanguageSwitcher';
import { useChatStore, ChatMessage } from './store/chatStore';
import {
  Package, CheckCircle2, Truck, Bell, BarChart3, Tag, MessageCircle,
  TrendingUp, Wrench, AlertTriangle, LayoutDashboard, UploadCloud,
  MessageSquare, Bookmark, Search, Smile, CornerUpLeft, MoreVertical,
  Copy, Trash2, X, Paperclip, Command, ArrowUpRight, Info, Settings2,
  UserPlus, Wifi, WifiOff, ChevronDown, LogOut, User, Maximize2,
  Minimize2, Pin, Menu,
} from 'lucide-react';
import './App.css';
import { useLanguage, translateText } from './i18n';
import {
  formatTimestamp,
  getDateLabel,
  formatFileSize,
  getInitials,
  getAvatarColor,
} from './utils/chatopsHelpers';

const WS_URL    = (import.meta.env.VITE_WS_URL  as string) || 'ws://localhost:9001';
const API_URL   = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3002';
const currentUserId = 'goncalo';

// Modal para criar grupo privado
function CreateGroupModal({ open, onClose, onCreate, members, t }: {
  open: boolean;
  onClose: () => void;
  onCreate: (group: { name: string; members: string[] }) => void;
  members: { id: string; name: string }[];
  t: (key: keyof typeof TRANSLATIONS) => string;
}) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  useEffect(() => { if (open) { setName(''); setSelected([]); } }, [open]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()} style={{ minWidth: 340 }}>
        <header><h3><UserPlus size={16}/> {t('newPrivateGroup')}</h3></header>
        <form onSubmit={e => { e.preventDefault(); if (name && selected.length) { onCreate({ name, members: selected }); onClose(); } }}>
          <label>{t('groupName')}
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Project X" required />
          </label>
          <label>{t('members')}
            <div style={{ maxHeight: 120, overflowY: 'auto', border: '1px solid var(--rule)', borderRadius: 6, padding: 6, marginTop: 2 }}>
              {members.filter(m => m.id !== currentUserId).map(m => (
                <label key={m.id} style={{ display: 'block', marginBottom: 2 }}>
                  <input type="checkbox" checked={selected.includes(m.id)} onChange={e => {
                    setSelected(sel => e.target.checked ? [...sel, m.id] : sel.filter(id => id !== m.id));
                  }} /> {m.name}
                </label>
              ))}
            </div>
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn-send" disabled={!name || !selected.length}>{t('createGroup')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Presença ───────────────────────────────────────────────────
type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online:  '● Available',
  away:    '◐ Away',
  dnd:     '⊘ Do not disturb',
  offline: '○ Offline',
};

// ── Emoji picker data ─────────────────────────────────────────
const EMOJI_CATEGORIES = [
  { label: 'Reações',  emojis: ['👍','👎','❤️','🔥','✅','⚠️','🚚','📦','💯','🎉','😂','😊','🙏','👋','💪','🤝','🚀','⭐'] },
  { label: 'Objetos',  emojis: ['📋','📊','📈','📉','💰','🔑','🔒','📧','📞','🖥️','⚙️','🔧','📌','🗓️','⏰','📁'] },
  { label: 'Símbolos', emojis: ['✔️','❌','❓','❗','🔴','🟠','🟡','🟢','🔵','⬆️','⬇️','➡️','↩️','🔄','➕','➖'] },
];
const QUICK_REACTIONS = ['👍','❤️','🔥','✅','⚠️','🚚','📦'];

const TRANSLATIONS = {
  brandName:       { pt: 'Logistics', en: 'Logistics', es: 'Logística' },
  brandSub:        { pt: 'ChatOps', en: 'ChatOps', es: 'ChatOps' },
  newPrivateGroup: { pt: 'Novo grupo privado', en: 'New private group', es: 'Nuevo grupo privado' },
  channels:        { pt: 'Canais', en: 'Channels', es: 'Canales' },
  shortcuts:       { pt: 'Atalhos', en: 'Shortcuts', es: 'Accesos directos' },
  inviteMember:    { pt: 'Convidar membro', en: 'Invite member', es: 'Invitar miembro' },
  settings:        { pt: 'Configurações', en: 'Settings', es: 'Configuración' },
  logout:          { pt: 'Terminar sessão', en: 'Log out', es: 'Cerrar sesión' },
  online:          { pt: 'Online', en: 'Online', es: 'En línea' },
  reconnecting:    { pt: 'A reconectar…', en: 'Reconnecting…', es: 'Reconectando…' },
  offline:         { pt: 'Offline', en: 'Offline', es: 'Desconectado' },
  chat:            { pt: 'Chat', en: 'Chat', es: 'Chat' },
  pins:            { pt: 'Pins', en: 'Pins', es: 'Pins' },
  search:          { pt: 'Pesquisa', en: 'Search', es: 'Buscar' },
  welcomeToChannel:{ pt: 'Bem-vindo ao', en: 'Welcome to', es: 'Bienvenido a' },
  welcomeHint:     { pt: 'Use /stock, /approve-credit ou arraste ficheiros para começar.', en: 'Use /stock, /approve-credit or drag files to get started.', es: 'Usa /stock, /approve-credit o arrastra archivos para comenzar.' },
  groupName:       { pt: 'Nome do grupo', en: 'Group name', es: 'Nombre del grupo' },
  members:         { pt: 'Membros', en: 'Members', es: 'Miembros' },
  cancel:          { pt: 'Cancelar', en: 'Cancel', es: 'Cancelar' },
  createGroup:     { pt: 'Criar grupo', en: 'Create group', es: 'Crear grupo' },
  displayName:     { pt: 'Nome de exibição', en: 'Display name', es: 'Nombre para mostrar' },
  theme:           { pt: 'Tema', en: 'Theme', es: 'Tema' },
  light:           { pt: 'Claro', en: 'Light', es: 'Claro' },
  dark:            { pt: 'Escuro', en: 'Dark', es: 'Oscuro' },
  notifications:   { pt: 'Notificações', en: 'Notifications', es: 'Notificaciones' },
  newMessages:     { pt: 'Novas mensagens', en: 'New messages', es: 'Nuevos mensajes' },
  mentions:        { pt: 'Menções e tags', en: 'Mentions and tags', es: 'Menciones y etiquetas' },
  sound:           { pt: 'Som de notificação', en: 'Notification sound', es: 'Sonido de notificación' },
  readReceipts:    { pt: 'Mostrar recibos de leitura', en: 'Show read receipts', es: 'Mostrar acuses de recibo' },
  compactMode:     { pt: 'Modo compacto', en: 'Compact mode', es: 'Modo compacto' },
  save:            { pt: 'Gravar', en: 'Save', es: 'Guardar' },
};

// ── Commands ──────────────────────────────────────────────────
const COMMANDS: { label: string; shortcut: string; description: string; icon: ReactNode }[] = [
  { label: '/stock',          shortcut: '/stock SKU-001',          description: 'Check product stock',          icon: <Package size={15} /> },
  { label: '/approve-credit', shortcut: '/approve-credit client-1', description: 'Approve B2B credit',           icon: <CheckCircle2 size={15} /> },
  { label: '/order',          shortcut: '/order ENC-001',            description: 'Check order status',           icon: <Truck size={15} /> },
  { label: '/alert',         shortcut: '/alert SKU-001 5',         description: 'Set stock alert',              icon: <Bell size={15} /> },
  { label: '/report',        shortcut: '/report today',            description: 'Daily sales report',           icon: <BarChart3 size={15} /> },
  { label: '/discount',      shortcut: '/discount SKU-001 10',    description: 'Apply product discount',       icon: <Tag size={15} /> },
];

const CHANNELS_LIST = [
  { id: 'logistica',  name: 'Logistics',  icon: <Truck size={15} />,          description: 'Warehouse and dispatch operations' },
  { id: 'geral',      name: 'General',    icon: <MessageCircle size={15} />,  description: 'Internal communication' },
  { id: 'comercial',  name: 'Sales',      icon: <TrendingUp size={15} />,     description: 'Sales and customer management' },
  { id: 'suporte',    name: 'Support',    icon: <Wrench size={15} />,         description: 'Technical support' },
  { id: 'alertas',    name: 'Alerts',     icon: <AlertTriangle size={15} />,  description: 'Automatic notifications' },
];

// Dummy team members for @ mentions
const TEAM_MEMBERS = [
  { id: 'goncalo',  name: 'Gonçalo Oliveira' },
  { id: 'joao',     name: 'João Silva' },
  { id: 'ana',      name: 'Ana Costa' },
  { id: 'pedro',    name: 'Pedro Martins' },
  { id: 'bot',      name: 'ChatBot' },
];

type ConnectionState = 'connected' | 'reconnecting' | 'offline';
type TabPanel = 'chat' | 'pins' | 'search';

// ── Latência ─────────────────────────────────────────────────
function LatencyIcon({ ms }: { ms: number | null }) {
  const cls = ms === null ? 'latency-none' : ms < 80 ? 'latency-good' : ms < 250 ? 'latency-ok' : 'latency-bad';
  return (
    <span className={`latency-indicator ${cls}`} title={ms !== null ? `${ms} ms` : 'no data'}>
      {[1,2,3,4].map(i => <span key={i} className="latency-bar" />)}
    </span>
  );
}

// ── Settings types ────────────────────────────────────────────
type SettingsState = {
  displayName: string;
  theme: 'light' | 'dark';
  notifications: { messages: boolean; mentions: boolean; sound: boolean };
  readReceipts: boolean;
};
const DEFAULT_SETTINGS: SettingsState = {
  displayName: 'Gonçalo Oliveira',
  theme: 'light',
  notifications: { messages: true, mentions: true, sound: true },
  readReceipts: true,
};

type PinnedMessage = { id: string; text: string; userId: string; ts: number; channelId: string };

// ════════════════════════════════════════════════════════════════
// Sub-components
// ════════════════════════════════════════════════════════════════

function SettingsModal({ open, settings, compactMode, onClose, onChange, onCompactModeChange, t }: {
  open: boolean; settings: SettingsState; compactMode: boolean; onClose: () => void;
  onChange: (s: SettingsState) => void; onCompactModeChange: (v: boolean) => void;
  t: (key: keyof typeof TRANSLATIONS) => string;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <header><h3><Settings2 size={16}/> {t('settings')}</h3></header>
        <form onSubmit={e => { e.preventDefault(); onClose(); }}>
          <label>{t('displayName')}
            <input value={settings.displayName} onChange={e => onChange({ ...settings, displayName: e.target.value })}/>
          </label>
          <div className="settings-group">
            <div className="settings-label">{t('theme')}</div>
            <div className="settings-row">
              <label><input type="radio" name="theme" value="light" checked={settings.theme==='light'} onChange={() => onChange({...settings, theme:'light'})}/> Light</label>
              <label><input type="radio" name="theme" value="dark"  checked={settings.theme==='dark'}  onChange={() => onChange({...settings, theme:'dark'})}/> Dark</label>
            </div>
          </div>
          <div className="settings-group">
            <div className="settings-label">Notifications</div>
            <label><input type="checkbox" checked={settings.notifications.messages} onChange={e => onChange({...settings, notifications:{...settings.notifications, messages:e.target.checked}})}/> {t('newMessages')}</label>
            <label><input type="checkbox" checked={settings.notifications.mentions} onChange={e => onChange({...settings, notifications:{...settings.notifications, mentions:e.target.checked}})}/> {t('mentions')}</label>
            <label><input type="checkbox" checked={settings.notifications.sound}    onChange={e => onChange({...settings, notifications:{...settings.notifications, sound:e.target.checked}})}/> {t('sound')}</label>
          </div>
          <div className="settings-group">
            <label><input type="checkbox" checked={settings.readReceipts} onChange={e => onChange({...settings, readReceipts:e.target.checked})}/> {t('readReceipts')}</label>
            <p className="settings-note">See who read the message and when it was viewed.</p>
          </div>
          <div className="settings-group">
            <label><input type="checkbox" checked={compactMode} onChange={e => onCompactModeChange(e.target.checked)}/> {t('compactMode')}</label>
            <p className="settings-note">Increase information density for faster conversations.</p>
          </div>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
            <button type="button" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn-send">{t('save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InviteModal({ open, target, group, onClose, onSubmit, onTargetChange, onGroupChange }: {
  open: boolean; target: string; group: string; onClose: () => void; onSubmit: () => void;
  onTargetChange: (v: string) => void; onGroupChange: (v: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <header><h3><UserPlus size={16}/> Invite to group</h3></header>
        <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <label>Username or email
            <input value={target} onChange={e => onTargetChange(e.target.value)} placeholder="e.g. joao.silva" required/>
          </label>
          <label>Channel / group
            <select value={group} onChange={e => onGroupChange(e.target.value)}>
              {CHANNELS_LIST.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-send">Send invite</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const allEmojis = EMOJI_CATEGORIES.flatMap(c => c.emojis);
  const filteredCats = query
    ? [{ label: 'Resultados', emojis: allEmojis.filter(e => e.includes(query)) }]
    : EMOJI_CATEGORIES;

  return (
    <div className="emoji-picker-wrapper" onClick={e => e.stopPropagation()}>
      <input className="emoji-picker-search" placeholder="Search emoji…" value={query} onChange={e => setQuery(e.target.value)} autoFocus/>
      {filteredCats.map(cat => (
        <div key={cat.label}>
          <div className="emoji-category-label">{cat.label}</div>
          <div className="emoji-grid">
            {cat.emojis.map(emoji => (
              <button key={emoji} className="emoji-btn" onClick={() => { onSelect(emoji); onClose(); }}>{emoji}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Main App
// ════════════════════════════════════════════════════════════════
export default function App() {
    const { language, setLanguage } = useLanguage();
    const t = useCallback((key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language), [language]);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [privateGroups, setPrivateGroups] = useState<{ id: string; name: string; members: string[] }[]>([]);
  // ── State ──────────────────────────────────────────────────
  const [activeChannel, setActiveChannel] = useState(() => {
    if (typeof window === 'undefined') return 'logistica';
    return localStorage.getItem('chatops-active-channel') || 'logistica';
  });
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem('chatops-drafts') || '{}');
    } catch {
      return {};
    }
  });
  const [command, setCommand] = useState(() => {
    if (typeof window === 'undefined') return '';
    const savedChannel = localStorage.getItem('chatops-active-channel') || 'logistica';
    try {
      const drafts = JSON.parse(localStorage.getItem('chatops-drafts') || '{}');
      return drafts[savedChannel] || '';
    } catch {
      return '';
    }
  });
  const [invalidCommand, setInvalidCommand] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(true);
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [showNewMessagesBadge, setShowNewMessagesBadge] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteType, setAutocompleteType] = useState<'command' | 'mention'>('command');
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [compactMode, setCompactMode] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteGroup, setInviteGroup] = useState(activeChannel);
  const [onlineMembers, setOnlineMembers] = useState<{ id: string; name: string; online?: boolean }[]>([]);
  const [channelFiles, setChannelFiles] = useState<{ id: string; name: string; url: string; size?: number }[]>([]);
  const [activeTab, setActiveTab] = useState<TabPanel>('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [reactions, setReactions] = useState<Record<string, Record<string, string[]>>>({});
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [pinnedMessages, setPinnedMessages] = useState<PinnedMessage[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [rightSidebarCollapsed, setRightSidebarCollapsed] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [messageMenuFor, setMessageMenuFor] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<{ file: File; previewUrl: string } | null>(null);
  const [toasts, setToasts] = useState<{ id: string; text: string; type: 'info' | 'success' | 'error' }[]>([]);
  const [channelTopic, setChannelTopic] = useState<Record<string, string>>({
    logistica: 'Warehouse and order dispatch management',
    geral:     'Company-wide general communication channel',
    comercial: 'B2B sales pipeline and customer management',
    suporte:   'Technical support and issue resolution',
    alertas:   'Automatic system notifications',
  });
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState('');
  const [statsVisible, setStatsVisible] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [userPresence, setUserPresence] = useState<PresenceStatus>('online');
  const [showPresenceMenu, setShowPresenceMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [channelsCollapsed, setChannelsCollapsed] = useState(false);
  const [shortcutsCollapsed, setShortcutsCollapsed] = useState(false);

  const setCommandAndDraft = useCallback((next: string | ((prev: string) => string)) => {
    const nextCommand = typeof next === 'function' ? next(command) : next;
    setCommand(nextCommand);
    setChannelDrafts(prev => {
      const updated = { ...prev, [activeChannel]: nextCommand };
      if (typeof window !== 'undefined') {
        localStorage.setItem('chatops-drafts', JSON.stringify(updated));
      }
      return updated;
    });
  }, [activeChannel, command]);

  // ── Refs ───────────────────────────────────────────────────
  const wsRef              = useRef<WebSocket | null>(null);
  const virtuosoRef        = useRef<VirtuosoHandle | null>(null);
  const inputRef           = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef       = useRef<HTMLInputElement | null>(null);
  const activeChannelRef   = useRef(activeChannel);
  const lastSentAtRef      = useRef(0);
  const typingThrottleRef  = useRef(0);
  const reconnectTimerRef  = useRef<number | null>(null);
  const isAtBottomRef      = useRef(true);
  const lastActivityRef    = useRef(Date.now());
  const presenceTimerRef   = useRef<number | null>(null);
  const pingTimerRef       = useRef<number | null>(null);
  const pingStartRef       = useRef<number>(0);

  // ── Store ──────────────────────────────────────────────────
  const allMessages      = useChatStore(s => s.messages);
  const addMessage       = useChatStore(s => s.addMessage);
  const prependMessages  = useChatStore(s => s.prependMessages);
  const clearChannel     = useChatStore(s => s.clearChannel);
  const confirmMessage   = useChatStore(s => s.confirmMessage);

  const channelMessages = useMemo(
    () => allMessages.filter(m => m.channelId === activeChannel),
    [allMessages, activeChannel]
  );
  const sortedMessages = useMemo(
    () => [...channelMessages].sort((a, b) => a.ts - b.ts),
    [channelMessages]
  );

  // Histórico de mensagens próprias para navegar com ↑
  const ownMessages = useMemo(
    () => sortedMessages.filter(m => m.userId === currentUserId && !m.pending),
    [sortedMessages]
  );
  const ownMsgCursorRef = useRef<number | null>(null);

  // Comandos / menções para autocomplete
  const filteredCommands = useMemo(() => {
    if (!command.trim().startsWith('/')) return [];
    return COMMANDS.filter(c => c.label.startsWith(command.trim().split(' ')[0]));
  }, [command]);

  const filteredMentions = useMemo(() => {
    const atMatch = command.match(/@(\w*)$/);
    if (!atMatch) return [];
    const q = atMatch[1].toLowerCase();
    return TEAM_MEMBERS.filter(m => m.name.toLowerCase().includes(q) || m.id.includes(q));
  }, [command]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return allMessages.filter(m => m.text?.toLowerCase().includes(q)).slice(-30);
  }, [searchQuery, allMessages]);

  // ── Clock ──────────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { setInviteGroup(activeChannel); }, [activeChannel]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('chatops-active-channel', activeChannel);
    setCommand(channelDrafts[activeChannel] || '');
  }, [activeChannel, channelDrafts]);

  // ── Presença automática ───────────────────────────────────
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setUserPresence(prev => (prev === 'away' ? 'online' : prev));
  }, []);

  useEffect(() => {
    presenceTimerRef.current = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      setUserPresence(prev => {
        if (prev === 'dnd' || prev === 'offline') return prev;
        return idle > 5 * 60_000 ? 'away' : 'online';
      });
    }, 30_000);

    document.addEventListener('mousemove', recordActivity);
    document.addEventListener('keydown', recordActivity);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) recordActivity();
    });
    return () => {
      if (presenceTimerRef.current) window.clearInterval(presenceTimerRef.current);
      document.removeEventListener('mousemove', recordActivity);
      document.removeEventListener('keydown', recordActivity);
    };
  }, [recordActivity]);

  // ── Toast ─────────────────────────────────────────────────
  const addToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  // ── WebSocket ─────────────────────────────────────────────
  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) return;
    setConnectionState('reconnecting');
    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null;
      initializeWebSocket();
    }, 1500);
  }, []);

  const sendSubscribe = (channelId: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'subscribe', channelId, userId: currentUserId }));
  };

  const initializeWebSocket = async () => {
    let token: string;
    try {
      const tokenResponse = await fetch(`${API_URL}/auth/dev-token`);
      if (!tokenResponse.ok) throw new Error(`Token request failed: ${tokenResponse.status}`);
      ({ token } = await tokenResponse.json() as { token: string });
    } catch (error) {
      console.error('WS authentication failed', error);
      setConnectionState('offline');
      scheduleReconnect();
      return;
    }
    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setConnectionState('connected');
      sendSubscribe(activeChannelRef.current);
      addToast('Ligação estabelecida', 'success');
      // Inicia ping para medir latência
      pingTimerRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          pingStartRef.current = Date.now();
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 5000);
    });

    ws.addEventListener('message', (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data);

        if (data.type === 'pong') {
          setLatencyMs(Date.now() - pingStartRef.current);
          return;
        }

        if (data.type === 'typing' && data.channelId === activeChannelRef.current && data.userId !== currentUserId) {
          setTypingUsers(prev => ({ ...prev, [data.channelId]: data.userId }));
          window.setTimeout(() => {
            setTypingUsers(prev => {
              const next = { ...prev };
              if (next[data.channelId] === data.userId) delete next[data.channelId];
              return next;
            });
          }, 1800);
          return;
        }

        if (data.type === 'message') {
          const msg: ChatMessage = {
            id: data.messageId || `msg-${data.channelId}-${data.ts}-${Math.random().toString(36).slice(2)}`,
            tempId: data.tempId,
            channelId: data.channelId,
            text: data.text,
            userId: data.userId || 'BOT',
            ts: data.ts || Date.now(),
            pending: false,
            system: !!data.system,
            fileUrl: data.fileUrl,
          };
          if (data.tempId) confirmMessage(data.tempId, msg);
          else addMessage(msg);

          if (data.channelId !== activeChannelRef.current) {
            setUnreadCounts(prev => ({ ...prev, [data.channelId]: (prev[data.channelId] || 0) + 1 }));
          } else if (!isAtBottomRef.current) {
            setShowNewMessagesBadge(true);
            setNewMsgCount(n => n + 1);
          }
          if (data.userId === currentUserId || data.system) setIsProcessing(false);
        }

        if (data.type === 'presence' && data.channelId === activeChannelRef.current) {
          setOnlineMembers(data.members || []);
        }
        if (data.type === 'file_added' && data.channelId === activeChannelRef.current && data.file) {
          setChannelFiles(prev => [data.file, ...prev]);
        }
        if (data.type === 'reaction') {
          const { messageId, emoji, userId: rUid } = data;
          setReactions(prev => {
            const r = { ...(prev[messageId] || {}) };
            const us = [...(r[emoji] || [])];
            if (!us.includes(rUid)) us.push(rUid);
            r[emoji] = us;
            return { ...prev, [messageId]: r };
          });
        }
      } catch (e) {
        console.warn('WS parse error', e);
      }
    });

    ws.addEventListener('close', () => { setConnectionState('offline'); setLatencyMs(null); scheduleReconnect(); });
    ws.addEventListener('error', () => { setConnectionState('offline'); setLatencyMs(null); scheduleReconnect(); });
  };

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  useEffect(() => {
    initializeWebSocket();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // ── History ───────────────────────────────────────────────
  const loadHistory = async (channelId: string, before?: number) => {
    setIsLoadingHistory(true);
    try {
      const url = new URL(`${API_URL}/history`);
      url.searchParams.set('channelId', channelId);
      if (before) url.searchParams.set('before', String(before));
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error();
      const data: ChatMessage[] = await res.json();
      if (!before) { clearChannel(channelId); prependMessages(data); }
      else prependMessages(data);
      setHasMoreHistory(data.length === 50);
      const oldest = data[data.length - 1];
      setHistoryCursor(oldest ? oldest.ts : null);
    } catch {
      // silent
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    setShowNewMessagesBadge(false);
    setNewMsgCount(0);
    setUnreadCounts(prev => ({ ...prev, [activeChannel]: 0 }));
    setHistoryCursor(null);
    setHasMoreHistory(true);
    setActiveTab('chat');
    setReplyTo(null);
    loadHistory(activeChannel);
    sendSubscribe(activeChannel);
    (async () => {
      try {
        const mRes = await fetch(`${API_URL}/channels/${activeChannel}/members`);
        setOnlineMembers(mRes.ok ? await mRes.json() : []);
      } catch { setOnlineMembers([]); }
      try {
        const fRes = await fetch(`${API_URL}/channels/${activeChannel}/files`);
        setChannelFiles(fRes.ok ? await fRes.json() : []);
      } catch { setChannelFiles([]); }
    })();
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [activeChannel]);

  // ── Autocomplete detection ────────────────────────────────
  useEffect(() => {
    if (command.trim().startsWith('/')) {
      setAutocompleteType('command');
      setShowAutocomplete(true);
      setAutocompleteIndex(0);
    } else if (/@\w*$/.test(command)) {
      setAutocompleteType('mention');
      setShowAutocomplete(filteredMentions.length > 0);
      setAutocompleteIndex(0);
    } else {
      setShowAutocomplete(false);
    }
  }, [command, filteredMentions.length]);

  // ── Typing ────────────────────────────────────────────────
  const sendTypingEvent = () => {
    recordActivity();
    const now = Date.now();
    if (now - typingThrottleRef.current < 1500) return;
    typingThrottleRef.current = now;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'typing', channelId: activeChannelRef.current, userId: currentUserId }));
    }
  };

  // ── Auto-resize textarea ──────────────────────────────────
  const autoResizeTextarea = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const lineH = 21; // ~1.5 * 14px
    const maxH  = lineH * 5 + 22; // 5 lines + padding
    el.style.height = Math.min(el.scrollHeight, maxH) + 'px';
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, []);

  useEffect(() => { autoResizeTextarea(); }, [command, autoResizeTextarea]);

  // ── Send ──────────────────────────────────────────────────
  const handleSend = () => {
    const trimmed = command.trim();
    if ((!trimmed && !pendingAttachment) || wsRef.current?.readyState !== WebSocket.OPEN) return;
    if (trimmed.startsWith('/')) {
      const base = trimmed.split(' ')[0];
      if (!COMMANDS.some(c => c.shortcut === base)) {
        addToast('Comando inválido. Use /stock, /approve-credit, /encomenda, /alerta, /relatorio ou /desconto', 'error');
        setInvalidCommand(true);
        window.setTimeout(() => setInvalidCommand(false), 1400);
        return;
      }
    }
    const now = Date.now();
    if (now - lastSentAtRef.current < 800) return;
    lastSentAtRef.current = now;
    recordActivity();

    const tempId = `temp-${now}-${Math.random().toString(36).slice(2)}`;
    const text = replyTo
      ? `↩ *Em resposta a ${replyTo.userId}:*\n> ${replyTo.text?.slice(0, 80)}${(replyTo.text?.length || 0) > 80 ? '…' : ''}\n\n${trimmed}`
      : trimmed;

    addMessage({ id: tempId, tempId, channelId: activeChannel, text, userId: currentUserId, ts: now, pending: true, system: false });

    if (trimmed.startsWith('/')) setIsProcessing(true);
    wsRef.current.send(JSON.stringify({ type: 'message', channelId: activeChannel, text, userId: currentUserId, tempId, replyToId: replyTo?.id }));

    setCommandAndDraft('');
    setShowAutocomplete(false);
    setReplyTo(null);
    setPendingAttachment(null);
    ownMsgCursorRef.current = null;
    // Reset textarea height
    if (inputRef.current) { inputRef.current.style.height = ''; }
  };

  // ── Reactions ─────────────────────────────────────────────
  const handleReaction = (messageId: string, emoji: string) => {
    setReactions(prev => {
      const r = { ...(prev[messageId] || {}) };
      const us = [...(r[emoji] || [])];
      const i = us.indexOf(currentUserId);
      if (i >= 0) us.splice(i, 1); else us.push(currentUserId);
      if (us.length === 0) delete r[emoji]; else r[emoji] = us;
      return { ...prev, [messageId]: r };
    });
    setReactionPickerFor(null);
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reaction', channelId: activeChannel, messageId, emoji, userId: currentUserId }));
    }
  };

  // ── Pin ───────────────────────────────────────────────────
  const handlePin = (msg: ChatMessage) => {
    setPinnedMessages(prev => {
      if (prev.find(p => p.id === msg.id)) return prev;
      addToast('Mensagem fixada', 'success');
      return [{ id: msg.id, text: msg.text || '', userId: msg.userId, ts: msg.ts, channelId: msg.channelId }, ...prev];
    });
    setMessageMenuFor(null);
  };

  // ── File upload ───────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    // Cria preview no input antes de enviar
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingAttachment({ file, previewUrl });
  };

  const doUpload = async (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('channelId', activeChannel);
    setUploadProgress(0);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
      await new Promise<void>((res, rej) => {
        xhr.open('POST', `${API_URL}/upload`);
        xhr.onload = () => { if (xhr.status < 400) res(); else rej(); };
        xhr.onerror = rej;
        xhr.send(fd);
      });
      const payload = JSON.parse(xhr.responseText);
      setCommandAndDraft(prev => `${prev}📎 [${file.name}](${payload.url})`);
      addToast(`"${file.name}" carregado`, 'success');
    } catch {
      addToast('Erro ao carregar ficheiro', 'error');
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDropActive(false);
    if (!e.dataTransfer.files.length) return;
    handleFileUpload(e.dataTransfer.files[0]);
  };

  // ── Autocomplete select ───────────────────────────────────
  const handleAutocompleteSelect = (value: string, type: 'command' | 'mention') => {
    if (type === 'command') {
      setCommandAndDraft(value + ' ');
    } else {
      // Substitui o @... no final pelo nome seleccionado
      setCommandAndDraft(prev => prev.replace(/@\w*$/, `@${value} `));
    }
    setShowAutocomplete(false);
    inputRef.current?.focus();
  };

  // ── Focus mode via keyboard ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // ⌘B / Ctrl+B → modo foco
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setFocusMode(v => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('chat');
        inputRef.current?.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveTab('search');
      }
      // ESC global — fecha menus/modais
      if (e.key === 'Escape') {
        setMessageMenuFor(null);
        setReactionPickerFor(null);
        setShowPresenceMenu(false);
        setShowEmojiPicker(false);
        setShowProfileMenu(false);
        setStatsVisible(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Close menus on outside click ──────────────────────────
  useEffect(() => {
    const handler = () => {
      setMessageMenuFor(null);
      setReactionPickerFor(null);
      setShowPresenceMenu(false);
      setShowEmojiPicker(false);
      setShowProfileMenu(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Dark mode ─────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('chatops-dark') === 'true';
    setDarkMode(saved);
    setSettings(prev => ({ ...prev, theme: saved ? 'dark' : 'light' }));
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    const compact = localStorage.getItem('chatops-compact') === 'true';
    setCompactMode(compact);
  }, []);

  useEffect(() => {
    localStorage.setItem('chatops-compact', String(compactMode));
  }, [compactMode]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const closeSidebar = () => setMobileNavOpen(false);
    document.addEventListener('click', closeSidebar);
    return () => document.removeEventListener('click', closeSidebar);
  }, [mobileNavOpen]);

  const extractImageUrl = (text?: string) => {
    const match = text?.match(/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg))/i);
    return match ? match[1] : null;
  };

  const handleOpenImageViewer = (url: string) => {
    setImageViewerUrl(url);
  };

  const markdownComponents = {
    code({ inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const content = String(children).replace(/\n$/, '');
      if (!inline && match?.[1] === 'json') {
        try {
          const parsed = JSON.parse(content);
          const pretty = JSON.stringify(parsed, null, 2);
          return (
            <pre className="code-block json-code">
              <code>{pretty}</code>
            </pre>
          );
        } catch {
          // Continue with raw output
        }
      }
      return inline ? (
        <code className="inline-code" {...props}>{content}</code>
      ) : (
        <pre className={`code-block ${match?.[1] || ''}`}><code {...props}>{content}</code></pre>
      );
    }
  };

  // ── Derived ───────────────────────────────────────────────
  const totalUnread  = Object.values(unreadCounts).reduce((a, b) => a + b, 0);
  const onlineCount  = onlineMembers.filter(m => m.online !== false).length;
  const typingInChannel = typingUsers[activeChannel];

  // Build message list with date separators (for rendering)
  const messageItems = useMemo(() => {
    const items: ({ type: 'date'; label: string; key: string } | { type: 'msg'; msg: ChatMessage; grouped: boolean })[] = [];
    let lastDate = '';
    let lastUserId = '';
    let lastTs = 0;
    for (const msg of sortedMessages) {
      const label = getDateLabel(msg.ts);
      if (label !== lastDate) {
        items.push({ type: 'date', label, key: `date-${msg.ts}` });
        lastDate = label;
        lastUserId = '';
        lastTs = 0;
      }
      // Group if same user within 2 minutes
      const grouped = msg.userId === lastUserId && (msg.ts - lastTs) < 2 * 60_000;
      items.push({ type: 'msg', msg, grouped });
      lastUserId = msg.userId;
      lastTs = msg.ts;
    }
    return items;
  }, [sortedMessages]);

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════
  // Handler para criar grupo privado
  const handleCreateGroup = (group: { name: string; members: string[] }) => {
    setPrivateGroups(prev => [
      { id: 'grp-' + Date.now(), name: group.name, members: [currentUserId, ...group.members] },
      ...prev
    ]);
    addToast('Grupo criado!', 'success');
  };

  return (
    <div className={[
      'app-shell',
      darkMode ? 'shell-dark' : '',
      compactMode ? 'compact-mode' : '',
      mobileNavOpen ? 'mobile-nav-open' : '',
      sidebarCollapsed && !focusMode ? 'sidebar-collapsed' : '',
      rightSidebarCollapsed && !focusMode ? 'rightbar-collapsed' : '',
      focusMode ? 'focus-mode' : '',
    ].filter(Boolean).join(' ')}>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <header className="app-header">
        <div className="header-brand">
          <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(v => !v)} title="Colapsar sidebar (⌘B)">
            <span/><span/><span/>
          </button>
          <div className="brand-lockup">
            <span className="brand-logo">O</span>
            <div>
              <div className="brand-name">{t('brandName')}</div>
              <div className="brand-sub">{t('brandSub')}</div>
            </div>
          </div>
        </div>

        <div className="header-divider"/>

        <div className="header-center">
          <div className="channel-headline">
            <span className="headline-icon">{CHANNELS_LIST.find(c => c.id === activeChannel)?.icon}</span>
            <span className="headline-name"># {activeChannel}</span>
            <span className="headline-sep">·</span>
            {editingTopic ? (
              <input className="topic-edit-input" value={topicDraft}
                onChange={e => setTopicDraft(e.target.value)}
                onBlur={() => { setChannelTopic(prev => ({ ...prev, [activeChannel]: topicDraft })); setEditingTopic(false); }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { setChannelTopic(prev => ({ ...prev, [activeChannel]: topicDraft })); setEditingTopic(false); }
                  if (e.key === 'Escape') setEditingTopic(false);
                }}
                autoFocus
              />
            ) : (
              <span className="headline-topic" onClick={() => { setTopicDraft(channelTopic[activeChannel] || ''); setEditingTopic(true); }}>
                {channelTopic[activeChannel]}
              </span>
            )}
          </div>
        </div>

        <div className="header-actions">
          <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
            <LanguageSwitcher />
          </div>

          <div className="header-clock">
            {currentTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {latencyMs !== null && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.68rem', color:'var(--ink-faint)', fontFamily:'DM Mono, monospace', paddingRight:'0.5rem', borderRight:'1px solid var(--rule)' }}>
              <LatencyIcon ms={latencyMs}/>
              {latencyMs}ms
            </span>
          )}

<button type="button" className="hdr-btn hdr-btn-icon mobile-nav-btn" data-tooltip="Menu móvel" onClick={() => setMobileNavOpen(v => !v)}>
            <Menu size={15}/>
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip="Modo foco (⌘B)" onClick={() => setFocusMode(v => !v)}>
            {focusMode ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip="Painel direito" onClick={() => setRightSidebarCollapsed(v => !v)}>
            <LayoutDashboard size={15}/>
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip={t('inviteMember')} onClick={() => setInviteOpen(true)}>
            <UserPlus size={15}/>
          </button>

          <div className={`status-pill status-${connectionState}`}>
            {connectionState === 'connected' && <span className="status-dot"/>}
            {connectionState === 'connected' ? t('online') : connectionState === 'reconnecting' ? t('reconnecting') : t('offline')}
          </div>
        </div>
      </header>

      {/* ── MODAL CRIAR GRUPO PRIVADO ── */}
      <CreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={handleCreateGroup}
        members={TEAM_MEMBERS}
        t={t}
      />

      {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
      <aside className="app-sidebar" onClick={e => { if (mobileNavOpen) e.stopPropagation(); }}>
        {/* Canais */}
        <div className="sidebar-section">
          <button className="shortcut-chip" style={{ width: '100%', marginBottom: 8 }} onClick={() => setCreateGroupOpen(true)}>
            <UserPlus size={15} /> {t('newPrivateGroup')}
          </button>
          <div className="sidebar-label" onClick={() => setChannelsCollapsed(v => !v)}>
            <span>{t('channels')}</span>
            <ChevronDown size={11} className={`sidebar-label-chevron ${channelsCollapsed ? 'collapsed' : ''}`}/>
          </div>
          <div className={`sidebar-section-content ${channelsCollapsed ? 'collapsed' : ''}`}>
            <nav className="channel-list">
              {[...privateGroups.map(g => ({
                ...g,
                icon: <User size={15} />, description: 'Grupo privado',
                id: g.id
              })), ...CHANNELS_LIST].map(ch => {
                const unread = unreadCounts[ch.id] || 0;
                return (
                  <button key={ch.id} type="button"
                    className={`channel-btn ${activeChannel === ch.id ? 'channel-active' : ''}`}
                    onClick={() => { setActiveChannel(ch.id); setMobileNavOpen(false); }}>
                    <span className="ch-icon">{ch.icon}</span>
                    <span className="ch-text">
                      <span className="ch-name">{ch.name}</span>
                      <span className="ch-desc">{ch.description}</span>
                    </span>
                    {unread > 0 && <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Atalhos */}
        <div className="sidebar-section">
          <div className="sidebar-label" onClick={() => setShortcutsCollapsed(v => !v)}>
            <span>{t('shortcuts')}</span>
            <ChevronDown size={11} className={`sidebar-label-chevron ${shortcutsCollapsed ? 'collapsed' : ''}`}/>
          </div>
          <div className={`sidebar-section-content ${shortcutsCollapsed ? 'collapsed' : ''}`}>
            <div className="shortcut-grid">
              {COMMANDS.slice(0, 4).map(cmd => (
                <button key={cmd.label} type="button" className="shortcut-chip"
                  onClick={() => { setCommandAndDraft(cmd.shortcut + ' '); inputRef.current?.focus(); }}>
                  <span>{cmd.icon}</span>
                  <span>{cmd.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Perfil + Menu de presença */}
        <div className="sidebar-section sidebar-bottom">
          <div style={{ position: 'relative' }}>
            {/* Menu de perfil completo */}
            {showProfileMenu && (
              <div className="profile-popup" onClick={e => e.stopPropagation()}>
                {/* Presença */}
                {(['online','dnd','away','offline'] as PresenceStatus[]).map(s => (
                  <button key={s} onClick={() => { setUserPresence(s); setShowProfileMenu(false); }}
                    style={{ fontWeight: s === userPresence ? 700 : 400 }}>
                    <span className={`presence-dot presence-${s}`}
                      style={{ position:'static', width:8, height:8, border:'none', borderRadius:'50%', flexShrink:0, display:'inline-block' }}/>
                    {PRESENCE_LABELS[s]}
                  </button>
                ))}
                <div className="menu-sep"/>
                <button onClick={() => { setSettingsOpen(true); setShowProfileMenu(false); }}>
                  <Settings2 size={13}/> {t('settings')}
                </button>
                <button className="popup-danger" onClick={() => addToast(t('logout'), 'info')}>
                  <LogOut size={13}/> {t('logout')}
                </button>
              </div>
            )}
            <div className="current-user-row"
              onClick={e => { e.stopPropagation(); setShowProfileMenu(v => !v); }}>
              <div className="avatar-wrap">
                <span className="avatar-circle" style={{ background: getAvatarColor(settings.displayName) }}>
                  {getInitials(settings.displayName)}
                </span>
                <span className={`presence-dot presence-${userPresence}`}/>
              </div>
              <div>
                <div className="cur-user-name">{settings.displayName}</div>
                <div className={`cur-user-status status-text-${userPresence}`}>{PRESENCE_LABELS[userPresence]}</div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT ──────────────────────────────────────────── */}
      <main className={`app-main ${dropActive ? 'drop-active' : ''}`}
        onDragEnter={() => setDropActive(true)}
        onDragOver={e => e.preventDefault()}
        onDragLeave={() => setDropActive(false)}
        onDrop={handleDrop}>

        {dropActive && (
          <div className="drop-overlay">
            <div className="drop-inner">
              <div className="drop-dashed-ring"><UploadCloud size={28}/></div>
              <div>Largar para partilhar em <strong>#{activeChannel}</strong></div>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="tab-bar">
          <button className={`tab-btn ${activeTab==='chat' ? 'tab-active' : ''}`} onClick={() => setActiveTab('chat')}>
            <MessageSquare size={14}/> {t('chat')}
          </button>
          <button className={`tab-btn ${activeTab==='pins' ? 'tab-active' : ''}`} onClick={() => setActiveTab('pins')}>
            <Bookmark size={14}/> {t('pins')}
            {pinnedMessages.filter(p => p.channelId === activeChannel).length > 0 && (
              <span className="tab-count">{pinnedMessages.filter(p => p.channelId === activeChannel).length}</span>
            )}
          </button>
          <button className={`tab-btn ${activeTab==='search' ? 'tab-active' : ''}`} onClick={() => setActiveTab('search')}>
            <Search size={14}/> {t('search')}
          </button>

          {/* Indicador de quem está a escrever — na tab bar */}
          {typingInChannel && (
            <div className="typing-bar">
              <span className="typing-dots"><span/><span/><span/></span>
              <span>{typingInChannel} está a escrever…</span>
            </div>
          )}
        </div>

        {/* ── CHAT TAB ─────────────────────────── */}
        {activeTab === 'chat' && (
          <div className="message-frame">
            {isLoadingHistory && sortedMessages.length === 0 ? (
              <div className="skeleton-grid">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className={`skeleton-row ${i%3===0 ? 'skeleton-own' : ''}`}>
                    <div className="skeleton-avatar"/>
                    <div className="skeleton-lines">
                      <div className="skeleton-line short"/>
                      <div className="skeleton-line long"/>
                      {i%2===0 && <div className="skeleton-line medium"/>}
                    </div>
                  </div>
                ))}
              </div>
            ) : sortedMessages.length === 0 ? (
              <div className="welcome-panel">
                <div className="welcome-icon">{CHANNELS_LIST.find(c => c.id === activeChannel)?.icon}</div>
                <h3>{t('welcomeToChannel')} #{activeChannel}</h3>
                <p>{channelTopic[activeChannel]}</p>
                <p className="welcome-hint">{t('welcomeHint')}</p>
              </div>
            ) : (
              <Virtuoso
                ref={virtuosoRef}
                data={messageItems}
                firstItemIndex={0}
                startReached={() => { if (!hasMoreHistory || isLoadingHistory || !historyCursor) return; loadHistory(activeChannel, historyCursor); }}
                followOutput={isAtBottomRef.current ? 'smooth' : false}
                atBottomStateChange={atBottom => {
                  isAtBottomRef.current = atBottom;
                  if (atBottom) { setShowNewMessagesBadge(false); setNewMsgCount(0); }
                }}
                itemContent={(_, item) => {
                  if (item.type === 'date') {
                    return (
                      <div className="date-divider" key={item.key}>
                        <div className="date-divider-line"/>
                        <span className="date-divider-label">{item.label}</span>
                        <div className="date-divider-line"/>
                      </div>
                    );
                  }

                  const { msg, grouped } = item;
                  const isOwn      = msg.userId === currentUserId;
                  const msgReacts  = reactions[msg.id] || {};
                  const isMenuOpen = messageMenuFor === msg.id;
                  const isReactOpen= reactionPickerFor === msg.id;
                  const isMention  = msg.text?.includes(`@${settings.displayName.split(' ')[0].toLowerCase()}`);

                  return (
                    <article
                      className={[
                        'chat-bubble',
                        isOwn ? 'chat-own' : 'chat-remote',
                        msg.pending ? 'bubble-pending' : '',
                        grouped ? 'grouped' : '',
                        isMention && !isOwn ? 'mention-highlight' : '',
                      ].filter(Boolean).join(' ')}
                      onContextMenu={e => { e.preventDefault(); setMessageMenuFor(isMenuOpen ? null : msg.id); setReactionPickerFor(null); }}
                      onDoubleClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                      onMouseLeave={() => { if (!isMenuOpen && !isReactOpen) { setMessageMenuFor(null); setReactionPickerFor(null); } }}
                    >
                      <div className="bubble-meta-row">
                        <div className="bubble-author">
                          <div className="avatar-wrap">
                            <span className="avatar-circle" style={{ background: getAvatarColor(msg.userId) }}>
                              {getInitials(msg.userId)}
                            </span>
                          </div>
                          <span className="author-name">{msg.system ? 'Sistema' : msg.userId}</span>
                          {msg.system && <span className="bot-badge">BOT</span>}
                        </div>
                        <div className="bubble-right-meta">
                          <time>{formatTimestamp(msg.ts)}</time>
                          <div className="msg-actions" onClick={e => e.stopPropagation()}>
                            <button className="msg-action-btn" title="Reagir" onClick={e => { e.stopPropagation(); setReactionPickerFor(isReactOpen ? null : msg.id); setMessageMenuFor(null); }}>
                              <Smile size={13}/>
                            </button>
                            <button className="msg-action-btn" title="Responder" onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}>
                              <CornerUpLeft size={13}/>
                            </button>
                            <button className="msg-action-btn" title="Mais opções" onClick={e => { e.stopPropagation(); setMessageMenuFor(isMenuOpen ? null : msg.id); setReactionPickerFor(null); }}>
                              <MoreVertical size={13}/>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bubble-content">
                        {(msg.kind === 'stock_card' || msg.payload?.kind === 'stock_card') ? (
                          <StockCard payload={msg.payload || (msg as any)}/>
                        ) : (msg.kind === 'mini_chart' || msg.payload?.kind === 'mini_chart') ? (
                          <MiniChart values={(msg.payload?.values || (msg as any).values) as any} meta={msg.payload?.meta}/>
                        ) : (
                          <ReactMarkdown components={markdownComponents}>{msg.text || ''}</ReactMarkdown>
                        )}
                        {(() => {
                          const imageUrl = msg.fileUrl || extractImageUrl(msg.text);
                          if (!imageUrl) return null;
                          return (
                            <button type="button" className="message-image-preview" onClick={() => handleOpenImageViewer(imageUrl)}>
                              <img src={imageUrl} alt="Visualização" />
                              <span>Ver imagem</span>
                            </button>
                          );
                        })()}
                      </div>

                      {Object.keys(msgReacts).length > 0 && (
                        <div className="reactions-row">
                          {Object.entries(msgReacts).map(([emoji, users]) => (
                            <button key={emoji}
                              className={`reaction-chip ${users.includes(currentUserId) ? 'reaction-mine' : ''}`}
                              onClick={() => handleReaction(msg.id, emoji)} title={users.join(', ')}>
                              {emoji} {users.length}
                            </button>
                          ))}
                        </div>
                      )}

                      {isReactOpen && (
                        <div className="reaction-picker" onClick={e => e.stopPropagation()}>
                          {QUICK_REACTIONS.map(e => (
                            <button key={e} className="reaction-pick-btn" onClick={() => handleReaction(msg.id, e)}>{e}</button>
                          ))}
                        </div>
                      )}

                      {isMenuOpen && (
                        <div className="msg-context-menu" onClick={e => e.stopPropagation()}>
                          <button onClick={() => { setReplyTo(msg); setMessageMenuFor(null); inputRef.current?.focus(); }}><CornerUpLeft size={13}/> Responder</button>
                          <button onClick={() => handlePin(msg)}><Pin size={13}/> Fixar</button>
                          <button onClick={() => { navigator.clipboard.writeText(msg.text || ''); addToast('Copiado!', 'success'); setMessageMenuFor(null); }}><Copy size={13}/> Copiar</button>
                          {isOwn && <>
                            <div className="menu-sep"/>
                            <button className="menu-danger" onClick={() => { setMessageMenuFor(null); addToast('Message deleted', 'info'); }}><Trash2 size={13}/> Delete</button>
                          </>}
                        </div>
                      )}

                      {settings.readReceipts && isOwn && !msg.pending && (
                        <div className="read-receipt">Visto • {new Date(msg.ts + 60000).toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })}</div>
                      )}
                      {msg.pending && <span className="pending-pill">A enviar…</span>}
                    </article>
                  );
                }}
              />
            )}

            {showNewMessagesBadge && (
              <button type="button" className="new-messages-badge" onClick={() => {
                virtuosoRef.current?.scrollToIndex({ index: sortedMessages.length - 1, align: 'end', behavior: 'smooth' });
                setShowNewMessagesBadge(false);
                setNewMsgCount(0);
              }}>
                ↓ {newMsgCount > 1 ? `${newMsgCount} new messages` : 'New message'}
              </button>
            )}
          </div>
        )}

        {/* ── PINS TAB ─────────────────────────── */}
        {activeTab === 'pins' && (
          <div className="tab-panel">
            <div className="tab-panel-header">
              <h3><Bookmark size={16}/> Mensagens Fixadas — #{activeChannel}</h3>
            </div>
            {pinnedMessages.filter(p => p.channelId === activeChannel).length === 0 ? (
              <div className="empty-state">
                <span className="empty-illustration">📌</span>
                No pinned messages in this channel.
              </div>
            ) : (
              <div className="pins-list">
                {pinnedMessages.filter(p => p.channelId === activeChannel).map(pin => (
                  <div key={pin.id} className="pin-item">
                    <div className="pin-author">
                      <span className="avatar-circle small" style={{ background: getAvatarColor(pin.userId) }}>{getInitials(pin.userId)}</span>
                      <span>{pin.userId}</span>
                      <time>{formatTimestamp(pin.ts)}</time>
                    </div>
                    <div className="pin-text">{pin.text}</div>
                    <button className="pin-remove" onClick={() => { setPinnedMessages(prev => prev.filter(p => p.id !== pin.id)); addToast('Pin removido', 'info'); }}>
                      <X size={13}/> Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SEARCH TAB ───────────────────────── */}
        {activeTab === 'search' && (
          <div className="tab-panel">
            <div className="tab-panel-header">
              <h3><Search size={16}/> Pesquisar Mensagens</h3>
              <input className="search-input" placeholder="Pesquisar em todos os canais…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus/>
            </div>
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="empty-state">
                <span className="empty-illustration">🔍</span>
                Nenhum resultado para "{searchQuery}"
              </div>
            )}
            <div className="search-results">
              {searchResults.map(msg => (
                <div key={msg.id} className="search-result-item"
                  onClick={() => { setActiveChannel(msg.channelId); setActiveTab('chat'); }}>
                  <div className="sr-header">
                    <span className="avatar-circle small" style={{ background: getAvatarColor(msg.userId) }}>{getInitials(msg.userId)}</span>
                    <strong>{msg.userId}</strong>
                    <span className="sr-channel">#{msg.channelId}</span>
                    <time>{formatTimestamp(msg.ts)}</time>
                  </div>
                  <p className="sr-text">{msg.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress !== null && (
          <div className="upload-progress-bar">
            <div className="upload-progress-fill" style={{ width: `${uploadProgress}%` }}/>
            <span>{uploadProgress}%</span>
          </div>
        )}

        {statsVisible && (
          <div className="stats-panel">
            <button className="stats-close" onClick={() => setStatsVisible(false)}><X size={16}/></button>
            <h4>Estatísticas do Canal</h4>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-num">{sortedMessages.length}</div><div>Mensagens</div></div>
              <div className="stat-card"><div className="stat-num">{onlineCount}</div><div>Online</div></div>
              <div className="stat-card"><div className="stat-num">{channelFiles.length}</div><div>Ficheiros</div></div>
              <div className="stat-card"><div className="stat-num">{pinnedMessages.filter(p => p.channelId === activeChannel).length}</div><div>Fixadas</div></div>
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT SIDEBAR ──────────────────────────────────────── */}
      <aside className="app-rightbar">
        <SidebarRight members={onlineMembers} files={channelFiles}/>
      </aside>

      {/* ── FOOTER / INPUT ─────────────────────────────────────── */}
      <footer className="app-footer">
        {replyTo && (
          <div className="reply-banner">
            <span><CornerUpLeft size={13}/> A responder a <strong>{replyTo.userId}</strong>: {replyTo.text?.slice(0, 60)}{(replyTo.text?.length || 0) > 60 ? '…' : ''}</span>
            <button onClick={() => setReplyTo(null)}><X size={16}/></button>
          </div>
        )}

        {/* Preview de anexo pendente */}
        {pendingAttachment && (
          <div className="input-attachment-preview">
            {pendingAttachment.previewUrl ? (
              <img className="preview-thumb" src={pendingAttachment.previewUrl} alt="preview"/>
            ) : (
              <div className="preview-thumb"><Paperclip size={16}/></div>
            )}
            <div className="preview-info">
              <div className="preview-name">{pendingAttachment.file.name}</div>
              <div className="preview-size">{formatFileSize(pendingAttachment.file.size)}</div>
            </div>
            <button className="preview-remove" onClick={() => { setPendingAttachment(null); }}>
              <X size={13}/>
            </button>
          </div>
        )}

        <div className="footer-inner">
          <div className="footer-tools">
            <input ref={fileInputRef} type="file" hidden onChange={e => { if (e.target.files?.[0]) handleFileUpload(e.target.files[0]); }}/>
            <button type="button" className="tool-btn" title="Anexar ficheiro" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={15}/>
            </button>
            <button type="button" className={`tool-btn ${showEmojiPicker ? 'active' : ''}`} title="Emojis"
              onClick={e => { e.stopPropagation(); setShowEmojiPicker(v => !v); setShowAutocomplete(false); }}>
              <Smile size={15}/>
            </button>
            <button type="button" className="tool-btn" title="Comandos"
              onClick={() => { if (showAutocomplete) { setShowAutocomplete(false); } else { setCommandAndDraft('/'); setShowAutocomplete(true); inputRef.current?.focus(); } }}>
              <Command size={15}/>
            </button>
          </div>

          <div className="input-wrapper">
            {showEmojiPicker && (
              <EmojiPicker onSelect={emoji => { setCommandAndDraft(prev => prev + emoji); inputRef.current?.focus(); }} onClose={() => setShowEmojiPicker(false)}/>
            )}

            {/* Autocomplete — comandos */}
            {showAutocomplete && autocompleteType === 'command' && filteredCommands.length > 0 && (
              <div className="autocomplete-menu" onClick={e => e.stopPropagation()}>
                <div className="autocomplete-header">Comandos disponíveis</div>
                {filteredCommands.map((item, idx) => (
                  <button key={item.label} type="button"
                    className={`autocomplete-option ${idx === autocompleteIndex ? 'autocomplete-active' : ''}`}
                    onClick={() => handleAutocompleteSelect(item.shortcut, 'command')}
                    onMouseEnter={() => setAutocompleteIndex(idx)}>
                    <span className="ac-icon">{item.icon}</span>
                    <div className="ac-info">
                      <div className="ac-label">{item.label}</div>
                      <div className="ac-desc">{item.description}</div>
                    </div>
                    <code className="ac-shortcut">{item.shortcut}</code>
                  </button>
                ))}
              </div>
            )}

            {/* Autocomplete — menções */}
            {showAutocomplete && autocompleteType === 'mention' && filteredMentions.length > 0 && (
              <div className="autocomplete-menu" onClick={e => e.stopPropagation()}>
                <div className="autocomplete-header">Membros</div>
                {filteredMentions.map((member, idx) => (
                  <button key={member.id} type="button"
                    className={`autocomplete-option ${idx === autocompleteIndex ? 'autocomplete-active' : ''}`}
                    onClick={() => handleAutocompleteSelect(member.id, 'mention')}
                    onMouseEnter={() => setAutocompleteIndex(idx)}>
                    <span className="avatar-circle small" style={{ background: getAvatarColor(member.id) }}>{getInitials(member.id)}</span>
                    <div className="ac-info">
                      <div className="ac-label">{member.name}</div>
                      <div className="ac-desc">@{member.id}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <textarea
              ref={inputRef}
              className={invalidCommand ? 'input-error' : ''}
              value={command}
              onChange={e => { setCommandAndDraft(e.target.value); sendTypingEvent(); }}
              onKeyDown={e => {
                // Navegar autocomplete
                if (showAutocomplete) {
                  const list = autocompleteType === 'command' ? filteredCommands : filteredMentions;
                  if (e.key === 'ArrowDown')  { e.preventDefault(); setAutocompleteIndex(i => Math.min(list.length - 1, i + 1)); return; }
                  if (e.key === 'ArrowUp')    { e.preventDefault(); setAutocompleteIndex(i => Math.max(0, i - 1)); return; }
                  if (e.key === 'Escape')     { setShowAutocomplete(false); return; }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (autocompleteType === 'command' && filteredCommands.length > 0)
                      handleAutocompleteSelect(filteredCommands[autocompleteIndex].shortcut, 'command');
                    else if (autocompleteType === 'mention' && filteredMentions.length > 0)
                      handleAutocompleteSelect(filteredMentions[autocompleteIndex].id, 'mention');
                    return;
                  }
                }
                // Enviar
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); return; }
                // Cancelar reply com ESC
                if (e.key === 'Escape' && replyTo) { setReplyTo(null); return; }
                if (e.key === 'Escape' && showEmojiPicker) { setShowEmojiPicker(false); return; }
                if (e.key === 'Escape' && pendingAttachment) { setPendingAttachment(null); return; }
                // Navegar histórico com ↑
                if (e.key === 'ArrowUp' && !command.trim() && ownMessages.length > 0) {
                  e.preventDefault();
                  const idx = ownMsgCursorRef.current === null ? ownMessages.length - 1 : Math.max(0, ownMsgCursorRef.current - 1);
                  ownMsgCursorRef.current = idx;
                  setCommandAndDraft(ownMessages[idx].text || '');
                }
                if (e.key === 'ArrowDown' && ownMsgCursorRef.current !== null) {
                  e.preventDefault();
                  const next = ownMsgCursorRef.current + 1;
                  if (next >= ownMessages.length) {
                    ownMsgCursorRef.current = null;
                    setCommandAndDraft('');
                  } else {
                    ownMsgCursorRef.current = next;
                    setCommandAndDraft(ownMessages[next].text || '');
                  }
                }
              }}
              placeholder={`Message in #${activeChannel}… (/ commands · @ mentions)`}
              rows={1}
              aria-label="ChatOps message"
              style={{ overflowY: 'hidden' }}
            />
          </div>

          <button className="btn-send" type="button" onClick={handleSend}
            disabled={(!command.trim() && !pendingAttachment) || connectionState !== 'connected' || isProcessing}
            title="Enviar (Enter)">
            {isProcessing ? <span className="send-spinner"/> : <ArrowUpRight size={17}/>}
          </button>
        </div>

        <div className="footer-hint">
          <span>/ comandos</span>
          <span>@ menções</span>
          <span>↵ enviar</span>
          <span>Shift+↵ nova linha</span>
          <span>↑ histórico</span>
          <span>⌘B modo foco</span>
        </div>
      </footer>

      {/* ── STATUS BAR ─────────────────────────────────────────── */}
      <div className={`app-statusbar statusbar-${connectionState}`}>
        <span className="statusbar-item">
          {connectionState === 'connected' ? <Wifi size={11}/> : <WifiOff size={11}/>}
          {connectionState === 'connected' ? 'Ligado' : connectionState === 'reconnecting' ? 'A reconectar…' : 'Sem ligação'}
        </span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item clickable" title="Click to open channel settings" onClick={() => setSettingsOpen(true)}>
          #{activeChannel}
        </span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item">{sortedMessages.length} msgs</span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item">{onlineCount} online</span>
        {totalUnread > 0 && <>
          <span className="statusbar-sep">|</span>
          <span className="statusbar-item">{totalUnread} não lidas</span>
        </>}

        {/* Indicador de quem está a escrever na status bar */}
        {typingInChannel && (
          <>
            <span className="statusbar-sep">|</span>
            <span className="statusbar-typing">
              <span className="typing-dots"><span/><span/><span/></span>
              {typingInChannel} está a escrever…
            </span>
          </>
        )}

        <div className="statusbar-right">
          <span className="statusbar-item">{PRESENCE_LABELS[userPresence]}</span>
          {latencyMs !== null && (
            <span className="statusbar-item" title="Latência WebSocket">
              <LatencyIcon ms={latencyMs}/> {latencyMs}ms
            </span>
          )}
          <span className="statusbar-item">
            {currentTime.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ── TOASTS ─────────────────────────────────────────────── */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? <CheckCircle2 size={13}/> : toast.type === 'error' ? <AlertTriangle size={13}/> : <Info size={13}/>}
            </span>
            {toast.text}
          </div>
        ))}
      </div>

      {/* ── MODALS ─────────────────────────────────────────────── */}
      <InviteModal
        open={inviteOpen} target={inviteTarget} group={inviteGroup}
        onClose={() => setInviteOpen(false)}
        onSubmit={() => { addToast(`Convite enviado a ${inviteTarget || 'membro'} para #${inviteGroup}`, 'success'); setInviteOpen(false); setInviteTarget(''); }}
        onTargetChange={setInviteTarget} onGroupChange={setInviteGroup}
      />
      {imageViewerUrl && (
        <div className="image-viewer-overlay" onClick={() => setImageViewerUrl(null)}>
          <img src={imageViewerUrl} alt="Imagem" onClick={e => e.stopPropagation()} />
          <button className="image-viewer-close" type="button" onClick={() => setImageViewerUrl(null)}>
            <X size={20} />
          </button>
        </div>
      )}
      <SettingsModal
        open={settingsOpen} settings={settings} compactMode={compactMode}
        onClose={() => setSettingsOpen(false)}
        onChange={next => { setSettings(next); setDarkMode(next.theme === 'dark'); localStorage.setItem('chatops-dark', String(next.theme === 'dark')); }}
        onCompactModeChange={setCompactMode}
        t={t}
      />
      <CommandModal
        open={false}
        onClose={() => {}}
        onSubmit={(data: { sku: string; discountPct: number; reason?: string; expiresAt?: string }) => {
          const now = Date.now();
          const tempId = `temp-cmd-${now}`;
          addMessage({ id: tempId, tempId, channelId: activeChannel, text: `🏷️ Desconto de **${data.discountPct}%** aplicado a \`${data.sku}\``, userId: currentUserId, ts: now, pending: true, system: false });
          addToast(`Desconto ${data.discountPct}% aplicado a ${data.sku}`, 'success');
        }}
      />
    </div>
  );
}