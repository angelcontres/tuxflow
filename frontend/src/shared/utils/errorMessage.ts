import axios from 'axios';

/**
 * Mensajes para los códigos de estado que el backend no puede explicar con un
 * cuerpo JSON, porque los contesta la capa HTTP antes de que la petición llegue
 * a un recurso.
 *
 * El 413 es el caso real: Quarkus rechaza un cuerpo mayor que
 * `quarkus.http.limits.max-body-size` con cuerpo vacío, así que no hay campo
 * `error` que leer. Sin esta tabla el usuario veía el texto genérico de cada
 * formulario y no tenía forma de saber que el problema era el tamaño del
 * archivo.
 *
 * El 20 MB citado aquí es el de `quarkus.http.limits.max-body-size` en
 * application.properties. Si se cambia uno hay que cambiar el otro.
 */
const MENSAJES_POR_ESTADO: Record<number, string> = {
  413: 'La imagen es demasiado grande. El máximo permitido es 20 MB.',
  // El 429 lo produce el `@RateLimit` de la búsqueda de usuarios: se alcanzó el tope de
  // peticiones por ventana. El mensaje es propio del cliente porque el backend responde el 429
  // con un cuerpo vacío o con el detalle del SDK, que aquí no se puede enseñar.
  429: 'Has buscado demasiadas veces seguidas. Espera un momento e inténtalo de nuevo.',
};

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

  // Después del mensaje del servidor: si el backend sí explicó el problema, su
  // texto es más preciso que cualquier mensaje genérico por estado.
  const porEstado = extractMessageByStatus(err);

  if (porEstado) {
    return porEstado;
  }

  return fallback;
}

/** Busca un mensaje propio para el código de estado del error. */
function extractMessageByStatus(err: unknown): string | null {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (typeof status === 'number') {
      return MENSAJES_POR_ESTADO[status] ?? null;
    }
  }
  return null;
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
