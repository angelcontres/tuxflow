import axios from 'axios';

/**
 * Extrae un mensaje apto para mostrar al usuario a partir de un error de red.
 *
 * Los errores de axios vienen con texto técnico ("Request failed with status
 * code 500", "Network Error", etc.) y el backend puede devolver mensajes con
 * detalle interno. Este helper intenta conservar solo los mensajes que el
 * backend define como pensados para el usuario final y, en cualquier otro
 * caso, devuelve el mensaje genérico indicado.
 */
export function getUserFacingError(err: unknown, fallback: string): string {
  const serverMessage = extractServerMessage(err);

  if (serverMessage && isUserSafe(serverMessage)) {
    return serverMessage;
  }

  return fallback;
}

/** Lee el campo `error` del body que devuelve el backend. */
function extractServerMessage(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: unknown } | undefined;
    if (typeof data?.error === 'string' && data.error.trim().length > 0) {
      return data.error.trim();
    }
  }
  return null;
}

/**
 * Filtra los mensajes que el backend sí escribe para el usuario final.
 * Todo lo que suene a detalle técnico se descarta y se usa el fallback.
 */
function isUserSafe(message: string): boolean {
  const technicalPatterns = [
    /\bminio\b/i,
    /\bs3\b/i,
    /\bneo4j\b/i,
    /\bboltd?\b/i,
    /status code/i,
    /\b\d{3}\b/,
    /request failed/i,
    /network error/i,
    /timeout/i,
    /exception/i,
    /\b[a-z0-9_]+\.[a-z0-9_.]+\.[A-Z]\w*/,
  ];

  return !technicalPatterns.some((pattern) => pattern.test(message));
}
