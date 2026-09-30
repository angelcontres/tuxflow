import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSuggestionsCard } from './UserSuggestionsCard';
import { followUserInGraph, unfollowUserInGraph } from '../services/networkApi';
import type { SugerenciaUsuario, Usuario } from '../types/network.types';

vi.mock('../services/networkApi', () => ({
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
}));

const followMock = vi.mocked(followUserInGraph);
const unfollowMock = vi.mocked(unfollowUserInGraph);

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
});
