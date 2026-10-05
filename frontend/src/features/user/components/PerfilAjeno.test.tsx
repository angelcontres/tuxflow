import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerfilAjeno } from './PerfilAjeno';
import { fetchPostsDeUsuario, fetchSeguidores, fetchUsuario } from '../services/userApi';
import {
  fetchCaminoCorto,
  fetchConexionesComunes,
  fetchSeguidos,
  followUserInGraph,
  unfollowUserInGraph,
} from '../../network/services/networkApi';
// El perfil pinta el `PostCard` del feed, así que sus servicios de reacción entran en esta prueba.
import { likePost } from '../../feed/services/feedApi';
import type { Post } from '../types/post.types';
import type { Usuario } from '../types/user.types';

vi.mock('../services/userApi', () => ({
  fetchUsuario: vi.fn(),
  fetchPostsDeUsuario: vi.fn(),
  fetchSeguidores: vi.fn(),
}));

vi.mock('../../network/services/networkApi', () => ({
  fetchSeguidos: vi.fn(),
  fetchCaminoCorto: vi.fn(),
  fetchConexionesComunes: vi.fn(),
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
}));

vi.mock('../../feed/services/feedApi', () => ({
  likePost: vi.fn(),
  dislikePost: vi.fn(),
  unlikePost: vi.fn(),
  undislikePost: vi.fn(),
  submitPost: vi.fn(),
}));

const usuarioMock = vi.mocked(fetchUsuario);
const postsMock = vi.mocked(fetchPostsDeUsuario);
const seguidoresMock = vi.mocked(fetchSeguidores);
const seguidosMock = vi.mocked(fetchSeguidos);
const caminoMock = vi.mocked(fetchCaminoCorto);
const comunesMock = vi.mocked(fetchConexionesComunes);
const followMock = vi.mocked(followUserInGraph);
const unfollowMock = vi.mocked(unfollowUserInGraph);
const likeMock = vi.mocked(likePost);

const AVATAR = 'https://cdn.example/beatriz.png';

function beatriz(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'beatriz-silva',
    username: 'beatriz',
    nombre: 'Beatriz Silva',
    email: 'beatriz@upse.edu.ec',
    avatarUrl: AVATAR,
    ...overrides,
  };
}

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-b1',
    texto: 'Bienvenidos a la Red Social',
    fechaCreacion: Date.now(),
    autorId: 'beatriz-silva',
    autorUsername: 'beatriz',
    totalLikes: 0,
    likedByMe: false,
    ...overrides,
  };
}

interface RenderOpts {
  usuarioId?: string;
  viewerId?: string;
  viewerUsername?: string;
  onCerrar?: () => void;
  onNetworkUpdated?: () => void;
  onOpenPerfil?: (usuarioId: string) => void;
}

function renderPerfil(opts: RenderOpts = {}) {
  return render(
    <PerfilAjeno
      usuarioId={opts.usuarioId ?? 'beatriz-silva'}
      viewerId={opts.viewerId ?? 'carlos-patino'}
      viewerUsername={opts.viewerUsername ?? 'carlos'}
      onCerrar={opts.onCerrar ?? vi.fn()}
      onNetworkUpdated={opts.onNetworkUpdated ?? vi.fn()}
      onOpenPerfil={opts.onOpenPerfil ?? vi.fn()}
    />,
  );
}

/** Estado por defecto: perfil cargado, sin publicaciones, sin seguidores, y sin seguir. */
function conDatosPorDefecto() {
  usuarioMock.mockResolvedValue(beatriz());
  postsMock.mockResolvedValue([]);
  seguidoresMock.mockResolvedValue([]);
  seguidosMock.mockResolvedValue([]);
  comunesMock.mockResolvedValue([]);
}

