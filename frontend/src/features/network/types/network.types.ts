export interface SugerenciaUsuario {
  id: string;
  username: string;
  nombre: string;
  avatar?: string;
  conexionesEnComun: number;
  seguidosEnComun: string[];
}

export interface Usuario {
  id: string;
  username: string;
  nombre: string;
  avatarUrl?: string;
}

/**
 * Nodo Usuario devuelto por la intersección de seguidos de `GET /users/comunes`.
 *
 * El Cypher #3 proyecta `avatarUrl` con el alias `avatar`, a diferencia de
 * `obtenerSeguidos`, que lo devuelve con su nombre de propiedad. `nombre` es
 * opcional porque `guardarUsuario` borra la propiedad cuando el valor es null y
 * el backend lo devuelve tal cual.
 */
export interface ConexionComun {
  id: string;
  username: string;
  nombre?: string;
  avatar?: string;
}

/**
 * Un salto del camino que devuelve `GET /users/camino-corto`.
 *
 * El identificador viene junto al nombre de usuario para que la interfaz pueda representar
 * cada salto y no limitarse a imprimirlo como texto plano. `id` es opcional porque un nodo
 * puede llegar sin él; `username` nunca viene vacío: el backend sustituye por `desconocido`
 * el nodo que no lo tiene cargado, ya que en Neo4j asignar null a una propiedad la elimina.
 */
export interface NodoCamino {
  id?: string | null;
  username: string;
}

/**
 * Respuesta de `GET /users/camino-corto`.
 *
 * Una ruta vacía con cero saltos es un resultado legítimo: significa que no hay camino de
 * seguimiento dentro de los seis grados del alcance. No es un error, y por eso no puede
 * confundirse con una petición a la que le falta un parámetro (esa responde 400).
 */
export interface CaminoCorto {
  rutaConexion: NodoCamino[];
  saltosTotales: number;
}

export type FilaRed = (SugerenciaUsuario & { seguido: boolean }) | (Usuario & { seguido: boolean });

export function esSugerencia(fila: FilaRed): fila is SugerenciaUsuario & { seguido: boolean } {
  return 'conexionesEnComun' in fila;
}
