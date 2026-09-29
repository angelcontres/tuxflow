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
    <div className="bg-[#161823] rounded-2xl p-5 shadow-xl border border-white/10 mb-6 backdrop-blur-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-[#FE2C55]/15 text-[#FE2C55]">
            <Network className="w-4 h-4" />
          </div>
          <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
            <span>Sugerencias de Red</span>
            <span className="text-xs">🍎</span>
          </h3>
        </div>
        <span className="text-[10px] font-bold bg-[#25F4EE]/15 text-[#25F4EE] px-2 py-0.5 rounded-full flex items-center gap-1 border border-[#25F4EE]/30">
          <Sparkles className="w-3 h-3" />
          2º Grado
        </span>
      </div>
      <p className="text-xs text-neutral-400 mb-4 leading-relaxed">
        Usuarios conectados mediante amigos en común calculados en tiempo real por Neo4j.
      </p>

      {sugerencias.length === 0 ? (
        <div className="py-4 text-center">
          <p className="text-xs text-neutral-400">No hay nuevas recomendaciones por ahora.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sugerencias.map((sug) => (
            <div
              key={sug.id}
              className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex items-center justify-center text-white font-bold text-xs shadow-md ring-1 ring-white/20">
                  {sug.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white hover:underline cursor-pointer flex items-center gap-1">
                    <span>@{sug.username}</span>
                    <span className="text-[10px] text-amber-300 font-normal">🌾</span>
                  </h4>
                  <p className="text-[11px] text-neutral-400">
                    {sug.conexionesEnComun} conexión(es) mutua(s)
                  </p>
                </div>
              </div>

              <button
                onClick={() => handleFollow(sug.id)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-[#FE2C55] hover:bg-[#e0264b] px-3.5 py-1.5 rounded-lg transition-all shadow-sm shadow-[#FE2C55]/20 cursor-pointer active:scale-95"
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
