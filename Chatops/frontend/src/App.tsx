import React, {
  useEffect, useMemo, useRef, useState, useCallback, type ReactNode
} from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import ReactMarkdown from 'react-markdown';
import StockCard from './components/StockCard';
import MiniChart from './components/MiniChart';
import SidebarRight from './components/SidebarRight';
import LanguageSwitcher from './components/LanguageSwitcher';
import CallDialog from './components/CallDialog';
import { formatCallDuration, useWebRtcCalls } from './hooks/useWebRtcCalls';
import { useChatStore, ChatMessage } from './store/chatStore';
import {
  Package, CheckCircle2, Truck, Bell, BarChart3, Tag, MessageCircle,
  TrendingUp, Wrench, AlertTriangle, LayoutDashboard, UploadCloud,
  MessageSquare, Bookmark, Search, Smile, CornerUpLeft, MoreVertical,
  Copy, Trash2, X, Paperclip, Command, ArrowUpRight, Info, Settings2,
  UserPlus, Wifi, WifiOff, ChevronDown, LogOut, User, Maximize2,
  Minimize2, Pin, Menu, Phone, Eye, EyeOff,
} from 'lucide-react';
import './App.css';
import { useLanguage, translateText } from './i18n';
import {
  formatTimestamp,
  getDateLabel,
  getLocale,
  formatFileSize,
  getInitials,
  getAvatarColor,
} from './utils/chatopsHelpers';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const WS_URL = (() => {
  const url = new URL(import.meta.env.VITE_WS_URL || '/ws', window.location.href);
  url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return url.toString();
})();

type ChatOpsUser = { id: string; name: string; email: string; role: string };
type PrivateGroupMember = { id: string; name: string; role: string };
type PrivateGroup = { id: string; name: string; ownerId: string | null; members: PrivateGroupMember[] };

const AUTH_TEXT = {
  eyebrow: { pt: 'TRANZOR  ·  CHATOPS', en: 'TRANZOR  ·  CHATOPS', es: 'TRANZOR  ·  CHATOPS' },
  title: { pt: 'Iniciar sessão no ChatOps', en: 'Sign in to ChatOps', es: 'Iniciar sesión en ChatOps' },
  subtitle: { pt: 'Entre no espaço de trabalho da sua equipa.', en: 'Enter your team workspace.', es: 'Accede al espacio de trabajo de tu equipo.' },
  welcome: { pt: 'O trabalho em equipa, em tempo real.', en: 'Teamwork, in real time.', es: 'Trabajo en equipo, en tiempo real.' },
  welcomeDescription: {
    pt: 'Converse, coordene e mantenha a sua equipa ligada num só lugar.',
    en: 'Chat, coordinate, and keep your team connected in one place.',
    es: 'Conversa, coordina y mantén a tu equipo conectado en un solo lugar.',
  },
  featureMessages: { pt: 'Mensagens em tempo real', en: 'Real-time messaging', es: 'Mensajes en tiempo real' },
  featureGroups: { pt: 'Canais e grupos privados', en: 'Channels and private groups', es: 'Canales y grupos privados' },
  featureCalls: { pt: 'Chamadas e partilha de ecrã', en: 'Calls and screen sharing', es: 'Llamadas y compartir pantalla' },
  accountNote: { pt: 'Acesso com a sua conta Tranzor', en: 'Sign in with your Tranzor account', es: 'Accede con tu cuenta de Tranzor' },
  email: { pt: 'Email', en: 'Email', es: 'Correo electrónico' },
  password: { pt: 'Palavra-passe', en: 'Password', es: 'Contraseña' },
  submit: { pt: 'Iniciar sessão', en: 'Sign in', es: 'Iniciar sesión' },
  submitting: { pt: 'A iniciar sessão…', en: 'Signing in…', es: 'Iniciando sesión…' },
  unavailable: { pt: 'Não foi possível contactar o serviço de autenticação.', en: 'The authentication service could not be reached.', es: 'No se pudo contactar con el servicio de autenticación.' },
  retry: { pt: 'Tentar novamente', en: 'Try again', es: 'Intentar de nuevo' },
  showPassword: { pt: 'Mostrar palavra-passe', en: 'Show password', es: 'Mostrar contraseña' },
  hidePassword: { pt: 'Ocultar palavra-passe', en: 'Hide password', es: 'Ocultar contraseña' },
};

