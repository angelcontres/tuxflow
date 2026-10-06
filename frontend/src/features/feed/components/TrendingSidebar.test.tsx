import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TrendingSidebar } from './TrendingSidebar';
import { fetchTendencias } from '../services/feedApi';
import type { Tendencia } from '../types/post.types';

vi.mock('../services/feedApi', () => ({
  fetchTendencias: vi.fn(),
}));

const tendenciasMock = vi.mocked(fetchTendencias);

function tendencia(overrides: Partial<Tendencia> = {}): Tendencia {
  return {
    id: 'post-t15',
    texto: 'Primer post de tendencia',
    autor: 'beatriz',
    likes: 5,
    dislikes: 0,
    totalReacciones: 5,
    puntuacionNeta: 5,
    ...overrides,
  };
}

function renderWidget(props: Partial<React.ComponentProps<typeof TrendingSidebar>> = {}) {
  return render(<TrendingSidebar currentUserId="carlos-patino" {...props} />);
}

describe('TrendingSidebar', () => {
  beforeEach(() => {
    tendenciasMock.mockReset();
  });

  describe('Consulta', () => {
    it('pide las tendencias del usuario activo', async () => {
      tendenciasMock.mockResolvedValue([]);

      renderWidget();

      await screen.findByText(
        'Aún no hay tendencias en tu red. Las publicaciones más reaccionadas de la semana aparecerán aquí.',
      );
      expect(tendenciasMock).toHaveBeenCalledTimes(1);
      expect(tendenciasMock).toHaveBeenCalledWith('carlos-patino');
    });

    it('mientras la petición está en vuelo muestra el estado de carga', () => {
      tendenciasMock.mockReturnValue(new Promise(() => {}));

      renderWidget();

      expect(screen.getByTestId('tendencias-cargando')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('no duplica la petición cuando vuelve a renderizar con los mismos props', () => {
      tendenciasMock.mockReturnValue(new Promise(() => {}));
      const { rerender } = renderWidget();

      rerender(<TrendingSidebar currentUserId="carlos-patino" />);
      rerender(<TrendingSidebar currentUserId="carlos-patino" />);

      expect(tendenciasMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Renderizado de tendencias', () => {
    it('muestra el título y la ventana de tiempo', async () => {
      tendenciasMock.mockResolvedValue([]);

      renderWidget();

      expect(await screen.findByRole('heading', { name: 'Tendencias' })).toBeInTheDocument();
      expect(screen.getByText('7 días')).toBeInTheDocument();
    });

    it('pinta las publicaciones en el orden recibido por el backend', async () => {
      tendenciasMock.mockResolvedValue([
        tendencia({ id: 'post-a', texto: 'Post en primera posición' }),
        tendencia({ id: 'post-b', texto: 'Post en segunda posición' }),
        tendencia({ id: 'post-c', texto: 'Post en tercera posición' }),
      ]);

      renderWidget();

      const filas = await screen.findAllByRole('listitem');
      expect(filas).toHaveLength(3);
      expect(filas[0]).toHaveTextContent('Post en primera posición');
      expect(filas[1]).toHaveTextContent('Post en segunda posición');
      expect(filas[2]).toHaveTextContent('Post en tercera posición');
      // La numeración de posiciones sale del índice del backend, no del DOM.
      expect(within(filas[0]).getByText('1')).toBeInTheDocument();
      expect(within(filas[2]).getByText('3')).toBeInTheDocument();
    });

    it('muestra autor, likes, dislikes y la puntuación neta con signo', async () => {
      tendenciasMock.mockResolvedValue([
        tendencia({ autor: 'paulo', likes: 3, dislikes: 1, puntuacionNeta: 2 }),
        tendencia({
          id: 'post-t33',
          texto: 'Post con neta negativa',
          likes: 3,
          dislikes: 5,
          puntuacionNeta: -2,
        }),
      ]);

      renderWidget();

      const filas = await screen.findAllByRole('listitem');
      expect(filas[0]).toHaveTextContent('@paulo');
      expect(filas[0]).toHaveTextContent('+2 pts');
      expect(filas[1]).toHaveTextContent('-2 pts');
      // likes y dislikes se pintan por separado: la neta no los reemplaza en pantalla.
      expect(filas[0]).toHaveTextContent('3');
      expect(filas[0]).toHaveTextContent('1');
    });

    it('sin tendencias muestra el estado vacío, que no es una alerta', async () => {
      tendenciasMock.mockResolvedValue([]);

      renderWidget();

      expect(
        await screen.findByText(
          'Aún no hay tendencias en tu red. Las publicaciones más reaccionadas de la semana aparecerán aquí.',
        ),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Errores', () => {
    it('un fallo de red se pinta como alerta y no como lista vacía', async () => {
      tendenciasMock.mockRejectedValue(new Error('Request failed with status code 500'));

      renderWidget();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos cargar las tendencias. Inténtalo de nuevo.',
      );
      expect(
        screen.queryByText(
          'Aún no hay tendencias en tu red. Las publicaciones más reaccionadas de la semana aparecerán aquí.',
        ),
      ).not.toBeInTheDocument();
    });

    it('conserva el mensaje pensado para el usuario que devuelve el backend', async () => {
      // isAxiosError es la marca que axios.isAxiosError() exige para leer response.data.
      tendenciasMock.mockRejectedValue({
        isAxiosError: true,
        response: { status: 503, data: { error: 'El servicio de grafos no está disponible.' } },
      });

      renderWidget();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'El servicio de grafos no está disponible.',
      );
    });
  });
});
