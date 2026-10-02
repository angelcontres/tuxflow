import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserSuggestionsCard } from './UserSuggestionsCard';
import { fusionarRed } from '../../../App';
import { fetchCaminoCorto, followUserInGraph, unfollowUserInGraph } from '../services/networkApi';
import type { CaminoCorto, FilaRed, SugerenciaUsuario, Usuario } from '../types/network.types';

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

  describe('Apertura del perfil ajeno (US-12)', () => {
    it('convierte el @username en un botón que abre el perfil de esa persona', async () => {
      // Antes era texto con `hover:underline`, que es la forma más barata de mentir sobre lo que
      // se puede hacer. Ahora hay un botón real detrás.
      const onOpenPerfil = vi.fn();
      const user = userEvent.setup();

      renderCard({
        filas: [sugerencia({ id: 'beatriz-silva', username: 'beatriz' })],
        onOpenPerfil,
      });
      await user.click(screen.getByRole('button', { name: 'Ver perfil de @beatriz' }));

      expect(onOpenPerfil).toHaveBeenCalledWith('beatriz-silva');
    });

    it('abre el perfil con el identificador de la fila, no con el nombre de usuario', async () => {
      // El identificador es lo que viaja en la ruta del endpoint; el nombre de usuario no sirve
      // para consultar el perfil y un enlace que lo mandara abriría un perfil inexistente.
      const onOpenPerfil = vi.fn();
      const user = userEvent.setup();

      renderCard({
        filas: [seguidoFila({ id: 'elena-vega', username: 'elena' })],
        onOpenPerfil,
      });
      await user.click(screen.getByRole('button', { name: 'Ver perfil de @elena' }));

      expect(onOpenPerfil).toHaveBeenCalledWith('elena-vega');
    });

    it('no ofrece abrir el perfil propio', () => {
      renderCard({ filas: [seguidoFila({ id: 'carlos-patino', username: 'carlos' })] });

      // La fila propia no aparece en la red, pero si llegara, el enlace abriría el propio perfil
      // como si fuera de otra persona.
      expect(
        screen.queryByRole('button', { name: 'Ver perfil de @carlos' }),
      ).not.toBeInTheDocument();
    });

    it('sin manejador, el @username sigue siendo texto y no promete nada', () => {
      renderCard({ filas: [sugerencia({ username: 'beatriz' })] });

      expect(screen.getByText('@beatriz')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ver perfil/i })).not.toBeInTheDocument();
    });

    it('no confunde el enlace al perfil con el botón de seguimiento', async () => {
      // Ambos están en la misma fila y se confunden por nombre si el enlace no se rotula.
      const onOpenPerfil = vi.fn();
      followMock.mockResolvedValue(undefined);
      const user = userEvent.setup();

      renderCard({ filas: [sugerencia({ id: 'u-2', username: 'beatriz' })], onOpenPerfil });
      await user.click(screen.getByRole('button', { name: 'Ver perfil de @beatriz' }));

      expect(followMock).not.toHaveBeenCalled();
      expect(onOpenPerfil).toHaveBeenCalledWith('u-2');
    });
  });

  describe('Ausencia de sugerencias', () => {
    it('comunica que no hay recomendaciones en lugar de mostrar una lista vacía', () => {
      renderCard({ filas: [] });

      expect(screen.getByText('No hay nuevas recomendaciones por ahora.')).toBeInTheDocument();
      expect(screen.queryAllByRole('button', { name: /seguir/i })).toHaveLength(0);
    });
  });

  describe('Orden de los botones por fila', () => {
    it('cada fila expone su enlace al perfil y su botón de seguimiento por separado', () => {
      renderCard({
        filas: [
          sugerencia({ id: 'u-2', username: 'beatriz' }),
          sugerencia({ id: 'u-3', username: 'david' }),
        ],
        onOpenPerfil: vi.fn(),
      });

      expect(screen.getAllByRole('button', { name: /Ver perfil de/ })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /seguir/i })).toHaveLength(2);
      expect(screen.getAllByRole('button', { name: /distancia/i })).toHaveLength(2);
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
  describe('Aviso de desaparición colateral', () => {
    // Payloads reales de GET /follows y GET /sugerencias para el caso Angel:
    // Angel sigue a Paulo y Beatriz, y los dos siguen a David. Cuando Angel deja
    // de seguir a uno, David sigue entrando por el otro; cuando deja al segundo,
    // se acaba el último puente y David sale de la red.
    const PAULO: Usuario = {
      id: 'paulo-orrala',
      username: 'paulo',
      nombre: 'Paulo Orrala',
      avatarUrl: 'http://x/paulo.png',
    };
    const BEATRIZ: Usuario = {
      id: 'beatriz-silva',
      username: 'beatriz',
      nombre: 'Beatriz Silva',
      avatarUrl: 'http://x/beatriz.png',
    };
    const DAVID_DOS_PUENTES: SugerenciaUsuario = {
      id: 'david-mendoza',
      username: 'david',
      nombre: 'David Mendoza',
      avatar: 'http://x/david.png',
      conexionesEnComun: 2,
      seguidosEnComun: ['paulo', 'beatriz'],
    };
    const DAVID_UN_PUENTE: SugerenciaUsuario = {
      ...DAVID_DOS_PUENTES,
      conexionesEnComun: 1,
      seguidosEnComun: ['paulo'],
    };
    // David aparece sin nadie en común conocido: el aviso no puede inventar una
    // explicación cuando no hay evidencia de que el puente lo mantenía en la red.
    const DAVID_SIN_PUENTE: SugerenciaUsuario = { ...DAVID_UN_PUENTE, seguidosEnComun: [] };
    const DAVID_SEGUIDO: Usuario = {
      id: 'david-mendoza',
      username: 'david',
      nombre: 'David Mendoza',
      avatarUrl: 'http://x/david.png',
    };

    // El orden de las filas lo fija `fusionarRed`: primero los seguidos, después
    // las sugerencias. Cada fila expone un botón "Distancia" y otro de seguimiento,
    // así que el nombre del botón aísla sin ambigüedad a los ya seguidos.
    const botonDejarDeSeguir = (indice = 0): HTMLElement =>
      screen.getAllByRole('button', { name: 'Dejar de seguir' })[indice];
    const botonSeguir = (indice = 0): HTMLElement =>
      screen.getAllByRole('button', { name: 'Seguir' })[indice];

    const card = (filas: FilaRed[]): React.ReactElement => (
      <UserSuggestionsCard filas={filas} currentUserId="angel-vega" onNetworkUpdated={vi.fn()} />
    );

    it('no avisa nada en la carga inicial, porque todavia no se dejo de seguir a nadie', () => {
      render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_DOS_PUENTES])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('no avisa en el primer unfollow porque el otro puente sigue en pie', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_DOS_PUENTES])));

      await user.click(botonDejarDeSeguir(1));
      view.rerender(card(fusionarRed([PAULO], [DAVID_UN_PUENTE])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    // Regresión: este caso se pierde si `handleToggle` recibe el id en vez de la
    // fila, porque el puente se registra con `fila.username` y quedaría undefined.
    it('avisa en el segundo unfollow, cuando se acaba el ultimo puente', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_DOS_PUENTES])));

      await user.click(botonDejarDeSeguir(1));
      view.rerender(card(fusionarRed([PAULO], [DAVID_UN_PUENTE])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([], [])));

      expect(screen.getByRole('status')).toHaveTextContent(
        'David dejó de aparecer en tu red al dejar de seguir a Paulo.',
      );
    });

    it('no anuncia a la persona que el usuario acaba de dejar de seguir', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_SIN_PUENTE])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([BEATRIZ], [])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('no avisa cuando la persona desaparecida no tenia al puente entre sus seguidos', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_SIN_PUENTE])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([BEATRIZ], [])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('usa el @username capitalizado aunque la fila venga sin nombre', async () => {
      const davidSinNombre = {
        id: 'david-mendoza',
        username: 'david',
        conexionesEnComun: 2,
        seguidosEnComun: ['paulo', 'beatriz'],
      } as unknown as SugerenciaUsuario;
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [davidSinNombre])));

      await user.click(botonDejarDeSeguir(1));
      view.rerender(card(fusionarRed([PAULO], [davidSinNombre])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([], [])));

      const aviso = screen.getByRole('status');
      expect(aviso).toHaveTextContent(
        'David dejó de aparecer en tu red al dejar de seguir a Paulo.',
      );
      expect(aviso).not.toHaveTextContent('undefined');
    });

    it('expone el aviso como anuncio accesible', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_DOS_PUENTES])));

      await user.click(botonDejarDeSeguir(1));
      view.rerender(card(fusionarRed([PAULO], [DAVID_UN_PUENTE])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([], [])));

      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });

    it('retira el aviso a los seis segundos', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      try {
        unfollowMock.mockResolvedValue(undefined);
        const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_DOS_PUENTES])));

        // fireEvent y no userEvent: con los timers falsos, userEvent queda esperando
        // a temporizadores que solo este test avanza.
        fireEvent.click(botonDejarDeSeguir(1));
        await act(async () => {});
        view.rerender(card(fusionarRed([PAULO], [DAVID_UN_PUENTE])));

        fireEvent.click(botonDejarDeSeguir(0));
        await act(async () => {});
        view.rerender(card(fusionarRed([], [])));
        expect(screen.getByRole('status')).toBeInTheDocument();

        act(() => {
          vi.advanceTimersByTime(6000);
        });

        expect(screen.queryByRole('status')).not.toBeInTheDocument();
      } finally {
        vi.useRealTimers();
      }
    });

    it('no avisa al seguir a una sugerencia nueva', async () => {
      followMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO], [DAVID_UN_PUENTE])));

      await user.click(botonSeguir());
      view.rerender(card(fusionarRed([PAULO, DAVID_SEGUIDO], [])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it('limpia el aviso anterior cuando un refresco posterior no trae otra desaparición', async () => {
      unfollowMock.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const view = render(card(fusionarRed([PAULO, BEATRIZ], [DAVID_UN_PUENTE])));

      await user.click(botonDejarDeSeguir(0));
      view.rerender(card(fusionarRed([BEATRIZ], [])));
      expect(screen.getByRole('status')).toBeInTheDocument();

      await user.click(botonDejarDeSeguir());
      view.rerender(card(fusionarRed([], [])));

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