describe('PerfilAjeno', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    conDatosPorDefecto();
    followMock.mockResolvedValue(undefined);
    unfollowMock.mockResolvedValue(undefined);
    // `PostCard` pide el estado completo de la reacción después del clic optimista, y la respuesta
    // del servidor manda sobre el incremento local. El total tiene que ser coherente con el que
    // devolvió la consulta, o la tarjeta se corrige a un número que no corresponde a nada.
    likeMock.mockResolvedValue({
      postId: 'post-b1',
      likedByMe: true,
      dislikedByMe: false,
      totalLikes: 4,
      totalDislikes: 0,
    });
  });

  describe('Datos del perfil', () => {
    it('pide el perfil, sus publicaciones, sus seguidores y los seguidos de quien mira', async () => {
      renderPerfil();

      await waitFor(() => expect(usuarioMock).toHaveBeenCalledWith('beatriz-silva'));
      expect(postsMock).toHaveBeenCalledWith('beatriz-silva', 'carlos-patino');
      expect(seguidoresMock).toHaveBeenCalledWith('beatriz-silva');
      expect(seguidosMock).toHaveBeenCalledWith('carlos-patino');
    });

    it('muestra nombre, @username y avatar', async () => {
      renderPerfil();

      expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.getByText('@beatriz')).toBeInTheDocument();
      expect(screen.getByAltText('Avatar de @beatriz')).toBeInTheDocument();
    });

    it('usa la inicial como respaldo cuando no hay avatar', async () => {
      usuarioMock.mockResolvedValue(beatriz({ avatarUrl: undefined }));

      renderPerfil();

      await waitFor(() => expect(screen.getByText('Beatriz Silva')).toBeInTheDocument());
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('vuelve a la inicial cuando el avatar no carga', async () => {
      renderPerfil();

      const imagen = await screen.findByAltText('Avatar de @beatriz');
      imagen.dispatchEvent(new Event('error'));

      await waitFor(() =>
        expect(screen.queryByAltText('Avatar de @beatriz')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('cae al @username cuando la persona no tiene nombre', async () => {
      // `guardarUsuario` borra la propiedad nombre cuando llega null, así que puede faltar aunque
      // el tipo la declare obligatoria. Sin este respaldo el encabezado quedaría en blanco.
      usuarioMock.mockResolvedValue(beatriz({ nombre: '' }));

      renderPerfil();

      expect(await screen.findByText('@beatriz')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('avisa con un mensaje visible cuando el perfil no se puede cargar', async () => {
      usuarioMock.mockRejectedValue(new Error('Network Error'));

      renderPerfil();

      expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos abrir este perfil');
    });
  });

  describe('Publicaciones', () => {
    it('las muestra en el orden que llegaron, sin reordenarlas', async () => {
      const antigua = post({ id: 'post-vieja', texto: 'La vieja', fechaCreacion: 1000 });
      const nueva = post({ id: 'post-nueva', texto: 'La nueva', fechaCreacion: 2000 });
      // El backend ya las ordena de la más nueva a la más antigua. Llega en ese orden y eso es lo
      // que se pinta: si el cliente reordenara, la vista podría contradecir a la del servidor.
      postsMock.mockResolvedValue([nueva, antigua]);

      renderPerfil();

      expect(await screen.findByText('La nueva')).toBeInTheDocument();
      expect(screen.getByText('La vieja')).toBeInTheDocument();
    });

    it('distingue un perfil sin publicaciones de un fallo al cargarlas', async () => {
      postsMock.mockResolvedValue([]);

      renderPerfil();

      expect(
        await screen.findByText('Esta persona todavía no ha publicado nada.'),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('permite dar like desde el perfil, como en cualquier red social', async () => {
      // Antes este perfil pintaba su propia copia de la tarjeta, sin reacciones: se podía ver
      // cuántos likes tenía cada publicación, pero no se podía reaccionar desde el perfil de
      // nadie. Reutilizar `PostCard` quita esa divergencia y además trae el dislike y el
      // resaltado de hashtags que la copia no tenía.
      postsMock.mockResolvedValue([post({ id: 'post-b1', totalLikes: 3, likedByMe: false })]);
      const user = userEvent.setup();

      renderPerfil();

      await user.click(await screen.findByRole('button', { name: '3' }));

      expect(likeMock).toHaveBeenCalledWith('post-b1', 'carlos-patino');
      expect(likeMock).toHaveBeenCalledWith('post-b1', 'carlos-patino');
      expect(await screen.findByRole('button', { name: '4' })).toBeInTheDocument();
    });

    it('muestra el dislike que el backend ahora trae, en vez de ocultarlo', async () => {
      postsMock.mockResolvedValue([post({ id: 'post-b1', totalLikes: 3, totalDislikes: 10 })]);

      renderPerfil();

      // El botón de dislike lleva `aria-label`, así que su nombre accesible no es el contador: se
      // busca por la etiqueta y se comprueba el número dentro. Con la copia anterior el perfil no
      // pintaba reacciones, así que diez dislikes existentes eran invisibles desde aquí.
      const dislike = await screen.findByRole('button', { name: 'No me gusta' });
      expect(dislike).toHaveTextContent('10');
    });

    it('muestra un fallo de carga sin tapar el perfil, que ya se pudo leer', async () => {
      postsMock.mockRejectedValue(new Error('Network Error'));

      renderPerfil();

      // El nombre sigue visible: los bloques se cargan por separado y un fallo de uno no puede
      // tapar a los demás.
      expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No pudimos cargar las publicaciones');
    });
  });

  describe('Seguidores', () => {
    it('el autor de las publicaciones no se enlaza al perfil que ya se está viendo', async () => {
      // El encabezado del perfil y el de cada publicación muestran el mismo `@beatriz`, así que
      // cuenta por separado: el encabezado sí es un enlace al perfil ajeno que se está viendo.
      // Las publicaciones de un perfil las escribió esa misma persona. Enlazarla a sí mismo
      // recarga lo que ya está en pantalla y se lee como un enlace roto.
      postsMock.mockResolvedValue([post({ id: 'post-b1', autorId: 'beatriz-silva' })]);

      renderPerfil();

      await screen.findByText('Bienvenidos a la Red Social');
      // "@beatriz" aparece dos veces: el subtítulo del encabezado y el autor de la publicación.
      // El del autor tiene que ser texto plano, sin el papel de botón que tendría si fuera un
      // enlace, así que se comprueba que ninguno de los dos sea botón.
      const apariciones = screen.getAllByText('@beatriz');
      expect(apariciones).toHaveLength(2);
      expect(apariciones.every((nodo) => nodo.tagName !== 'BUTTON')).toBe(true);
    });

    it('lista a las personas que siguen al perfil', async () => {
      seguidoresMock.mockResolvedValue([
        beatriz({ id: 'carlos-patino', username: 'carlos', nombre: 'Carlos Patiño' }),
        beatriz({ id: 'elena-vega', username: 'elena', nombre: 'Elena Vega' }),
      ]);

      renderPerfil();

      expect(await screen.findByText('Carlos Patiño')).toBeInTheDocument();
      expect(screen.getByText('Elena Vega')).toBeInTheDocument();
    });

    it('informa que no hay seguidores sin presentarlo como error', async () => {
      renderPerfil();

      expect(await screen.findByText('Todavía no tiene seguidores.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('abre el perfil de un seguidor al pulsar su fila', async () => {
      seguidoresMock.mockResolvedValue([
        beatriz({ id: 'elena-vega', username: 'elena', nombre: 'Elena Vega' }),
      ]);
      const onOpenPerfil = vi.fn();

      renderPerfil({ onOpenPerfil });

      await userEvent.click(await screen.findByText('Elena Vega'));

      expect(onOpenPerfil).toHaveBeenCalledWith('elena-vega');
    });
  });

  describe('Botón de seguimiento', () => {
    it('muestra "Seguir" cuando la relación no existe', async () => {
      renderPerfil();

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument(),
      );
      expect(screen.queryByRole('button', { name: 'Dejar de seguir' })).not.toBeInTheDocument();
    });

    it('muestra "Dejar de seguir" cuando la relación ya existe', async () => {
      seguidosMock.mockResolvedValue([
        { id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz' },
      ]);

      renderPerfil();

      expect(await screen.findByRole('button', { name: 'Dejar de seguir' })).toBeInTheDocument();
    });

    it('sigue al pulsar Seguir y avisa que la red cambió', async () => {
      const onNetworkUpdated = vi.fn();

      renderPerfil({ onNetworkUpdated });
      await userEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

      expect(followMock).toHaveBeenCalledWith('carlos-patino', 'beatriz-silva');
      expect(onNetworkUpdated).toHaveBeenCalledTimes(1);
    });

    it('deja de seguir al pulsar Dejar de seguir', async () => {
      seguidosMock.mockResolvedValue([
        { id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz' },
      ]);

      renderPerfil();
      await userEvent.click(await screen.findByRole('button', { name: 'Dejar de seguir' }));

      expect(unfollowMock).toHaveBeenCalledWith('carlos-patino', 'beatriz-silva');
    });

    it('no inventa un botón cuando no se pudo saber la relación', async () => {
      // Fallar al leer los seguidos deja el botón ausente en vez de decir "Seguir": un botón que
      // afirma una relación que no se comprobó puede perder el seguimiento de otra persona.
      seguidosMock.mockRejectedValue(new Error('Network Error'));

      renderPerfil();

      await screen.findByText('Beatriz Silva');
      expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dejar de seguir' })).not.toBeInTheDocument();
    });

    it('revierte el botón y avisa cuando seguir falla', async () => {
      followMock.mockRejectedValue(new Error('Network Error'));

      renderPerfil();
      await userEvent.click(await screen.findByRole('button', { name: 'Seguir' }));

      expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo completar la acción');
    });

    it('no ofrece seguir ni dejar de seguir sobre el perfil propio', async () => {
      renderPerfil({ usuarioId: 'carlos-patino', viewerId: 'carlos-patino' });

      await screen.findByText('Carlos Patiño', { exact: false }).catch(() => undefined);
      await waitFor(() => expect(seguidosMock).toHaveBeenCalled());
      expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Dejar de seguir' })).not.toBeInTheDocument();
    });
  });

  describe('Distancia de separación', () => {
    it('calcula la distancia entre quien mira y el perfil abierto', async () => {
      caminoMock.mockResolvedValue({
        rutaConexion: [
          { id: 'carlos-patino', username: 'carlos' },
          { id: 'beatriz-silva', username: 'beatriz' },
        ],
        saltosTotales: 1,
      });

      renderPerfil();
      await userEvent.click(await screen.findByRole('button', { name: /distancia con @carlos/i }));

      expect(caminoMock).toHaveBeenCalledWith('carlos-patino', 'beatriz-silva');
      expect(await screen.findByText('1 salto de separación')).toBeInTheDocument();
    });

    it('presenta la ausencia de conexión como resultado y no como fallo', async () => {
      caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });

      renderPerfil();
      await userEvent.click(await screen.findByRole('button', { name: /distancia/i }));

      expect(await screen.findByText(/No hay conexión con @beatriz/)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('distingue un fallo de cálculo de la ausencia de conexión', async () => {
      caminoMock.mockRejectedValue(new Error('Network Error'));

      renderPerfil();
      await userEvent.click(await screen.findByRole('button', { name: /distancia/i }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos calcular la distancia',
      );
    });
  });

  describe('Paneles de US-09 y US-10 montados dentro del perfil', () => {
    it('consulta las conexiones en común sin pedir que se escriba ningún identificador', async () => {
      renderPerfil();

      await waitFor(() =>
        expect(comunesMock).toHaveBeenCalledWith('carlos-patino', 'beatriz-silva'),
      );
      expect(screen.queryByLabelText('Identificador de la otra persona')).not.toBeInTheDocument();
    });

    it('vuelve a la vista anterior desde el botón Volver', async () => {
      const onCerrar = vi.fn();

      renderPerfil({ onCerrar });
      await userEvent.click(await screen.findByRole('button', { name: /volver/i }));

      expect(onCerrar).toHaveBeenCalledTimes(1);
    });

    it('descarta el perfil anterior al cambiar de persona', async () => {
      // Sin este reinicio, abrir el perfil de otra persona deja en pantalla el nombre de la
      // anterior hasta que llegan los datos nuevos: se vería el nombre de Beatriz con las
      // publicaciones de Carlos.
      const vista = renderPerfil();
      await screen.findByText('Beatriz Silva');

      usuarioMock.mockResolvedValue(
        beatriz({ id: 'paulo-orrala', username: 'paulo', nombre: 'Paulo Orrala' }),
      );
      postsMock.mockResolvedValue([post({ id: 'post-p1', texto: 'Publicación de Paulo' })]);

      vista.rerender(
        <PerfilAjeno
          usuarioId="paulo-orrala"
          viewerId="carlos-patino"
          viewerUsername="carlos"
          onCerrar={vi.fn()}
          onNetworkUpdated={vi.fn()}
          onOpenPerfil={vi.fn()}
        />,
      );

      expect(await screen.findByText('Paulo Orrala')).toBeInTheDocument();
      expect(screen.queryByText('Beatriz Silva')).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByText('Publicación de Paulo')).toBeInTheDocument());
    });
  });
});
