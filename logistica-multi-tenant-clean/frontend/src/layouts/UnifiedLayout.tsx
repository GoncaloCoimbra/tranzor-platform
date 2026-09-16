import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UnifiedHeader from '../components/layout/UnifiedHeader';
import UnifiedSidebar from '../components/layout/UnifiedSidebar';
import UnifiedFooter from '../components/layout/UnifiedFooter';
import '../styles/unified-system.css';

interface UnifiedLayoutProps {
  showSidebar?: boolean;
  showHeader?: boolean;
  showFooter?: boolean;
  variant?: 'admin' | 'public';
}

const UnifiedLayout: React.FC<UnifiedLayoutProps> = ({
  showSidebar = true,
  showHeader = true,
  showFooter = true,
  variant = 'admin',
}) => {
  const location = useLocation();
  const { user } = useAuth();
  const isSuperAdminArea = location.pathname.startsWith('/superadmin') ||
    (user?.role === 'SUPER_ADMIN' && ['/users', '/companies'].includes(location.pathname));

  useEffect(() => {
    const html = document.documentElement;
    html.classList.add('dark-mode');
    localStorage.setItem('theme', 'dark');
  }, []);

  return (
    <div className="unified-layout">
      {showHeader && (
        <UnifiedHeader variant={variant} />
      )}
      
      <div className="layout-wrapper">
        {showSidebar && !isSuperAdminArea && <UnifiedSidebar />}
        
        <main className="layout-main">
          <Outlet />
        </main>
      </div>
      
      {showFooter && <UnifiedFooter />}
    </div>
  );
};

export default UnifiedLayout;
