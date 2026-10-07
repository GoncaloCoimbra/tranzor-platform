import React from 'react';
import { Phone } from 'lucide-react';
import { translateText, useLanguage } from '../i18n';

type Member = {
  id: string;
  name: string;
  online?: boolean;
  presence?: 'online' | 'dnd' | 'away' | 'offline';
  presenceChangedAt?: number;
};
type FileItem = { id: string; name: string; url: string; size?: number };

const AVATAR_COLORS = [
  'hsl(345, 80%, 50%)',
  'hsl(356, 76%, 42%)',
  'hsl(15, 72%, 45%)',
  'hsl(12, 64%, 38%)',
  'hsl(2, 74%, 44%)',
  'hsl(1, 78%, 46%)',
];
const getAvatarColor = (uid: string) => AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length];

type Props = {
  members: Member[];
  files: FileItem[];
  currentUserId: string;
  onCall: (userId: string) => void;
};

export default function SidebarRight({ members, files, currentUserId, onCall }: Props) {
  const { language } = useLanguage();
  const text = (pt: string, en: string, es: string) => translateText({ pt, en, es }, language);

  return (
    <aside className="app-rightbar">
      <div className="right-section">
        <div className="avatar-stack">
          {members.slice(0, 5).map((member, idx) => (
            <span key={member.id} className="avatar-circle small stack-item" style={{ background: getAvatarColor(member.id), zIndex: 10 - idx }}>
              {member.name.split(' ').map(n => n[0]).slice(0,2).join('')}
            </span>
          ))}
          {members.length > 5 && (
            <span className="avatar-circle small stack-item stack-more">+{members.length - 5}</span>
          )}
        </div>
        <h4>{text('Membros', 'Members', 'Miembros')}</h4>
        <div className="member-list">
          {members.length === 0 ? <div className="muted">{text('Ainda não há membros neste canal.', 'There are no members in this channel yet.', 'Todavía no hay miembros en este canal.')}</div> : null}
          {members.map((m) => (
            <div key={m.id} className="member-row">
              <span className="avatar-circle small">{m.name.split(' ').map(n => n[0]).slice(0,2).join('')}</span>
              <div className="member-meta">
                <div className="member-name">{m.name}</div>
                <div className={`member-status-label ${m.presence || (m.online ? 'online' : 'offline')}`}>
                  {m.presence === 'away'
                    ? text('Ausente', 'Away', 'Ausente')
                    : m.presence === 'dnd'
                      ? text('Não incomodar', 'Do not disturb', 'No molestar')
                      : m.online && m.presence !== 'offline'
                        ? text('Online', 'Online', 'En línea')
                        : text('Offline', 'Offline', 'Desconectado')}
                  {m.presenceChangedAt && m.presence !== 'offline' && (
                    <> · {text('há', 'for', 'desde hace')} {Math.floor(Math.max(0, Date.now() - m.presenceChangedAt) / 60_000)} min</>
                  )}
                </div>
              </div>
              {m.id !== currentUserId && (
                <div className="member-call-actions">
                  <button
                    type="button"
                    aria-label={text(`Ligar a ${m.name}`, `Call ${m.name}`, `Llamar a ${m.name}`)}
                    title={m.online && m.presence !== 'offline'
                      ? text('Iniciar chamada', 'Start a call', 'Iniciar llamada')
                      : text('Este membro está offline.', 'This member is offline.', 'Este miembro está desconectado.')}
                    disabled={!m.online || m.presence === 'offline'}
                    onClick={() => onCall(m.id)}
                  >
                    <Phone size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="right-section">
        <h4>{text('Ficheiros do canal', 'Channel files', 'Archivos del canal')}</h4>
        <div className="file-list">
          {files.length === 0 ? <div className="muted">{text('Sem ficheiros', 'No files', 'Sin archivos')}</div> : null}
          {files.map((f) => (
            <a key={f.id} className="file-item" href={f.url} target="_blank" rel="noreferrer">
              <div className="file-name">{f.name}</div>
              <div className="file-meta">{f.size ? `${(f.size/1024).toFixed(1)} KB` : ''}</div>
            </a>
          ))}
        </div>
      </div>
    </aside>
  );
}
