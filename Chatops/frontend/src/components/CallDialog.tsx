import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, Mic, MicOff, MonitorUp, Phone, PhoneOff, Settings2, ShieldCheck, Video } from 'lucide-react';
import { CallDevice, CallMediaRequest, CallSession, formatCallDuration, IncomingCall, RemoteCallPeer } from '../hooks/useWebRtcCalls';
import { translateText, useLanguage } from '../i18n';

type Props = {
  activeCall: CallSession | null;
  incomingCall: IncomingCall | null;
  mediaRequest: CallMediaRequest | null;
  localStream: MediaStream | null;
  remotePeers: RemoteCallPeer[];
  users: { id: string; name: string }[];
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  screenShareEnabled: boolean;
  microphones: CallDevice[];
  audioOutputs: CallDevice[];
  cameras: CallDevice[];
  audioOutputSelectionSupported: boolean;
  audioDeviceId: string;
  audioOutputDeviceId: string;
  videoDeviceId: string;
  soundEnabled: boolean;
  microphoneTestLevel: number;
  microphoneTestActive: boolean;
  onAccept: () => void;
  onConfirmMediaRequest: () => void;
  onCancelMediaRequest: () => void;
  onReject: () => void;
  onEnd: () => void;
  onEndForEveryone: () => void;
  onToggleMicrophone: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onRefreshDevices: () => void;
  onAudioDeviceChange: (deviceId: string) => void;
  onAudioOutputDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
  onSoundChange: (enabled: boolean) => void;
  onToggleMicrophoneTest: () => void;
  onTestAudioOutput: () => void;
};

function MediaTile({ stream, name, muted }: {
  stream: MediaStream | null;
  name: string;
  muted?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasVideo = Boolean(stream?.getVideoTracks().some(track => track.readyState === 'live' && track.enabled));

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
    if (audioRef.current) audioRef.current.srcObject = stream;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
      if (audioRef.current) audioRef.current.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="call-media-tile">
      <video ref={videoRef} autoPlay playsInline muted style={{ display: hasVideo ? 'block' : 'none' }} />
      <audio ref={audioRef} autoPlay muted={muted} />
      {!hasVideo && <div className="call-media-placeholder"><Video size={22} /><span>{name}</span></div>}
      <span className="call-media-name">{name}</span>
    </div>
  );
}

