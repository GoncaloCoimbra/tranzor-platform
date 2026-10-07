import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCallIceServers, formatCallDuration } from './useWebRtcCalls';

describe('formatCallDuration', () => {
  it('formats elapsed time as minutes and seconds', () => {
    expect(formatCallDuration(0, 65_000)).toBe('01:05');
  });

  it('includes hours for longer calls', () => {
    expect(formatCallDuration(0, 3_661_000)).toBe('01:01:01');
  });

  it('does not show a negative duration when clocks differ', () => {
    expect(formatCallDuration(1_000, 0)).toBe('00:00');
  });
});

describe('fetchCallIceServers', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads ICE servers from the authenticated backend endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [
          { urls: 'stun:stun.example.test:3478' },
          {
            urls: ['turn:turn.example.test:3478?transport=udp'],
            username: '2030000000:user-1',
            credential: 'short-lived-credential',
          },
        ],
        turnConfigured: true,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchCallIceServers()).resolves.toEqual([
      { urls: 'stun:stun.example.test:3478' },
      {
        urls: ['turn:turn.example.test:3478?transport=udp'],
        username: '2030000000:user-1',
        credential: 'short-lived-credential',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/ice-servers', { credentials: 'include' });
  });

  it('surfaces an unavailable backend response instead of silently using STUN only', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    await expect(fetchCallIceServers()).rejects.toThrow('Não foi possível obter a configuração');
  });

  it('rejects malformed ICE server responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ iceServers: [{ urls: 12 }] }),
    }));

    await expect(fetchCallIceServers()).rejects.toThrow('configuração dos servidores de ligação recebida é inválida');
  });
});
