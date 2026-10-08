import React, { createContext, useState, useContext, useEffect, useRef, ReactNode } from 'react';
import api from '../api/api';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OPERATOR';
  companyId?: string | null;
  companyName?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  role?: 'ADMIN' | 'OPERATOR';
  companyId?: string;
}

interface AuthContextData {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (date: RegisterData) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  updateUserData: (userData: Partial<User>) => void;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isOperator: boolean;
  isDemo: boolean;
}

const AuthContext = createContext<AuthContextData | null>(null);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);
  const hasLoadedRef = useRef(false);

  // normalize user object (strip wrappers)
  const normalizeUser = (maybeUser: any): User | null => {
    if (!maybeUser) return null;
    // if payload is { user: {...} }
    if (maybeUser.user && typeof maybeUser.user === 'object') return maybeUser.user as User;
    // if payload is { data: { user: {...} } }
    if (maybeUser.data && maybeUser.data.user) return maybeUser.data.user as User;
    // otherwise assume it's the user object
    return maybeUser as User;
  };

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadUser = async () => {
      const token = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      const storedIsDemo = localStorage.getItem('isDemo') === 'true';

      if (token && storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsDemo(storedIsDemo);
          api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          const response = await api.get('/auth/me');

          const userFromServer = normalizeUser(response.data);

          if (!userFromServer) {
            throw new Error('Invalid format returned by /auth/me');
          }

          setUser(userFromServer);
          localStorage.setItem('user', JSON.stringify(userFromServer));
        } catch (error: any) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
          delete api.defaults.headers.common['Authorization'];
        }
      }

      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });

      const token =
        response.data?.token ||
        response.data?.accessToken ||
        response.data?.access_token ||
        response.data?.data?.token ||
        null;

      const userData =
        response.data?.user ||
        response.data?.data?.user ||
        response.data?.userData ||
        (typeof response.data === 'object' ? response.data : null);

      const normalizedUser = normalizeUser(userData);

      if (!token || !normalizedUser) {
        throw new Error('Resposta do servidor inválida: token ou user ausentes');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(normalizedUser);

    } catch (error: any) {
      let message = 'Login error. Please check your credentials.';

      if (error.response?.data) {
        const date = error.response.data;
        if (typeof date === 'string') {
          message = date;
        } else if (date.message) {
          message = date.message;
        } else if (date.error) {
          message = date.error;
        } else if (Array.isArray(date) && date[0]?.message) {
          message = date[0].message;
        }
      } else if (error.request) {
        message = 'Sem resposta do servidor. Verifique sua conexão.';
      } else if (error.message) {
        message = error.message;
      }

      throw new Error(message);
    }
  };

  const demoLogin = async () => {
    try {
      await login('demo@logistica.com', 'demo123');
      setIsDemo(true);
      localStorage.setItem('isDemo', 'true');
    } catch (error: any) {
      setIsDemo(false);
      localStorage.removeItem('isDemo');
      throw new Error('Failedto load demo account. Please try again.');
    }
  };

  const register = async (date: RegisterData) => {
    try {
      const response = await api.post('/auth/register', date);

      const token =
        response.data?.token ||
        response.data?.accessToken ||
        response.data?.access_token ||
        response.data?.data?.token ||
        null;

      const userData =
        response.data?.user ||
        response.data?.data?.user ||
        response.data?.userData ||
        (typeof response.data === 'object' ? response.data : null);

      const normalizedUser = normalizeUser(userData);

      if (!token || !normalizedUser) {
        throw new Error('Resposta do servidor inválida: token ou user ausentes');
      }

      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(normalizedUser));
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(normalizedUser);

    } catch (error: any) {
      let message = 'Registration error. Please try again.';

      if (error.response?.data) {
        const date = error.response.data;
        if (typeof date === 'string') {
          message = date;
        } else if (date.message) {
          message = date.message;
        } else if (date.error) {
          message = date.error;
        } else if (Array.isArray(date) && date[0]?.message) {
          message = date[0].message;
        }
      } else if (error.request) {
        message = 'Sem resposta do servidor. Verifique sua conexão.';
      } else if (error.message) {
        message = error.message;
      }

      throw new Error(message);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isDemo');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
    setIsDemo(false);
    window.location.href = '/login';
  };

  const updateUserData = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const isSuperAdmin = user?.role === 'SUPER_ADMIN';
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isOperator = user?.role === 'OPERATOR';

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        demoLogin,
        logout,
        updateUserData,
        isAuthenticated: !!user,
        isSuperAdmin,
        isAdmin,
        isOperator,
        isDemo,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};