import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSuggestionsCard } from './UserSuggestionsCard';
import { followUserInGraph, unfollowUserInGraph } from '../services/networkApi';
import type { FilaRed, SugerenciaUsuario, Usuario } from '../types/network.types';
import { fusionarRed } from '../../../App';

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

  describe('Aviso de desaparición colateral', () => {
    it('muestra un aviso cuando un sugerido pierde a su único puente tras dejar de seguir', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const filasIniciales = [
        seguidoFila({ id: 'u-paulo', username: 'paulo', nombre: 'Paulo' }),
        sugerencia({
          id: 'u-david',
          username: 'david',
          nombre: 'David',
          conexionesEnComun: 1,
          seguidosEnComun: ['paulo'],
          seguido: false,
        }),
      ];
      const { rerender } = render(
        <UserSuggestionsCard
          filas={filasIniciales}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'David dejó de aparecer en tu red al dejar de seguir a Paulo.',
      );
    });

    it('usa el username capitalizado aunque el sugerido no tenga nombre', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const filasIniciales = [
        seguidoFila({ id: 'u-paulo', username: 'paulo', nombre: 'Paulo' }),
        {
          id: 'u-david',
          username: 'david',
          conexionesEnComun: 1,
          seguidosEnComun: ['paulo'],
          seguido: false,
          // `guardarUsuario` drops the `nombre` property when it is null and the
          // backend returns the row as-is, so a row without it is a real
          // runtime shape even though the type declares `nombre: string`.
        } as unknown as SugerenciaUsuario & { seguido: boolean },
      ];
      const { rerender } = render(
        <UserSuggestionsCard
          filas={filasIniciales}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.getByRole('status')).toHaveTextContent(
        'David dejó de aparecer en tu red al dejar de seguir a Paulo.',
      );
      expect(screen.getByRole('status')).not.toHaveTextContent('undefined');
    });

    it('avisa solo en el segundo unfollow, cuando se acaba el ultimo puente', async () => {
      // Payloads reales de GET /follows y GET /sugerencias con las seeds de
      // carlos: sigue a beatriz y paulo, y ambos son puente hacia david.
      const follows = [
        { id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz Silva' },
        { id: 'paulo-orrala', username: 'paulo', nombre: 'Paulo Orrala' },
      ];
      const sugerencias = [
        {
          id: 'david-mendoza',
          username: 'david',
          nombre: 'David Mendoza',
          conexionesEnComun: 2,
          seguidosEnComun: ['paulo', 'beatriz'],
        },
      ];
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const card = (filas: FilaRed[]) => (
        <UserSuggestionsCard
          filas={filas}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />
      );
      const botonDejarDeSeguir = (username: string): HTMLElement => {
        const fila = screen
          .getByText(`@${username}`)
          .closest('div.flex.items-center.justify-between');
        if (fila === null) {
          throw new Error(`no se encontro la fila de @${username}`);
        }
        return within(fila as HTMLElement).getByRole('button', { name: 'Dejar de seguir' });
      };
      const { rerender } = render(card(fusionarRed(follows, sugerencias)));

      // 1er unfollow: beatriz. david conserva a paulo como puente, no desaparece.
      await user.click(botonDejarDeSeguir('beatriz'));
      const soloPaulo = [follows[1]];
      const davidConUnPuente = [
        { ...sugerencias[0], conexionesEnComun: 1, seguidosEnComun: ['paulo'] },
      ];
      rerender(card(fusionarRed(soloPaulo, davidConUnPuente)));
      expect(screen.queryByRole('status')).toBeNull();

      // 2do unfollow: paulo. Se acaba el ultimo puente y david sale de la red.
      await user.click(botonDejarDeSeguir('paulo'));
      rerender(card(fusionarRed([], [])));
      expect(screen.getByRole('status')).toHaveTextContent(
        'David dejó de aparecer en tu red al dejar de seguir a Paulo.',
      );
    });

    it('no muestra aviso cuando el sugerido conserva otro puente y sigue en la lista', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const david = sugerencia({
        id: 'u-david',
        username: 'david',
        nombre: 'David',
        conexionesEnComun: 2,
        seguidosEnComun: ['paulo', 'beatriz'],
        seguido: false,
      });
      const { rerender } = render(
        <UserSuggestionsCard
          filas={[seguidoFila({ id: 'u-beatriz', username: 'beatriz', nombre: 'Beatriz' }), david]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[david]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('no muestra aviso cuando solo desaparece la propia persona dejada de seguir', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <UserSuggestionsCard
          filas={[seguidoFila({ id: 'u-beatriz', username: 'beatriz', nombre: 'Beatriz' })]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('no muestra aviso cuando el desaparecido no tenía al puente entre sus seguidos en común', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <UserSuggestionsCard
          filas={[
            seguidoFila({ id: 'u-paulo', username: 'paulo', nombre: 'Paulo' }),
            sugerencia({
              id: 'u-david',
              username: 'david',
              nombre: 'David',
              conexionesEnComun: 1,
              seguidosEnComun: ['carlos'],
              seguido: false,
            }),
          ]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('no muestra aviso tras seguir a una sugerencia aunque la lista cambie', async () => {
      followMock.mockResolvedValue(undefined);
      const onNetworkUpdated = vi.fn();
      const user = userEvent.setup();
      const { rerender } = render(
        <UserSuggestionsCard
          filas={[
            sugerencia({
              id: 'u-david',
              username: 'david',
              nombre: 'David',
              conexionesEnComun: 1,
              seguidosEnComun: ['paulo'],
              seguido: false,
            }),
          ]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      await user.click(screen.getByRole('button', { name: 'Seguir' }));
      rerender(
        <UserSuggestionsCard
          filas={[]}
          currentUserId="carlos-patino"
          onNetworkUpdated={onNetworkUpdated}
        />,
      );

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('limpia el aviso automáticamente después de un tiempo corto', async () => {
      vi.useFakeTimers();
      try {
        unfollowMock.mockResolvedValue(undefined);
        const onNetworkUpdated = vi.fn();
        const { rerender } = render(
          <UserSuggestionsCard
            filas={[
              seguidoFila({ id: 'u-paulo', username: 'paulo', nombre: 'Paulo' }),
              sugerencia({
                id: 'u-david',
                username: 'david',
                nombre: 'David',
                conexionesEnComun: 1,
                seguidosEnComun: ['paulo'],
                seguido: false,
              }),
            ]}
            currentUserId="carlos-patino"
            onNetworkUpdated={onNetworkUpdated}
          />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
        await act(async () => {
          for (let i = 0; i < 10; i += 1) {
            await Promise.resolve();
          }
        });
        rerender(
          <UserSuggestionsCard
            filas={[]}
            currentUserId="carlos-patino"
            onNetworkUpdated={onNetworkUpdated}
          />,
        );

        expect(screen.getByRole('status')).toBeInTheDocument();
        act(() => {
          vi.advanceTimersByTime(6000);
        });
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
