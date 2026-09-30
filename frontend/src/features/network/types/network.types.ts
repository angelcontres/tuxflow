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

export type FilaRed = (SugerenciaUsuario & { seguido: boolean }) | (Usuario & { seguido: boolean });

export function esSugerencia(fila: FilaRed): fila is SugerenciaUsuario & { seguido: boolean } {
  return 'conexionesEnComun' in fila;
}
