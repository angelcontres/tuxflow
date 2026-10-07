import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { restoreSession } from './features/auth/services/authApi';
import {
  fetchFeedBySocialGraph,
  fetchTendencias,
  likePost,
} from './features/feed/services/feedApi';
import {
  fetchSeguidos,
  fetchSugerenciasGrafo,
  unfollowUserInGraph,
} from './features/network/services/networkApi';
import {
  buscarUsuarios,
  fetchMiPerfil,
  fetchPostsDeUsuario,
  fetchSeguidores,
  fetchUsuario,
} from './features/user/services/userApi';
import { fetchCaminoCorto, fetchConexionesComunes } from './features/network/services/networkApi';
import type { Post } from './features/feed/types/post.types';
import type { SugerenciaUsuario, Usuario } from './features/network/types/network.types';

vi.mock('./features/auth/services/authApi', () => ({
  restoreSession: vi.fn(),
  clearToken: vi.fn(),
}));

vi.mock('./features/feed/services/feedApi', () => ({
  fetchFeedBySocialGraph: vi.fn(),
  likePost: vi.fn(),
  dislikePost: vi.fn(),
  unlikePost: vi.fn(),
  undislikePost: vi.fn(),
  submitPost: vi.fn(),
  // El widget de tendencias (US-11) monta con App: sin este stub devolviendo una
  // promesa, resetAllMocks() en cada beforeEach lo deja en undefined y el render
  // de App revienta con "Cannot read properties of undefined (reading 'then')".
  fetchTendencias: vi.fn(),
}));

vi.mock('./features/network/services/networkApi', () => ({
  fetchSugerenciasGrafo: vi.fn(),
  fetchSeguidos: vi.fn(),
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
  fetchConexionesComunes: vi.fn(),
  fetchCaminoCorto: vi.fn(),
}));

vi.mock('./features/user/services/userApi', () => ({
  fetchUsuario: vi.fn(),
  fetchPostsDeUsuario: vi.fn(),
  fetchSeguidores: vi.fn(),
  registerOrUpdateUsuario: vi.fn(),
  uploadAvatar: vi.fn(),
  // El buscador del Navbar (US-14) monta con App. Sin este stub devolviendo una promesa,
  // resetAllMocks() en cada beforeEach lo deja en undefined y el render de App revienta con
  // "Cannot read properties of undefined (reading 'then')". Es el mismo motivo que el de
  // fetchTendencias en US-11.
  buscarUsuarios: vi.fn(),
  // El Navbar lee el correo propio de /auth/me. Sin este stub, el Navbar revienta al montar con
  // la misma ClassCastException de undefined.
  fetchMiPerfil: vi.fn(),
}));

vi.mock('./features/chat/services/chatSocket', () => ({
  chatSocketManager: { connect: vi.fn(), disconnect: vi.fn(), sendMessage: vi.fn() },
}));

// El centro de notificaciones abre un EventSource real, y jsdom no implementa
// esa API: el useEffect revienta al montar y tumba el árbol entero. Esta
// prueba es del feed, así que el canal en vivo no aporta nada y el componente
// se aísla completo.
vi.mock('./features/notifications/components/NotificationCenter', () => ({
  NotificationCenter: () => null,
}));

// El registro de Web Push pide la clave VAPID al backend al montar la App. Se
// aísla para no arrastrar el cliente HTTP real (que exige getToken del authApi
// mockeado) ni el permiso de notificaciones del navegador.
vi.mock('./features/notifications/services/pushService', () => ({
  initWebPush: vi.fn().mockResolvedValue(undefined),
}));

const sesionMock = vi.mocked(restoreSession);
const feedMock = vi.mocked(fetchFeedBySocialGraph);
const tendenciasMock = vi.mocked(fetchTendencias);
const likeMock = vi.mocked(likePost);
const sugerenciasMock = vi.mocked(fetchSugerenciasGrafo);
const seguidosMock = vi.mocked(fetchSeguidos);
const unfollowMock = vi.mocked(unfollowUserInGraph);
const perfilMock = vi.mocked(fetchUsuario);
const postsAjenosMock = vi.mocked(fetchPostsDeUsuario);
const seguidoresMock = vi.mocked(fetchSeguidores);
const caminoMock = vi.mocked(fetchCaminoCorto);
const comunesMock = vi.mocked(fetchConexionesComunes);
const buscarMock = vi.mocked(buscarUsuarios);
const miPerfilMock = vi.mocked(fetchMiPerfil);

