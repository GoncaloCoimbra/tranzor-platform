import React from 'react';
import { render } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('./contexts/AuthContext', () => ({
  AuthProvider: ({ children }: any) => <>{children}</>,
  useAuth: () => ({
    user: null,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    demoLogin: vi.fn(),
    logout: vi.fn(),
    updateUserData: vi.fn(),
    isAuthenticated: false,
    isSuperAdmin: false,
    isAdmin: false,
    isOperator: false,
    isDemo: false,
  }),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div>{children}</div>,
  TileLayer: () => <div />,
  Popup: ({ children }: any) => <div>{children}</div>,
  Polyline: () => <div />,
  Circle: () => <div />,
  Marker: () => <div />,
  useMap: () => ({
    fitBounds: vi.fn(),
  }),
}));

vi.mock('leaflet', () => ({
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  latLngBounds: vi.fn(),
  divIcon: vi.fn().mockImplementation((opts: any) => ({ ...opts, options: opts })),
  default: {
    latLngBounds: vi.fn(),
    divIcon: vi.fn().mockImplementation((opts: any) => ({ ...opts, options: opts })),
  },
}));

import App from './App';

test('renders App without crashing', () => {
  expect(() => render(<App />)).not.toThrow();
});
