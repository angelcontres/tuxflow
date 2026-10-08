/**
 * Normaliza las URLs de MinIO S3 para que siempre se sirvan por el mismo host
 * a través del proxy inverso (/redsocial-media/...), evitando problemas de Mixed Content (HTTPS)
 * o puertos cerrados en AWS.
 *
 * Si la URL ya es relativa o externa (http://x/avatar.png), la conserva intacta.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url) return '';
  if (url.includes('/redsocial-media/')) {
    return url.substring(url.indexOf('/redsocial-media/'));
  }
  return url;
}
