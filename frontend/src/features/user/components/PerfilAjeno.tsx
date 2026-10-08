import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, Route, UserMinus, UserPlus, Users, Sparkles } from 'lucide-react';
import { ConexionesComunesPanel } from '../../network/components/ConexionesComunesPanel';
import { PostCard } from '../../feed/components/PostCard';
import {
  fetchCaminoCorto,
  fetchSeguidos,
  followUserInGraph,
  unfollowUserInGraph,
} from '../../network/services/networkApi';
import type { CaminoCorto } from '../../network/types/network.types';
import { getUserFacingError } from '../../../shared/utils/errorMessage';
import { resolveMediaUrl } from '../../../shared/utils/mediaUrl';
import { fetchPostsDeUsuario, fetchSeguidores, fetchUsuario } from '../services/userApi';
import type { Usuario } from '../types/user.types';
import type { Post } from '../types/post.types';
import { getBannerTheme, getUserSavedBanner } from '../utils/profileStyle';

interface PerfilAjenoProps {
  /** Identificador de la persona cuyo perfil se está mirando. */
  usuarioId: string;
  /** Quién está mirando. Define el botón de seguir y el de distancia. */
  viewerId: string;
  /** Nombre de usuario de quien mira, para los rótulos del panel de conexiones. */
  viewerUsername: string;
  /** Vuelve a la vista anterior. */
  onCerrar: () => void;
  /** Avisa que la red cambió, para que el feed y las sugerencias se repinten. */
  onNetworkUpdated: () => void;
  /** Abre el perfil de otra persona desde una lista de este perfil. */
  onOpenPerfil: (usuarioId: string) => void;
}

/**
 * Cada bloque se modela aparte y con su propio estado.
 *
 * Se evita un único `cargando` para toda la pantalla porque las cuatro peticiones no dependen entre
 * sí: si las publicaciones tardan, el nombre y el botón de seguir ya se pueden ver. Un error de
 * una parte tampoco puede tapar a las otras tres, que es justo lo que pasa con un estado único.
 */
type Estado<T> =
  | { tipo: 'inicial' }
  | { tipo: 'cargando' }
  | { tipo: 'listo'; datos: T }
  | { tipo: 'error'; mensaje: string };

const INICIAL = { tipo: 'inicial' } as const;

/**
 * Perfil de otra persona (US-12).
 *
 * Es un componente nuevo y no una versión del modal de `Navbar`: aquel es el perfil propio y trae
 * un formulario de edición que aquí no tendría sentido, porque no es el usuario quien edita.
 *
 * Monta dentro el panel de conexiones en común (US-09) y el cálculo de distancia (US-10) con la
 * otra persona ya fijada. Eso salda la deuda que el `design.md` de US-09 declara: al existir un
 * perfil ajeno, el "otro usuario" deja de necesitarse escrito a mano.
 */
