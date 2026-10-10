import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import Sidebar from '../Sidebar';

// mock the auth hook so we can control the returned user
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { role: 'SUPER_ADMIN' },
  }),
}));

describe('Sidebar component', () => {
  it('shows base navigation links', () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Sidebar />
      </MemoryRouter>
    );

    const dashboardLinks = screen.getAllByRole('link', { name: /Dashboard/i });
    expect(dashboardLinks.length).toBeGreaterThan(0);

    expect(screen.getAllByRole('link', { name: /Products/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Suppliers/i }).length).toBeGreaterThan(0);
  });

  it('includes super admin link when role is SUPER_ADMIN', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText(/Super Admin/i)).toBeInTheDocument();
  });
});