function AuthScreen({ onAuthenticated, initialError, onRetry }: {
  onAuthenticated: (user: ChatOpsUser) => void;
  initialError?: string;
  onRetry: () => void;
}) {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [submitting, setSubmitting] = useState(false);
  const authText = (key: keyof typeof AUTH_TEXT) => translateText(AUTH_TEXT[key], language);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { user?: ChatOpsUser; error?: string };
      if (!response.ok || !result.user) {
        throw new Error(result.error || authText('unavailable'));
      }
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : authText('unavailable'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="auth-screen">
      <section className="auth-layout" aria-label="ChatOps">
        <aside className="auth-showcase">
          <div className="auth-showcase-glow" aria-hidden="true" />
          <div className="auth-brand">
            <span className="auth-brand-mark"><MessageCircle size={21} strokeWidth={2.4} /></span>
            <span>ChatOps</span>
          </div>
          <div className="auth-showcase-copy">
            <span className="auth-eyebrow">{authText('eyebrow')}</span>
            <h2>{authText('welcome')}</h2>
            <p>{authText('welcomeDescription')}</p>
            <ul className="auth-feature-list">
              {(['featureMessages', 'featureGroups', 'featureCalls'] as const).map(feature => (
                <li key={feature}><CheckCircle2 size={17} aria-hidden="true" />{authText(feature)}</li>
              ))}
            </ul>
          </div>
          <div className="auth-showcase-footer">
            <span className="auth-live-dot" aria-hidden="true" />
            <span>{authText('accountNote')}</span>
          </div>
        </aside>
        <section className="auth-card">
          <div className="auth-card-header">
            <div className="auth-mobile-brand">
              <span className="auth-brand-mark"><MessageCircle size={19} strokeWidth={2.4} /></span>
              <span>ChatOps</span>
            </div>
            <LanguageSwitcher />
          </div>
          <div className="auth-form-heading">
            <span className="auth-eyebrow">{authText('eyebrow')}</span>
            <h1>{authText('title')}</h1>
            <p>{authText('subtitle')}</p>
          </div>
          <form onSubmit={submit}>
            <label>
              {authText('email')}
              <input autoComplete="username" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
            </label>
            <div className="auth-password-group">
              <label htmlFor="chatops-password">{authText('password')}</label>
              <span className="auth-password-field">
                <input id="chatops-password" autoComplete="current-password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} required />
                <button
                  className="auth-password-toggle"
                  type="button"
                  aria-label={authText(showPassword ? 'hidePassword' : 'showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(visible => !visible)}
                >
                  {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
                </button>
              </span>
            </div>
            {error && <div className="auth-error" role="alert">{error}</div>}
            {initialError && <button className="auth-retry" type="button" onClick={onRetry}>{authText('retry')}</button>}
            <button className="auth-submit" type="submit" disabled={submitting}>
              <span>{submitting ? authText('submitting') : authText('submit')}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </button>
          </form>
          <p className="auth-account-note">{authText('accountNote')}</p>
        </section>
      </section>
    </main>
  );
}

// Modal para criar grupo privado
function CreateGroupModal({ open, onClose, onCreate, members, currentUserId, t }: {
  open: boolean;
  onClose: () => void;
  onCreate: (group: { name: string; members: string[] }) => void;
  members: { id: string; name: string }[];
  currentUserId: string;
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
            <input value={name} onChange={e => setName(e.target.value)} placeholder={t('groupNamePlaceholder')} required />
          </label>
          <fieldset className="create-group-members">
            <legend>{t('members')}</legend>
            <div className="create-group-member-list">
              {members.filter(m => m.id !== currentUserId).map(m => (
                <label key={m.id} className={`create-group-member-option ${selected.includes(m.id) ? 'is-selected' : ''}`}>
                  <input type="checkbox" checked={selected.includes(m.id)} onChange={e => {
                    setSelected(sel => e.target.checked ? [...sel, m.id] : sel.filter(id => id !== m.id));
                  }} />
                  <span className="create-group-checkbox" aria-hidden="true" />
                  <span className="create-group-member-name">{m.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onClose}>{t('cancel')}</button>
            <button type="submit" className="btn-send" disabled={!name || !selected.length}>{t('createGroup')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

const GROUP_TEXT = {
  settings: { pt: 'Definições do grupo', en: 'Group settings', es: 'Configuración del grupo' },
  owner: { pt: 'Proprietário', en: 'Owner', es: 'Propietario' },
  addMember: { pt: 'Adicionar membro', en: 'Add member', es: 'Añadir miembro' },
  removeMember: { pt: 'Remover', en: 'Remove', es: 'Eliminar' },
  noUsers: { pt: 'Não há mais utilizadores disponíveis para adicionar.', en: 'There are no more users available to add.', es: 'No hay más usuarios disponibles para añadir.' },
  deleteGroup: { pt: 'Eliminar grupo', en: 'Delete group', es: 'Eliminar grupo' },
  confirmDelete: { pt: 'Eliminar este grupo e as respetivas mensagens?', en: 'Delete this group and its messages?', es: '¿Eliminar este grupo y sus mensajes?' },
  ownerOnly: { pt: 'Só o proprietário pode gerir os membros e eliminar o grupo.', en: 'Only the owner can manage members and delete the group.', es: 'Solo el propietario puede gestionar los miembros y eliminar el grupo.' },
};

function ManagePrivateGroupModal({ group, currentUserId, members, language, onClose, onAddMember, onRemoveMember, onDelete }: {
  group: PrivateGroup | null;
  currentUserId: string;
  members: { id: string; name: string }[];
  language: 'pt' | 'en' | 'es';
  onClose: () => void;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [userId, setUserId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!group) return null;

  const t = (key: keyof typeof GROUP_TEXT) => translateText(GROUP_TEXT[key], language);
  const isOwner = group.ownerId === currentUserId;
  const availableMembers = members.filter(member => !group.members.some(existing => existing.id === member.id));
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Não foi possível atualizar o grupo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card group-settings-card" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
        <header><h3><Settings2 size={16} />{t('settings')}: {group.name}</h3></header>
        <ul className="group-settings-members">
          {group.members.map(member => (
            <li key={member.id}>
              <span>{member.name}{member.role === 'owner' ? ` · ${t('owner')}` : ''}</span>
              {isOwner && member.id !== group.ownerId && (
                <button type="button" disabled={busy} onClick={() => void run(() => onRemoveMember(member.id))}>
                  {t('removeMember')}
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <>
            <form className="group-settings-add" onSubmit={event => {
              event.preventDefault();
              if (userId) void run(async () => { await onAddMember(userId); setUserId(''); });
            }}>
              <label>
                {t('addMember')}
                <select value={userId} onChange={event => setUserId(event.target.value)} disabled={busy || availableMembers.length === 0}>
                  <option value="">{t('noUsers')}</option>
                  {availableMembers.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <button type="submit" disabled={busy || !userId}>{t('addMember')}</button>
            </form>
            <button className="group-settings-delete" type="button" disabled={busy} onClick={() => {
              if (window.confirm(t('confirmDelete'))) void run(onDelete);
            }}>{t('deleteGroup')}</button>
          </>
        ) : <p className="group-settings-note">{t('ownerOnly')}</p>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <footer><button type="button" onClick={onClose}>{translateText(TRANSLATIONS.cancel, language)}</button></footer>
      </section>
    </div>
  );
}

// ── Presença ───────────────────────────────────────────────────
type PresenceStatus = 'online' | 'away' | 'dnd' | 'offline';

const PRESENCE_LABELS: Record<PresenceStatus, { pt: string; en: string; es: string }> = {
  online:  { pt: 'Online', en: 'Online', es: 'En línea' },
  away:    { pt: 'Ausente', en: 'Away', es: 'Ausente' },
  dnd:     { pt: 'Não incomodar', en: 'Do not disturb', es: 'No molestar' },
  offline: { pt: 'Offline', en: 'Offline', es: 'Desconectado' },
};

// ── Emoji picker data ─────────────────────────────────────────
const EMOJI_CATEGORIES: { label?: string; emojis: string[] }[] = [
  { emojis: ['👍','👎','❤️','🔥','✅','⚠️','🚚','📦','💯','🎉','😂','😊','🙏','👋','💪','🤝','🚀','⭐'] },
  { emojis: ['📋','📊','📈','📉','💰','🔑','🔒','📧','📞','🖥️','⚙️','🔧','📌','🗓️','⏰','📁'] },
  { emojis: ['✔️','❌','❓','❗','🔴','🟠','🟡','🟢','🔵','⬆️','⬇️','➡️','↩️','🔄','➕','➖'] },
];
const QUICK_REACTIONS = ['👍','❤️','🔥','✅','⚠️','🚚','📦'];

const TRANSLATIONS = {
  brandName:       { pt: 'Logística', en: 'Logistics', es: 'Logística' },
  brandSub:        { pt: 'ChatOps', en: 'ChatOps', es: 'ChatOps' },
  newPrivateGroup: { pt: 'Novo grupo privado', en: 'New private group', es: 'Nuevo grupo privado' },
  channels:        { pt: 'Canais', en: 'Channels', es: 'Canales' },
  privateGroup:    { pt: 'Grupo privado', en: 'Private group', es: 'Grupo privado' },
  pinnedEmpty:     { pt: 'Ainda não há mensagens fixadas neste canal.', en: 'No pinned messages in this channel.', es: 'Todavía no hay mensajes fijados en este canal.' },
  searchEmpty:     { pt: 'Nenhum resultado para', en: 'No results for', es: 'No hay resultados para' },
  newMessagesCount:{ pt: 'novas mensagens', en: 'new messages', es: 'mensajes nuevos' },
  newMessage:      { pt: 'Nova mensagem', en: 'New message', es: 'Nuevo mensaje' },
  shortcuts:       { pt: 'Atalhos', en: 'Shortcuts', es: 'Accesos directos' },
  inviteMember:    { pt: 'Convidar membro', en: 'Invite member', es: 'Invitar miembro' },
  settings:        { pt: 'Configurações', en: 'Settings', es: 'Configuración' },
  logout:          { pt: 'Terminar sessão', en: 'Log out', es: 'Cerrar sesión' },
  online:          { pt: 'Ligado', en: 'Online', es: 'En línea' },
  reconnecting:    { pt: 'A reconectar…', en: 'Reconnecting…', es: 'Reconectando…' },
  offline:         { pt: 'Desligado', en: 'Offline', es: 'Desconectado' },
  shortcutsDisabled: { pt: 'Comandos: /stock [SKU], /low-stock, /order [id] e /approve-credit [id_empresa] (administradores).', en: 'Commands: /stock [SKU], /low-stock, /order [id] and /approve-credit [company_id] (administrators).', es: 'Comandos: /stock [SKU], /low-stock, /order [id] y /approve-credit [id_empresa] (administradores).' },
  shortcutUnavailableShort: { pt: 'Comandos disponíveis', en: 'Available commands', es: 'Comandos disponibles' },
  commandNotAvailable: { pt: 'Comando ou formato inválido. Use /stock [SKU], /low-stock, /order [id] ou /approve-credit [id_empresa].', en: 'Invalid command or format. Use /stock [SKU], /low-stock, /order [id] or /approve-credit [company_id].', es: 'Comando o formato no válido. Usa /stock [SKU], /low-stock, /order [id] o /approve-credit [id_empresa].' },
  commandsOnlyLogistics: { pt: 'Os comandos de logística só estão disponíveis no canal #Logística.', en: 'Logistics commands are only available in the #Logística channel.', es: 'Los comandos de logística solo están disponibles en el canal #Logística.' },
  commandsInLogisticsHint: { pt: 'Use /stock, /low-stock e /order no canal Logística.', en: 'Use /stock, /low-stock and /order in the Logistics channel.', es: 'Usa /stock, /low-stock y /order en el canal Logística.' },
  commandsHeading: { pt: 'Comandos de Logística', en: 'Logistics commands', es: 'Comandos de logística' },
  mentionShortcut: { pt: 'Mencionar membro', en: 'Mention a member', es: 'Mencionar a un miembro' },
  mentionShortcutShort: { pt: 'Mencionar', en: 'Mention', es: 'Mencionar' },
  emojiShortcut: { pt: 'Inserir emoji', en: 'Insert emoji', es: 'Insertar emoji' },
  emojiShortcutShort: { pt: 'Emoji', en: 'Emoji', es: 'Emoji' },
  attachShortcut: { pt: 'Anexar ficheiro', en: 'Attach file', es: 'Adjuntar archivo' },
  attachShortcutShort: { pt: 'Anexar', en: 'Attach', es: 'Adjuntar' },
  newGroupShortcut: { pt: 'Novo grupo', en: 'New group', es: 'Nuevo grupo' },
  searchShortcut: { pt: 'Pesquisar', en: 'Search', es: 'Buscar' },
  membersHeading: { pt: 'Membros', en: 'Members', es: 'Miembros' },
  messageInputLabel: { pt: 'Mensagem do ChatOps', en: 'ChatOps message', es: 'Mensaje de ChatOps' },
  sendMessageLabel: { pt: 'Enviar (Enter)', en: 'Send (Enter)', es: 'Enviar (Intro)' },
  focusModeLabel: { pt: 'Modo foco (⌘B)', en: 'Focus mode (⌘B)', es: 'Modo de enfoque (⌘B)' },
  collapseSidebarLabel: { pt: 'Recolher barra lateral (⌘B)', en: 'Collapse sidebar (⌘B)', es: 'Contraer barra lateral (⌘B)' },
  searchPlaceholder: { pt: 'Pesquisar em todos os canais…', en: 'Search all channels…', es: 'Buscar en todos los canales…' },
  imageAlt: { pt: 'Imagem partilhada', en: 'Shared image', es: 'Imagen compartida' },
  imagePreview: { pt: 'Ver imagem', en: 'View image', es: 'Ver imagen' },
  reactToMessage: { pt: 'Reagir', en: 'React', es: 'Reaccionar' },
  replyToMessage: { pt: 'Responder', en: 'Reply', es: 'Responder' },
  moreMessageOptions: { pt: 'Mais opções', en: 'More options', es: 'Más opciones' },
  searchEmoji: { pt: 'Pesquisar emojis…', en: 'Search emojis…', es: 'Buscar emojis…' },
  dragToShare: { pt: 'Largar para partilhar em', en: 'Drop to share in', es: 'Soltar para compartir en' },
  websocketLatency: { pt: 'Latência WebSocket', en: 'WebSocket latency', es: 'Latencia de WebSocket' },
  messagesStat: { pt: 'Mensagens', en: 'Messages', es: 'Mensajes' },
  onlineStat: { pt: 'Online', en: 'Online', es: 'En línea' },
  filesStat: { pt: 'Ficheiros', en: 'Files', es: 'Archivos' },
  pinnedStat: { pt: 'Fixadas', en: 'Pinned', es: 'Fijados' },
  channelStatistics: { pt: 'Estatísticas do canal', en: 'Channel statistics', es: 'Estadísticas del canal' },
  presenceDuration: { pt: 'há', en: 'for', es: 'desde hace' },
  messageSendFailed: { pt: 'Não foi possível enviar a mensagem.', en: 'The message could not be sent.', es: 'No se pudo enviar el mensaje.' },
  messageConnectionLost: { pt: 'A ligação foi interrompida antes de confirmar o envio. Volte a tentar.', en: 'The connection closed before the message was confirmed. Please try again.', es: 'La conexión se interrumpió antes de confirmar el envío. Inténtalo de nuevo.' },
  uploadFailed: { pt: 'Não foi possível carregar o ficheiro.', en: 'The file could not be uploaded.', es: 'No se pudo cargar el archivo.' },
  fileUploaded: { pt: 'Ficheiro carregado', en: 'File uploaded', es: 'Archivo cargado' },
  connectionEstablished: { pt: 'Ligação estabelecida', en: 'Connection established', es: 'Conexión establecida' },
  channelSettings: { pt: 'Abrir definições do canal', en: 'Open channel settings', es: 'Abrir configuración del canal' },
  messagesCount: { pt: 'mensagens', en: 'messages', es: 'mensajes' },
  onlineCount: { pt: 'online', en: 'online', es: 'en línea' },
  statusBarConnected: { pt: 'Ligado', en: 'Connected', es: 'Conectado' },
  settingsNotifications: { pt: 'Notificações', en: 'Notifications', es: 'Notificaciones' },
  readReceiptsNote: { pt: 'Consulte quem leu a mensagem e quando foi visualizada.', en: 'See who read the message and when it was viewed.', es: 'Consulta quién leyó el mensaje y cuándo se visualizó.' },
  compactModeNote: { pt: 'Mostre mais informação em menos espaço.', en: 'Show more information in less space.', es: 'Muestra más información en menos espacio.' },
  startGroupCall: { pt: 'Iniciar chamada no grupo', en: 'Start a group call', es: 'Iniciar llamada grupal' },
  noMembersToCall: { pt: 'Não há outros membros em linha neste grupo.', en: 'No other group members are online.', es: 'No hay otros miembros del grupo en línea.' },
  themeLight: { pt: 'Claro', en: 'Light', es: 'Claro' },
  themeDark: { pt: 'Escuro', en: 'Dark', es: 'Oscuro' },
  startChatHint:   { pt: 'Escreva uma mensagem para começar.', en: 'Send a message to get started.', es: 'Escribe un mensaje para empezar.' },
  messagePlaceholder: { pt: 'Mensagem em', en: 'Message in', es: 'Mensaje en' },
  chat:            { pt: 'Chat', en: 'Chat', es: 'Chat' },
  pins:            { pt: 'Pins', en: 'Pins', es: 'Pins' },
  search:          { pt: 'Pesquisa', en: 'Search', es: 'Buscar' },
  welcomeToChannel:{ pt: 'Bem-vindo ao', en: 'Welcome to', es: 'Bienvenido a' },
  welcomeHint:     { pt: 'Escreva uma mensagem para começar.', en: 'Send a message to get started.', es: 'Escribe un mensaje para empezar.' },
  groupName:       { pt: 'Nome do grupo', en: 'Group name', es: 'Nombre del grupo' },
  groupNamePlaceholder: { pt: 'ex.: Projeto X', en: 'e.g. Project X', es: 'p. ej., Proyecto X' },
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
  system:          { pt: 'Sistema', en: 'System', es: 'Sistema' },
  reply:           { pt: 'Responder', en: 'Reply', es: 'Responder' },
  pin:             { pt: 'Fixar', en: 'Pin', es: 'Fijar' },
  copy:            { pt: 'Copiar', en: 'Copy', es: 'Copiar' },
  copied:          { pt: 'Copiado!', en: 'Copied!', es: '¡Copiado!' },
  delete:          { pt: 'Eliminar', en: 'Delete', es: 'Eliminar' },
  messageDeleted:  { pt: 'Mensagem eliminada', en: 'Message deleted', es: 'Mensaje eliminado' },
  readReceipt:     { pt: 'Visto', en: 'Seen', es: 'Visto' },
  sending:         { pt: 'A enviar…', en: 'Sending…', es: 'Enviando…' },
  pinnedMessagesTitle: { pt: 'Mensagens fixadas', en: 'Pinned messages', es: 'Mensajes fijados' },
  remove:          { pt: 'Remover', en: 'Remove', es: 'Quitar' },
  pinRemoved:      { pt: 'Mensagem desafixada', en: 'Message unpinned', es: 'Mensaje desfijado' },
  searchMessages:  { pt: 'Pesquisar mensagens', en: 'Search messages', es: 'Buscar mensajes' },
  mentionsPlaceholder: { pt: '@ menções', en: '@ mentions', es: '@ menciones' },
  mobileMenu:      { pt: 'Menu móvel', en: 'Mobile menu', es: 'Menú móvil' },
  rightPanel:      { pt: 'Painel direito', en: 'Right panel', es: 'Panel derecho' },
  noData:          { pt: 'sem dados', en: 'no data', es: 'sin datos' },
  unread:          { pt: 'não lidas', en: 'unread', es: 'sin leer' },
  typing:          { pt: 'está a escrever…', en: 'is typing…', es: 'está escribiendo…' },
  readBy:          { pt: 'Visto por', en: 'Seen by', es: 'Visto por' },
  pinAlreadyExists:{ pt: 'Esta mensagem já está fixada.', en: 'This message is already pinned.', es: 'Este mensaje ya está fijado.' },
  messageDeleteFailed: { pt: 'Não foi possível eliminar a mensagem.', en: 'The message could not be deleted.', es: 'No se pudo eliminar el mensaje.' },
  messagePinned:   { pt: 'Mensagem fixada.', en: 'Message pinned.', es: 'Mensaje fijado.' },
  groupMemberAdded:{ pt: 'Membro adicionado ao grupo.', en: 'Member added to the group.', es: 'Miembro añadido al grupo.' },
  groupInvitationReceived: { pt: 'Foi adicionado ao grupo', en: 'You were added to the group', es: 'Te añadieron al grupo' },
  pinnedLoadFailed: { pt: 'Não foi possível carregar as mensagens fixadas.', en: 'Pinned messages could not be loaded.', es: 'No se pudieron cargar los mensajes fijados.' },
  groupsLoadFailed: { pt: 'Não foi possível atualizar a lista de grupos.', en: 'The group list could not be refreshed.', es: 'No se pudo actualizar la lista de grupos.' },
  pinActionFailed: { pt: 'Não foi possível atualizar a mensagem fixada.', en: 'The pinned message could not be updated.', es: 'No se pudo actualizar el mensaje fijado.' },
  unpin:           { pt: 'Desafixar', en: 'Unpin', es: 'Desfijar' },
  inviteFailed:    { pt: 'Não foi possível adicionar o membro.', en: 'The member could not be added.', es: 'No se pudo añadir al miembro.' },
  inviteUserNotFound: { pt: 'Não foi encontrado um utilizador registado com esse ID ou email.', en: 'No registered user was found with that ID or email.', es: 'No se encontró ningún usuario registrado con ese ID o correo.' },
  inviteOwnerOnly: { pt: 'Só o proprietário pode adicionar membros a este grupo.', en: 'Only the group owner can add members.', es: 'Solo el propietario del grupo puede añadir miembros.' },
  inviteAlreadyMember: { pt: 'Esse utilizador já pertence ao grupo.', en: 'That user is already a member of this group.', es: 'Ese usuario ya pertenece a este grupo.' },
};

const CHANNELS_LIST = [
  { id: 'logistica', name: { pt: 'Logística', en: 'Logistics', es: 'Logística' }, icon: <Truck size={15} />, description: { pt: 'Operações de armazém e expedição', en: 'Warehouse and dispatch operations', es: 'Operaciones de almacén y expedición' }, topic: { pt: 'Gestão de armazém e expedição', en: 'Warehouse and order dispatch management', es: 'Gestión de almacén y expedición' } },
  { id: 'geral', name: { pt: 'Geral', en: 'General', es: 'General' }, icon: <MessageCircle size={15} />, description: { pt: 'Comunicação interna', en: 'Internal communication', es: 'Comunicación interna' }, topic: { pt: 'Canal de comunicação geral da empresa', en: 'Company-wide general communication channel', es: 'Canal de comunicación general de la empresa' } },
  { id: 'comercial', name: { pt: 'Vendas', en: 'Sales', es: 'Ventas' }, icon: <TrendingUp size={15} />, description: { pt: 'Vendas e gestão de clientes', en: 'Sales and customer management', es: 'Ventas y gestión de clientes' }, topic: { pt: 'Gestão de vendas B2B e clientes', en: 'B2B sales pipeline and customer management', es: 'Gestión de ventas B2B y clientes' } },
  { id: 'suporte', name: { pt: 'Suporte', en: 'Support', es: 'Soporte' }, icon: <Wrench size={15} />, description: { pt: 'Apoio técnico', en: 'Technical support', es: 'Asistencia técnica' }, topic: { pt: 'Apoio técnico e resolução de problemas', en: 'Technical support and issue resolution', es: 'Asistencia técnica y resolución de problemas' } },
  { id: 'alertas', name: { pt: 'Alertas', en: 'Alerts', es: 'Alertas' }, icon: <AlertTriangle size={15} />, description: { pt: 'Notificações automáticas', en: 'Automatic notifications', es: 'Notificaciones automáticas' }, topic: { pt: 'Notificações automáticas do sistema', en: 'Automatic system notifications', es: 'Notificaciones automáticas del sistema' } },
];

type ConnectionState = 'connected' | 'reconnecting' | 'offline';
type TabPanel = 'chat' | 'pins' | 'search';

// ── Latência ─────────────────────────────────────────────────
function LatencyIcon({ ms, noDataLabel }: { ms: number | null; noDataLabel: string }) {
  const cls = ms === null ? 'latency-none' : ms < 80 ? 'latency-good' : ms < 250 ? 'latency-ok' : 'latency-bad';
  return (
    <span className={`latency-indicator ${cls}`} title={ms !== null ? `${ms} ms` : noDataLabel}>
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

type PinnedMessage = {
  id: string; text: string; userId: string; ts: number; channelId: string;
  pinnedByUserId?: string; pinnedAt?: string;
};

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
              <label><input type="radio" name="theme" value="light" checked={settings.theme==='light'} onChange={() => onChange({...settings, theme:'light'})}/> {t('themeLight')}</label>
              <label><input type="radio" name="theme" value="dark"  checked={settings.theme==='dark'}  onChange={() => onChange({...settings, theme:'dark'})}/> {t('themeDark')}</label>
            </div>
          </div>
          <div className="settings-group">
            <div className="settings-label">{t('settingsNotifications')}</div>
            <label><input type="checkbox" checked={settings.notifications.messages} onChange={e => onChange({...settings, notifications:{...settings.notifications, messages:e.target.checked}})}/> {t('newMessages')}</label>
            <label><input type="checkbox" checked={settings.notifications.mentions} onChange={e => onChange({...settings, notifications:{...settings.notifications, mentions:e.target.checked}})}/> {t('mentions')}</label>
            <label><input type="checkbox" checked={settings.notifications.sound}    onChange={e => onChange({...settings, notifications:{...settings.notifications, sound:e.target.checked}})}/> {t('sound')}</label>
          </div>
          <div className="settings-group">
            <label><input type="checkbox" checked={settings.readReceipts} onChange={e => onChange({...settings, readReceipts:e.target.checked})}/> {t('readReceipts')}</label>
            <p className="settings-note">{t('readReceiptsNote')}</p>
          </div>
          <div className="settings-group">
            <label><input type="checkbox" checked={compactMode} onChange={e => onCompactModeChange(e.target.checked)}/> {t('compactMode')}</label>
            <p className="settings-note">{t('compactModeNote')}</p>
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

function InviteModal({ open, target, group, groups, submitting, error, onClose, onSubmit, onTargetChange, onGroupChange }: {
  open: boolean; target: string; group: string; groups: { id: string; name: string }[];
  submitting: boolean; error: string; onClose: () => void; onSubmit: () => void;
  onTargetChange: (v: string) => void; onGroupChange: (v: string) => void;
}) {
  const { language } = useLanguage();
  if (!open) return null;
  const text = (pt: string, en: string, es: string) => translateText({ pt, en, es }, language);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <header><h3><UserPlus size={16}/> {text('Adicionar membro a um grupo', 'Add a member to a group', 'Añadir miembro a un grupo')}</h3></header>
        <form onSubmit={e => { e.preventDefault(); onSubmit(); }}>
          <p>{text('Só é possível adicionar utilizadores já registados no ChatOps. A adição é imediata.', 'Only users already registered in ChatOps can be added. They will be added immediately.', 'Solo se pueden añadir usuarios ya registrados en ChatOps. Se añadirán inmediatamente.')}</p>
          <label>{text('ID ou email do utilizador', 'User ID or email', 'ID o correo electrónico del usuario')}
            <input value={target} onChange={e => onTargetChange(e.target.value)} placeholder={text('ID ou email registado', 'Registered ID or email', 'ID o correo registrado')} required/>
          </label>
          <label>{text('Canal ou grupo', 'Channel or group', 'Canal o grupo')}
            <select value={group} onChange={e => onGroupChange(e.target.value)}>
              <option value="">{text('Selecionar grupo privado', 'Select a private group', 'Seleccionar un grupo privado')}</option>
              {groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          {groups.length === 0 && <p>{text('Ainda não pertence a nenhum grupo privado.', 'You do not belong to any private groups yet.', 'Aún no perteneces a ningún grupo privado.')}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:12}}>
            <button type="button" onClick={onClose}>{text('Cancelar', 'Cancel', 'Cancelar')}</button>
            <button type="submit" className="btn-send" disabled={submitting || !group || !target.trim()}>
              {submitting ? '…' : text('Adicionar membro', 'Add member', 'Añadir miembro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmojiPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const { language } = useLanguage();
  const [query, setQuery] = useState('');
  const allEmojis = EMOJI_CATEGORIES.flatMap(c => c.emojis);
  const filteredCats = query
    ? [{ label: translateText({ pt: 'Resultados', en: 'Results', es: 'Resultados' }, language), emojis: allEmojis.filter(e => e.includes(query)) }]
    : EMOJI_CATEGORIES;
  const categoryLabels = [
    { pt: 'Reações', en: 'Reactions', es: 'Reacciones' },
    { pt: 'Objetos', en: 'Objects', es: 'Objetos' },
    { pt: 'Símbolos', en: 'Symbols', es: 'Símbolos' },
  ];

  return (
    <div className="emoji-picker-wrapper" onClick={e => e.stopPropagation()}>
      <input className="emoji-picker-search" placeholder={translateText(TRANSLATIONS.searchEmoji, language)} value={query} onChange={e => setQuery(e.target.value)} autoFocus/>
      {filteredCats.map((cat, index) => (
        <div key={index}>
          <div className="emoji-category-label">{query ? cat.label : translateText(categoryLabels[index], language)}</div>
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
  const [user, setUser] = useState<ChatOpsUser | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sessionError, setSessionError] = useState('');

  const checkSession = async () => {
    setCheckingSession(true);
    setSessionError('');
    try {
      const response = await fetch(`${API_URL}/auth/session`, { credentials: 'include' });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      const result = await response.json() as { user?: ChatOpsUser; error?: string };
      if (!response.ok || !result.user) {
        throw new Error(result.error || AUTH_TEXT.unavailable.pt);
      }
      setUser(result.user);
    } catch (error) {
      setUser(null);
      setSessionError(error instanceof Error ? error.message : AUTH_TEXT.unavailable.pt);
    } finally {
      setCheckingSession(false);
    }
  };

  useEffect(() => { void checkSession(); }, []);

  const logout = async () => {
    const response = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw new Error('Não foi possível terminar a sessão.');
    setUser(null);
  };

  if (checkingSession) {
    return <main className="auth-screen"><p className="auth-loading">{AUTH_TEXT.title.pt}</p></main>;
  }
  if (!user) {
    return <AuthScreen onAuthenticated={setUser} initialError={sessionError || undefined} onRetry={() => void checkSession()} />;
  }
  return <ChatWorkspace key={user.id} currentUser={user} onLogout={logout} />;
}

function ChatWorkspace({ currentUser, onLogout }: {
  currentUser: ChatOpsUser;
  onLogout: () => Promise<void>;
}) {
    const currentUserId = currentUser.id;
    const { language, setLanguage } = useLanguage();
    const t = useCallback((key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language), [language]);
    const [createGroupOpen, setCreateGroupOpen] = useState(false);
    const [privateGroups, setPrivateGroups] = useState<PrivateGroup[]>([]);
    const [manageGroupOpen, setManageGroupOpen] = useState(false);
    const channelStorageKey = `chatops-active-channel:${currentUserId}`;
    const draftsStorageKey = `chatops-drafts:${currentUserId}`;
  // ── State ──────────────────────────────────────────────────
  const [activeChannel, setActiveChannel] = useState(() => {
    if (typeof window === 'undefined') return 'logistica';
    return localStorage.getItem(channelStorageKey) || 'logistica';
  });
  const [channelDrafts, setChannelDrafts] = useState<Record<string, string>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      return JSON.parse(localStorage.getItem(draftsStorageKey) || '{}');
    } catch {
      return {};
    }
  });
  const [command, setCommand] = useState(() => {
    if (typeof window === 'undefined') return '';
    const savedChannel = localStorage.getItem(channelStorageKey) || 'logistica';
    try {
      const drafts = JSON.parse(localStorage.getItem(draftsStorageKey) || '{}');
      return drafts[savedChannel] || '';
    } catch {
      return '';
    }
  });
  const [invalidCommand, setInvalidCommand] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);
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
  const [settings, setSettings] = useState<SettingsState>(() => ({ ...DEFAULT_SETTINGS, displayName: currentUser.name }));
  const [compactMode, setCompactMode] = useState(false);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTarget, setInviteTarget] = useState('');
  const [inviteGroup, setInviteGroup] = useState(activeChannel);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [onlineMembers, setOnlineMembers] = useState<{
    id: string;
    name: string;
    online?: boolean;
    presence?: PresenceStatus;
    presenceChangedAt?: number;
  }[]>([]);
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
  const [channelTopic, setChannelTopic] = useState<Record<string, string>>({});
  const defaultActiveChannel = CHANNELS_LIST.find(channel => channel.id === activeChannel);
  const activeChannelTopic = channelTopic[activeChannel]
    ?? (defaultActiveChannel ? translateText(defaultActiveChannel.topic, language) : '');
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
        localStorage.setItem(draftsStorageKey, JSON.stringify(updated));
      }
      return updated;
    });
  }, [activeChannel, command, draftsStorageKey]);

  // ── Refs ───────────────────────────────────────────────────
  const wsRef              = useRef<WebSocket | null>(null);
  const virtuosoRef        = useRef<VirtuosoHandle | null>(null);
  const visibleMessageIdsRef = useRef<string[]>([]);
  const inputRef           = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef       = useRef<HTMLInputElement | null>(null);
  const activeChannelRef   = useRef(activeChannel);
  const lastSentAtRef      = useRef(0);
  const typingThrottleRef  = useRef(0);
  const reconnectTimerRef  = useRef<number | null>(null);
  const isAtBottomRef      = useRef(true);
  const lastActivityRef    = useRef(Date.now());
  const presenceTimerRef   = useRef<number | null>(null);
  const manualPresenceRef = useRef<PresenceStatus>('online');
  const [presenceChangedAt, setPresenceChangedAt] = useState(Date.now());
  const pingTimerRef       = useRef<number | null>(null);
  const pingStartRef       = useRef<number>(0);

  // ── Store ──────────────────────────────────────────────────
  const allMessages      = useChatStore(s => s.messages);
  const addMessage       = useChatStore(s => s.addMessage);
  const prependMessages  = useChatStore(s => s.prependMessages);
  const clearChannel     = useChatStore(s => s.clearChannel);
  const removeMessage = useChatStore(s => s.removeMessage);
  const addReadReceipt = useChatStore(s => s.addReadReceipt);
  const confirmMessage   = useChatStore(s => s.confirmMessage);
  const failMessage      = useChatStore(s => s.failMessage);
  const failPendingMessages = useChatStore(s => s.failPendingMessages);

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

  const isLogisticsChannel = activeChannel === 'logistica';
  const commandSuggestions: {
    label: string;
    shortcut: string;
    description: { pt: string; en: string; es: string };
    icon: ReactNode;
  }[] = isLogisticsChannel ? [{
    label: '/stock',
    shortcut: '/stock',
    description: {
      pt: 'Consultar o stock atual de um SKU.',
      en: 'Check the current stock for a SKU.',
      es: 'Consultar el stock actual de un SKU.',
    },
    icon: <Package size={14} />,
  }, {
    label: '/low-stock',
    shortcut: '/low-stock',
    description: {
      pt: 'Listar produtos com 5 ou menos unidades em stock.',
      en: 'List products with 5 units or fewer in stock.',
      es: 'Listar productos con 5 unidades o menos en existencias.',
    },
    icon: <AlertTriangle size={14} />,
  }, {
    label: '/order',
    shortcut: '/order',
    description: {
      pt: 'Consultar o estado de uma encomenda pelo ID (24 caracteres hexadecimais).',
      en: 'Check an order status by ID (24 hexadecimal characters).',
      es: 'Consultar el estado de un pedido por ID (24 caracteres hexadecimales).',
    },
    icon: <Truck size={14} />,
  }, ...(currentUser.role.toLowerCase() === 'admin' ? [{
    label: '/approve-credit',
    shortcut: '/approve-credit',
    description: {
      pt: 'Aprovar crédito de uma empresa (administradores).',
      en: 'Approve a company credit request (administrators).',
      es: 'Aprobar el crédito de una empresa (administradores).',
    },
    icon: <CheckCircle2 size={14} />,
  }] : [])] : [];

  const commandPrefix = command.trim().split(/\s/, 1)[0].toLowerCase();
  const filteredCommands = commandPrefix.startsWith('/')
    ? commandSuggestions.filter(item => item.shortcut.startsWith(commandPrefix))
    : [];

  const filteredMentions = useMemo(() => {
    const atMatch = command.match(/@(\w*)$/);
    if (!atMatch) return [];
    const q = atMatch[1].toLowerCase();
    return teamMembers.filter(m => m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [command, teamMembers]);

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

  useEffect(() => {
    setInviteGroup(privateGroups.some(group => group.id === activeChannel)
      ? activeChannel
      : privateGroups[0]?.id || '');
  }, [activeChannel, privateGroups]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(channelStorageKey, activeChannel);
    setCommand(channelDrafts[activeChannel] || '');
  }, [activeChannel, channelDrafts, channelStorageKey]);

  // ── Presença automática ───────────────────────────────────
  const recordActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (manualPresenceRef.current === 'online') {
      setUserPresence(prev => (prev === 'away' ? 'online' : prev));
    }
  }, []);

  useEffect(() => {
    presenceTimerRef.current = window.setInterval(() => {
      const idle = Date.now() - lastActivityRef.current;
      if (manualPresenceRef.current === 'online') {
        setUserPresence(idle > 5 * 60_000 ? 'away' : 'online');
      }
    }, 5_000);

    const onVisibilityChange = () => {
      if (!document.hidden) recordActivity();
    };
    document.addEventListener('mousemove', recordActivity);
    document.addEventListener('pointerdown', recordActivity);
    document.addEventListener('keydown', recordActivity);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', recordActivity);
    return () => {
      if (presenceTimerRef.current) window.clearInterval(presenceTimerRef.current);
      document.removeEventListener('mousemove', recordActivity);
      document.removeEventListener('pointerdown', recordActivity);
      document.removeEventListener('keydown', recordActivity);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', recordActivity);
    };
  }, [recordActivity]);

  useEffect(() => {
    setPresenceChangedAt(Date.now());
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'presence', status: userPresence }));
    }
  }, [userPresence]);

  // ── Toast ─────────────────────────────────────────────────
  const addToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = `toast-${Date.now()}`;
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);
  const calls = useWebRtcCalls(currentUserId, wsRef, addToast);

  useEffect(() => {
    if (connectionState !== 'connected') calls.handleSignalingLoss();
  }, [calls.handleSignalingLoss, connectionState]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/users`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`Pedido de utilizadores falhou (${response.status}).`);
        const users = await response.json() as { id: string; name: string }[];
        if (!Array.isArray(users) || users.some(user => typeof user.id !== 'string' || typeof user.name !== 'string')) {
          throw new Error('Resposta inválida ao carregar os utilizadores.');
        }
        if (!cancelled) setTeamMembers(users);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Could not load ChatOps users', error);
          addToast('Não foi possível carregar a lista de utilizadores.', 'error');
        }
      });
    return () => { cancelled = true; };
  }, [addToast]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/groups`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`Pedido de grupos falhou (${response.status}).`);
        const groups = await response.json() as PrivateGroup[];
        if (
          !Array.isArray(groups) ||
          groups.some(group =>
            typeof group.id !== 'string' ||
            typeof group.name !== 'string' ||
            !Array.isArray(group.members) ||
            group.members.some(member => typeof member.id !== 'string' || typeof member.name !== 'string')
          )
        ) {
          throw new Error('Resposta inválida ao carregar os grupos privados.');
        }
        if (cancelled) return;
        setPrivateGroups(groups);
        if (
          !CHANNELS_LIST.some(channel => channel.id === activeChannelRef.current) &&
          !groups.some(group => group.id === activeChannelRef.current)
        ) {
          setActiveChannel('logistica');
        }
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Could not load private groups', error);
          addToast('Não foi possível carregar os grupos privados.', 'error');
        }
      });
    return () => { cancelled = true; };
  }, [addToast]);

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
    ws.send(JSON.stringify({ type: 'subscribe', channelId }));
  };

  const initializeWebSocket = () => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setConnectionState('connected');
      sendSubscribe(activeChannelRef.current);
      ws.send(JSON.stringify({ type: 'presence', status: userPresence }));
      addToast(t('connectionEstablished'), 'success');
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

        if (calls.handleWebSocketMessage(data)) return;

        if (data.type === 'channel_access_revoked' || data.type === 'group_deleted') {
          setPrivateGroups(previous => previous.filter(group => group.id !== data.channelId));
          if (activeChannelRef.current === data.channelId) setActiveChannel('logistica');
          addToast(data.type === 'group_deleted' ? 'O grupo foi eliminado.' : 'O seu acesso ao grupo foi removido.', 'info');
          return;
        }
        if (data.type === 'group_invitation' && data.channelId) {
          void fetch(`${API_URL}/groups`, { credentials: 'include' })
            .then(async response => {
              if (!response.ok) throw new Error(`Could not reload private groups (${response.status}).`);
              return await response.json() as PrivateGroup[];
            })
            .then(groups => {
              setPrivateGroups(groups);
              addToast(`${t('groupInvitationReceived')} "${data.channelName || data.channelId}".`, 'info');
            })
            .catch(error => {
              console.error('Could not load invited private group', error);
              addToast(t('groupsLoadFailed'), 'error');
            });
          return;
        }
        if (data.type === 'error') {
          addToast(data.error || 'A operação não foi autorizada.', 'error');
          if (activeChannelRef.current.startsWith('grp-')) setActiveChannel('logistica');
          return;
        }
        if (data.type === 'message_failed') {
          if (typeof data.tempId === 'string') failMessage(data.tempId);
          setIsProcessing(false);
          addToast(data.error || t('messageSendFailed'), 'error');
          return;
        }
        if (data.type === 'message_delete_failed') {
          addToast(t('messageDeleteFailed'), 'error');
          return;
        }
        if (data.type === 'message_deleted' && typeof data.messageId === 'string') {
          removeMessage(data.messageId);
          setPinnedMessages(previous => previous.filter(pin => pin.id !== data.messageId));
          return;
        }
        if (data.type === 'pin_added' && data.pin?.channelId === activeChannelRef.current) {
          setPinnedMessages(previous => previous.some(pin => pin.id === data.pin.id)
            ? previous
            : [data.pin, ...previous]);
          return;
        }
        if (data.type === 'pin_removed' && typeof data.messageId === 'string') {
          setPinnedMessages(previous => previous.filter(pin => pin.id !== data.messageId));
          return;
        }
        if (
          data.type === 'read_receipt' &&
          typeof data.messageId === 'string' &&
          typeof data.userId === 'string' &&
          typeof data.readAt === 'string'
        ) {
          addReadReceipt(data.messageId, { userId: data.userId, readAt: data.readAt });
          return;
        }

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
            id: data.messageId || data.id || `msg-${data.channelId}-${data.ts}-${Math.random().toString(36).slice(2)}`,
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
          const members = data.members || [];
          setOnlineMembers(members);
          const ownPresence = members.find((member: { id: string }) => member.id === currentUserId);
          if (ownPresence?.presenceChangedAt) setPresenceChangedAt(ownPresence.presenceChangedAt);
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

    ws.addEventListener('close', () => {
      if (wsRef.current !== ws) return;
      setConnectionState('offline');
      setLatencyMs(null);
      if (failPendingMessages() > 0) addToast(t('messageConnectionLost'), 'error');
      setIsProcessing(false);
      scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      if (wsRef.current !== ws) return;
      setConnectionState('offline');
      setLatencyMs(null);
      if (failPendingMessages() > 0) addToast(t('messageConnectionLost'), 'error');
      setIsProcessing(false);
      scheduleReconnect();
    });
  };

  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);

  useEffect(() => {
    initializeWebSocket();
    return () => {
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (pingTimerRef.current) window.clearInterval(pingTimerRef.current);
      const currentSocket = wsRef.current;
      wsRef.current = null;
      currentSocket?.close();
    };
  }, []);

  // ── History ───────────────────────────────────────────────
  const loadHistory = async (channelId: string, before?: number) => {
    setIsLoadingHistory(true);
    try {
      const url = new URL(`${API_URL}/history`);
      url.searchParams.set('channelId', channelId);
      if (before) url.searchParams.set('before', String(before));
      const res = await fetch(url.toString(), { credentials: 'include' });
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
        const mRes = await fetch(`${API_URL}/channels/${activeChannel}/members`, { credentials: 'include' });
        setOnlineMembers(mRes.ok ? await mRes.json() : []);
      } catch { setOnlineMembers([]); }
      try {
        const fRes = await fetch(`${API_URL}/channels/${activeChannel}/files`, { credentials: 'include' });
        setChannelFiles(fRes.ok ? await fRes.json() : []);
      } catch { setChannelFiles([]); }
    })();
    let cancelled = false;
    fetch(`${API_URL}/channels/${encodeURIComponent(activeChannel)}/pins`, { credentials: 'include' })
      .then(async response => {
        if (!response.ok) throw new Error(`Could not load pinned messages (${response.status}).`);
        return await response.json() as PinnedMessage[];
      })
      .then(pins => {
        if (!cancelled) setPinnedMessages(previous => [
          ...previous.filter(pin => pin.channelId !== activeChannel),
          ...pins,
        ]);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('Could not load pinned messages', error);
          addToast(t('pinnedLoadFailed'), 'error');
        }
      });
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => { cancelled = true; };
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
  const handleSend = async () => {
    const trimmed = command.trim();
    if (!trimmed && !pendingAttachment) return;
    if (/^\/(stock|low-stock|order|approve-credit)(?:\s|$)/.test(trimmed)) {
      if (!isLogisticsChannel) {
        addToast(translateText(TRANSLATIONS.commandsOnlyLogistics, language), 'error');
        return;
      }
    }
    if (trimmed.startsWith('/') &&
      !/^\/stock\s+\S+$/.test(trimmed) &&
      !/^\/low-stock$/.test(trimmed) &&
      !/^\/order(?:\s+[a-f\d]{24})?$/i.test(trimmed) &&
      !/^\/approve-credit\s+[A-Za-z0-9_-]{1,64}$/.test(trimmed)) {
      addToast(t('commandNotAvailable'), 'error');
      setInvalidCommand(true);
      window.setTimeout(() => setInvalidCommand(false), 1400);
      return;
    }
    if (wsRef.current?.readyState !== WebSocket.OPEN) return;
    const now = Date.now();
    if (now - lastSentAtRef.current < 800) return;
    lastSentAtRef.current = now;
    recordActivity();

    setIsProcessing(true);
    let attachmentMarkdown = '';
    if (pendingAttachment) {
      try {
        const fileUrl = await doUpload(pendingAttachment.file);
        attachmentMarkdown = `[${pendingAttachment.file.name}](${fileUrl})`;
      } catch (error) {
        setIsProcessing(false);
        addToast(error instanceof Error ? error.message : t('uploadFailed'), 'error');
        return;
      }
    }
    const tempId = `temp-${now}-${Math.random().toString(36).slice(2)}`;
    const content = [trimmed, attachmentMarkdown].filter(Boolean).join(' ');
    const text = replyTo
      ? `↩ *Em resposta a ${replyTo.userId}:*\n> ${replyTo.text?.slice(0, 80)}${(replyTo.text?.length || 0) > 80 ? '…' : ''}\n\n${content}`
      : content;

    addMessage({ id: tempId, tempId, channelId: activeChannel, text, userId: currentUserId, ts: now, pending: true, system: false });
    try {
      wsRef.current.send(JSON.stringify({ type: 'message', channelId: activeChannel, text, userId: currentUserId, tempId, replyToId: replyTo?.id, language }));
    } catch (error) {
      failMessage(tempId);
      setIsProcessing(false);
      addToast(error instanceof Error ? error.message : t('messageSendFailed'), 'error');
      return;
    }

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
  const handlePin = async (msg: ChatMessage) => {
    const existingPin = pinnedMessages.some(pin => pin.id === msg.id);
    try {
      const response = await fetch(
        `${API_URL}/channels/${encodeURIComponent(msg.channelId)}/pins${existingPin ? `/${encodeURIComponent(msg.id)}` : ''}`,
        {
          method: existingPin ? 'DELETE' : 'POST',
          credentials: 'include',
          headers: existingPin ? undefined : { 'content-type': 'application/json' },
          body: existingPin ? undefined : JSON.stringify({ messageId: msg.id }),
        },
      );
      if (!response.ok) {
        await response.json().catch(() => ({}));
        throw new Error(response.status === 409 ? t('pinAlreadyExists') : t('pinActionFailed'));
      }
      if (existingPin) {
        setPinnedMessages(previous => previous.filter(pin => pin.id !== msg.id));
        addToast(t('pinRemoved'), 'info');
      } else {
        const pin = await response.json() as PinnedMessage;
        setPinnedMessages(previous => previous.some(current => current.id === pin.id)
          ? previous
          : [pin, ...previous]);
        addToast(t('messagePinned'), 'success');
      }
    } catch (error) {
      console.error('Could not update pinned message', error);
      addToast(error instanceof Error ? error.message : t('pinActionFailed'), 'error');
    } finally {
      setMessageMenuFor(null);
    }
  };

  const handleDeleteMessage = (msg: ChatMessage) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      addToast(t('messageDeleteFailed'), 'error');
      setMessageMenuFor(null);
      return;
    }
    socket.send(JSON.stringify({
      type: 'delete_message',
      channelId: msg.channelId,
      messageId: msg.id,
    }));
    setMessageMenuFor(null);
  };

  // ── File upload ───────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    // Cria preview no input antes de enviar
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setPendingAttachment({ file, previewUrl });
  };

  const doUpload = async (file: File): Promise<string> => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('channelId', activeChannel);
    setUploadProgress(0);
    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)); };
      return await new Promise<string>((resolve, reject) => {
        xhr.open('POST', `${API_URL}/upload`);
        xhr.onload = () => {
          if (xhr.status >= 400) {
            reject(new Error(t('uploadFailed')));
            return;
          }
          try {
            const payload = JSON.parse(xhr.responseText);
            if (typeof payload.url !== 'string') throw new Error(t('uploadFailed'));
            resolve(payload.url);
          } catch (error) {
            reject(error instanceof Error ? error : new Error(t('uploadFailed')));
          }
        };
        xhr.onerror = () => reject(new Error(t('uploadFailed')));
        xhr.send(fd);
      });
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
  const callInvitees = onlineMembers
    .filter(member => member.online && member.id !== currentUserId)
    .map(member => member.id)
    .slice(0, 8);
  const typingInChannel = typingUsers[activeChannel];

  // Build message list with date separators (for rendering)
  const messageItems = useMemo(() => {
    const items: ({ type: 'date'; label: string; key: string } | { type: 'msg'; msg: ChatMessage; grouped: boolean })[] = [];
    let lastDate = '';
    let lastUserId = '';
    let lastTs = 0;
    for (const msg of sortedMessages) {
      const label = getDateLabel(msg.ts, language);
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
  }, [language, sortedMessages]);

  const sendVisibleReadReceipts = useCallback(() => {
   if (
     !settings.readReceipts ||
     activeTab !== 'chat' ||
     document.hidden ||
     !document.hasFocus()
   ) return;
   const socket = wsRef.current;
   if (!socket || socket.readyState !== WebSocket.OPEN) return;
   const messageIds = visibleMessageIdsRef.current;
   if (messageIds.length > 0) {
     socket.send(JSON.stringify({
       type: 'read_receipts',
       channelId: activeChannel,
       messageIds,
     }));
   }
  }, [activeChannel, activeTab, settings.readReceipts]);

  useEffect(() => {
   visibleMessageIdsRef.current = [];
  }, [activeChannel]);

  useEffect(() => {
   const handleFocus = () => {
     window.requestAnimationFrame(sendVisibleReadReceipts);
   };
   window.addEventListener('focus', handleFocus);
   document.addEventListener('visibilitychange', handleFocus);
   return () => {
     window.removeEventListener('focus', handleFocus);
     document.removeEventListener('visibilitychange', handleFocus);
   };
  }, [sendVisibleReadReceipts]);

  useEffect(() => {
   sendVisibleReadReceipts();
  }, [activeTab, connectionState, sendVisibleReadReceipts, settings.readReceipts]);

  // ════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════
  // Handler para criar grupo privado
  const handleCreateGroup = (group: { name: string; members: string[] }) => {
    void (async () => {
      try {
        const response = await fetch(`${API_URL}/groups`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(group),
        });
        const result = await response.json() as PrivateGroup & { error?: string };
        if (!response.ok) throw new Error(result.error || 'Não foi possível criar o grupo.');
        setPrivateGroups(previous => [result, ...previous]);
        setActiveChannel(result.id);
        addToast('Grupo criado e guardado.', 'success');
      } catch (error) {
        console.error('Could not create private group', error);
        addToast(error instanceof Error ? error.message : 'Não foi possível criar o grupo.', 'error');
      }
    })();
  };
  const updateGroupMembers = async (groupId: string, userId: string, action: 'add' | 'remove') => {
    const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}/members`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, action }),
    });
    const result = await response.json() as { members?: PrivateGroupMember[]; error?: string };
    if (!response.ok || !result.members) throw new Error(result.error || 'Não foi possível atualizar os membros.');
    setPrivateGroups(previous => previous.map(group =>
      group.id === groupId ? { ...group, members: result.members! } : group
    ));
  };
  const deletePrivateGroup = async (groupId: string) => {
    const response = await fetch(`${API_URL}/groups/${encodeURIComponent(groupId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) {
      const result = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(result.error || 'Não foi possível eliminar o grupo.');
    }
    setPrivateGroups(previous => previous.filter(group => group.id !== groupId));
    if (activeChannel === groupId) setActiveChannel('logistica');
    setManageGroupOpen(false);
    addToast('Grupo eliminado.', 'success');
  };
  const handleInviteSubmit = async () => {
    setInviteSubmitting(true);
    setInviteError('');
    try {
      const response = await fetch(`${API_URL}/groups/${encodeURIComponent(inviteGroup)}/invitations`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target: inviteTarget.trim() }),
      });
      if (!response.ok) {
        const errorKey = response.status === 403
          ? 'inviteOwnerOnly'
          : response.status === 404
            ? 'inviteUserNotFound'
            : response.status === 409
              ? 'inviteAlreadyMember'
              : 'inviteFailed';
        await response.json().catch(() => ({}));
        throw new Error(t(errorKey));
      }
      const result = await response.json() as { members: PrivateGroupMember[] };
      setPrivateGroups(previous => previous.map(group => group.id === inviteGroup
        ? { ...group, members: result.members }
        : group));
      addToast(t('groupMemberAdded'), 'success');
      setInviteOpen(false);
      setInviteTarget('');
    } catch (error) {
      console.error('Could not add invited ChatOps member', error);
      setInviteError(error instanceof Error ? error.message : t('inviteFailed'));
    } finally {
      setInviteSubmitting(false);
    }
  };
  const activePrivateGroup = privateGroups.find(group => group.id === activeChannel) || null;
  const availableCall = calls.availableCalls.find(call =>
    call.channelId === activeChannel && call.invitedUserIds.includes(currentUserId),
  );
  const activeChannelName = activePrivateGroup?.name
    || CHANNELS_LIST.find(channel => channel.id === activeChannel)?.name[language]
    || activeChannel;

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
          <button className="sidebar-toggle-btn" onClick={() => setSidebarCollapsed(v => !v)} title={translateText(TRANSLATIONS.collapseSidebarLabel, language)} aria-label={translateText(TRANSLATIONS.collapseSidebarLabel, language)}>
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
            <span className="headline-icon">{activePrivateGroup ? <User size={15} /> : CHANNELS_LIST.find(c => c.id === activeChannel)?.icon}</span>
            <span className="headline-name"># {activeChannelName}</span>
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
              <span className="headline-topic" onClick={() => { setTopicDraft(activeChannelTopic); setEditingTopic(true); }}>
                {activeChannelTopic}
              </span>
            )}
            {activePrivateGroup && (
              <>
              <button
                type="button"
                className="hdr-btn hdr-btn-icon"
                aria-label={callInvitees.length ? translateText(TRANSLATIONS.startGroupCall, language) : translateText(TRANSLATIONS.noMembersToCall, language)}
                title={callInvitees.length ? translateText(TRANSLATIONS.startGroupCall, language) : translateText(TRANSLATIONS.noMembersToCall, language)}
                disabled={!callInvitees.length || connectionState !== 'connected'}
                onClick={() => { void calls.startCall(activeChannel, callInvitees, 'audio'); }}
              >
                <Phone size={15} />
              </button>
              <button
                type="button"
                className="hdr-btn hdr-btn-icon group-settings-trigger"
                aria-label={translateText(GROUP_TEXT.settings, language)}
                title={translateText(GROUP_TEXT.settings, language)}
                onClick={() => setManageGroupOpen(true)}
              >
                <Settings2 size={15} />
              </button>
              </>
            )}
          </div>
        </div>

        <div className="header-actions">
          <div style={{ display: 'flex', gap: 6, marginRight: 8 }}>
            <LanguageSwitcher />
          </div>

          <div className="header-clock">
            {currentTime.toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>

          {latencyMs !== null && (
            <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:'0.68rem', color:'var(--ink-faint)', fontFamily:'DM Mono, monospace', paddingRight:'0.5rem', borderRight:'1px solid var(--rule)' }}>
              <LatencyIcon ms={latencyMs} noDataLabel={t('noData')}/>
              {latencyMs}ms
            </span>
          )}

          <button
            type="button"
            className="hdr-btn hdr-btn-icon mobile-nav-btn"
            data-tooltip={t('mobileMenu')}
            aria-label={t('mobileMenu')}
            aria-expanded={mobileNavOpen}
            aria-controls="chatops-sidebar"
            onClick={() => setMobileNavOpen(v => !v)}
          >
            <Menu size={15}/>
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip={translateText(TRANSLATIONS.focusModeLabel, language)} onClick={() => setFocusMode(v => !v)}>
            {focusMode ? <Minimize2 size={15}/> : <Maximize2 size={15}/>}
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip={t('rightPanel')} onClick={() => setRightSidebarCollapsed(v => !v)}>
            <LayoutDashboard size={15}/>
          </button>

          <button type="button" className="hdr-btn hdr-btn-icon" data-tooltip={t('inviteMember')} onClick={() => setInviteOpen(true)}>
            <UserPlus size={15}/>
          </button>

          {availableCall && !calls.activeCall && !calls.incomingCall && !calls.mediaRequest && (
            <button
              type="button"
              className="hdr-btn call-rejoin-btn"
              onClick={() => calls.rejoinCall(availableCall)}
              aria-label={translateText({
                pt: `Voltar à chamada de ${availableCall.hostName}`,
                en: `Rejoin ${availableCall.hostName}'s call`,
                es: `Volver a la llamada de ${availableCall.hostName}`,
              }, language)}
            >
              <Phone size={15}/>
              <span className="call-rejoin-label">
                <strong>
                  {translateText({
                  pt: 'Chamada em andamento',
                  en: 'Call in progress',
                  es: 'Llamada en curso',
                }, language)}
                  {' · '}{formatCallDuration(availableCall.startedAt, currentTime.getTime())}
                </strong>
                <small>
                  {availableCall.participantCount}{' '}
                  {translateText({
                    pt: availableCall.participantCount === 1 ? 'participante' : 'participantes',
                    en: availableCall.participantCount === 1 ? 'participant' : 'participants',
                    es: availableCall.participantCount === 1 ? 'participante' : 'participantes',
                  }, language)}
                  {' · '}{translateText({
                    pt: 'Voltar à chamada',
                    en: 'Rejoin call',
                    es: 'Volver a la llamada',
                  }, language)}
                </small>
              </span>
            </button>
          )}

          <div className={`status-pill status-${connectionState}`}>
            {connectionState === 'connected' && <span className="status-dot"/>}
            {connectionState === 'connected' ? t('online') : connectionState === 'reconnecting' ? t('reconnecting') : t('offline')}
          </div>
        </div>
      </header>

      {/* ── MODAL CRIAR GRUPO PRIVADO ── */}
      <CallDialog
        activeCall={calls.activeCall}
        incomingCall={calls.incomingCall}
        mediaRequest={calls.mediaRequest}
        localStream={calls.localStream}
        remotePeers={calls.remotePeers}
        users={teamMembers}
        microphoneEnabled={calls.microphoneEnabled}
        cameraEnabled={calls.cameraEnabled}
        screenShareEnabled={calls.screenShareEnabled}
        microphones={calls.devices.microphones}
        audioOutputs={calls.devices.audioOutputs}
        cameras={calls.devices.cameras}
        audioOutputSelectionSupported={calls.devices.audioOutputSelectionSupported}
        audioDeviceId={calls.preferences.audioDeviceId}
        audioOutputDeviceId={calls.preferences.audioOutputDeviceId}
        videoDeviceId={calls.preferences.videoDeviceId}
        soundEnabled={calls.preferences.soundEnabled}
        microphoneTestLevel={calls.microphoneTestLevel}
        microphoneTestActive={calls.microphoneTestActive}
        onAccept={() => { void calls.acceptCall(); }}
        onConfirmMediaRequest={() => { void calls.confirmMediaRequest(); }}
        onCancelMediaRequest={calls.cancelMediaRequest}
        onReject={calls.rejectCall}
        onEnd={calls.leaveCall}
        onEndForEveryone={calls.endCall}
        onToggleMicrophone={calls.toggleMicrophone}
        onToggleCamera={calls.toggleCamera}
        onToggleScreenShare={() => { void calls.toggleScreenShare(); }}
        onRefreshDevices={() => { void calls.refreshDevices(); }}
        onAudioDeviceChange={audioDeviceId => calls.updatePreferences({ audioDeviceId })}
        onAudioOutputDeviceChange={audioOutputDeviceId => calls.updatePreferences({ audioOutputDeviceId })}
        onVideoDeviceChange={videoDeviceId => calls.updatePreferences({ videoDeviceId })}
        onSoundChange={soundEnabled => calls.updatePreferences({ soundEnabled })}
        onToggleMicrophoneTest={() => { void calls.toggleMicrophoneTest(); }}
        onTestAudioOutput={() => { void calls.testAudioOutput(); }}
      />
      <CreateGroupModal
        open={createGroupOpen}
        onClose={() => setCreateGroupOpen(false)}
        onCreate={handleCreateGroup}
        members={teamMembers}
        currentUserId={currentUserId}
        t={t}
      />
      <ManagePrivateGroupModal
        group={manageGroupOpen ? activePrivateGroup : null}
        currentUserId={currentUserId}
        members={teamMembers}
        language={language}
        onClose={() => setManageGroupOpen(false)}
        onAddMember={userId => activePrivateGroup ? updateGroupMembers(activePrivateGroup.id, userId, 'add') : Promise.resolve()}
        onRemoveMember={userId => activePrivateGroup ? updateGroupMembers(activePrivateGroup.id, userId, 'remove') : Promise.resolve()}
        onDelete={() => activePrivateGroup ? deletePrivateGroup(activePrivateGroup.id) : Promise.resolve()}
      />

      {/* ── LEFT SIDEBAR ───────────────────────────────────────── */}
      <aside id="chatops-sidebar" className="app-sidebar" onClick={e => { if (mobileNavOpen) e.stopPropagation(); }}>
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
                icon: <User size={15} />,
                description: TRANSLATIONS.privateGroup,
                id: g.id
              })), ...CHANNELS_LIST].map(ch => {
                const unread = unreadCounts[ch.id] || 0;
                return (
                  <button key={ch.id} type="button"
                    className={`channel-btn ${activeChannel === ch.id ? 'channel-active' : ''}`}
                    onClick={() => { setActiveChannel(ch.id); setMobileNavOpen(false); }}>
                    <span className="ch-icon">{ch.icon}</span>
                    <span className="ch-text">
                      <span className="ch-name">{typeof ch.name === 'string' ? ch.name : translateText(ch.name, language)}</span>
                      <span className="ch-desc">{translateText(ch.description, language)}</span>
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
              {isLogisticsChannel && (
                <>
                  <button type="button" className="shortcut-chip" title={translateText(commandSuggestions[0]?.description ?? { pt: 'Consultar stock por SKU.', en: 'Check stock by SKU.', es: 'Consultar existencias por SKU.' }, language)}
                    onClick={() => { setCommandAndDraft('/stock '); inputRef.current?.focus(); }}>
                    <Package size={14} /><span>/stock</span>
                  </button>
                  <button type="button" className="shortcut-chip" title={translateText(commandSuggestions[1]?.description ?? { pt: 'Listar produtos com 5 ou menos unidades em stock.', en: 'List products with 5 units or fewer in stock.', es: 'Listar productos con 5 unidades o menos en existencias.' }, language)}
                    onClick={() => { setCommandAndDraft('/low-stock'); inputRef.current?.focus(); }}>
                    <AlertTriangle size={14} /><span>/low-stock</span>
                  </button>
                  <button type="button" className="shortcut-chip" title={translateText(commandSuggestions[2]?.description ?? { pt: 'Consultar estado de encomenda por ID.', en: 'Check order status by ID.', es: 'Consultar el estado del pedido por ID.' }, language)}
                    onClick={() => { setCommandAndDraft('/order '); inputRef.current?.focus(); }}>
                    <Truck size={14} /><span>/order</span>
                  </button>
                  {currentUser.role.toLowerCase() === 'admin' && (
                    <button type="button" className="shortcut-chip" title={translateText({ pt: 'Aprovar crédito de empresa (administradores).', en: 'Approve company credit (administrators).', es: 'Aprobar crédito de empresa (administradores).' }, language)}
                      onClick={() => { setCommandAndDraft('/approve-credit '); inputRef.current?.focus(); }}>
                      <CheckCircle2 size={14} /><span>/approve-credit</span>
                    </button>
                  )}
                </>
              )}
              <button type="button" className="shortcut-chip" title={translateText(TRANSLATIONS.mentionShortcut, language)} aria-label={translateText(TRANSLATIONS.mentionShortcut, language)}
                onClick={() => { setCommandAndDraft(value => `${value}@`); inputRef.current?.focus(); }}>
                <User size={14} /><span>{translateText(TRANSLATIONS.mentionShortcutShort, language)}</span>
              </button>
              <button type="button" className="shortcut-chip" title={translateText(TRANSLATIONS.emojiShortcut, language)} aria-label={translateText(TRANSLATIONS.emojiShortcut, language)}
                onClick={() => setShowEmojiPicker(value => !value)}>
                <Smile size={14} /><span>{translateText(TRANSLATIONS.emojiShortcutShort, language)}</span>
              </button>
              <button type="button" className="shortcut-chip" title={translateText(TRANSLATIONS.attachShortcut, language)} aria-label={translateText(TRANSLATIONS.attachShortcut, language)}
                onClick={() => fileInputRef.current?.click()}>
                <Paperclip size={14} /><span>{translateText(TRANSLATIONS.attachShortcutShort, language)}</span>
              </button>
              {(!isLogisticsChannel || currentUser.role.toLowerCase() !== 'admin') && (
                <button type="button" className="shortcut-chip" title={translateText(TRANSLATIONS.newGroupShortcut, language)} aria-label={translateText(TRANSLATIONS.newGroupShortcut, language)}
                  onClick={() => setCreateGroupOpen(true)}>
                  <UserPlus size={14} /><span>{translateText(TRANSLATIONS.newGroupShortcut, language)}</span>
                </button>
              )}
              {!isLogisticsChannel && (
                <button type="button" className="shortcut-chip" title={translateText(TRANSLATIONS.searchShortcut, language)} aria-label={translateText(TRANSLATIONS.searchShortcut, language)}
                  onClick={() => setActiveTab('search')}>
                  <Search size={14} /><span>{translateText(TRANSLATIONS.searchShortcut, language)}</span>
                </button>
              )}
            </div>
            {!isLogisticsChannel && (
              <span className="shortcuts-disabled">{translateText(TRANSLATIONS.commandsInLogisticsHint, language)}</span>
            )}
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
                  <button key={s} onClick={() => {
                    manualPresenceRef.current = s;
                    setUserPresence(s);
                    setShowProfileMenu(false);
                  }}
                    style={{ fontWeight: s === userPresence ? 700 : 400 }}>
                    <span className={`presence-dot presence-${s}`}
                      style={{ position:'static', width:8, height:8, border:'none', borderRadius:'50%', flexShrink:0, display:'inline-block' }}/>
                    {translateText(PRESENCE_LABELS[s], language)}
                  </button>
                ))}
                <div className="menu-sep"/>
                <button onClick={() => { setSettingsOpen(true); setShowProfileMenu(false); }}>
                  <Settings2 size={13}/> {t('settings')}
                </button>
                <button className="popup-danger" onClick={() => {
                  void onLogout().catch(error => addToast(error instanceof Error ? error.message : t('logout'), 'error'));
                  setShowProfileMenu(false);
                }}>
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
                <div className={`cur-user-status status-text-${userPresence}`}>
                  {translateText(PRESENCE_LABELS[userPresence], language)} · {t('presenceDuration')} {Math.floor(Math.max(0, currentTime.getTime() - presenceChangedAt) / 60_000)} min
                </div>
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
              <div>{translateText(TRANSLATIONS.dragToShare, language)} <strong>#{activeChannel}</strong></div>
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
              <span>{typingInChannel} {t('typing')}</span>
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
                <h3>{t('welcomeToChannel')} #{activeChannelName}</h3>
                <p>{activeChannelTopic}</p>
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
                rangeChanged={({ startIndex, endIndex }) => {
                  visibleMessageIdsRef.current = messageItems
                    .slice(startIndex, endIndex + 1)
                    .filter((item): item is Extract<typeof item, { type: 'msg' }> => item.type === 'msg')
                    .filter(({ msg }) => !msg.pending && msg.userId !== currentUserId)
                    .map(({ msg }) => msg.id);
                  sendVisibleReadReceipts();
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
                  const isPinned = pinnedMessages.some(pin => pin.id === msg.id);
                  const latestReceipt = msg.readBy?.reduce<{ userId: string; readAt: string } | null>((latest, receipt) =>
                    !latest || Date.parse(receipt.readAt) > Date.parse(latest.readAt) ? receipt : latest,
                  null);

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
                          <span className="author-name">{msg.system ? t('system') : msg.userId}</span>
                          {msg.system && <span className="bot-badge">BOT</span>}
                        </div>
                        <div className="bubble-right-meta">
                          <time>{formatTimestamp(msg.ts, language)}</time>
                          <div className="msg-actions" onClick={e => e.stopPropagation()}>
                            <button className="msg-action-btn" title={translateText(TRANSLATIONS.reactToMessage, language)} aria-label={translateText(TRANSLATIONS.reactToMessage, language)} onClick={e => { e.stopPropagation(); setReactionPickerFor(isReactOpen ? null : msg.id); setMessageMenuFor(null); }}>
                              <Smile size={13}/>
                            </button>
                            <button className="msg-action-btn" title={translateText(TRANSLATIONS.replyToMessage, language)} aria-label={translateText(TRANSLATIONS.replyToMessage, language)} onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}>
                              <CornerUpLeft size={13}/>
                            </button>
                            <button className="msg-action-btn" title={translateText(TRANSLATIONS.moreMessageOptions, language)} aria-label={translateText(TRANSLATIONS.moreMessageOptions, language)} onClick={e => { e.stopPropagation(); setMessageMenuFor(isMenuOpen ? null : msg.id); setReactionPickerFor(null); }}>
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
                              <img src={imageUrl} alt={translateText(TRANSLATIONS.imagePreview, language)} />
                              <span>{translateText(TRANSLATIONS.imagePreview, language)}</span>
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
                          <button onClick={() => { setReplyTo(msg); setMessageMenuFor(null); inputRef.current?.focus(); }}><CornerUpLeft size={13}/> {t('reply')}</button>
                          <button onClick={() => { void handlePin(msg); }}><Pin size={13}/> {isPinned ? t('unpin') : t('pin')}</button>
                          <button onClick={() => { navigator.clipboard.writeText(msg.text || ''); addToast(t('copied'), 'success'); setMessageMenuFor(null); }}><Copy size={13}/> {t('copy')}</button>
                          {isOwn && <>
                            <div className="menu-sep"/>
                            <button className="menu-danger" onClick={() => handleDeleteMessage(msg)}><Trash2 size={13}/> {t('delete')}</button>
                          </>}
                        </div>
                      )}

                      {settings.readReceipts && isOwn && !msg.pending && latestReceipt && (
                        <div className="read-receipt">
                          {t('readBy')} {teamMembers
                            .filter(member => msg.readBy?.some(receipt => receipt.userId === member.id))
                            .map(member => member.name)
                            .join(', ') || latestReceipt.userId}
                          {' • '}
                          {new Date(latestReceipt.readAt).toLocaleTimeString(getLocale(language), { hour:'2-digit', minute:'2-digit' })}
                        </div>
                      )}
                      {msg.pending && <span className="pending-pill">{t('sending')}</span>}
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
                ↓ {newMsgCount > 1 ? `${newMsgCount} ${t('newMessagesCount')}` : t('newMessage')}
              </button>
            )}
          </div>
        )}

        {/* ── PINS TAB ─────────────────────────── */}
        {activeTab === 'pins' && (
          <div className="tab-panel">
            <div className="tab-panel-header">
              <h3><Bookmark size={16}/> {t('pinnedMessagesTitle')} — #{activeChannel}</h3>
            </div>
            {pinnedMessages.filter(p => p.channelId === activeChannel).length === 0 ? (
              <div className="empty-state">
                <Bookmark className="empty-illustration" size={48} aria-hidden="true" />
                {t('pinnedEmpty')}
              </div>
            ) : (
              <div className="pins-list">
                {pinnedMessages.filter(p => p.channelId === activeChannel).map(pin => (
                  <div key={pin.id} className="pin-item">
                    <div className="pin-author">
                      <span className="avatar-circle small" style={{ background: getAvatarColor(pin.userId) }}>{getInitials(pin.userId)}</span>
                      <span>{pin.userId}</span>
                      <time>{formatTimestamp(pin.ts, language)}</time>
                    </div>
                    <div className="pin-text">{pin.text}</div>
                    <button className="pin-remove" onClick={() => {
                      const pinnedMessage = channelMessages.find(message => message.id === pin.id) || {
                        id: pin.id,
                        channelId: pin.channelId,
                        text: pin.text,
                        userId: pin.userId,
                        ts: pin.ts,
                      };
                      void handlePin(pinnedMessage);
                    }}>
                      <X size={13}/> {t('remove')}
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
              <h3><Search size={16}/> {t('searchMessages')}</h3>
              <input className="search-input" placeholder={translateText(TRANSLATIONS.searchPlaceholder, language)}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus/>
            </div>
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div className="empty-state">
                <Search className="empty-illustration" size={48} aria-hidden="true" />
                {t('searchEmpty')} "{searchQuery}"
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
                    <time>{formatTimestamp(msg.ts, language)}</time>
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
            <h4>{translateText(TRANSLATIONS.channelStatistics, language)}</h4>
            <div className="stats-grid">
              <div className="stat-card"><div className="stat-num">{sortedMessages.length}</div><div>{translateText(TRANSLATIONS.messagesStat, language)}</div></div>
              <div className="stat-card"><div className="stat-num">{onlineCount}</div><div>{translateText(TRANSLATIONS.onlineStat, language)}</div></div>
              <div className="stat-card"><div className="stat-num">{channelFiles.length}</div><div>{translateText(TRANSLATIONS.filesStat, language)}</div></div>
              <div className="stat-card"><div className="stat-num">{pinnedMessages.filter(p => p.channelId === activeChannel).length}</div><div>{translateText(TRANSLATIONS.pinnedStat, language)}</div></div>
            </div>
          </div>
        )}
      </main>

      {/* ── RIGHT SIDEBAR ──────────────────────────────────────── */}
      <aside className="app-rightbar">
        <SidebarRight
          members={onlineMembers}
          files={channelFiles}
          currentUserId={currentUserId}
          onCall={userId => { void calls.startCall(activeChannel, [userId], 'audio'); }}
        />
      </aside>

      {/* ── FOOTER / INPUT ─────────────────────────────────────── */}
      <footer className="app-footer">
        {replyTo && (
          <div className="reply-banner">
            <span><CornerUpLeft size={13}/> {t('reply')} <strong>{replyTo.userId}</strong>: {replyTo.text?.slice(0, 60)}{(replyTo.text?.length || 0) > 60 ? '…' : ''}</span>
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
            <button type="button" className="tool-btn" title={translateText(TRANSLATIONS.attachShortcut, language)} aria-label={translateText(TRANSLATIONS.attachShortcut, language)} onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={15}/>
            </button>
            <button type="button" className={`tool-btn ${showEmojiPicker ? 'active' : ''}`} title={translateText(TRANSLATIONS.emojiShortcut, language)} aria-label={translateText(TRANSLATIONS.emojiShortcut, language)}
              onClick={e => { e.stopPropagation(); setShowEmojiPicker(v => !v); setShowAutocomplete(false); }}>
              <Smile size={15}/>
            </button>
            <button type="button" className="tool-btn" title={translateText(TRANSLATIONS.commandsHeading, language)}
              aria-label={translateText(TRANSLATIONS.shortcutUnavailableShort, language)}
              onClick={() => {
                if (!isLogisticsChannel) {
                  addToast(translateText(TRANSLATIONS.commandsOnlyLogistics, language), 'info');
                  return;
                }
                setCommandAndDraft('/');
                inputRef.current?.focus();
              }}>
              <Command size={15}/>
            </button>
          </div>

          <div className="input-wrapper">
            {showEmojiPicker && (
              <EmojiPicker onSelect={emoji => { setCommandAndDraft(prev => prev + emoji); inputRef.current?.focus(); }} onClose={() => setShowEmojiPicker(false)}/>
            )}

            {/* Autocomplete — comandos */}
            {showAutocomplete && autocompleteType === 'command' && (
              <div className="autocomplete-menu" onClick={e => e.stopPropagation()}>
                <div className="autocomplete-header">{t('shortcutUnavailableShort')}</div>
                  {isLogisticsChannel
                    ? filteredCommands.map((item, idx) => (
                      <button key={item.label} type="button"
                        className={`autocomplete-option ${idx === autocompleteIndex ? 'autocomplete-active' : ''}`}
                        onClick={() => handleAutocompleteSelect(item.shortcut, 'command')}
                        onMouseEnter={() => setAutocompleteIndex(idx)}>
                        <span className="ac-icon">{item.icon}</span>
                        <div className="ac-info">
                          <div className="ac-label">{item.label}</div>
                          <div className="ac-desc">{translateText(item.description, language)}</div>
                        </div>
                      </button>
                    ))
                    : <div className="shortcuts-disabled">{translateText(TRANSLATIONS.commandsOnlyLogistics, language)}</div>}
              </div>
            )}

            {/* Autocomplete — menções */}
            {showAutocomplete && autocompleteType === 'mention' && filteredMentions.length > 0 && (
              <div className="autocomplete-menu" onClick={e => e.stopPropagation()}>
                <div className="autocomplete-header">{translateText(TRANSLATIONS.membersHeading, language)}</div>
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
              placeholder={`${t('messagePlaceholder')} #${activeChannelName}… (${t('mentionsPlaceholder')})`}
              rows={1}
              aria-label={translateText(TRANSLATIONS.messageInputLabel, language)}
              style={{ overflowY: 'hidden' }}
            />
          </div>

          <button className="btn-send" type="button" onClick={handleSend}
            disabled={(!command.trim() && !pendingAttachment) || connectionState !== 'connected' || isProcessing}
            title={translateText(TRANSLATIONS.sendMessageLabel, language)}>
            {isProcessing ? <span className="send-spinner"/> : <ArrowUpRight size={17}/>}
          </button>
        </div>

        <div className="footer-hint">
          <span>{t('shortcutUnavailableShort')}</span>
          <span>@ {translateText(TRANSLATIONS.mentionShortcut, language)}</span>
          <span>↵ {translateText({ pt: 'enviar', en: 'send', es: 'enviar' }, language)}</span>
          <span>Shift+↵ {translateText({ pt: 'nova linha', en: 'new line', es: 'nueva línea' }, language)}</span>
          <span>↑ {translateText({ pt: 'histórico', en: 'history', es: 'historial' }, language)}</span>
          <span>{translateText(TRANSLATIONS.focusModeLabel, language)}</span>
        </div>
      </footer>

      {/* ── STATUS BAR ─────────────────────────────────────────── */}
      <div className={`app-statusbar statusbar-${connectionState}`}>
        <span className="statusbar-item">
          {connectionState === 'connected' ? <Wifi size={11}/> : <WifiOff size={11}/>}
          {connectionState === 'connected' ? t('statusBarConnected') : connectionState === 'reconnecting' ? t('reconnecting') : t('offline')}
        </span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item clickable" title={t('channelSettings')} onClick={() => setSettingsOpen(true)}>
          #{activeChannelName}
        </span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item">{sortedMessages.length} {t('messagesCount')}</span>
        <span className="statusbar-sep">|</span>
        <span className="statusbar-item">{onlineCount} {t('onlineCount')}</span>
        {totalUnread > 0 && <>
          <span className="statusbar-sep">|</span>
          <span className="statusbar-item">{totalUnread} {t('unread')}</span>
        </>}

        {/* Indicador de quem está a escrever na status bar */}
        {typingInChannel && (
          <>
            <span className="statusbar-sep">|</span>
            <span className="statusbar-typing">
              <span className="typing-dots"><span/><span/><span/></span>
              {typingInChannel} {t('typing')}
            </span>
          </>
        )}

        <div className="statusbar-right">
          <span className="statusbar-item">{translateText(PRESENCE_LABELS[userPresence], language)}</span>
          {latencyMs !== null && (
            <span className="statusbar-item" title={translateText(TRANSLATIONS.websocketLatency, language)}>
              <LatencyIcon ms={latencyMs} noDataLabel={t('noData')}/> {latencyMs}ms
            </span>
          )}
          <span className="statusbar-item">
            {currentTime.toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })}
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
        open={inviteOpen} target={inviteTarget} group={inviteGroup} groups={privateGroups}
        submitting={inviteSubmitting} error={inviteError}
        onClose={() => { setInviteOpen(false); setInviteError(''); }}
        onSubmit={() => { void handleInviteSubmit(); }}
        onTargetChange={setInviteTarget} onGroupChange={setInviteGroup}
      />
      {imageViewerUrl && (
        <div className="image-viewer-overlay" onClick={() => setImageViewerUrl(null)}>
          <img src={imageViewerUrl} alt={translateText(TRANSLATIONS.imageAlt, language)} onClick={e => e.stopPropagation()} />
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
    </div>
  );
}