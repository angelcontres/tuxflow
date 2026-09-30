import React, { useEffect, useState } from 'react';
import { UserMinus, UserPlus, Sparkles, Users } from 'lucide-react';
import { FilaRed, esSugerencia } from '../types/network.types';
import { followUserInGraph, unfollowUserInGraph } from '../services/networkApi';

interface UserSuggestionsCardProps {
  filas: FilaRed[];
  currentUserId: string;
  onNetworkUpdated: () => void;
}

export const UserSuggestionsCard: React.FC<UserSuggestionsCardProps> = ({
  filas,
  currentUserId,
  onNetworkUpdated,
}) => {
  const [confirmados, setConfirmados] = useState<Record<string, boolean>>({});
  const [errorPorId, setErrorPorId] = useState<Record<string, string | null>>({});
  const [enVuelo, setEnVuelo] = useState<Record<string, boolean>>({});
  const [avatarCaido, setAvatarCaido] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setConfirmados({});
    setAvatarCaido({});
  }, [filas]);

  const seguidoVisible = (fila: FilaRed): boolean => confirmados[fila.id] ?? fila.seguido;

  const handleToggle = async (targetId: string, seguido: boolean) => {
    setEnVuelo((prev) => ({ ...prev, [targetId]: true }));
    setErrorPorId((prev) => ({ ...prev, [targetId]: null }));
    try {
      if (seguido) {
        await unfollowUserInGraph(currentUserId, targetId);
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

  return (
    <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Users className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-sm text-slate-900">Tu red</h3>
        </div>
        <span className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-100">
          <Sparkles className="w-3 h-3 text-blue-500" />
          Grafo Neo4j
        </span>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Sugerencias y personas que sigues
      </p>

      {filas.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-400">No hay nuevas recomendaciones por ahora.</p>
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
            return (
              <div
                key={fila.id}
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {mostrarAvatar ? (
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0">
                      <img
                        src={avatarUrl}
                        alt={`Avatar de @${fila.username}`}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarCaido((prev) => ({ ...prev, [fila.id]: true }))}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {fila.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-800 hover:underline cursor-pointer">
                      @{fila.username}
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      {esSugerencia(fila)
                        ? `${fila.conexionesEnComun} conexión(es) mutua(s)`
                        : fila.nombre || 'Persona que sigues'}
                    </p>
                    {seguidosEnComun && seguidosEnComun.length > 0 && (
                      <p className="text-[11px] text-slate-400">
                        Conocido por {seguidosEnComun.map((nombre) => `@${nombre}`).join(', ')}
                      </p>
                    )}
                    {error && (
                      <p role="alert" className="text-[11px] text-red-600 font-medium">
                        {error}
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => void handleToggle(fila.id, seguido)}
                  disabled={cargando}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {seguido ? (
                    <UserMinus className="w-3.5 h-3.5" />
                  ) : (
                    <UserPlus className="w-3.5 h-3.5" />
                  )}
                  <span>{seguido ? 'Dejar de seguir' : 'Seguir'}</span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
