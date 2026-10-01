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

export type FilaRed = (SugerenciaUsuario & { seguido: boolean }) | (Usuario & { seguido: boolean });

export function esSugerencia(fila: FilaRed): fila is SugerenciaUsuario & { seguido: boolean } {
  return 'conexionesEnComun' in fila;
}
