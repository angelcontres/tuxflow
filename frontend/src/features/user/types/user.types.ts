/**
 * Usuario tal como lo devuelve la API.
 *
 * `nombre` es opcional a propósito, no por descuido: `guardarUsuario` hace `SET u.nombre = $nombre`, y
 * en Neo4j asignar `null` a una propiedad la elimina, así que un usuario guardado sin nombre llega
 * sin la propiedad. Declararlo obligatorio obligaba a defenderse con `nombre || username` en cada
 * punto de uso, y el tipo seguía mintiendo mientras tanto.
 */
export interface Usuario {
  id: string;
  username: string;
  email?: string;
  nombre?: string;
  avatarUrl?: string;
  pushSubscriptionJson?: string;
}