function postBeatriz(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-beatriz',
    texto: 'Post de beatriz en el feed',
    fechaCreacion: Date.now() - 60_000,
    autorId: 'u-2',
    autorUsername: 'beatriz',
    totalLikes: 5,
    likedByMe: false,
    ...overrides,
  };
}

function postPaulo(overrides: Partial<Post> = {}): Post {
  return {
    id: 'p-paulo',
    texto: 'Post de paulo en el feed',
    fechaCreacion: Date.now() - 2 * 3_600_000,
    autorId: 'u-3',
    autorUsername: 'paulo',
    totalLikes: 1,
    likedByMe: false,
    ...overrides,
  };
}

const beatrizSeguida: Usuario = { id: 'u-2', username: 'beatriz', nombre: 'Beatriz' };

const beatrizSugerencia: SugerenciaUsuario = {
  id: 'u-2',
  username: 'beatriz',
  nombre: 'Beatriz',
  conexionesEnComun: 2,
  seguidosEnComun: ['paulo'],
};

/**
 * Red con una sugerencia que apunta al identificador real de otra persona, para poder abrir su
 * perfil desde el `@username` de la tarjeta.
 */
function redConSugerencia(id: string, username: string) {
  sugerenciasMock.mockResolvedValue([
    { id, username, nombre: username, conexionesEnComun: 1, seguidosEnComun: [] },
  ]);
  seguidosMock.mockResolvedValue([]);
}

/** Perfil propio y perfil ajeno, según el identificador que pida la vista. */
function perfilesConBeatriz(nombre = 'Beatriz Silva') {
  perfilMock.mockImplementation((id: string) =>
    Promise.resolve(
      id === 'beatriz-silva'
        ? { id: 'beatriz-silva', username: 'beatriz', nombre }
        : { id: 'carlos-patino', username: 'carlos', nombre: 'Carlos' },
    ),
  );
}

/**
 * Red antes del unfollow (beatriz seguida) y despues (beatriz vuelve a ser
 * sugerencia con "Seguir"), como la devolveria el backend real.
 */
function simularRedConUnfollowDeBeatriz(): void {
  seguidosMock.mockResolvedValueOnce([beatrizSeguida]);
  seguidosMock.mockResolvedValue([]);
  sugerenciasMock.mockResolvedValueOnce([]);
  sugerenciasMock.mockResolvedValue([beatrizSugerencia]);
}

describe('App (feed tras dejar de seguir)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // US-11: el widget de tendencias pide esto al montar con App.
    tendenciasMock.mockResolvedValue([]);
    // El Navbar pide el perfil con correo por separado: /users/{id} ya no lo devuelve.
    miPerfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    sesionMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    perfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      nombre: 'Carlos',
    });
    likeMock.mockResolvedValue({
      postId: 'p-paulo',
      likedByMe: true,
      dislikedByMe: false,
      totalLikes: 2,
      totalDislikes: 0,
    });
    unfollowMock.mockResolvedValue(undefined);
    // Respuestas por defecto de la vista de perfil ajeno: sin nada que mostrar y sin fallos, para
    // que las pruebas de navegación no tengan que declararlas una por una.
    postsAjenosMock.mockResolvedValue([]);
    seguidoresMock.mockResolvedValue([]);
    comunesMock.mockResolvedValue([]);
    caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });
  });

  it('deja de seguir vuelve a pedir el feed y quita los posts del usuario filtrado', async () => {
    // El backend excluye de las publicaciones a los no seguidos: la segunda
    // respuesta ya no trae nada de beatriz.
    feedMock.mockResolvedValueOnce([postBeatriz(), postPaulo()]);
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de beatriz en el feed')).toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));

    expect(unfollowMock).toHaveBeenCalledWith('carlos-patino', 'u-2');
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.queryByText('Post de beatriz en el feed')).not.toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(2);
  });

  it('los posts del usuario filtrado no reaparecen al recargar la vista', async () => {
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    const vista = render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dejar de seguir' }));
    expect(await screen.findByRole('button', { name: 'Seguir' })).toBeInTheDocument();

    vista.unmount();
    render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(screen.queryByText('Post de beatriz en el feed')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Dejar de seguir' })).not.toBeInTheDocument();
  });

  it('dar like a un post que sigue en el feed no vuelve a pedir el feed', async () => {
    feedMock.mockResolvedValue([postPaulo()]);
    simularRedConUnfollowDeBeatriz();
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByText('Post de paulo en el feed')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '1' }));

    expect(likeMock).toHaveBeenCalledTimes(1);
    expect(likeMock).toHaveBeenCalledWith('p-paulo', 'carlos-patino');
    expect(await screen.findByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByText('Post de paulo en el feed')).toBeInTheDocument();
    expect(feedMock).toHaveBeenCalledTimes(1);
  });
});

