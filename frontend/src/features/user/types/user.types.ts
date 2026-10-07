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

/**
 * Una persona entre los resultados de `GET /users/buscar`.
 *
 * No es `Usuario` a propósito. `Usuario` declara `email` porque el perfil propio sí lo trae, y
 * reusar ese tipo aquí haría que el correo pareciera parte de la búsqueda: no lo es, y no hay
 * forma de que llegue aquí. Es un tipo distinto porque el endpoint responde un DTO distinto, más
 * estrecho.
 *
 * `nombre` es opcional por la misma razón que en `Usuario`: `guardarUsuario` borra la propiedad cuando
 * el valor es null y el backend la devuelve tal cual.
 */
export interface ResultadoBusquedaUsuario {
  id: string;
  username: string;
  nombre?: string;
  avatarUrl?: string;
}
