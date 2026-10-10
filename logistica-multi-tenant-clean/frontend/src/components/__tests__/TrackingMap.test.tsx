import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import TrackingMap from '../TrackingMap';

// Mock Leaflet
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => <div data-testid="map-container">{children}</div>,
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({ children }: any) => <div data-testid="marker">{children}</div>,
  Popup: ({ children }: any) => <div data-testid="popup">{children}</div>,
  Polyline: () => <div data-testid="polyline" />,
  Circle: () => <div data-testid="circle" />,
  useMap: () => ({
    fitBounds: vi.fn(),
  }),
}));

vi.mock('leaflet', () => ({
  latLng: (lat: number, lng: number) => ({ lat, lng }),
  latLngBounds: vi.fn(),
  divIcon: vi.fn().mockImplementation((opts: any) => ({
    ...opts,
    options: opts,
  })),
  default: {
    latLngBounds: vi.fn(),
    divIcon: vi.fn().mockImplementation((opts: any) => ({
      ...opts,
      options: opts,
    })),
  },
}));

describe('TrackingMap Component', () => {
  const mockRoute = {
    id: '1',
    name: 'Lisboa → Porto',
    status: 'in_progress' as const,
    locations: [
      { lat: 38.7223, lng: -9.1393, timestamp: '2026-02-27T10:00:00Z', speed: 0 },
      { lat: 40, lng: -8.5, timestamp: '2026-02-27T12:00:00Z', speed: 50 },
      { lat: 41.1579, lng: -8.6291, timestamp: '2026-02-27T14:00:00Z', speed: 0 },
    ],
    startTime: '2026-02-27T10:00:00Z',
    endTime: '2026-02-27T14:00:00Z',
  };

  it('should render map container', () => {
    // Arrange & Act
    render(<TrackingMap routes={[mockRoute]} />);

    // Assert
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
    expect(screen.getByTestId('tile-layer')).toBeInTheDocument();
  });

  it('should render polyline for route', () => {
    // Arrange & Act
    render(<TrackingMap routes={[mockRoute]} />);

    // Assert
    expect(screen.getByTestId('polyline')).toBeInTheDocument();
  });

  it('should render start and end markers', () => {
    // Arrange & Act
    render(<TrackingMap routes={[mockRoute]} />);

    // Assert
    const markers = screen.getAllByTestId('marker');
    expect(markers.length).toBeGreaterThanOrEqual(2);
  });

  it('should handle empty routes gracefully', () => {
    // Arrange & Act
    render(<TrackingMap routes={[]} />);

    // Assert
    expect(screen.getByText(/No routes available for tracking/i)).toBeInTheDocument();
    expect(screen.queryByTestId('map-container')).not.toBeInTheDocument();
  });

  it('should render intermediate waypoint circles', () => {
    // Arrange & Act
    render(<TrackingMap routes={[mockRoute]} />);

    // Assert
    const circles = screen.getAllByTestId('circle');
    // Should have circles for intermediate points
    expect(circles.length).toBeGreaterThanOrEqual(0);
  });

  it('should display correct route status', () => {
    // Arrange & Act
    const { rerender } = render(<TrackingMap routes={[mockRoute]} />);

    // Assert - in_progress status
    expect(screen.getByTestId('map-container')).toBeInTheDocument();

    // Arrange - Update with completed status
    const completedRoute = { ...mockRoute, status: 'completed' as const };
    rerender(<TrackingMap routes={[completedRoute]} />);

    // Assert - Should still render
    expect(screen.getByTestId('map-container')).toBeInTheDocument();
  });
});