describe('App (navegación al perfil ajeno, US-12)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // US-11: el widget de tendencias pide esto al montar con App.
    tendenciasMock.mockResolvedValue([]);
    // El Navbar pide el perfil con correo por separado: /users/{id} ya no lo devuelve.
    miPerfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    sesionMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    perfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      nombre: 'Carlos',
    });
    feedMock.mockResolvedValue([]);
    unfollowMock.mockResolvedValue(undefined);
    postsAjenosMock.mockResolvedValue([]);
    seguidoresMock.mockResolvedValue([]);
    comunesMock.mockResolvedValue([]);
    caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });
  });

  it('abre el perfil de otra persona desde el @username de una sugerencia', async () => {
    // Antes el @username era texto con `hover:underline`: no llevaba a ninguna parte.
    perfilesConBeatriz();
    redConSugerencia('beatriz-silva', 'beatriz');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Ver perfil de @beatriz' }));

    expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
    expect(postsAjenosMock).toHaveBeenCalledWith('beatriz-silva', 'carlos-patino');
    expect(seguidoresMock).toHaveBeenCalledWith('beatriz-silva');
    // El feed y el formulario dejan de estar en pantalla mientras se mira a otra persona.
    expect(screen.queryByPlaceholderText('¿Qué estás pensando hoy?')).not.toBeInTheDocument();
  });

  it('sustituye el feed por el perfil ajeno y vuelve con el botón Volver', async () => {
    perfilesConBeatriz();
    redConSugerencia('beatriz-silva', 'beatriz');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Ver perfil de @beatriz' }));
    await screen.findByText('Beatriz Silva');
    await user.click(screen.getByRole('button', { name: /volver/i }));

    expect(screen.queryByText('Beatriz Silva')).not.toBeInTheDocument();
    // Volver no vuelve a pedir el feed: los posts siguen en el estado de la vista y mirar a otra
    // persona no los cambia. El refresco ocurre cuando cambia la red -- seguir o dejar de seguir
    // desde el perfil -- y no por dar atrás.
    await screen.findByPlaceholderText('¿Qué estás pensando hoy?');
    expect(feedMock).toHaveBeenCalledTimes(1);
  });

  it('monta el panel de conexiones en común dentro del perfil sin campo de texto', async () => {
    perfilesConBeatriz();
    redConSugerencia('beatriz-silva', 'beatriz');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Ver perfil de @beatriz' }));

    await waitFor(() => expect(comunesMock).toHaveBeenCalledWith('carlos-patino', 'beatriz-silva'));
    // Desde el perfil, la comparación sale sola con el identificador de la otra persona. El
    // panel de la barra lateral sigue teniendo su campo, y es lo correcto: ahí todavía no hay
    // ninguna persona elegida.
    expect(comunesMock).toHaveBeenCalledTimes(1);
  });

  it('deja el perfil ajeno al cerrar la sesión', async () => {
    // El identificador de un perfil abierto no sobrevive a la sesión: si lo sobreviviera, al
    // entrar otra persona se abriría el perfil que estaba mirando la anterior.
    perfilesConBeatriz();
    redConSugerencia('beatriz-silva', 'beatriz');
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Ver perfil de @beatriz' }));
    await screen.findByText('Beatriz Silva');

    await user.click(screen.getByRole('button', { name: /salir|cerrar sesi/i }));

    expect(await screen.findByRole('button', { name: /iniciar sesi/i })).toBeInTheDocument();
    expect(screen.queryByText('Beatriz Silva')).not.toBeInTheDocument();
  });
});

