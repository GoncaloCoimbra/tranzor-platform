/**
 * Extrai mensagem de error de forma segura
 * Converte erros de qualquer tipo em string
 */
export function getErrorMessage(error: any, defaultMessage?: string): string {
  const fallback = defaultMessage || 'Error desconhecido. Tente novamente.';

  // Se for string, retorna direto
  if (typeof error === 'string') {
    return error;
  }

  // Se for error de axios response
  if (error?.response?.data) {
    const date = error.response.data;

    // Tentar várias possibilidades comuns
    if (typeof date === 'string') {
      return date;
    }

    if (date.message && typeof date.message === 'string') {
      return date.message;
    }

    if (date.error && typeof date.error === 'string') {
      return date.error;
    }

    if (date.error?.message && typeof date.error.message === 'string') {
      return date.error.message;
    }

    // Se for array de erros
    if (Array.isArray(date) && date[0]?.message) {
      return date[0].message;
    }
  }

  // Se for error padrão de JavaScript
  if (error?.message && typeof error.message === 'string') {
    return error.message;
  }

  // Fallback
  return fallback;
}

/**
 * Log de error para debug
 */
export function logError(context: string, error: any): void {
  console.error(`[${context}] Request failed`, {
    status: error?.response?.status,
  });
}
