import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSuggestionsCard } from './UserSuggestionsCard';
import { fetchCaminoCorto, followUserInGraph, unfollowUserInGraph } from '../services/networkApi';
import type { CaminoCorto, SugerenciaUsuario, Usuario } from '../types/network.types';

vi.mock('../services/networkApi', () => ({
  fetchCaminoCorto: vi.fn(),
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
}));

const followMock = vi.mocked(followUserInGraph);
const unfollowMock = vi.mocked(unfollowUserInGraph);
const caminoMock = vi.mocked(fetchCaminoCorto);

type FilaSugerencia = SugerenciaUsuario & { seguido: boolean };
type FilaSeguido = Usuario & { seguido: boolean };

function sugerencia(overrides: Partial<FilaSugerencia> = {}): FilaSugerencia {
  return {
    id: 'u-2',
    username: 'beatriz',
    nombre: 'Beatriz',
    conexionesEnComun: 3,
    seguidosEnComun: ['carlos'],
    seguido: false,
    ...overrides,
  };
}

function seguidoFila(overrides: Partial<FilaSeguido> = {}): FilaSeguido {
  return {
    id: 'u-9',
    username: 'elena',
    nombre: 'Elena',
    seguido: true,
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof UserSuggestionsCard>> = {}) {
  return render(
    <UserSuggestionsCard
      filas={[sugerencia()]}
      currentUserId="carlos-patino"
      onNetworkUpdated={vi.fn()}
      {...props}
    />,
  );
}

describe('UserSuggestionsCard', () => {
  beforeEach(() => {
    followMock.mockReset();
    unfollowMock.mockReset();
    caminoMock.mockReset();
  });

  describe('Renderizado de sugerencias', () => {
    it('muestra el nombre de usuario de cada sugerencia', () => {
      renderCard();

      expect(screen.getByText('@beatriz')).toBeInTheDocument();
    });

    it('muestra cuántas conexiones en común tiene cada sugerencia', () => {
      renderCard({ filas: [sugerencia({ conexionesEnComun: 5 })] });

      expect(screen.getByText('5 conexión(es) mutua(s)')).toBeInTheDocument();
    });

    it('usa la inicial en mayúscula del nombre de usuario como avatar', () => {
      renderCard({ filas: [sugerencia({ username: 'david' })] });

      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('renderiza una fila por cada sugerencia recibida', () => {
      renderCard({
        filas: [
          sugerencia({ id: 'u-2', username: 'beatriz' }),
          sugerencia({ id: 'u-3', username: 'david' }),
        ],
      });

      expect(screen.getByText('@beatriz')).toBeInTheDocument();
      expect(screen.getByText('@david')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /seguir/i })).toHaveLength(2);
    });
  });

  describe('Intermediarios en común', () => {
    it('muestra los usernames de los intermediarios junto al contador', () => {
      renderCard({
        filas: [
          sugerencia({
            username: 'david',
            conexionesEnComun: 2,
            seguidosEnComun: ['beatriz', 'paulo'],
          }),
        ],
      });

      expect(screen.getByText('Conocido por @beatriz, @paulo')).toBeInTheDocument();
    });

    it('conserva el contador de conexiones mutuas cuando muestra los intermediarios', () => {
      renderCard({
        filas: [sugerencia({ conexionesEnComun: 2, seguidosEnComun: ['beatriz', 'paulo'] })],
      });

      expect(screen.getByText('2 conexión(es) mutua(s)')).toBeInTheDocument();
    });

    it('omite la línea de intermediarios cuando el arreglo llega vacío', () => {
      renderCard({ filas: [sugerencia({ conexionesEnComun: 0, seguidosEnComun: [] })] });

      expect(screen.queryByText(/Conocido por/)).not.toBeInTheDocument();
      expect(screen.getByText('0 conexión(es) mutua(s)')).toBeInTheDocument();
    });

    it('no muestra intermediarios en las filas que no son sugerencias', () => {
      renderCard({ filas: [seguidoFila()] });

      expect(screen.queryByText(/Conocido por/)).not.toBeInTheDocument();
    });
  });

  describe('Avatar de la sugerencia', () => {
    const AVATAR = 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150';

    it('muestra el avatar recibido en lugar del círculo con la inicial', () => {
      renderCard({ filas: [sugerencia({ username: 'david', avatar: AVATAR })] });

      expect(screen.getByAltText('Avatar de @david')).toBeInTheDocument();
      expect(screen.queryByText('D')).not.toBeInTheDocument();
    });

    it('vuelve al círculo con la inicial cuando la imagen no carga', () => {
      renderCard({ filas: [sugerencia({ username: 'david', avatar: AVATAR })] });

      fireEvent.error(screen.getByAltText('Avatar de @david'));

      expect(screen.queryByAltText('Avatar de @david')).not.toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('usa la inicial cuando la sugerencia no trae avatar', () => {
      renderCard({ filas: [sugerencia({ username: 'david' })] });

      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('D')).toBeInTheDocument();
    });
  });

  describe('Ausencia de sugerencias', () => {
    it('comunica que no hay recomendaciones en lugar de mostrar una lista vacía', () => {
      renderCard({ filas: [] });

      expect(screen.getByText('No hay nuevas recomendaciones por ahora.')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /seguir/i })).toHaveLength(0);
    });
  });

  describe('Seguimiento de una sugerencia', () => {
    it('envía el usuario actual y el objetivo al pulsar Seguir', async () => {
      followMock.mockResolvedValue(undefined);
      const user = userEvent.setup();

      renderCard();
      await user.click(screen.getByRole('button', { name: /seguir/i }));

      expect(followMock).toHaveBeenCalledTimes(1);
      expect(followMock).toHaveBeenCalledWith('carlos-patino', 'u-2');
    });

    it('avisa que la red se actualizó cuando el seguimiento tiene éxito', async () => {
      followMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();

      renderCard({ onNetworkUpdated });
      await user.click(screen.getByRole('button', { name: /seguir/i }));

      expect(onNetworkUpdated).toHaveBeenCalledTimes(1);
    });

    it('no avisa que la red se actualizó cuando el seguimiento falla', async () => {
      followMock.mockRejectedValue(new Error('error de red'));
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();

      renderCard({ onNetworkUpdated });
      await user.click(screen.getByRole('button', { name: /seguir/i }));

      expect(onNetworkUpdated).not.toHaveBeenCalled();
    });
  });

  describe('Alternancia por bandera de fila', () => {
    it('muestra "Dejar de seguir" cuando la fila llega ya seguida desde la fuente de seguidos', () => {
      renderCard({ filas: [seguidoFila()] });

      expect(screen.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument();
    });

    it('cambia a "Dejar de seguir" tras confirmar el seguimiento en el servidor', async () => {
      followMock.mockResolvedValue(undefined);
      const user = userEvent.setup();

      renderCard();
      await user.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(await screen.findByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    });

    it('invoca unfollow y vuelve a "Seguir" tras confirmar el borrado en el servidor', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();

      renderCard({ filas: [seguidoFila()], onNetworkUpdated });
      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));

      expect(unfollowMock).toHaveBeenCalledTimes(1);
      expect(unfollowMock).toHaveBeenCalledWith('carlos-patino', 'u-9');
      expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
      expect(onNetworkUpdated).toHaveBeenCalledTimes(1);
    });

    it('deshabilita el botón de la fila mientras su promesa está en curso', async () => {
      let resolve!: (value: undefined) => void;
      followMock.mockReturnValue(
        new Promise<undefined>((r) => {
          resolve = r;
        }),
      );
      const user = userEvent.setup();

      renderCard();
      await user.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(await screen.findByRole('button', { name: 'Seguir' })).toBeDisabled();
      resolve(undefined);
      expect(await screen.findByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    });
  });

  describe('Error visible por fila', () => {
    it('muestra una alerta y conserva "Seguir" cuando el seguimiento falla', async () => {
      followMock.mockRejectedValue(new Error('error de red'));
      const user = userEvent.setup();

      renderCard();
      await user.click(screen.getByRole('button', { name: 'Seguir' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    });

    it('muestra una alerta y conserva "Dejar de seguir" cuando dejar de seguir falla', async () => {
      unfollowMock.mockRejectedValue(new Error('error de red'));
      const user = userEvent.setup();

      renderCard({ filas: [seguidoFila()] });
      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));

      expect(await screen.findByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    });
  });

  describe('Cálculo de distancia', () => {
    const CON_CAMINO: CaminoCorto = {
      rutaConexion: [
        { id: 'carlos-patino', username: 'carlos' },
        { id: 'beatriz-silva', username: 'beatriz' },
        { id: 'david-mendoza', username: 'david' },
        { id: 'elena-vega', username: 'elena' },
      ],
      saltosTotales: 3,
    };

    const botonDistancia = (indice = 0): HTMLElement =>
      screen.getAllByRole('button', { name: /distancia/i })[indice];

    it('envía el usuario actual y el de la fila al pulsar el botón', async () => {
      caminoMock.mockResolvedValue(CON_CAMINO);
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(caminoMock).toHaveBeenCalledTimes(1);
      expect(caminoMock).toHaveBeenCalledWith('carlos-patino', 'elena-vega');
    });

    it('muestra la cadena de nombres y el total de saltos', async () => {
      caminoMock.mockResolvedValue(CON_CAMINO);
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(await screen.findByText('3 saltos de separación')).toBeInTheDocument();
      expect(screen.getByText('@carlos')).toBeInTheDocument();
      expect(screen.getByText('@beatriz')).toBeInTheDocument();
      expect(screen.getByText('@david')).toBeInTheDocument();
    });

    it('usa el singular cuando el camino es de un solo salto', async () => {
      caminoMock.mockResolvedValue({
        rutaConexion: [
          { id: 'carlos-patino', username: 'carlos' },
          { id: 'elena-vega', username: 'elena' },
        ],
        saltosTotales: 1,
      });
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(await screen.findByText('1 salto de separación')).toBeInTheDocument();
    });

    it('presenta la ausencia de conexión como resultado y no como fallo', async () => {
      // Ruta vacía con cero saltos es un 200 legítimo: no debe pintarse con rol de alerta,
      // que es lo reservado para la petición inválida.
      caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(
        await screen.findByText('No hay conexión con @elena dentro de los 6 grados de separación.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('muestra una alerta cuando la petición falla y no la confunde con la ausencia de conexión', async () => {
      caminoMock.mockRejectedValue(new Error('Request failed with status code 400'));
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos calcular la distancia. Inténtalo de nuevo.',
      );
      expect(screen.queryByText(/No hay conexión con @elena/)).not.toBeInTheDocument();
    });

    it('deshabilita el botón mientras la petición está en curso', async () => {
      let resolve!: (value: CaminoCorto) => void;
      caminoMock.mockReturnValue(
        new Promise<CaminoCorto>((r) => {
          resolve = r;
        }),
      );
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'elena-vega', username: 'elena' })] });
      await user.click(botonDistancia());

      expect(screen.getByRole('button', { name: /calculando/i })).toBeDisabled();
      resolve(CON_CAMINO);
      expect(await screen.findByText('3 saltos de separación')).toBeInTheDocument();
    });

    it('calcula cada fila por separado', async () => {
      caminoMock.mockResolvedValue(CON_CAMINO);
      const user = userEvent.setup();

      renderCard({
        filas: [
          sugerencia({ id: 'elena-vega', username: 'elena' }),
          sugerencia({ id: 'david-mendoza', username: 'david' }),
        ],
      });
      await user.click(botonDistancia(1));

      expect(caminoMock).toHaveBeenCalledWith('carlos-patino', 'david-mendoza');
    });

    it('no altera el seguimiento: calcular distancia deja el botón de Seguir intacto', async () => {
      caminoMock.mockResolvedValue(CON_CAMINO);
      const user = userEvent.setup();

      renderCard();
      await user.click(botonDistancia());
      await screen.findByText('3 saltos de separación');

      expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
      expect(caminoMock).toHaveBeenCalledTimes(1);
    });
  });
});
