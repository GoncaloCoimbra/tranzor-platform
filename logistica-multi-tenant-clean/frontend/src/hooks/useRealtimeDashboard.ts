import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { io, Socket } from 'socket.io-client';

const realtimeEvents = [
  'stock:updated',
  'stock:reservation-created',
  'stock:reservation-confirmed',
  'stock:reservation-released',
  'stock:reservation-expired',
  'transport:created',
  'transport:updated',
  'transport:delivered',
] as const;

function getSocketUrl(): string {
  const configuredUrl = process.env.REACT_APP_WS_URL;
  if (configuredUrl) {
    return configuredUrl;
  }

  return window.location.origin;
}

export function useRealtimeDashboard(companyId?: string | null): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !companyId) {
      return undefined;
    }

    const socket: Socket = io(getSocketUrl(), {
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
    });

    const refreshDashboard = () => {
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    };

    realtimeEvents.forEach((event) => socket.on(event, refreshDashboard));

    return () => {
      realtimeEvents.forEach((event) => socket.off(event, refreshDashboard));
      socket.disconnect();
    };
  }, [companyId, queryClient]);
}
