import React, { useState } from 'react';
import { AlertCircle, Link2, Search, UserCheck } from 'lucide-react';
import { fetchConexionesComunes } from '../services/networkApi';
import type { ConexionComun } from '../types/network.types';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

interface ConexionesComunesPanelProps {
  currentUserId: string;
  currentUsername: string;
}

/**
 * Estado de la consulta. Se modela como un discriminated union para que la lista
 * vacía sea un resultado y no se confunda con una consulta que nunca corrió o que
 * falló: las tres cosas se ven distintas en pantalla.
 */
type EstadoConsulta =
  | { tipo: 'inicial' }
  | { tipo: 'cargando' }
  | { tipo: 'listo'; conexiones: ConexionComun[] }
  | { tipo: 'error'; mensaje: string };

/**
 * Conexiones en común entre el usuario activo y otra persona (US-09).
 *
 * El producto no tiene página de perfil, así que no existe el lugar donde "estoy
 * mirando el perfil de alguien" sea una noción navegable. Por eso la segunda
 * persona se elige con un campo de texto explícito en lugar de un selector. Es
 * la deuda que se paga cuando exista el perfil.
 */
export const ConexionesComunesPanel: React.FC<ConexionesComunesPanelProps> = ({
  currentUserId,
  currentUsername,
}) => {
  const [otroUsuario, setOtroUsuario] = useState('');
  const [estado, setEstado] = useState<EstadoConsulta>({ tipo: 'inicial' });
  const [avatarCaido, setAvatarCaido] = useState<Record<string, boolean>>({});

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const objetivo = otroUsuario.trim();

    // No se manda la petición: el backend responde 400 a un identificador vacío y
    // el panel ya sabe que no puede buscar nada.
    if (!objetivo) {
      setEstado({ tipo: 'error', mensaje: 'Escribe el identificador de la otra persona.' });
      return;
    }

    setEstado({ tipo: 'cargando' });
    try {
      const conexiones = await fetchConexionesComunes(currentUserId, objetivo);
      setAvatarCaido({});
      setEstado({ tipo: 'listo', conexiones });
    } catch (err: unknown) {
      setEstado({
        tipo: 'error',
        mensaje: getUserFacingError(
          err,
          'No pudimos consultar las conexiones en común. Inténtalo de nuevo.',
        ),
      });
    }
  };

  return (
    <div className="bg-white rounded-xl p-5 shadow-xs border border-slate-200 mb-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
          <Link2 className="w-4 h-4" />
        </div>
        <h3 className="font-semibold text-sm text-slate-900">Conexiones en común</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4 leading-relaxed">
        Personas que sigues tú y también la otra persona.
      </p>

      <form onSubmit={handleBuscar} className="flex gap-2">
        <input
          type="text"
          value={otroUsuario}
          onChange={(e) => setOtroUsuario(e.target.value)}
          placeholder="Ej. angel-villon"
          aria-label="Identificador de la otra persona"
          className="flex-1 min-w-0 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
        />
        <button
          type="submit"
          disabled={estado.tipo === 'cargando'}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          {estado.tipo === 'cargando' ? 'Buscando...' : 'Buscar'}
        </button>
      </form>

      {estado.tipo === 'error' && (
        <p
          role="alert"
          className="mt-3 text-xs text-rose-600 font-medium flex items-center gap-1.5"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {estado.mensaje}
        </p>
      )}

      {estado.tipo === 'listo' && estado.conexiones.length === 0 && (
        <p className="mt-3 py-3 text-center text-xs text-slate-400">
          No tienen conexiones en común.
        </p>
      )}

      {estado.tipo === 'listo' && estado.conexiones.length > 0 && (
        <div className="mt-3 space-y-2.5">
          <p className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-1 rounded-full inline-flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            {estado.conexiones.length} conexion(es) en comun con @{currentUsername}
          </p>
          {estado.conexiones.map((conexion) => {
            const inicial = conexion.username.charAt(0).toUpperCase();
            // El Cypher #3 no garantiza nombre ni avatar: el nombre es la propiedad
            // que guardarUsuario borra cuando viene null, y el identificador siempre
            // está, así que sirve de respaldo en ambos casos.
            const nombre = conexion.nombre || `@${conexion.username}`;
            const mostrarAvatar = Boolean(conexion.avatar) && avatarCaido[conexion.id] !== true;
            return (
              <div
                key={conexion.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {mostrarAvatar ? (
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-200 shrink-0">
                    <img
                      src={conexion.avatar}
                      alt={`Avatar de @${conexion.username}`}
                      className="w-full h-full object-cover"
                      onError={() => setAvatarCaido((prev) => ({ ...prev, [conexion.id]: true }))}
                    />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                    {inicial}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-800 truncate">{nombre}</p>
                  <p className="text-[11px] text-slate-500">@{conexion.username}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
