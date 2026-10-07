import { useCallback, useEffect, useRef, useState } from 'react';
import { translateText, useLanguage } from '../i18n';

type Language = Parameters<typeof translateText>[1];

export type CallMedia = 'audio' | 'video';

export type CallSession = {
  callId: string;
  channelId: string;
  media: CallMedia;
  isHost: boolean;
  startedAt: number;
};

export type IncomingCall = Omit<CallSession, 'isHost'> & {
  fromUserId: string;
  callerName: string;
};

export type CallMediaRequest = {
  media: CallMedia;
  kind: 'outgoing' | 'incoming' | 'rejoin';
  channelId: string;
  callId?: string;
  hostUserId?: string;
  startedAt?: number;
  targetUserIds?: string[];
};

export type AvailableCall = {
  callId: string;
  channelId: string;
  hostUserId: string;
  hostName: string;
  media: CallMedia;
  startedAt: number;
  participantCount: number;
  invitedUserIds: string[];
};

export type RemoteCallPeer = {
  userId: string;
  stream: MediaStream | null;
};

export type CallDevice = {
  deviceId: string;
  label: string;
};

export function formatCallDuration(startedAt: number, now = Date.now()): string {
  const totalSeconds = Math.max(0, Math.floor((now - startedAt) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

type AudioContextWithSinkId = AudioContext & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

type SocketRef = { current: WebSocket | null };
type CallPreferences = {
  audioDeviceId: string;
  audioOutputDeviceId: string;
  videoDeviceId: string;
  soundEnabled: boolean;
};

const preferencesKey = 'chatops-call-preferences';
type IceServerConfiguration = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIceServerConfiguration(value: unknown): value is IceServerConfiguration {
  if (!isRecord(value)) return false;
  const validUrls = typeof value.urls === 'string'
    || (Array.isArray(value.urls) && value.urls.every(url => typeof url === 'string'));
  return validUrls
    && (value.username === undefined || typeof value.username === 'string')
    && (value.credential === undefined || typeof value.credential === 'string');
}

export async function fetchCallIceServers(): Promise<IceServerConfiguration[]> {
  const response = await fetch('/api/ice-servers', { credentials: 'include' });
  if (!response.ok) {
    throw new Error('Não foi possível obter a configuração dos servidores de ligação.');
  }
  const payload: unknown = await response.json();
  if (
    !isRecord(payload)
    || !Array.isArray(payload.iceServers)
    || payload.iceServers.length === 0
    || !payload.iceServers.every(isIceServerConfiguration)
  ) {
    throw new Error('A configuração dos servidores de ligação recebida é inválida.');
  }
  return payload.iceServers;
}

function mediaErrorMessage(error: unknown, language: Language): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return translateText({
      pt: 'O acesso ao microfone ou à câmara foi recusado. Permita o acesso nas definições do navegador e tente novamente.',
      en: 'Microphone or camera access was denied. Allow access in your browser settings and try again.',
      es: 'Se denegó el acceso al micrófono o a la cámara. Permite el acceso en la configuración del navegador e inténtalo de nuevo.',
    }, language);
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return translateText({
      pt: 'Não foi encontrado um microfone ou uma câmara disponível.',
      en: 'No available microphone or camera was found.',
      es: 'No se encontró ningún micrófono o cámara disponible.',
    }, language);
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return translateText({
      pt: 'O microfone ou a câmara já está a ser utilizado por outra aplicação.',
      en: 'The microphone or camera is already in use by another application.',
      es: 'Otra aplicación ya está usando el micrófono o la cámara.',
    }, language);
  }
  return translateText({
    pt: 'Não foi possível aceder ao microfone ou à câmara.',
    en: 'Could not access the microphone or camera.',
    es: 'No se pudo acceder al micrófono o a la cámara.',
  }, language);
}

function callErrorMessage(error: unknown, language: Language): string {
  const source = typeof error === 'string' ? error : '';
  const messages: Record<string, { pt: string; en: string; es: string }> = {
    'Convite de chamada inválido.': {
      pt: 'Convite de chamada inválido.',
      en: 'Invalid call invitation.',
      es: 'La invitación a la llamada no es válida.',
    },
    'Não tem acesso ao canal desta chamada.': {
      pt: 'Não tem acesso ao canal desta chamada.',
      en: 'You do not have access to this call channel.',
      es: 'No tienes acceso al canal de esta llamada.',
    },
    'O identificador desta chamada já está em uso.': {
      pt: 'O identificador desta chamada já está em uso.',
      en: 'This call ID is already in use.',
      es: 'El identificador de esta llamada ya está en uso.',
    },
    'Não há membros autorizados em linha neste canal.': {
      pt: 'Não há membros autorizados em linha neste canal.',
      en: 'There are no authorized members online in this channel.',
      es: 'No hay miembros autorizados en línea en este canal.',
    },
    'Este convite de chamada já não está válido.': {
      pt: 'Este convite de chamada já não está válido.',
      en: 'This call invitation is no longer valid.',
      es: 'Esta invitación a la llamada ya no es válida.',
    },
    'Não pode voltar a esta chamada.': {
      pt: 'Não pode voltar a esta chamada.',
      en: 'You are not allowed to rejoin this call.',
      es: 'No tienes permiso para volver a esta llamada.',
    },
    'Já está nesta chamada.': {
      pt: 'Já está nesta chamada.',
      en: 'You are already in this call.',
      es: 'Ya estás en esta llamada.',
    },
    'Sinal de chamada inválido ou não autorizado.': {
      pt: 'Sinal de chamada inválido ou não autorizado.',
      en: 'Invalid or unauthorized call signal.',
      es: 'Señal de llamada no válida o no autorizada.',
    },
    'Só quem iniciou a chamada pode terminá-la para todos.': {
      pt: 'Só quem iniciou a chamada pode terminá-la para todos.',
      en: 'Only the call host can end it for everyone.',
      es: 'Solo quien inició la llamada puede finalizarla para todos.',
    },
  };
  const message = messages[source];
  return message
    ? translateText(message, language)
    : translateText({
      pt: 'A chamada não foi autorizada.',
      en: 'The call was not authorized.',
      es: 'La llamada no fue autorizada.',
    }, language);
}

function readPreferences(): CallPreferences {
  if (typeof window === 'undefined') {
    return { audioDeviceId: '', audioOutputDeviceId: '', videoDeviceId: '', soundEnabled: true };
  }
  try {
    const saved = JSON.parse(localStorage.getItem(preferencesKey) || '{}') as Partial<CallPreferences>;
    return {
      audioDeviceId: typeof saved.audioDeviceId === 'string' ? saved.audioDeviceId : '',
      audioOutputDeviceId: typeof saved.audioOutputDeviceId === 'string' ? saved.audioOutputDeviceId : '',
      videoDeviceId: typeof saved.videoDeviceId === 'string' ? saved.videoDeviceId : '',
      soundEnabled: saved.soundEnabled !== false,
    };
  } catch {
    return { audioDeviceId: '', audioOutputDeviceId: '', videoDeviceId: '', soundEnabled: true };
  }
}

export function useWebRtcCalls(
  currentUserId: string,
  socketRef: SocketRef,
  addToast: (message: string, type?: 'info' | 'success' | 'error') => void,
) {
  const { language } = useLanguage();
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [availableCalls, setAvailableCalls] = useState<AvailableCall[]>([]);
  const [mediaRequest, setMediaRequest] = useState<CallMediaRequest | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remotePeers, setRemotePeers] = useState<RemoteCallPeer[]>([]);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [screenShareEnabled, setScreenShareEnabled] = useState(false);
  const [microphoneTestLevel, setMicrophoneTestLevel] = useState(0);
  const [microphoneTestActive, setMicrophoneTestActive] = useState(false);
  const [devices, setDevices] = useState<{
    microphones: CallDevice[];
    audioOutputs: CallDevice[];
    cameras: CallDevice[];
    audioOutputSelectionSupported: boolean;
  }>({
    microphones: [],
    audioOutputs: [],
    cameras: [],
    audioOutputSelectionSupported: false,
  });
  const [preferences, setPreferences] = useState<CallPreferences>(readPreferences);
  const activeCallRef = useRef<CallSession | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const microphoneTestRef = useRef<{ context: AudioContext; frameId: number } | null>(null);
  const outputTestRef = useRef<{ context: AudioContext; timerId: number } | null>(null);
  const messageHandlerRef = useRef<(data: Record<string, unknown>) => boolean>(() => false);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());

  const send = useCallback((message: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, [socketRef]);

  const setCurrentCall = useCallback((call: CallSession | null) => {
    activeCallRef.current = call;
    setActiveCall(call);
  }, []);

  const setCurrentIncomingCall = useCallback((call: IncomingCall | null) => {
    incomingCallRef.current = call;
    setIncomingCall(call);
  }, []);
  const setCurrentMediaRequest = useCallback((request: CallMediaRequest | null) => {
    setMediaRequest(request);
  }, []);

  const stopMicrophoneTest = useCallback(() => {
    const test = microphoneTestRef.current;
    microphoneTestRef.current = null;
    if (test) {
      cancelAnimationFrame(test.frameId);
      void test.context.close();
    }
    setMicrophoneTestActive(false);
    setMicrophoneTestLevel(0);
  }, []);

  const stopOutputTest = useCallback(() => {
    const test = outputTestRef.current;
    outputTestRef.current = null;
    if (test) {
      window.clearTimeout(test.timerId);
      void test.context.close();
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    const screenStream = screenStreamRef.current;
    screenStreamRef.current = null;
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    screenStream?.getTracks().forEach(track => track.stop());
    localStreamRef.current = null;
    cameraTrackRef.current = null;
    setLocalStream(null);
    setScreenShareEnabled(false);
  }, []);

  const closePeer = useCallback((userId: string) => {
    const peer = peerConnections.current.get(userId);
    if (peer) {
      peer.onicecandidate = null;
      peer.ontrack = null;
      peer.close();
      peerConnections.current.delete(userId);
    }
    pendingCandidates.current.delete(userId);
    setRemotePeers(previous => previous.filter(item => item.userId !== userId));
  }, []);

  const closeCall = useCallback((callId?: string) => {
    if (callId && activeCallRef.current?.callId !== callId) return;
    stopMicrophoneTest();
    for (const userId of peerConnections.current.keys()) closePeer(userId);
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    stopLocalStream();
    setCurrentCall(null);
    setCurrentIncomingCall(null);
    setCurrentMediaRequest(null);
    setRemotePeers([]);
    setMicrophoneEnabled(true);
    setCameraEnabled(true);
  }, [closePeer, setCurrentCall, setCurrentIncomingCall, setCurrentMediaRequest, stopLocalStream, stopMicrophoneTest]);

  const captureLocalMedia = useCallback(async (media: CallMedia) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(translateText({
        pt: 'Este navegador não suporta chamadas de áudio ou vídeo.',
        en: 'This browser does not support audio or video calls.',
        es: 'Este navegador no admite llamadas de audio o vídeo.',
      }, language));
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: preferences.audioDeviceId
        ? { deviceId: { exact: preferences.audioDeviceId } }
        : true,
      video: media === 'video'
        ? preferences.videoDeviceId
          ? { deviceId: { exact: preferences.videoDeviceId } }
          : true
        : false,
    });
    localStreamRef.current = stream;
    cameraTrackRef.current = stream.getVideoTracks()[0] || null;
    setLocalStream(stream);
    setMicrophoneEnabled(true);
    setCameraEnabled(media === 'video');
    return stream;
  }, [language, preferences.audioDeviceId, preferences.videoDeviceId]);

  const createPeerConnection = useCallback(async (
    peerUserId: string,
    call: CallSession,
    createOffer: boolean,
  ) => {
    const existing = peerConnections.current.get(peerUserId);
    if (existing) return existing;
    if (!localStreamRef.current) throw new Error('O microfone ou a câmara ainda não estão preparados.');

    const iceServers = await fetchCallIceServers();
    const peer = new RTCPeerConnection({ iceServers });
    peerConnections.current.set(peerUserId, peer);
    localStreamRef.current.getAudioTracks().forEach(track => peer.addTrack(track, localStreamRef.current!));
    const outgoingVideoTrack = screenStreamRef.current?.getVideoTracks()[0]
      || (cameraTrackRef.current?.enabled ? cameraTrackRef.current : null);
    if (outgoingVideoTrack) peer.addTrack(outgoingVideoTrack, localStreamRef.current);
    peer.onicecandidate = event => {
      if (!event.candidate) return;
      send({
        type: 'call_signal',
        callId: call.callId,
        channelId: call.channelId,
        targetUserId: peerUserId,
        signal: { type: 'candidate', ...event.candidate.toJSON() },
      });
    };
    peer.ontrack = event => {
      const stream = event.streams[0] || null;
      setRemotePeers(previous => {
        const existingPeer = previous.find(item => item.userId === peerUserId);
        return existingPeer
          ? previous.map(item => item.userId === peerUserId ? { ...item, stream } : item)
          : [...previous, { userId: peerUserId, stream }];
      });
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed') {
        addToast(translateText({
          pt: 'Não foi possível estabelecer a ligação com um dos membros.',
          en: 'Could not establish a connection with one of the members.',
          es: 'No se pudo establecer la conexión con uno de los miembros.',
        }, language), 'error');
      }
    };

    if (createOffer) {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({
        type: 'call_signal',
        callId: call.callId,
        channelId: call.channelId,
        targetUserId: peerUserId,
        signal: peer.localDescription,
      });
    }
    return peer;
  }, [addToast, language, send]);

  const addIceCandidate = useCallback(async (peerUserId: string, peer: RTCPeerConnection, candidate: RTCIceCandidateInit) => {
    if (!peer.remoteDescription) {
      const queued = pendingCandidates.current.get(peerUserId) || [];
      queued.push(candidate);
      pendingCandidates.current.set(peerUserId, queued);
      return;
    }
    await peer.addIceCandidate(candidate);
  }, []);

  const flushIceCandidates = useCallback(async (peerUserId: string, peer: RTCPeerConnection) => {
    const queued = pendingCandidates.current.get(peerUserId) || [];
    pendingCandidates.current.delete(peerUserId);
    for (const candidate of queued) await peer.addIceCandidate(candidate);
  }, []);

  const receiveSignal = useCallback(async (data: Record<string, unknown>) => {
    const call = activeCallRef.current;
    const peerUserId = data.fromUserId;
    const signal = data.signal;
    if (!call || call.callId !== data.callId || typeof peerUserId !== 'string' || !signal || typeof signal !== 'object') return;

    try {
      const peer = await createPeerConnection(peerUserId, call, false);
      const description = signal as RTCSessionDescriptionInit;
      if (description.type === 'offer') {
        await peer.setRemoteDescription(description);
        await flushIceCandidates(peerUserId, peer);
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send({
          type: 'call_signal',
          callId: call.callId,
          channelId: call.channelId,
          targetUserId: peerUserId,
          signal: peer.localDescription,
        });
        const localVideoTrack = screenStreamRef.current?.getVideoTracks()[0]
          || (cameraTrackRef.current?.enabled ? cameraTrackRef.current : null);
        if (localVideoTrack && !description.sdp?.includes('m=video')) {
          const videoOffer = await peer.createOffer();
          await peer.setLocalDescription(videoOffer);
          send({
            type: 'call_signal',
            callId: call.callId,
            channelId: call.channelId,
            targetUserId: peerUserId,
            signal: peer.localDescription,
          });
        }
      } else if (description.type === 'answer') {
        await peer.setRemoteDescription(description);
        await flushIceCandidates(peerUserId, peer);
      } else if (typeof (signal as RTCIceCandidateInit).candidate === 'string') {
        await addIceCandidate(peerUserId, peer, signal as RTCIceCandidateInit);
      }
    } catch (error) {
      console.error('WebRTC signalling failed:', error);
      addToast(translateText({
        pt: 'A ligação não pôde ser estabelecida. Verifique as permissões de áudio/vídeo e tente novamente.',
        en: 'The connection could not be established. Check your audio/video permissions and try again.',
        es: 'No se pudo establecer la conexión. Comprueba los permisos de audio/vídeo e inténtalo de nuevo.',
      }, language), 'error');
    }
  }, [addIceCandidate, addToast, createPeerConnection, flushIceCandidates, language, send]);

  const playIncomingTone = useCallback(() => {
    if (!preferences.soundEnabled || typeof window === 'undefined' || !window.AudioContext) return;
    try {
      const context = new window.AudioContext();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 740;
      gain.gain.value = 0.08;
      oscillator.connect(gain);
      gain.connect(context.destination);
      void context.resume().then(() => {
        oscillator.start();
        oscillator.stop(context.currentTime + 0.35);
        oscillator.onended = () => { void context.close(); };
      }).catch(error => {
        console.warn('Could not start incoming call tone:', error);
        void context.close();
      });
    } catch (error) {
      console.warn('Could not play incoming call tone:', error);
    }
  }, [preferences.soundEnabled]);

  const processWebSocketMessage = useCallback((data: Record<string, unknown>): boolean => {
    if (data.type === 'call_invite') {
      if (
        typeof data.callId !== 'string' ||
        typeof data.channelId !== 'string' ||
        typeof data.fromUserId !== 'string' ||
        typeof data.media !== 'string' ||
        (data.media !== 'audio' && data.media !== 'video') ||
        typeof data.startedAt !== 'number' ||
        !Number.isFinite(data.startedAt) ||
        data.startedAt <= 0
      ) return true;

      if (activeCallRef.current || incomingCallRef.current) {
        send({
          type: 'call_reject',
          callId: data.callId,
          channelId: data.channelId,
        });
        return true;
      }
      const invitation: IncomingCall = {
        callId: data.callId,
        channelId: data.channelId,
        fromUserId: data.fromUserId,
        callerName: typeof data.callerName === 'string' ? data.callerName : data.fromUserId,
        media: data.media,
        startedAt: data.startedAt,
      };
      setCurrentIncomingCall(invitation);
      playIncomingTone();
      return true;
    }
    if (data.type === 'call_available') {
      if (typeof data.callId !== 'string') return true;
      if (data.available === false) {
        setAvailableCalls(previous => previous.filter(call => call.callId !== data.callId));
        return true;
      }
      if (
        typeof data.channelId !== 'string' ||
        typeof data.hostUserId !== 'string' ||
        typeof data.hostName !== 'string' ||
        (data.media !== 'audio' && data.media !== 'video') ||
        typeof data.startedAt !== 'number' ||
        !Number.isFinite(data.startedAt) ||
        data.startedAt <= 0 ||
        typeof data.participantCount !== 'number' ||
        !Array.isArray(data.invitedUserIds) ||
        data.invitedUserIds.some(userId => typeof userId !== 'string')
      ) return true;
      const call: AvailableCall = {
        callId: data.callId,
        channelId: data.channelId,
        hostUserId: data.hostUserId,
        hostName: data.hostName,
        media: data.media,
        startedAt: data.startedAt,
        participantCount: data.participantCount,
        invitedUserIds: data.invitedUserIds,
      };
      setAvailableCalls(previous => [
        ...previous.filter(existing => existing.callId !== call.callId),
        call,
      ]);
      if (activeCallRef.current?.callId === call.callId) {
        setCurrentCall({ ...activeCallRef.current, startedAt: call.startedAt });
      }
      return true;
    }
    if (data.type === 'call_peer_joined') {
      const call = activeCallRef.current;
      if (
        !call ||
        call.callId !== data.callId ||
        typeof data.userId !== 'string' ||
        typeof data.initiatorId !== 'string' ||
        data.userId === currentUserId
      ) return true;
      if (typeof data.startedAt === 'number' && data.startedAt > 0) {
        setCurrentCall({ ...call, startedAt: data.startedAt });
      }
      void createPeerConnection(data.userId, call, data.initiatorId === currentUserId).catch(error => {
        console.error('Could not create WebRTC peer connection:', error);
        addToast(translateText({
          pt: 'Não foi possível iniciar a ligação com um dos membros.',
          en: 'Could not start the connection with one of the members.',
          es: 'No se pudo iniciar la conexión con uno de los miembros.',
        }, language), 'error');
      });
      return true;
    }
    if (data.type === 'call_signal') {
      void receiveSignal(data);
      return true;
    }
    if (data.type === 'call_peer_left') {
      if (activeCallRef.current?.callId === data.callId && typeof data.userId === 'string') {
        closePeer(data.userId);
      }
      return true;
    }
    if (data.type === 'call_invite_rejected') {
      if (typeof data.userId === 'string') {
        addToast(translateText({
          pt: 'Um membro recusou a chamada.',
          en: 'A member declined the call.',
          es: 'Un miembro rechazó la llamada.',
        }, language), 'info');
      }
      return true;
    }
    if (data.type === 'call_ended') {
      setAvailableCalls(previous => previous.filter(call => call.callId !== data.callId));
      if (activeCallRef.current?.callId === data.callId) {
        closeCall(String(data.callId));
        addToast(translateText({
          pt: 'A chamada terminou.',
          en: 'The call has ended.',
          es: 'La llamada ha terminado.',
        }, language), 'info');
      } else if (incomingCallRef.current?.callId === data.callId) {
        setCurrentIncomingCall(null);
        if (mediaRequest?.callId === data.callId) setCurrentMediaRequest(null);
      }
      return true;
    }
    if (data.type === 'call_error') {
      if (typeof data.callId === 'string' && activeCallRef.current?.callId === data.callId) {
        closeCall(data.callId);
      }
      addToast(callErrorMessage(data.error, language), 'error');
      return true;
    }
    return false;
  }, [
    addToast,
    closeCall,
    closePeer,
    createPeerConnection,
    currentUserId,
    language,
    mediaRequest,
    playIncomingTone,
    receiveSignal,
    send,
    setCurrentCall,
    setCurrentIncomingCall,
    setCurrentMediaRequest,
  ]);
  messageHandlerRef.current = processWebSocketMessage;
  const handleWebSocketMessage = useCallback(
    (data: Record<string, unknown>) => messageHandlerRef.current(data),
    [],
  );

  const startCall = useCallback((channelId: string, targetUserIds: string[], media: CallMedia) => {
    const targets = [...new Set(targetUserIds.filter(userId => userId && userId !== currentUserId))];
    if (targets.length === 0) {
      addToast(translateText({
        pt: 'Não há membros em linha para convidar.',
        en: 'There are no online members to invite.',
        es: 'No hay miembros en línea para invitar.',
      }, language), 'info');
      return;
    }
    if (targets.length > 8) {
      addToast(translateText({
        pt: 'As chamadas de grupo estão limitadas a oito convidados.',
        en: 'Group calls are limited to eight invitees.',
        es: 'Las llamadas grupales están limitadas a ocho invitados.',
      }, language), 'error');
      return;
    }
    if (activeCallRef.current || incomingCallRef.current) {
      addToast(translateText({
        pt: 'Termine ou recuse a chamada atual antes de iniciar outra.',
        en: 'End or decline the current call before starting another.',
        es: 'Finaliza o rechaza la llamada actual antes de iniciar otra.',
      }, language), 'info');
      return;
    }
    setCurrentMediaRequest({ kind: 'outgoing', channelId, targetUserIds: targets, media });
  }, [addToast, currentUserId, language, setCurrentMediaRequest]);

  const acceptCall = useCallback(() => {
    const invitation = incomingCallRef.current;
    if (!invitation) return;
    setCurrentMediaRequest({
      kind: 'incoming',
      channelId: invitation.channelId,
      callId: invitation.callId,
      media: invitation.media,
      startedAt: invitation.startedAt,
    });
  }, [setCurrentMediaRequest]);

  const rejoinCall = useCallback((call: AvailableCall) => {
    if (!call.invitedUserIds.includes(currentUserId)) return;
    if (activeCallRef.current || incomingCallRef.current) return;
    setCurrentMediaRequest({
      kind: 'rejoin',
      channelId: call.channelId,
      callId: call.callId,
      hostUserId: call.hostUserId,
      startedAt: call.startedAt,
      media: call.media,
    });
  }, [currentUserId, setCurrentMediaRequest]);

  const confirmMediaRequest = useCallback(async () => {
    const request = mediaRequest;
    if (!request) return;
    setCurrentMediaRequest(null);
    try {
      await captureLocalMedia(request.media);
      const callId = request.kind === 'outgoing' ? crypto.randomUUID() : request.callId;
      if (!callId) throw new Error('Incoming call invitation is no longer available.');
      if (request.kind === 'incoming' &&
        incomingCallRef.current?.callId !== request.callId) {
        stopLocalStream();
        return;
      }
      const call: CallSession = {
        callId,
        channelId: request.channelId,
        media: request.media,
        isHost: request.kind === 'outgoing' || request.hostUserId === currentUserId,
        startedAt: request.kind === 'outgoing' ? Date.now() : request.startedAt || Date.now(),
      };
      setCurrentCall(call);
      if (request.kind === 'outgoing') {
        if (!send({
          type: 'call_invite',
          callId,
          channelId: request.channelId,
          targetUserIds: request.targetUserIds,
          media: request.media,
        })) {
          closeCall(callId);
          addToast(translateText({
            pt: 'O ChatOps está desligado. Não foi possível iniciar a chamada.',
            en: 'ChatOps is disconnected. Could not start the call.',
            es: 'ChatOps está desconectado. No se pudo iniciar la llamada.',
          }, language), 'error');
        }
      } else {
        if (request.kind === 'incoming') setCurrentIncomingCall(null);
        if (!send({
          type: request.kind === 'incoming' ? 'call_accept' : 'call_rejoin',
          callId,
          channelId: request.channelId,
        })) {
          closeCall(callId);
          addToast(translateText({
            pt: 'O ChatOps está desligado. Não foi possível atender à chamada.',
            en: 'ChatOps is disconnected. Could not answer the call.',
            es: 'ChatOps está desconectado. No se pudo responder a la llamada.',
          }, language), 'error');
        }
      }
    } catch (error) {
      console.error(`Could not acquire media for ${request.kind} call:`, error);
      stopLocalStream();
      addToast(mediaErrorMessage(error, language), 'error');
      if (request.kind === 'incoming') {
        send({
          type: 'call_reject',
          callId: request.callId,
          channelId: request.channelId,
        });
        setCurrentIncomingCall(null);
      }
    }
  }, [
    addToast,
    captureLocalMedia,
    closeCall,
    language,
    mediaRequest,
    send,
    currentUserId,
    setCurrentCall,
    setCurrentIncomingCall,
    setCurrentMediaRequest,
    stopLocalStream,
  ]);

  const cancelMediaRequest = useCallback(() => setCurrentMediaRequest(null), [setCurrentMediaRequest]);

  const rejectCall = useCallback(() => {
    const invitation = incomingCallRef.current;
    if (!invitation) return;
    setCurrentMediaRequest(null);
    send({
      type: 'call_reject',
      callId: invitation.callId,
      channelId: invitation.channelId,
    });
    setCurrentIncomingCall(null);
  }, [send, setCurrentIncomingCall, setCurrentMediaRequest]);

  const leaveCall = useCallback(() => {
    const call = activeCallRef.current;
    if (call) {
      send({
        type: 'call_leave',
        callId: call.callId,
        channelId: call.channelId,
      });
    }
    closeCall(call?.callId);
  }, [closeCall, send]);

  const endCall = useCallback(() => {
    const call = activeCallRef.current;
    if (call) {
      send({
        type: call.isHost ? 'call_end' : 'call_leave',
        callId: call.callId,
        channelId: call.channelId,
      });
    }
    closeCall(call?.callId);
  }, [closeCall, send]);

  const handleSignalingLoss = useCallback(() => {
    if (!activeCallRef.current && !incomingCallRef.current && !mediaRequest) return;
    closeCall(activeCallRef.current?.callId);
    setAvailableCalls([]);
    setCurrentIncomingCall(null);
    setCurrentMediaRequest(null);
    addToast(translateText({
      pt: 'A ligação ao servidor foi perdida; a chamada local foi encerrada.',
      en: 'The server connection was lost; the local call has ended.',
      es: 'Se perdió la conexión con el servidor; la llamada local ha terminado.',
    }, language), 'error');
  }, [addToast, closeCall, language, mediaRequest, setCurrentIncomingCall, setCurrentMediaRequest]);

  const toggleMicrophone = useCallback(() => {
    const next = !microphoneEnabled;
    localStreamRef.current?.getAudioTracks().forEach(track => { track.enabled = next; });
    setMicrophoneEnabled(next);
  }, [microphoneEnabled]);

  const replaceOutgoingVideoTrack = useCallback(async (track: MediaStreamTrack | null) => {
    const call = activeCallRef.current;
    if (!call) return;

    const waitForStableSignalingState = (peer: RTCPeerConnection) => {
      if (peer.signalingState === 'stable') return Promise.resolve();
      return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          peer.removeEventListener('signalingstatechange', handleStateChange);
        };
        const handleStateChange = () => {
          if (peer.signalingState === 'stable') {
            cleanup();
            resolve();
          } else if (peer.signalingState === 'closed') {
            cleanup();
            reject(new Error('The call connection closed before video negotiation completed.'));
          }
        };
        const timeout = window.setTimeout(() => {
          cleanup();
          reject(new Error('The call connection did not finish video negotiation in time.'));
        }, 10_000);
        peer.addEventListener('signalingstatechange', handleStateChange);
        handleStateChange();
      });
    };

    for (const [userId, peer] of peerConnections.current) {
      let sender = peer.getSenders().find(item => item.track?.kind === 'video')
        || peer.getTransceivers().find(item => item.receiver.track.kind === 'video')?.sender;
      if (sender) {
        await sender.replaceTrack(track);
        continue;
      }
      if (!track || !localStreamRef.current) continue;

      sender = peer.addTrack(track, localStreamRef.current);
      await waitForStableSignalingState(peer);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      send({
        type: 'call_signal',
        callId: call.callId,
        channelId: call.channelId,
        targetUserId: userId,
        signal: peer.localDescription,
      });
    }
  }, [send]);

  const toggleCamera = useCallback(async () => {
    if (cameraEnabled) {
      if (cameraTrackRef.current) cameraTrackRef.current.enabled = false;
      setCameraEnabled(false);
      if (!screenStreamRef.current) await replaceOutgoingVideoTrack(null);
      return;
    }

    try {
      let track = cameraTrackRef.current;
      if (!track || track.readyState === 'ended') {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Este navegador não permite aceder à câmara.');
        }
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: preferences.videoDeviceId
            ? { deviceId: { exact: preferences.videoDeviceId } }
            : true,
        });
        track = cameraStream.getVideoTracks()[0];
        const localStream = localStreamRef.current;
        if (!localStream || !track) {
          cameraStream.getTracks().forEach(item => item.stop());
          throw new Error('Não foi possível iniciar a câmara.');
        }
        localStream.addTrack(track);
        track.addEventListener('ended', () => localStream.removeTrack(track!));
        cameraTrackRef.current = track;
        setLocalStream(new MediaStream(localStream.getTracks()));
      }
      track.enabled = true;
      setCameraEnabled(true);
      if (!screenStreamRef.current) await replaceOutgoingVideoTrack(track);
    } catch (error) {
      console.error('Could not enable call camera:', error);
      addToast(error instanceof Error ? error.message : translateText({
        pt: 'Não foi possível ligar a câmara.',
        en: 'Could not turn on the camera.',
        es: 'No se pudo encender la cámara.',
      }, language), 'error');
    }
  }, [addToast, cameraEnabled, preferences.videoDeviceId, replaceOutgoingVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenStreamRef.current) {
      const stream = screenStreamRef.current;
      screenStreamRef.current = null;
      stream.getTracks().forEach(track => {
        localStreamRef.current?.removeTrack(track);
        track.stop();
      });
      setScreenShareEnabled(false);
      setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
      await replaceOutgoingVideoTrack(cameraEnabled ? cameraTrackRef.current : null);
      return;
    }

    if (!window.isSecureContext) {
      addToast(translateText({
        pt: 'A partilha do ecrã requer uma ligação segura (HTTPS ou localhost).',
        en: 'Screen sharing requires a secure connection (HTTPS or localhost).',
        es: 'Compartir pantalla requiere una conexión segura (HTTPS o localhost).',
      }, language), 'error');
      return;
    }
    if (!navigator.mediaDevices?.getDisplayMedia) {
      addToast(translateText({
        pt: 'Este navegador não suporta a partilha do ecrã.',
        en: 'This browser does not support screen sharing.',
        es: 'Este navegador no admite compartir pantalla.',
      }, language), 'error');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      if (!track) {
        stream.getTracks().forEach(item => item.stop());
        throw new Error('Não foi possível iniciar a partilha do ecrã.');
      }
      screenStreamRef.current = stream;
      localStreamRef.current?.addTrack(track);
      setLocalStream(localStreamRef.current
        ? new MediaStream([...localStreamRef.current.getAudioTracks(), track])
        : new MediaStream([track]));
      setScreenShareEnabled(true);
      track.addEventListener('ended', () => {
        if (screenStreamRef.current !== stream) return;
        screenStreamRef.current = null;
        localStreamRef.current?.removeTrack(track);
        setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
        setScreenShareEnabled(false);
        void replaceOutgoingVideoTrack(cameraEnabled ? cameraTrackRef.current : null);
      }, { once: true });
      await replaceOutgoingVideoTrack(track);
    } catch (error) {
      console.error('Could not share call screen:', error);
      const errorName = error instanceof DOMException ? error.name : '';
      if (stream) {
        stream.getTracks().forEach(track => {
          localStreamRef.current?.removeTrack(track);
          track.stop();
        });
        screenStreamRef.current = null;
        setScreenShareEnabled(false);
        setLocalStream(localStreamRef.current ? new MediaStream(localStreamRef.current.getTracks()) : null);
        try {
          await replaceOutgoingVideoTrack(cameraEnabled ? cameraTrackRef.current : null);
        } catch (rollbackError) {
          console.error('Could not restore video after screen sharing failed:', rollbackError);
        }
      }
      const message = errorName === 'NotAllowedError'
        ? translateText({
          pt: 'A partilha do ecrã foi cancelada ou não tem autorização.',
          en: 'Screen sharing was cancelled or permission was denied.',
          es: 'Se canceló la pantalla compartida o se denegó el permiso.',
        }, language)
        : errorName === 'NotSupportedError' || errorName === 'TypeError'
          ? translateText({
            pt: 'O navegador não permite iniciar a partilha do ecrã neste contexto.',
            en: 'The browser cannot start screen sharing in this context.',
            es: 'El navegador no puede iniciar la pantalla compartida en este contexto.',
          }, language)
        : errorName === 'NotReadableError'
          ? translateText({
            pt: 'Não foi possível capturar o ecrã. Feche outras aplicações que o estejam a partilhar e tente novamente.',
            en: 'The screen could not be captured. Close other apps sharing it and try again.',
            es: 'No se pudo capturar la pantalla. Cierre otras aplicaciones que la compartan e inténtelo de nuevo.',
          }, language)
          : translateText({
            pt: 'Não foi possível partilhar o ecrã.',
            en: 'Screen sharing could not be started.',
            es: 'No se pudo iniciar la pantalla compartida.',
          }, language);
      addToast(message, 'error');
    }
  }, [addToast, cameraEnabled, language, replaceOutgoingVideoTrack]);

  const toggleMicrophoneTest = useCallback(async () => {
    if (microphoneTestRef.current) {
      stopMicrophoneTest();
      return;
    }
    const track = localStreamRef.current?.getAudioTracks()
      .find(item => item.readyState === 'live');
    if (!track) {
      addToast(translateText({
        pt: 'O microfone não está disponível nesta chamada.',
        en: 'The microphone is not available in this call.',
        es: 'El micrófono no está disponible en esta llamada.',
      }, language), 'error');
      return;
    }
    if (!track.enabled) {
      addToast(translateText({
        pt: 'Ative o microfone para testar o nível de entrada.',
        en: 'Turn on the microphone to test its input level.',
        es: 'Encienda el micrófono para probar el nivel de entrada.',
      }, language), 'info');
      return;
    }

    try {
      const context = new AudioContext();
      await context.resume();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(new MediaStream([track])).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const updateLevel = () => {
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length);
        setMicrophoneTestLevel(Math.min(100, Math.round(rms * 350)));
        const current = microphoneTestRef.current;
        if (current?.context === context) {
          current.frameId = requestAnimationFrame(updateLevel);
        }
      };
      microphoneTestRef.current = { context, frameId: requestAnimationFrame(updateLevel) };
      setMicrophoneTestActive(true);
    } catch (error) {
      console.error('Could not test call microphone:', error);
      addToast(translateText({
        pt: 'Não foi possível testar o microfone.',
        en: 'Could not test the microphone.',
        es: 'No se pudo probar el micrófono.',
      }, language), 'error');
    }
  }, [addToast, language, stopMicrophoneTest]);

  const testAudioOutput = useCallback(async () => {
    stopOutputTest();
    try {
      const context = new AudioContext() as AudioContextWithSinkId;
      if (preferences.audioOutputDeviceId) {
        if (!context.setSinkId) {
          await context.close();
          addToast(translateText({
            pt: 'Este navegador não permite selecionar a saída de áudio.',
            en: 'This browser does not support selecting an audio output.',
            es: 'Este navegador no permite seleccionar la salida de audio.',
          }, language), 'error');
          return;
        }
        await context.setSinkId(preferences.audioOutputDeviceId);
      }
      await context.resume();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 440;
      gain.gain.value = 0.08;
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.8);
      const timerId = window.setTimeout(() => {
        if (outputTestRef.current?.context === context) {
          outputTestRef.current = null;
          void context.close();
        }
      }, 1000);
      outputTestRef.current = { context, timerId };
    } catch (error) {
      console.error('Could not test call audio output:', error);
      addToast(translateText({
        pt: 'Não foi possível reproduzir o som de teste.',
        en: 'Could not play the audio test tone.',
        es: 'No se pudo reproducir el tono de prueba.',
      }, language), 'error');
    }
  }, [addToast, language, preferences.audioOutputDeviceId, stopOutputTest]);

  const updatePreferences = useCallback((next: Partial<CallPreferences>) => {
    setPreferences(previous => {
      const updated = { ...previous, ...next };
      localStorage.setItem(preferencesKey, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      addToast(translateText({
        pt: 'Este navegador não permite listar os dispositivos de áudio/vídeo.',
        en: 'This browser cannot list audio/video devices.',
        es: 'Este navegador no permite listar dispositivos de audio/vídeo.',
      }, language), 'error');
      return;
    }
    try {
      const listed = await navigator.mediaDevices.enumerateDevices();
      const audioContextPrototype = AudioContext.prototype as AudioContextWithSinkId;
      setDevices({
        microphones: listed.filter(device => device.kind === 'audioinput').map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Microfone ${device.deviceId.slice(0, 6)}`,
        })),
        audioOutputs: listed.filter(device => device.kind === 'audiooutput').map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Saída de áudio ${device.deviceId.slice(0, 6)}`,
        })),
        cameras: listed.filter(device => device.kind === 'videoinput').map(device => ({
          deviceId: device.deviceId,
          label: device.label || `Câmara ${device.deviceId.slice(0, 6)}`,
        })),
        audioOutputSelectionSupported: typeof audioContextPrototype.setSinkId === 'function',
      });
    } catch (error) {
      console.error('Could not list call devices:', error);
      addToast(translateText({
        pt: 'Não foi possível carregar os dispositivos de áudio/vídeo.',
        en: 'Could not load audio/video devices.',
        es: 'No se pudieron cargar los dispositivos de audio/vídeo.',
      }, language), 'error');
    }
  }, [addToast, language]);

  useEffect(() => {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  }, [preferences]);

  useEffect(() => () => {
    stopMicrophoneTest();
    stopOutputTest();
    for (const peer of peerConnections.current.values()) peer.close();
    peerConnections.current.clear();
    localStreamRef.current?.getTracks().forEach(track => track.stop());
  }, [stopMicrophoneTest, stopOutputTest]);

  return {
    activeCall,
    incomingCall,
    availableCalls,
    mediaRequest,
    localStream,
    remotePeers,
    microphoneEnabled,
    cameraEnabled,
    screenShareEnabled,
    microphoneTestLevel,
    microphoneTestActive,
    devices,
    preferences,
    handleWebSocketMessage,
    handleSignalingLoss,
    startCall,
    acceptCall,
    rejoinCall,
    confirmMediaRequest,
    cancelMediaRequest,
    rejectCall,
    leaveCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    toggleMicrophoneTest,
    testAudioOutput,
    updatePreferences,
    refreshDevices,
  };
}
