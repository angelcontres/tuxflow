import React, { useEffect, useState } from 'react';
import { ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';
import { fetchTendencias } from '../services/feedApi';
import type { Tendencia } from '../types/post.types';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

interface TrendingSidebarProps {
  currentUserId: string;
}

/**
 * Estado de la consulta. Se modela como un discriminated union para que la lista vacía sea un
 * resultado y no se confunda con una consulta que nunca corrió o que falló: las tres cosas se
 * ven distintas en pantalla (US-11, D4).
 */
type EstadoConsulta =
  | { tipo: 'inicial' }
  | { tipo: 'cargando' }
  | { tipo: 'listo'; tendencias: Tendencia[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Tendencias de los últimos 7 días en la red extendida a 1-2 saltos (US-11).
 *
 * El widget es dueño de su estado (loading / vacío / error) y de su propia petición: en la barra
 * lateral no hay un contenedor que lo alimente, igual que `ConexionesComunesPanel` y
 * `ChatWidget`. La peticion se dispara sólo cuando cambia `currentUserId`, así que un re-render
 * del padre con los mismos props no apila una segunda llamada en vuelo.
 *
 * La puntuación neta se pinta con signo explícito porque es la métrica que ordena la lista
 * (D1): sin el signo, `3` y `-3` se leen igual en pantalla y la posición deja de explicarse.
 */
export const TrendingSidebar: React.FC<TrendingSidebarProps> = ({ currentUserId }) => {
  const [estado, setEstado] = useState<EstadoConsulta>({ tipo: 'inicial' });

  useEffect(() => {
    if (!currentUserId) {
      setEstado({ tipo: 'inicial' });
      return;
    }
    let cancelado = false;
    setEstado({ tipo: 'cargando' });
    fetchTendencias(currentUserId)
      .then((tendencias) => {
        if (cancelado) return;
        setEstado({ tipo: 'listo', tendencias });
      })
      .catch((err: unknown) => {
        // El error llega como rechazo, nunca convertido a lista vacía: si el backend
        // falla, el usuario tiene que ver "no se pudo cargar" y no "no hay tendencias".
        if (cancelado) return;
        setEstado({
          tipo: 'error',
          mensaje: getUserFacingError(err, 'No pudimos cargar las tendencias. Inténtalo de nuevo.'),
        });
      });
    return () => {
      cancelado = true;
    };
  }, [currentUserId]);

  return (
    <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
          <TrendingUp className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-sm text-slate-900">Tendencias</h3>
        <span className="ml-auto text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full">
          7 días
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Lo más reaccionado en tu red (hasta 2 saltos) en los últimos 7 días.
      </p>

      {estado.tipo === 'inicial' || estado.tipo === 'cargando' ? (
        <div className="space-y-3 animate-pulse" data-testid="tendencias-cargando">
          <div className="h-4 bg-slate-100 rounded w-full" />
          <div className="h-4 bg-slate-100 rounded w-5/6" />
          <div className="h-4 bg-slate-100 rounded w-2/3" />
        </div>
      ) : null}

      {estado.tipo === 'error' ? (
        <div
          role="alert"
          className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-3 leading-relaxed"
        >
          {estado.mensaje}
        </div>
      ) : null}

      {estado.tipo === 'listo' && estado.tendencias.length === 0 ? (
        <div className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3 leading-relaxed">
          Aún no hay tendencias en tu red. Las publicaciones más reaccionadas de la semana
          aparecerán aquí.
        </div>
      ) : null}

      {estado.tipo === 'listo' && estado.tendencias.length > 0 ? (
        <ol className="space-y-3">
          {estado.tendencias.map((tendencia, indice) => (
            <li key={tendencia.id} className="flex items-start gap-3">
              <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-semibold flex items-center justify-center">
                {indice + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 leading-snug line-clamp-2 break-words">
                  {tendencia.texto}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                  <span className="font-medium">@{tendencia.autor}</span>
                  <span className="inline-flex items-center gap-0.5">
                    <ThumbsUp className="w-3 h-3" aria-hidden="true" />
                    {tendencia.likes}
                  </span>
                  <span className="inline-flex items-center gap-0.5">
                    <ThumbsDown className="w-3 h-3" aria-hidden="true" />
                    {tendencia.dislikes}
                  </span>
                  <span
                    className={`font-semibold ${
                      tendencia.puntuacionNeta > 0
                        ? 'text-emerald-600'
                        : tendencia.puntuacionNeta < 0
                          ? 'text-rose-600'
                          : 'text-slate-500'
                    }`}
                  >
                    {tendencia.puntuacionNeta > 0
                      ? `+${tendencia.puntuacionNeta}`
                      : tendencia.puntuacionNeta}{' '}
                    pts
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
};
