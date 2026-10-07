import React, { useEffect, useRef, useState } from 'react';
import { Route, UserMinus, UserPlus, Sparkles, Users, Network } from 'lucide-react';
import { FilaRed, esSugerencia } from '../types/network.types';
import type { CaminoCorto } from '../types/network.types';
import { fetchCaminoCorto, followUserInGraph, unfollowUserInGraph } from '../services/networkApi';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

/**
 * Username comes from the graph in lowercase. The notice interpolates it into a
 * sentence, so it needs an initial capital to read like a name.
 */
const capitalizar = (valor: string): string => valor.charAt(0).toUpperCase() + valor.slice(1);

interface UserSuggestionsCardProps {
  filas: FilaRed[];
  currentUserId: string;
  onNetworkUpdated: () => void;
  /**
   * Abre el perfil de una persona de la lista (US-12).
   *
   * El `@username` era texto con aspecto de enlace y `hover:underline`, que es la forma más
   * barata de mentir sobre lo que se puede hacer. Ahora es un botón de verdad. Es opcional para no
   * romper a quien monte la tarjeta sin esa capacidad: sin él, el `@username` vuelve a texto y no
   * promete nada.
   */
  onOpenPerfil?: (usuarioId: string) => void;
  onOpenGraphModal?: () => void;
}

interface DistanciaResultProps {
  camino: CaminoCorto;
  username: string;
}

/**
 * Resultado del cálculo de distancia de una fila.
 *
 * Distingue tres cosas que el backend ya separa: hay camino (se muestra la cadena y los
 * saltos), no hay camino dentro de los seis grados (resultado legítimo, no un fallo) y la
 * petición falló (eso lo pinta la tarjeta, con rol de alerta).
 */
