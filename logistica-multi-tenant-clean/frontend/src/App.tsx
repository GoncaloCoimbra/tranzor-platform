import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { queryClient } from './lib/react-query';
import { AuthProvider } from './contexts/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import DemoBadge from './components/DemoBadge';
import './styles/leaflet.css';
import './styles/unified-system.css';

// Layout
import UnifiedLayout from './layouts/UnifiedLayout';
import PrivateRoute from './components/PrivateRoute';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import DashboardAdvanced from './pages/DashboardAdvanced';

// Product Pages
import ProductList from './pages/ProductList';
import ProductDetails from './pages/ProductDetails';
import NewProduct from './pages/NewProduct';

// Management Pages
import CompanyManagement from './pages/CompanyManagement';
import GlobalUserManagement from './pages/GlobalUserManagement';
import SupplierList from './pages/SupplierList';

// Vehicle & Transport Pages
import VehicleList from './pages/VehicleList';
import TransportList from './pages/TransportList';

// SuperAdmin (SEM MainLayout)
import SuperAdminHome from './pages/SuperAdminHome';
import SuperAdminProfile from './pages/SuperAdminProfile';

// New role‑specific homepage components
import AdminHome from './pages/AdminHome';
import OperatorHome from './pages/OperatorHome';
import RoleRedirect from './components/RoleRedirect';

// Profile & Settings
import Profile from './pages/Profile';
import Settings from './pages/Settings';

// Tasks
import Tasks from './pages/Tasks';

// Referrals
import Referrals from './pages/Referrals';

// AUDIT LOG - Audit History
import AuditLog from './pages/AuditLog';

// Live Tracking & Route Optimization
import LiveTrackingRouteOptimization from './pages/LiveTrackingAndRouteOptimization';

// Informational pages
import ApiDocumentation from './pages/ApiDocumentation';
import HelpCenter from './pages/HelpCenter';
import Tutorials from './pages/Tutorials';
import TutorialDetail from './pages/TutorialDetail';
import Updates from './pages/Updates';
import SystemStatus from './pages/SystemStatus';

// Add imports for new informational pages
import PrivacyPolicy from './pages/Privacy Policy';
import TermsOfUse from './pages/TermsofUse';
import Cookies from './pages/cookies';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ErrorBoundary>
          <DemoBadge />
          <BrowserRouter>
          <Routes>

            {/* ===================
                PUBLIC ROUTES
            =================== */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Add new public informational routes here */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms-of-use" element={<TermsOfUse />} />
            <Route path="/terms" element={<TermsOfUse />} />
            <Route path="/contact" element={<HelpCenter />} />
            <Route path="/cookies" element={<Cookies />} />

            {/* ===================
                SUPER ADMIN ROUTES (WITHOUT MainLayout)
                Home page: /superadmin-home
            =================== */}
            <Route
              path="/superadmin-home"
              element={
                <PrivateRoute requireSuperAdmin>
                  <UnifiedLayout />
                </PrivateRoute>
              }
            >
              <Route index element={<SuperAdminHome />} />
            </Route>

            <Route
              path="/superadmin"
              element={
                <PrivateRoute requireSuperAdmin>
                  <UnifiedLayout />
                </PrivateRoute>
              }
            >
              <Route path="profile" element={<SuperAdminProfile />} />
            </Route>

            {/* ===================
                PRIVATE ROUTES (WITH UnifiedLayout)
            =================== */}
            <Route
              path="/"
              element={
                <PrivateRoute>
                  <UnifiedLayout />
                </PrivateRoute>
              }
            >

              {/* Redirect root to the appropriate page according to the user's role */}
              <Route index element={<RoleRedirect />} />
              
              {/* Dashboard */}
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="dashboard/advanced" element={<DashboardAdvanced />} />

              {/* Products - English & Portuguese */}
              <Route path="products" element={<ProductList />} />
              <Route path="products/new" element={<NewProduct />} />
              <Route path="products/:id" element={<ProductDetails />} />

              {/* Suppliers - English & Portuguese */}
              <Route path="suppliers" element={<SupplierList />} />
              <Route path="fornecedores" element={<SupplierList />} />

              {/* Companies - English & Portuguese */}
              <Route 
                path="companies"
                element={
                  <PrivateRoute>
                    <CompanyManagement />
                  </PrivateRoute>
                } 
              />
              <Route path="empresas" element={<Navigate to="/companies" replace />} />

              {/* Vehicles - English & Portuguese */}
              <Route path="vehicles" element={<VehicleList />} />
              <Route path="veiculos" element={<VehicleList />} />

              {/* Transports - English & Portuguese */}
              <Route path="transports" element={<TransportList />} />
              <Route path="transportes" element={<TransportList />} />

              {/* Documentation/Help Pages */}
              <Route path="api-docs" element={<ApiDocumentation />} />
              <Route path="help" element={<HelpCenter />} />
              <Route path="tutorials" element={<Tutorials />} />
              <Route path="tutorials/:id" element={<TutorialDetail />} />
              <Route path="updates" element={<Updates />} />
              <Route path="status" element={<SystemStatus />} />

              {/* GPS Tracking and Route Optimization */}
              <Route path="tracking" element={<LiveTrackingRouteOptimization />} />
              <Route path="rastreamento" element={<LiveTrackingRouteOptimization />} />

              {/* Tasks - English & Portuguese - only Operator and Admin */}
              <Route
                path="tasks"
                element={
                  <PrivateRoute requireOperator>
                    <Tasks />
                  </PrivateRoute>
                }
              />
              <Route
                path="tarefas"
                element={
                  <PrivateRoute requireOperator>
                    <Tasks />
                  </PrivateRoute>
                }
              />

              {/* Referrals - References/Recommendations */}
              <Route
                path="referrals"
                element={
                  <PrivateRoute requireOperator>
                    <Referrals />
                  </PrivateRoute>
                }
              />

              {/* History - Accessible to all authenticated users */}
              <Route path="history" element={<AuditLog />} />
              <Route path="historico" element={<Navigate to="/history" replace />} />

              {/* Profile */}
              <Route path="profile" element={<Profile />} />

              {/* Settings (only for Admin and SuperAdmin) */}
              <Route
                path="configuracoes"
                element={
                  <PrivateRoute requireAdmin>
                    <Settings />
                  </PrivateRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <PrivateRoute requireAdmin>
                    <Settings />
                  </PrivateRoute>
                }
              />

              {/* Role-specific home routes (can be expanded in the future) */}
              <Route
                path="admin-home"
                element={
                  <PrivateRoute requireAdmin>
                    <AdminHome />
                  </PrivateRoute>
                }
              />
              <Route
                path="operator-home"
                element={
                  <PrivateRoute requireOperator>
                    <OperatorHome />
                  </PrivateRoute>
                }
              />

              {/* Users (Admin) */}
              <Route 
                path="users" 
                element={
                  <PrivateRoute requireAdmin>
                    <GlobalUserManagement />
                  </PrivateRoute>
                } 
              />

            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />

          </Routes>
        </BrowserRouter>

        <ReactQueryDevtools initialIsOpen={false} />
        </ErrorBoundary>
        </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;