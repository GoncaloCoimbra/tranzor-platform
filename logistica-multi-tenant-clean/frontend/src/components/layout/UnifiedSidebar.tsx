import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage, translateText, TRANSLATIONS } from '../../i18n';
import { Building2, ClipboardList, LayoutDashboard, MapPin, Package, Route, Truck, History, ChevronLeft, ChevronRight } from 'lucide-react';
import './UnifiedSidebar.css';

interface NavItem {
  label: string;
  translationKey: keyof typeof TRANSLATIONS;
  href: string;
  icon: React.ReactNode;
}

const iconClass = 'sidebar-lucide-icon';

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    translationKey: 'dashboardHeader',
    href: '/dashboard',
    icon: <LayoutDashboard className={iconClass} />,
  },
  {
    label: 'Products',
    translationKey: 'headerProducts',
    href: '/products',
    icon: <Package className={iconClass} />,
  },
  {
    label: 'Suppliers',
    translationKey: 'headerSuppliers',
    href: '/suppliers',
    icon: <Building2 className={iconClass} />,
  },
  {
    label: 'Vehicles',
    translationKey: 'headerVehicles',
    href: '/vehicles',
    icon: <Truck className={iconClass} />,
  },
  {
    label: 'Transports',
    translationKey: 'headerTransports',
    href: '/transports',
    icon: <Route className={iconClass} />,
  },
  {
    label: 'Tracking',
    translationKey: 'headerTracking',
    href: '/tracking',
    icon: <MapPin className={iconClass} />,
  },
  {
    label: 'Tasks',
    translationKey: 'headerTasks',
    href: '/tasks',
    icon: <ClipboardList className={iconClass} />,
  },
  {
    label: 'History',
    translationKey: 'headerHistory',
    href: '/history',
    icon: <History className={iconClass} />,
  },
];
const UnifiedSidebar: React.FC = () => {
  const { language } = useLanguage();
  const t = (key: keyof typeof TRANSLATIONS) => translateText(TRANSLATIONS[key], language);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`unified-sidebar ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? t('menuOpen') : t('menuClose')}
        type="button"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </svg>
      </button>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            title={t(item.translationKey)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{t(item.translationKey)}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};

export default UnifiedSidebar;