const DistanciaResult: React.FC<DistanciaResultProps> = ({ camino, username }) => {
  if (camino.rutaConexion.length === 0) {
    return (
      <p className="mt-1.5 text-[11px] text-slateDark-textMuted">
        No hay conexión con @{username} dentro de los 6 grados de separación.
      </p>
    );
  }

  const saltos = camino.saltosTotales;
  return (
    <div className="mt-1.5 text-[11px] text-slateDark-textMuted">
      <p className="font-medium text-slateDark-primaryLight">
        {saltos} {saltos === 1 ? 'salto' : 'saltos'} de separación
      </p>
      <ol className="mt-1 flex flex-wrap items-center gap-1">
        {camino.rutaConexion.map((nodo, indice) => (
          <li key={`${nodo.id ?? nodo.username}-${indice}`} className="flex items-center gap-1">
            {indice > 0 && <span className="text-slateDark-border">&rarr;</span>}
            <span className="font-medium text-slateDark-text">@{nodo.username}</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export const UserSuggestionsCard: React.FC<UserSuggestionsCardProps> = ({
  filas,
  currentUserId,
  onNetworkUpdated,
  onOpenPerfil,
  onOpenGraphModal,
}) => {
  const [confirmados, setConfirmados] = useState<Record<string, boolean>>({});
  const [errorPorId, setErrorPorId] = useState<Record<string, string | null>>({});
  const [enVuelo, setEnVuelo] = useState<Record<string, boolean>>({});
  const [avatarCaido, setAvatarCaido] = useState<Record<string, boolean>>({});
  const [distancias, setDistancias] = useState<Record<string, CaminoCorto>>({});
  const [errorDistancia, setErrorDistancia] = useState<Record<string, string>>({});
  const [calculando, setCalculando] = useState<Record<string, boolean>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  // Refs, no estado: el efecto de detección corre una vez por cada `filas` nuevas
  // y necesita el snapshot anterior sin provocar un render extra.
  const filasPreviasRef = useRef<FilaRed[]>(filas);
  const puenteRef = useRef<string | null>(null);

  useEffect(() => {
    setConfirmados({});
    setAvatarCaido({});
  }, [filas]);

  useEffect(() => {
    const antes = filasPreviasRef.current;
    const puente = puenteRef.current;
    filasPreviasRef.current = filas;
    puenteRef.current = null;
    if (puente === null) {
      return;
    }
    const idsActuales = new Set(filas.map((x) => x.id));
    const desaparecen = antes.filter((f) => !idsActuales.has(f.id) && f.username !== puente);
    const afectada = desaparecen.find((f) => esSugerencia(f) && f.seguidosEnComun.includes(puente));
    if (afectada === undefined) {
      setAviso(null);
      return;
    }
    // The row above the notice shows the `@username` handle, so the message uses
    // the username too instead of the full name. Reading `nombre` here would also
    // be unsafe: `guardarUsuario` drops that property when it is null and the
    // backend returns the row as-is, so it can be missing at runtime even though
    // the type declares it required.
    setAviso(
      `${capitalizar(afectada.username)} dejó de aparecer en tu red al dejar de seguir a ${capitalizar(puente)}.`,
    );
  }, [filas]);

  useEffect(() => {
    if (aviso === null) {
      return;
    }
    const temporizador = setTimeout(() => {
      setAviso(null);
    }, 6000);
    return () => {
      clearTimeout(temporizador);
    };
  }, [aviso]);

  const seguidoVisible = (fila: FilaRed): boolean => confirmados[fila.id] ?? fila.seguido;

  const handleToggle = async (fila: FilaRed, seguido: boolean) => {
    const targetId = fila.id;
    setEnVuelo((prev) => ({ ...prev, [targetId]: true }));
    setErrorPorId((prev) => ({ ...prev, [targetId]: null }));
    try {
      if (seguido) {
        await unfollowUserInGraph(currentUserId, targetId);
        puenteRef.current = fila.username;
        setConfirmados((prev) => ({ ...prev, [targetId]: false }));
      } else {
        await followUserInGraph(currentUserId, targetId);
        setConfirmados((prev) => ({ ...prev, [targetId]: true }));
      }
      onNetworkUpdated();
    } catch {
      setErrorPorId((prev) => ({
        ...prev,
        [targetId]: 'No se pudo completar la acción. Inténtalo de nuevo.',
      }));
    } finally {
      setEnVuelo((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  /**
   * Pide el grado de separación con otra persona y guarda el resultado en su fila.
   *
   * Un error y una ruta vacía se guardan en mapas distintos a propósito: "no hay camino
   * dentro de los seis grados" es un resultado legítimo y no puede pintarse como fallo.
   */
  const handleCalcularDistancia = async (targetId: string) => {
    setCalculando((prev) => ({ ...prev, [targetId]: true }));
    // El error anterior se borra al reintentar: si ahora sale bien, el mensaje viejo
    // no debe seguir en pantalla junto al resultado nuevo.
    setErrorDistancia((prev) => {
      const siguiente = { ...prev };
      delete siguiente[targetId];
      return siguiente;
    });
    try {
      const camino = await fetchCaminoCorto(currentUserId, targetId);
      setDistancias((prev) => ({ ...prev, [targetId]: camino }));
    } catch (err: unknown) {
      setErrorDistancia((prev) => ({
        ...prev,
        [targetId]: getUserFacingError(
          err,
          'No pudimos calcular la distancia. Inténtalo de nuevo.',
        ),
      }));
    } finally {
      setCalculando((prev) => ({ ...prev, [targetId]: false }));
    }
  };

  return (
    <div className="bg-slateDark-surface rounded-xl p-5 shadow-xs border border-slateDark-borderSubtle mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 text-slateDark-primaryLight">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm text-slateDark-text">Tu red</h3>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenGraphModal && (
            <button
              type="button"
              onClick={onOpenGraphModal}
              className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60"
              title="Abrir Explorador Interactivo de Grafo"
              aria-label="Abrir explorador de grafo"
            >
              <Network className="w-3 h-3" />
              <span>Ver Grafo</span>
            </button>
          )}
          <span className="text-[11px] font-medium bg-indigo-500/10 text-slateDark-primaryLight px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-500/20">
            <Sparkles className="w-3 h-3 text-slateDark-primaryLight" />
            Sugerencias
          </span>
        </div>
      </div>
      <p className="text-xs text-slateDark-textMuted mb-4 leading-relaxed">
        Sugerencias y personas que sigues
      </p>

      {aviso !== null && (
        <p
          role="status"
          aria-live="polite"
          className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-800/60 rounded-lg px-3 py-2 mb-4 leading-relaxed"
        >
          {aviso}
        </p>
      )}

      {filas.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-slateDark-textMuted">
            No hay nuevas recomendaciones por ahora.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filas.map((fila) => {
            const seguido = seguidoVisible(fila);
            const error = errorPorId[fila.id];
            const cargando = enVuelo[fila.id] === true;
            const avatarUrl = esSugerencia(fila) ? fila.avatar : fila.avatarUrl;
            const seguidosEnComun = esSugerencia(fila) ? fila.seguidosEnComun : null;
            const mostrarAvatar = Boolean(avatarUrl) && avatarCaido[fila.id] !== true;
            const distancia = distancias[fila.id];
            const errorCalculo = errorDistancia[fila.id];
            const calculandoDistancia = calculando[fila.id] === true;
            return (
              <div
                key={fila.id}
                className="p-2 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mostrarAvatar ? (
                      <div className="w-9 h-9 rounded-full overflow-hidden bg-slateDark-surfaceSubtle shrink-0 ring-1 ring-slateDark-border">
                        <img
                          src={avatarUrl}
                          alt={`Avatar de @${fila.username}`}
                          className="w-full h-full object-cover"
                          onError={() => setAvatarCaido((prev) => ({ ...prev, [fila.id]: true }))}
                        />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-slateDark-surfaceSubtle text-slateDark-text border border-slateDark-borderSubtle flex items-center justify-center font-bold text-xs shrink-0">
                        {fila.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      {onOpenPerfil ? (
                        <button
                          type="button"
                          onClick={() => onOpenPerfil(fila.id)}
                          aria-label={`Ver perfil de @${fila.username}`}
                          className="text-xs font-semibold text-slateDark-text hover:underline cursor-pointer text-left"
                        >
                          @{fila.username}
                        </button>
                      ) : (
                        <h4 className="text-xs font-semibold text-slateDark-text">
                          @{fila.username}
                        </h4>
                      )}
                      <p className="text-[11px] text-slateDark-textMuted">
                        {esSugerencia(fila)
                          ? `${fila.conexionesEnComun} conexión(es) mutua(s)`
                          : fila.nombre || 'Persona que sigues'}
                      </p>
                      {seguidosEnComun && seguidosEnComun.length > 0 && (
                        <p className="text-[11px] text-slateDark-textMuted/70">
                          Conocido por {seguidosEnComun.map((nombre) => `@${nombre}`).join(', ')}
                        </p>
                      )}
                      {error && (
                        <p role="alert" className="text-[11px] text-rose-400 font-medium">
                          {error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => void handleCalcularDistancia(fila.id)}
                      disabled={calculandoDistancia}
                      title={`Calcular la distancia entre @${currentUserId} y @${fila.username}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slateDark-textMuted hover:text-slateDark-primaryLight bg-slateDark-surfaceSubtle hover:bg-slateDark-borderSubtle border border-slateDark-borderSubtle px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Route className="w-3.5 h-3.5" />
                      <span>{calculandoDistancia ? 'Calculando...' : 'Distancia'}</span>
                    </button>

                    <button
                      onClick={() => void handleToggle(fila, seguido)}
                      disabled={cargando}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slateDark-text hover:text-white bg-slateDark-surfaceSubtle hover:bg-slateDark-primary border border-slateDark-borderSubtle px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {seguido ? (
                        <UserMinus className="w-3.5 h-3.5" />
                      ) : (
                        <UserPlus className="w-3.5 h-3.5" />
                      )}
                      <span>{seguido ? 'Dejar de seguir' : 'Seguir'}</span>
                    </button>
                  </div>
                </div>

                {errorCalculo && (
                  <p role="alert" className="mt-1.5 text-[11px] text-rose-400 font-medium">
                    {errorCalculo}
                  </p>
                )}

                {distancia && !errorCalculo && (
                  <DistanciaResult camino={distancia} username={fila.username} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