export default function CallDialog(props: Props) {
  const { language } = useLanguage();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const refreshDevicesRef = useRef(props.onRefreshDevices);
  useEffect(() => {
    refreshDevicesRef.current = props.onRefreshDevices;
  }, [props.onRefreshDevices]);
  useEffect(() => {
    if (settingsOpen) refreshDevicesRef.current();
  }, [settingsOpen]);
  useEffect(() => {
    if (!props.activeCall) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [props.activeCall?.callId]);
  if (!props.activeCall && !props.incomingCall && !props.mediaRequest) return null;

  const active = props.activeCall;
  const incoming = props.incomingCall;
  const getName = (id: string) => props.users.find(user => user.id === id)?.name || id;
  const text = (pt: string, en: string, es: string) => translateText({ pt, en, es }, language);

  return (
    <div className={`modal-backdrop call-backdrop${active ? ' call-backdrop-active' : ''}`}>
      <section className={`call-dialog${active ? ' call-dialog-active' : ''}`} role="dialog" aria-modal={incoming || props.mediaRequest ? 'true' : undefined} aria-label={text('Chamada ChatOps', 'ChatOps call', 'Llamada de ChatOps')}>
        <header className="call-dialog-header">
          <div>
            <h2>{props.mediaRequest
              ? text('Preparar microfone e câmara', 'Set up microphone and camera', 'Preparar micrófono y cámara')
              : incoming
                ? text('Chamada recebida', 'Incoming call', 'Llamada entrante')
              : active?.media === 'video' || props.cameraEnabled || props.screenShareEnabled
                ? text('Chamada de vídeo', 'Video call', 'Llamada de vídeo')
                : text('Chamada de áudio', 'Audio call', 'Llamada de audio')}</h2>
            <p>{props.mediaRequest
              ? text('Antes de iniciar a chamada', 'Before joining the call', 'Antes de iniciar la llamada')
              : incoming
              ? text(`${incoming.callerName} está a ligar.`, `${incoming.callerName} is calling.`, `${incoming.callerName} está llamando.`)
              : active
                ? `${text('Canal', 'Channel', 'Canal')} ${active.channelId} · ${text('Em andamento', 'In progress', 'En curso')} ${formatCallDuration(active.startedAt, clock)} · ${props.remotePeers.length + 1} ${translateText({
                  pt: props.remotePeers.length === 0 ? 'participante' : 'participantes',
                  en: props.remotePeers.length === 0 ? 'participant' : 'participants',
                  es: props.remotePeers.length === 0 ? 'participante' : 'participantes',
                }, language)}`
                : ''}</p>
          </div>
          <button type="button" className="hdr-btn hdr-btn-icon" aria-label={text('Definições da chamada', 'Call settings', 'Ajustes de llamada')} onClick={() => setSettingsOpen(open => !open)}>
            <Settings2 size={17} />
          </button>
        </header>

        {settingsOpen && (
          <div className="call-settings">
            <label className="call-sound-toggle">
              <input
                type="checkbox"
                checked={props.soundEnabled}
                onChange={event => props.onSoundChange(event.target.checked)}
              />
              {text('Som de chamadas recebidas', 'Incoming call sound', 'Sonido de llamadas entrantes')}
            </label>
            <label>
              {text('Microfone', 'Microphone', 'Micrófono')}
              <select value={props.audioDeviceId} onChange={event => props.onAudioDeviceChange(event.target.value)}>
                <option value="">{text('Dispositivo predefinido', 'Default device', 'Dispositivo predeterminado')}</option>
                {props.microphones.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
              </select>
            </label>
            {active && (
              <div className="call-device-test">
                <button type="button" onClick={props.onToggleMicrophoneTest}>
                  {props.microphoneTestActive
                    ? text('Parar teste do microfone', 'Stop microphone test', 'Detener prueba del micrófono')
                    : text('Testar microfone', 'Test microphone', 'Probar micrófono')}
                </button>
                <div
                  className="call-microphone-meter"
                  role="meter"
                  aria-label={text('Nível do microfone', 'Microphone level', 'Nivel del micrófono')}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={props.microphoneTestLevel}
                >
                  <span style={{ width: `${props.microphoneTestLevel}%` }} />
                </div>
                <small>{props.microphoneTestActive
                  ? text('Fale para verificar o nível de entrada.', 'Speak to check the input level.', 'Hable para comprobar el nivel de entrada.')
                  : text('O teste usa o microfone da chamada sem interrompê-la.', 'The test uses the call microphone without interrupting the call.', 'La prueba usa el micrófono de la llamada sin interrumpirla.')}</small>
              </div>
            )}
            {props.audioOutputSelectionSupported && (
              <label>
                {text('Saída de áudio', 'Audio output', 'Salida de audio')}
                <select value={props.audioOutputDeviceId} onChange={event => props.onAudioOutputDeviceChange(event.target.value)}>
                  <option value="">{text('Dispositivo predefinido', 'Default device', 'Dispositivo predeterminado')}</option>
                  {props.audioOutputs.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={props.onTestAudioOutput}>
              {text('Testar som dos auscultadores', 'Test headphone audio', 'Probar el sonido de los auriculares')}
            </button>
            <label>
              {text('Câmara', 'Camera', 'Cámara')}
              <select value={props.videoDeviceId} onChange={event => props.onVideoDeviceChange(event.target.value)}>
                <option value="">{text('Dispositivo predefinido', 'Default device', 'Dispositivo predeterminado')}</option>
                {props.cameras.map(device => <option key={device.deviceId} value={device.deviceId}>{device.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={props.onRefreshDevices}>{text('Atualizar dispositivos', 'Refresh devices', 'Actualizar dispositivos')}</button>
          </div>
        )}

        {props.mediaRequest && (
          <div className="call-permission-card">
            <div className="call-permission-icon"><ShieldCheck size={23} /></div>
            <div className="call-permission-copy">
              <h3>{text('O navegador vai pedir autorização', 'Your browser will ask for permission', 'El navegador solicitará permiso')}</h3>
              <p>{text(
                'O microfone é necessário para falar. O navegador mostrará a sua própria janela de permissão; escolha “Permitir” para continuar.',
                'Your microphone is needed to speak. Your browser will show its own permission prompt; choose “Allow” to continue.',
                'Necesitas el micrófono para hablar. El navegador mostrará su propia solicitud de permiso; selecciona “Permitir” para continuar.',
              )}</p>
              {props.mediaRequest.media === 'video' && (
                <p>{text(
                  'A câmara também será solicitada porque esta chamada foi iniciada com vídeo. Pode desligá-la a qualquer momento.',
                  'Camera access is also requested because this call uses video. You can turn it off at any time.',
                  'También se solicitará acceso a la cámara porque esta llamada incluye vídeo. Puedes apagarla cuando quieras.',
                )}</p>
              )}
              <div className="call-permission-privacy">
                <CheckCircle2 size={15} />
                <span>{text(
                  'O acesso só é usado para esta chamada e pode ser revogado nas definições do navegador.',
                  'Access is used only for this call and can be revoked in your browser settings.',
                  'El acceso solo se usa para esta llamada y puedes revocarlo en la configuración del navegador.',
                )}</span>
              </div>
            </div>
            <div className="call-permission-actions">
              <button type="button" className="call-control" onClick={props.onCancelMediaRequest}>
                {text('Cancelar', 'Cancel', 'Cancelar')}
              </button>
              <button type="button" className="call-control accept" onClick={props.onConfirmMediaRequest}>
                <Mic size={16} /> {text('Continuar', 'Continue', 'Continuar')}
              </button>
            </div>
          </div>
        )}

        {!props.mediaRequest && incoming && (
          <div className="call-incoming">
            <div className="call-incoming-icon">{incoming.media === 'video' ? <Video size={28} /> : <Phone size={28} />}</div>
            <strong>{incoming.callerName}</strong>
            <span>{text('Chamada', 'Call', 'Llamada')} {incoming.media === 'video'
              ? text('de vídeo', 'by video', 'de vídeo')
              : text('de áudio', 'by audio', 'de audio')} {text('no canal', 'in channel', 'en el canal')} {incoming.channelId}</span>
            <div className="call-controls">
              <button type="button" className="call-control accept" aria-label={text('Atender chamada', 'Answer call', 'Responder llamada')} onClick={props.onAccept}>
                <Phone size={17} /> {text('Atender', 'Answer', 'Responder')}
              </button>
              <button type="button" className="call-control reject" aria-label={text('Recusar chamada', 'Decline call', 'Rechazar llamada')} onClick={props.onReject}>
                <PhoneOff size={17} /> {text('Recusar', 'Decline', 'Rechazar')}
              </button>
            </div>
          </div>
        )}

        {!props.mediaRequest && active && (
          <>
            <div className="call-media-grid">
              <MediaTile stream={props.localStream} name={text('Eu', 'Me', 'Yo')} muted />
              {props.remotePeers.map(peer => (
                <MediaTile
                  key={peer.userId}
                  stream={peer.stream}
                  name={getName(peer.userId)}
                />
              ))}
              {props.remotePeers.length === 0 && <p className="call-waiting">{text('A aguardar resposta dos membros convidados…', 'Waiting for invited members to answer…', 'Esperando a que respondan los miembros invitados…')}</p>}
            </div>
            <div className="call-controls">
              <button
                type="button"
                className={`call-control ${props.microphoneEnabled ? '' : 'disabled'}`}
                aria-label={props.microphoneEnabled ? text('Desligar microfone', 'Mute microphone', 'Silenciar micrófono') : text('Ligar microfone', 'Unmute microphone', 'Activar micrófono')}
                onClick={props.onToggleMicrophone}
              >
                {props.microphoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}
                {props.microphoneEnabled ? text('Microfone ligado', 'Microphone on', 'Micrófono activado') : text('Microfone desligado', 'Microphone off', 'Micrófono desactivado')}
              </button>
              <button
                type="button"
                className={`call-control ${props.cameraEnabled ? '' : 'disabled'}`}
                aria-pressed={props.cameraEnabled}
                aria-label={props.cameraEnabled ? text('Desligar câmara', 'Turn camera off', 'Apagar cámara') : text('Ligar câmara', 'Turn camera on', 'Encender cámara')}
                onClick={props.onToggleCamera}
              >
                {props.cameraEnabled ? <Camera size={17} /> : <CameraOff size={17} />}
                {props.cameraEnabled ? text('Câmara ligada', 'Camera on', 'Cámara encendida') : text('Câmara desligada', 'Camera off', 'Cámara apagada')}
              </button>
              <button
                type="button"
                className={`call-control ${props.screenShareEnabled ? '' : 'disabled'}`}
                aria-pressed={props.screenShareEnabled}
                aria-label={props.screenShareEnabled ? text('Parar partilha do ecrã', 'Stop screen sharing', 'Dejar de compartir pantalla') : text('Partilhar ecrã', 'Share screen', 'Compartir pantalla')}
                onClick={props.onToggleScreenShare}
              >
                <MonitorUp size={17} />
                {props.screenShareEnabled ? text('Parar partilha', 'Stop sharing', 'Dejar de compartir') : text('Partilhar ecrã', 'Share screen', 'Compartir pantalla')}
              </button>
              <button
                type="button"
                className="call-control"
                aria-label={text('Sair da chamada e poder voltar mais tarde', 'Leave the call and rejoin later', 'Salir de la llamada y volver más tarde')}
                onClick={props.onEnd}
              >
                <PhoneOff size={17} />
                {text('Sair da chamada', 'Leave call', 'Salir de la llamada')}
              </button>
              {active.isHost && (
                <button
                  type="button"
                  className="call-control reject"
                  aria-label={text('Terminar chamada para todos', 'End call for everyone', 'Finalizar llamada para todos')}
                  onClick={props.onEndForEveryone}
                >
                  <PhoneOff size={17} />
                  {text('Terminar para todos', 'End for everyone', 'Finalizar para todos')}
                </button>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
