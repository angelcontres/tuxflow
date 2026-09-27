import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSuggestionsCard } from './UserSuggestionsCard';
import { followUserInGraph } from '../services/networkApi';
import type { SugerenciaUsuario } from '../types/network.types';

vi.mock('../services/networkApi', () => ({
  followUserInGraph: vi.fn(),
}));

const followMock = vi.mocked(followUserInGraph);

function sugerencia(overrides: Partial<SugerenciaUsuario> = {}): SugerenciaUsuario {
  return {
    id: 'u-2',
    username: 'beatriz',
    nombre: 'Beatriz',
    conexionesEnComun: 3,
    seguidosEnComun: ['carlos'],
    ...overrides,
  };
}

function renderCard(props: Partial<React.ComponentProps<typeof UserSuggestionsCard>> = {}) {
  return render(
    <UserSuggestionsCard
      sugerencias={[sugerencia()]}
      currentUserId="carlos-patino"
      onNetworkUpdated={vi.fn()}
      {...props}
    />,
  );
}

describe('UserSuggestionsCard', () => {
  beforeEach(() => {
    followMock.mockReset();
  });

  describe('Renderizado de sugerencias', () => {
    it('muestra el nombre de usuario de cada sugerencia', () => {
      renderCard();

      expect(screen.getByText('@beatriz')).toBeInTheDocument();
    });

    it('muestra cuántas conexiones en común tiene cada sugerencia', () => {
      renderCard({ sugerencias: [sugerencia({ conexionesEnComun: 5 })] });

      expect(screen.getByText('5 conexión(es) mutua(s)')).toBeInTheDocument();
    });

    it('usa la inicial en mayúscula del nombre de usuario como avatar', () => {
      renderCard({ sugerencias: [sugerencia({ username: 'david' })] });

      expect(screen.getByText('D')).toBeInTheDocument();
    });

    it('renderiza una fila por cada sugerencia recibida', () => {
      renderCard({
        sugerencias: [
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
      renderCard({ sugerencias: [] });

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
});
