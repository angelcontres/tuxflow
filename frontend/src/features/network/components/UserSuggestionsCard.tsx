import React from 'react';
import { UserPlus, Sparkles, Network } from 'lucide-react';
import { SugerenciaUsuario } from '../types/network.types';
import { followUserInGraph } from '../services/networkApi';

interface UserSuggestionsCardProps {
  sugerencias: SugerenciaUsuario[];
  currentUserId: string;
  onNetworkUpdated: () => void;
}

export const UserSuggestionsCard: React.FC<UserSuggestionsCardProps> = ({
  sugerencias,
  currentUserId,
  onNetworkUpdated,
}) => {
  const handleFollow = async (targetId: string) => {
    try {
      await followUserInGraph(currentUserId, targetId);
      onNetworkUpdated();
    } catch (err) {
      console.error('Error al seguir usuario:', err);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Network className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-slate-900">Sugerencias de Red</h3>
        </div>
        <span className="text-[11px] font-medium bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" />
          2º Grado
        </span>
      </div>
      <p className="text-xs text-slate-400 mb-4 leading-relaxed">
        Usuarios conectados mediante amigos en común calculados en tiempo real por Neo4j.
      </p>

      {sugerencias.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-400">No hay nuevas recomendaciones por ahora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sugerencias.map((sug) => (
            <div
              key={sug.id}
              className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                  {sug.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">@{sug.username}</h4>
                  <p className="text-[11px] text-slate-400">
                    {sug.conexionesEnComun} conexión(es) mutua(s)
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleFollow(sug.id)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-600 hover:text-white bg-sky-50 hover:bg-sky-600 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Seguir</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
