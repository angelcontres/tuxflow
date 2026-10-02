const MINUTO_EN_MS = 60_000;
const HORA_EN_MS = 60 * MINUTO_EN_MS;
const DIA_EN_MS = 24 * HORA_EN_MS;
const SEMANA_EN_MS = 7 * DIA_EN_MS;

// Una sola instancia: el formato absoluto no depende del post.
const formatoAbsoluto = new Intl.DateTimeFormat('es', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/**
 * Convierte un epoch en milisegundos a texto legible en español.
 *
 * - Menos de una semana: tiempo relativo ("ahora mismo", "hace 5 minutos"...).
 * - Siete días o más: fecha absoluta ("12 mar 2024").
 * - Valor ausente, no finito o invalido: "Reciente".
 *
 * El 0 es un epoch valido (1 de enero de 1970), no una ausencia de fecha:
 * solo el `Number.isNaN` sobre la fecha derivada separa "sin fecha" de
 * "fecha muy antigua". La validez se chequea aqui, nunca en el JSX.
 */
export function formatFecha(valor: number | null | undefined): string {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    return 'Reciente';
  }
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) {
    return 'Reciente';
  }
  const diferencia = Date.now() - fecha.getTime();
  // Un instante ligeramente futuro (reloj desfasado, post recien creado)
  // se lee como ahora, nunca como un tiempo negativo sin sentido.
  if (diferencia < MINUTO_EN_MS) {
    return 'ahora mismo';
  }
  if (diferencia < HORA_EN_MS) {
    const minutos = Math.floor(diferencia / MINUTO_EN_MS);
    return minutos === 1 ? 'hace 1 minuto' : `hace ${minutos} minutos`;
  }
  if (diferencia < DIA_EN_MS) {
    const horas = Math.floor(diferencia / HORA_EN_MS);
    return horas === 1 ? 'hace 1 hora' : `hace ${horas} horas`;
  }
  if (diferencia < SEMANA_EN_MS) {
    const dias = Math.floor(diferencia / DIA_EN_MS);
    return dias === 1 ? 'hace 1 día' : `hace ${dias} días`;
  }
  return formatoAbsoluto.format(fecha);
}
