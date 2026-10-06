export interface NotificacionInApp {
  id: string;
  tipo: string;
  titulo: string;
  mensaje: string;
  leido: boolean;
  fechaCreacion: string;
  url?: string;
}