describe('App (búsqueda de personas, US-14)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tendenciasMock.mockResolvedValue([]);
    // El Navbar pide el perfil con correo por separado: /users/{id} ya no lo devuelve.
    miPerfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    sesionMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    feedMock.mockResolvedValue([]);
    sugerenciasMock.mockResolvedValue([]);
    seguidosMock.mockResolvedValue([]);
    unfollowMock.mockResolvedValue(undefined);
    postsAjenosMock.mockResolvedValue([]);
    seguidoresMock.mockResolvedValue([]);
    comunesMock.mockResolvedValue([]);
    caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });
    buscarMock.mockResolvedValue([]);
    perfilesConBeatriz();
  });

  it('busca a una persona y abre su perfil: el circuito que US-12 dejó a medias', async () => {
    // Es el cierre de la historia: buscar → resultado → perfil → seguir. Lo que se comprueba aquí es
    // que el resultado del buscador llega al MISMO manejador que usan las sugerencias, así que hay un
    // solo camino de navegación y no uno por pantalla.
    buscarMock.mockResolvedValue([
      { id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz Silva' },
    ]);
    render(<App />);

    // Se espera a que la sesión se restaure antes de tocar el buscador: hasta entonces la pantalla
    // es el spinner de carga y el Navbar no existe en el árbol.
    const campo = await screen.findByLabelText(/buscar personas/i);

    const user = userEvent.setup();
    await user.type(campo, 'beatriz');

    expect(await screen.findByText('Beatriz Silva', { selector: 'li *' })).toBeInTheDocument();
    await waitFor(() => expect(buscarMock).toHaveBeenCalledWith('beatriz', expect.anything()));

    await user.click(screen.getByRole('option', { name: /Beatriz Silva/ }));

    // Y desde el perfil se ven sus publicaciones y sus seguidores: la búsqueda abre el circuito
    // completo, no una pantalla a medias.
    expect(postsAjenosMock).toHaveBeenCalledWith('beatriz-silva', 'carlos-patino');
    expect(seguidoresMock).toHaveBeenCalledWith('beatriz-silva');
    expect(screen.queryByPlaceholderText('¿Qué estás pensando hoy?')).not.toBeInTheDocument();
  });

  it('el buscador está en el Navbar y no pregunta nada al abrir la aplicación', async () => {
    render(<App />);

    expect(await screen.findByLabelText(/buscar personas/i)).toBeInTheDocument();
    expect(buscarMock).not.toHaveBeenCalled();
  });
});

describe('App (el correo propio viene de la sesion, no del perfil publico)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    tendenciasMock.mockResolvedValue([]);
    // El Navbar pide el perfil con correo por separado: /users/{id} ya no lo devuelve.
    miPerfilMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    sesionMock.mockResolvedValue({
      id: 'carlos-patino',
      username: 'carlos',
      email: 'carlos@upse.edu.ec',
      nombre: 'Carlos',
    });
    feedMock.mockResolvedValue([]);
    sugerenciasMock.mockResolvedValue([]);
    seguidosMock.mockResolvedValue([]);
    unfollowMock.mockResolvedValue(undefined);
    postsAjenosMock.mockResolvedValue([]);
    seguidoresMock.mockResolvedValue([]);
    comunesMock.mockResolvedValue([]);
    caminoMock.mockResolvedValue({ rutaConexion: [], saltosTotales: 0 });
    buscarMock.mockResolvedValue([]);
    perfilMock.mockResolvedValue({ id: 'carlos-patino', username: 'carlos', nombre: 'Carlos' });
  });

  it('el perfil ajeno se pinta sin el correo de otra persona', async () => {
    // El perfil publico ya no lleva correo y `PerfilAjeno` no debe intentar mostrarlo. Es la
    // contraparte de que `GET /users/{id}` responda `UsuarioPublicoResponse`.
    perfilesConBeatriz();
    buscarMock.mockResolvedValue([
      { id: 'beatriz-silva', username: 'beatriz', nombre: 'Beatriz Silva' },
    ]);
    render(<App />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(/buscar personas/i), 'beatriz');
    await screen.findByText('Beatriz Silva', { selector: 'li *' });
    await user.click(screen.getByRole('option', { name: /Beatriz Silva/ }));

    // El nombre si aparece; el correo de otra persona, nunca.
    expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
    expect(screen.queryByText('beatriz@upse.edu.ec')).not.toBeInTheDocument();
  });

  it('el Navbar sobrevive si /auth/me falla, sin tirar la sesion abajo', async () => {
    // Perder el correo propio es un problema; perder el Navbar entero, que es por donde se entra
    // al perfil y se cierra sesion, es otro. El token ya lo limpia el interceptor de `client.ts`
    // cuando el backend responde 401.
    miPerfilMock.mockRejectedValue(new Error('Network Error'));
    render(<App />);

    expect(await screen.findByLabelText(/buscar personas/i)).toBeInTheDocument();
    expect(screen.getByTitle(/ver perfil o cambiar de sesi/i)).toBeInTheDocument();
  });
});