export const PerfilAjeno: React.FC<PerfilAjenoProps> = ({
  usuarioId,
  viewerId,
  viewerUsername,
  onCerrar,
  onNetworkUpdated,
  onOpenPerfil,
}) => {
  const [perfil, setPerfil] = useState<Estado<Usuario>>({ tipo: 'inicial' });
  const [publicaciones, setPublicaciones] = useState<Estado<Post[]>>({ tipo: 'inicial' });
  const [seguidores, setSeguidores] = useState<Estado<Usuario[]>>({ tipo: 'inicial' });
  const [siguiendo, setSiguiendo] = useState<boolean | null>(null);
  const [enVuelo, setEnVuelo] = useState<boolean>(false);
  const [errorSeguimiento, setErrorSeguimiento] = useState<string | null>(null);
  const [avatarCaido, setAvatarCaido] = useState<boolean>(false);
  const [distancia, setDistancia] = useState<Estado<CaminoCorto>>({ tipo: 'inicial' });

  const esPropio = usuarioId === viewerId;
  const bannerTheme = getBannerTheme(getUserSavedBanner(usuarioId), usuarioId);

  // Cada cambio de identificador reinicia los cuatro bloques. Sin esto, abrir el perfil de otra
  // persona dejaría en pantalla el nombre y las publicaciones de la anterior hasta que llegaran
  // las nuevas, que es un fallo de identidad: se vería el perfil de Beatriz con las publicaciones
  // de Carlos.
  useEffect(() => {
    let cancelado = false;

    setPerfil({ tipo: 'cargando' });
    setPublicaciones({ tipo: 'cargando' });
    setSeguidores({ tipo: 'cargando' });
    setDistancia(INICIAL);
    setSiguiendo(null);
    setErrorSeguimiento(null);
    setAvatarCaido(false);

    fetchUsuario(usuarioId)
      .then((usuario) => {
        if (!cancelado) setPerfil({ tipo: 'listo', datos: usuario });
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setPerfil({
            tipo: 'error',
            mensaje: getUserFacingError(err, 'No pudimos abrir este perfil. Inténtalo de nuevo.'),
          });
        }
      });

    fetchPostsDeUsuario(usuarioId, viewerId)
      .then((posts) => {
        if (!cancelado) setPublicaciones({ tipo: 'listo', datos: posts });
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setPublicaciones({
            tipo: 'error',
            mensaje: getUserFacingError(
              err,
              'No pudimos cargar las publicaciones. Inténtalo de nuevo.',
            ),
          });
        }
      });

    fetchSeguidores(usuarioId)
      .then((lista) => {
        if (!cancelado) setSeguidores({ tipo: 'listo', datos: lista });
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setSeguidores({
            tipo: 'error',
            mensaje: getUserFacingError(
              err,
              'No pudimos cargar los seguidores. Inténtalo de nuevo.',
            ),
          });
        }
      });

    // El estado del botón sale de los seguidos del que mira. Es la misma fuente que ya usa el
    // feed, así que el botón no puede contradecir a la lista de la barra lateral: si aquí dice
    // "Seguir" y en la red está como seguido, uno de los dos está viejo.
    fetchSeguidos(viewerId)
      .then((lista) => {
        if (!cancelado) setSiguiendo(lista.some((u) => u.id === usuarioId));
      })
      .catch(() => {
        // Sin este dato el botón queda en un estado que no afirma nada, en vez de mentir con
        // "Seguir" sobre un perfil al que ya se sigue.
        if (!cancelado) setSiguiendo(null);
      });

    return () => {
      cancelado = true;
    };
  }, [usuarioId, viewerId]);

  const handleToggleSeguir = useCallback(async () => {
    if (siguiendo === null) {
      return;
    }
    setEnVuelo(true);
    setErrorSeguimiento(null);
    // La actualización optimista deja el botón en el estado que el usuario acaba de pedir. Si la
    // petición falla se revierte, y con un mensaje: un botón que cambia y no dice nada es peor
    // que uno que tarda.
    const siguiente = !siguiendo;
    setSiguiendo(siguiente);
    try {
      if (siguiente) {
        await followUserInGraph(viewerId, usuarioId);
      } else {
        await unfollowUserInGraph(viewerId, usuarioId);
      }
      onNetworkUpdated();
    } catch (err: unknown) {
      setSiguiendo(!siguiente);
      setErrorSeguimiento(
        getUserFacingError(err, 'No se pudo completar la acción. Inténtalo de nuevo.'),
      );
    } finally {
      setEnVuelo(false);
    }
  }, [siguiendo, viewerId, usuarioId, onNetworkUpdated]);

  const handleCalcularDistancia = useCallback(async () => {
    setDistancia({ tipo: 'cargando' });
    try {
      const camino = await fetchCaminoCorto(viewerId, usuarioId);
      setDistancia({ tipo: 'listo', datos: camino });
    } catch (err: unknown) {
      setDistancia({
        tipo: 'error',
        mensaje: getUserFacingError(err, 'No pudimos calcular la distancia. Inténtalo de nuevo.'),
      });
    }
  }, [viewerId, usuarioId]);

  const usernameMostrado = perfil.tipo === 'listo' ? perfil.datos.username : null;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onCerrar}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slateDark-textMuted hover:text-slateDark-text bg-slateDark-surface border border-slateDark-borderSubtle hover:border-slateDark-border px-3 py-2 rounded-lg transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Volver
      </button>

      <section className="bg-slateDark-surface rounded-xl border border-slateDark-borderSubtle shadow-xs overflow-hidden">
        {perfil.tipo === 'cargando' && (
          <div className="flex items-center gap-4 p-6">
            <div className="animate-spin w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full shrink-0" />
            <p className="text-xs text-slateDark-textMuted font-medium">Cargando perfil...</p>
          </div>
        )}

        {perfil.tipo === 'error' && (
          <div className="flex items-center gap-2 p-6">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <p role="alert" className="text-sm text-rose-400 font-medium">
              {perfil.mensaje}
            </p>
          </div>
        )}

        {perfil.tipo === 'listo' && (
          <>
            {/* Banner Estético Superior */}
            <div
              className={`h-24 sm:h-32 w-full bg-gradient-to-r ${bannerTheme.gradient} relative overflow-hidden flex items-end justify-end p-3`}
            >
              <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:14px_14px]" />
              <div className="relative z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-semibold text-white/95 border border-white/10 shadow-xs">
                <Sparkles className="w-3 h-3 text-cyan-300" />
                <span>{bannerTheme.nombre}</span>
              </div>
            </div>

            <div className="p-5 pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  {perfil.datos.avatarUrl && !avatarCaido ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-slateDark-surfaceSubtle shrink-0 ring-2 ring-slateDark-border shadow-xs">
                      <img
                        src={resolveMediaUrl(perfil.datos.avatarUrl)}
                        alt={`Avatar de @${perfil.datos.username}`}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarCaido(true)}
                      />
                    </div>
                  ) : (
                    // Respaldo con la inicial. El identificador siempre llega: es la clave del MERGE
                    // de guardarUsuario, así que hay algo que inicializar aunque falte el nombre.
                    <div className="w-16 h-16 rounded-full bg-slateDark-primary text-white flex items-center justify-center font-bold text-xl shrink-0 shadow-xs ring-2 ring-slateDark-border">
                      {(perfil.datos.nombre || perfil.datos.username || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-slateDark-text truncate">
                      {perfil.datos.nombre || `@${perfil.datos.username}`}
                    </h2>
                    <p className="text-xs text-slateDark-primaryLight font-medium truncate">
                      {perfil.datos.nombre ? `@${perfil.datos.username}` : 'Sin nombre registrado'}
                    </p>
                  </div>
                </div>

                {/* El botón no aparece sobre el perfil propio: no hay botón de "dejar de seguirte a
                      ti mismo", y ahí la pregunta no tiene sentido. */}
                {!esPropio && siguiendo !== null && (
                  <button
                    type="button"
                    onClick={() => void handleToggleSeguir()}
                    disabled={enVuelo}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-slateDark-primary hover:bg-slateDark-primaryHover disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg transition-colors cursor-pointer shrink-0 shadow-xs active:scale-95"
                  >
                    {siguiendo ? (
                      <UserMinus className="w-3.5 h-3.5" />
                    ) : (
                      <UserPlus className="w-3.5 h-3.5" />
                    )}
                    <span>{siguiendo ? 'Dejar de seguir' : 'Seguir'}</span>
                  </button>
                )}
              </div>

              {errorSeguimiento && (
                <p role="alert" className="mt-2 mb-3 text-xs text-rose-400 font-medium">
                  {errorSeguimiento}
                </p>
              )}

              {/* Separadores y estado de la distancia */}
              <div className="mt-4 pt-4 border-t border-slateDark-borderSubtle">
                <button
                  type="button"
                  onClick={() => void handleCalcularDistancia()}
                  disabled={distancia.tipo === 'cargando'}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slateDark-textMuted hover:text-slateDark-primaryLight bg-slateDark-surfaceSubtle hover:bg-slateDark-borderSubtle border border-slateDark-borderSubtle px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>
                    {distancia.tipo === 'cargando'
                      ? 'Calculando...'
                      : `Distancia con @${viewerUsername}`}
                  </span>
                </button>

                {distancia.tipo === 'error' && (
                  <p role="alert" className="mt-2 text-xs text-rose-400 font-medium">
                    {distancia.mensaje}
                  </p>
                )}

                {distancia.tipo === 'listo' && distancia.datos.rutaConexion.length === 0 && (
                  <p className="mt-2 text-xs text-slateDark-textMuted">
                    No hay conexión con @{usernameMostrado} dentro de los 6 grados de separación.
                  </p>
                )}

                {distancia.tipo === 'listo' && distancia.datos.rutaConexion.length > 0 && (
                  <div className="mt-2 text-xs text-slateDark-textMuted">
                    <p className="font-medium text-slateDark-primaryLight">
                      {distancia.datos.saltosTotales}{' '}
                      {distancia.datos.saltosTotales === 1 ? 'salto' : 'saltos'} de separación
                    </p>
                    <ol className="mt-1 flex flex-wrap items-center gap-1">
                      {distancia.datos.rutaConexion.map((nodo, indice) => (
                        <li
                          key={`${nodo.id ?? nodo.username}-${indice}`}
                          className="flex items-center gap-1"
                        >
                          {indice > 0 && <span className="text-slateDark-border">&rarr;</span>}
                          <span className="font-medium text-slateDark-text">@{nodo.username}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Seguidores */}
      <section className="bg-slateDark-surface rounded-xl border border-slateDark-borderSubtle shadow-xs p-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-slateDark-primaryLight">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm text-slateDark-text">Seguidores</h3>
        </div>

        {seguidores.tipo === 'cargando' && (
          <p className="text-xs text-slateDark-textMuted">Cargando seguidores...</p>
        )}

        {seguidores.tipo === 'error' && (
          <p role="alert" className="text-xs text-rose-400 font-medium">
            {seguidores.mensaje}
          </p>
        )}

        {seguidores.tipo === 'listo' && seguidores.datos.length === 0 && (
          <p className="text-xs text-slateDark-textMuted py-2">Todavía no tiene seguidores.</p>
        )}

        {seguidores.tipo === 'listo' && seguidores.datos.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {seguidores.datos.map((persona) => (
              <PersonaFila key={persona.id} persona={persona} onOpenPerfil={onOpenPerfil} />
            ))}
          </div>
        )}
      </section>

      {/* Conexiones en común y distancia, montadas con el otro usuario ya fijado */}
      <ConexionesComunesPanel
        currentUserId={viewerId}
        currentUsername={viewerUsername}
        otroUsuarioId={usuarioId}
      />

      {/* Publicaciones */}
      <section>
        <h3 className="font-semibold text-sm text-slateDark-text mb-3">Publicaciones</h3>

        {publicaciones.tipo === 'cargando' && (
          <div className="bg-slateDark-surface rounded-xl p-8 text-center border border-slateDark-borderSubtle shadow-xs">
            <div className="animate-spin w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-xs text-slateDark-textMuted font-medium">
              Cargando publicaciones...
            </p>
          </div>
        )}

        {publicaciones.tipo === 'error' && (
          <p role="alert" className="text-sm text-rose-400 font-medium">
            {publicaciones.mensaje}
          </p>
        )}

        {publicaciones.tipo === 'listo' && publicaciones.datos.length === 0 && (
          <div className="bg-slateDark-surface rounded-xl p-8 text-center border border-slateDark-borderSubtle shadow-xs">
            <p className="text-xs text-slateDark-textMuted">
              Esta persona todavía no ha publicado nada.
            </p>
          </div>
        )}

        {publicaciones.tipo === 'listo' && publicaciones.datos.length > 0 && (
          <div>
            {/* El `PostCard` del feed, no una copia. Antes este perfil pintaba su propia versión
                sin reacciones y sin resaltado de hashtags, con el resultado de que la misma
                publicación se leía distinta según dónde se mirara y no se podía dar like desde el
                perfil de alguien. En cualquier red social se reacciona desde el perfil, y reutilizar
                el componente evita que las dos vistas vuelvan a divergir. */}
            {publicaciones.datos.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={viewerId} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

interface PersonaFilaProps {
  persona: Usuario;
  onOpenPerfil: (usuarioId: string) => void;
}

/** Fila de una persona, con su @username como enlace a su propio perfil. */
const PersonaFila: React.FC<PersonaFilaProps> = ({ persona, onOpenPerfil }) => {
  const [avatarCaido, setAvatarCaido] = useState<boolean>(false);
  const inicial = (persona.nombre || persona.username || '?').charAt(0).toUpperCase();

  return (
    <button
      type="button"
      onClick={() => onOpenPerfil(persona.id)}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors text-left cursor-pointer"
    >
      {persona.avatarUrl && !avatarCaido ? (
        <div className="w-9 h-9 rounded-full overflow-hidden bg-slateDark-surfaceSubtle shrink-0 ring-1 ring-slateDark-border">
          <img
            src={resolveMediaUrl(persona.avatarUrl)}
            alt={`Avatar de @${persona.username}`}
            className="w-full h-full object-cover"
            onError={() => setAvatarCaido(true)}
          />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-full bg-slateDark-surfaceSubtle text-slateDark-text border border-slateDark-borderSubtle flex items-center justify-center font-bold text-xs shrink-0">
          {inicial}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slateDark-text truncate">
          {persona.nombre || `@${persona.username}`}
        </p>
        <p className="text-[11px] text-slateDark-textMuted">@{persona.username}</p>
      </div>
    </button>
  );
};
