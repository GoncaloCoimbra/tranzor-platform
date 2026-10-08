import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || '/api';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📡 API Service inicializado');
console.log('🔗 Base URL:', BASE_URL);
console.log('🔗 Env Variable:', process.env.REACT_APP_API_URL);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});


// REQUEST INTERCEPTOR

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const fullUrl = `${config.baseURL}${config.url}`;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🔵 [REQUEST] ${config.method?.toUpperCase()} ${fullUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return config;
  },
  (error) => {
    console.error('[REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);


// RESPONSE INTERCEPTOR

api.interceptors.response.use(
  (response) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`[RESPONSE] ${response.status} ${response.config.url}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const errorData = error.response?.data;

    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error(`[ERROR] ${status || 'NETWORK ERROR'} ${url}`);
    console.error('[ERROR DATA]', errorData);
    console.error('[ATTEMPTED URL]', error.config?.baseURL + error.config?.url);
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ✅ Normalize error date to always be a plain string
    // This prevents "Objects are not valid as a React child" crashes
    if (error.response) {
      const date = error.response.data;
      let message: string;

      // Get custom message based on status code
      const statusMessages: { [key: number]: string } = {
        400: 'Oops! Dados inválidos. Verifique o formulário e tente novamente.',
        401: 'Sua sessão expirou. Faça login novamente para continuar.',
        403: 'Você não tem permissão para acessar este recurso.',
        404: 'Recurso não encontrado. Pode ter sido deletado ou a URL está incorreta.',
        409: 'Conflito detectado. Tente atualizar a página e tentar novamente.',
        500: 'Erro interno do servidor. Nossa equipe foi notificada.',
        503: 'Servidor em manutenção. Tente novamente em alguns momentos.',
      };

      // Try to use provided error message first
      if (typeof date === 'string') {
        message = date;
      } else if (typeof date?.message === 'string') {
        message = date.message;
      } else if (Array.isArray(date?.message)) {
        // NestJS validation errors return message as string[]
        message = date.message.join(', ');
      } else if (typeof date?.error === 'string') {
        message = date.error;
      } else {
        // Fall back to status code message
        message = statusMessages[status] || `❌ Erro do servidor (${status}). Tente novamente ou contate o suporte.`;
      }

      error.response.data = { message };
    }

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;