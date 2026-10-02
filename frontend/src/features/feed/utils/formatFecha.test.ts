import { describe, expect, it } from 'vitest';
import { formatFecha } from './formatFecha';

const MINUTO_EN_MS = 60_000;
const HORA_EN_MS = 60 * MINUTO_EN_MS;
const DIA_EN_MS = 24 * HORA_EN_MS;

describe('formatFecha', () => {
  describe('fecha ausente o inválida', () => {
    it("devuelve 'Reciente' cuando no llega fecha", () => {
      expect(formatFecha(null)).toBe('Reciente');
      expect(formatFecha(undefined)).toBe('Reciente');
    });

    it("devuelve 'Reciente' ante valores no finitos", () => {
      expect(formatFecha(NaN)).toBe('Reciente');
      expect(formatFecha(Infinity)).toBe('Reciente');
      expect(formatFecha(-Infinity)).toBe('Reciente');
    });
  });

  describe('epoch cero', () => {
    it('trata el 0 como una fecha real y no como ausencia de fecha', () => {
      const texto = formatFecha(0);

      expect(texto).not.toBe('Reciente');
      expect(texto).toMatch(/\d{4}/);
    });
  });

  describe('tiempo relativo', () => {
    it("dice 'ahora mismo' para un post de hace segundos", () => {
      expect(formatFecha(Date.now() - 30_000)).toBe('ahora mismo');
    });

    it('usa minutos para lo de hace menos de una hora', () => {
      expect(formatFecha(Date.now() - 5 * MINUTO_EN_MS)).toBe('hace 5 minutos');
      expect(formatFecha(Date.now() - MINUTO_EN_MS)).toBe('hace 1 minuto');
    });

    it('usa horas para lo de hace menos de un día', () => {
      expect(formatFecha(Date.now() - 3 * HORA_EN_MS)).toBe('hace 3 horas');
      expect(formatFecha(Date.now() - HORA_EN_MS)).toBe('hace 1 hora');
    });

    it('usa días para lo de hace menos de una semana', () => {
      expect(formatFecha(Date.now() - 3 * DIA_EN_MS)).toBe('hace 3 días');
      expect(formatFecha(Date.now() - DIA_EN_MS)).toBe('hace 1 día');
    });

    it('no produce tiempos negativos ante un instante ligeramente futuro', () => {
      expect(formatFecha(Date.now() + 30_000)).toBe('ahora mismo');
    });
  });

  describe('fecha absoluta', () => {
    it('usa fecha absoluta para lo de hace más de siete días', () => {
      const texto = formatFecha(Date.now() - 8 * DIA_EN_MS);

      expect(texto).not.toMatch(/hace/);
      expect(texto).toMatch(/\d{4}/);
    });

    it('usa fecha absoluta en el límite de los siete días', () => {
      const texto = formatFecha(Date.now() - 7 * DIA_EN_MS);

      expect(texto).not.toMatch(/hace/);
      expect(texto).toMatch(/\d{4}/);
    });
  });
});
