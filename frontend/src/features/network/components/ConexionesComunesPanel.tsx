import React, { useEffect, useState } from 'react';
import { AlertCircle, Link2, Search, UserCheck } from 'lucide-react';
import { fetchConexionesComunes } from '../services/networkApi';
import type { ConexionComun } from '../types/network.types';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

interface ConexionesComunesPanelProps {
  currentUserId: string;
  currentUsername: string;
  /**
   * Identificador de la otra persona, cuando ya está fijado.
   *
   * Es lo que monta el perfil ajeno (US-12) y con qué se salda la deuda que declara el design de
   * US-09: al existir un perfil de otra persona, "con quién comparo" deja de ser una pregunta que
   * el usuario tiene que responder escribiendo un identificador. Cuando viene, el campo de texto
   * desaparece y la consulta se dispara sola; cuando no viene, el panel se comporta como antes.
   */
  otroUsuarioId?: string;
  /** Nombre de usuario de la otra persona, para el rótulo del resultado. */
  otroUsername?: string;
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
 * Tiene dos modos. En la barra lateral, sin `otroUsuarioId`, la segunda persona se elige con un
 * campo de texto: era lo único posible cuando el producto sólo conocía el perfil propio. Dentro
 * del perfil ajeno (US-12), con `otroUsuarioId` fijado, no hay campo: la persona ya está elegida y
 * la consulta sale sola. El segundo modo es el que paga la deuda del primero.
 */
export const ConexionesComunesPanel: React.FC<ConexionesComunesPanelProps> = ({
  currentUserId,
  currentUsername,
  otroUsuarioId,
  otroUsername,
}) => {
  const [otroUsuario, setOtroUsuario] = useState('');
  const [estado, setEstado] = useState<EstadoConsulta>({ tipo: 'inicial' });
  const [avatarCaido, setAvatarCaido] = useState<Record<string, boolean>>({});

  const fijado = otroUsuarioId !== undefined && otroUsuarioId !== '';

  const consultar = async (objetivo: string) => {
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

  // Con la otra persona fijada no hay nada que esperar a que el usuario escriba: se consulta al
  // abrir. La dependencia es el identificador y no el nombre, porque cambiar de perfil no obliga a
  // volver a pedir la lista si la otra persona sigue siendo la misma.
  useEffect(() => {
    if (!fijado || otroUsuarioId === undefined) {
      return;
    }
    let cancelado = false;
    void consultar(otroUsuarioId).then(() => {
      // `cancelado` no altera el resultado de `consultar`, que ya guardó el estado: sólo evita
      // propagar un rechazo sin manejar cuando el panel se desmonta a mitad de la petición.
      if (cancelado) {
        return;
      }
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fijado, otroUsuarioId, currentUserId]);

  const handleBuscar = async (e: React.FormEvent) => {
    e.preventDefault();
    const objetivo = otroUsuario.trim();

    // No se manda la petición: el backend responde 400 a un identificador vacío y
    // el panel ya sabe que no puede buscar nada.
    if (!objetivo) {
      setEstado({ tipo: 'error', mensaje: 'Escribe el identificador de la otra persona.' });
      return;
    }

    await consultar(objetivo);
  };

  // Nombre de la otra persona, con el del usuario activo como respaldo cuando el panel se usa
  // suelto en la barra lateral, donde no hay nadie fijado a quién mirar.
  const otroUsuarioNombre = fijado ? `@${otroUsername ?? otroUsuarioId}` : `@${currentUsername}`;

  // Contactos sugeridos para comparar con 1 clic en la barra lateral
  const contactosSugeridos = ['beatriz', 'paulo', 'angel-villon'];

  const handleCompararRapido = (id: string) => {
    setOtroUsuario(id);
    void consultar(id);
  };

  return (
    <div className="bg-slateDark-surface rounded-xl p-5 shadow-xs border border-slateDark-borderSubtle mb-6">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-slateDark-primaryLight">
          <Link2 className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-semibold text-sm text-slateDark-text">Conexiones en común</h3>
        </div>
      </div>
      <p className="text-xs text-slateDark-textMuted mb-3.5 leading-relaxed">
        Descubre personas que sigues tú y también {otroUsuarioNombre}.
      </p>

      {/* El campo desaparece cuando la otra persona ya está fijada: no hay nada que escribir y un
          campo que ignora lo que se escribe es peor que un campo que no está. */}
      {!fijado ? (
        <div className="space-y-2.5">
          <form onSubmit={handleBuscar} className="flex gap-2">
            <input
              type="text"
              value={otroUsuario}
              onChange={(e) => setOtroUsuario(e.target.value)}
              placeholder="Ej. angel-villon"
              aria-label="Identificador de la otra persona"
              className="flex-1 min-w-0 px-3 py-2 bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg text-xs text-slateDark-text placeholder:text-slateDark-textMuted/50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-slateDark-surfaceSubtle transition-all"
            />
            <button
              type="submit"
              disabled={estado.tipo === 'cargando'}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slateDark-primary hover:bg-slateDark-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 shadow-xs"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{estado.tipo === 'cargando' ? 'Buscando...' : 'Buscar'}</span>
            </button>
          </form>

          {/* Chips de sugerencia rápida para comparar en 1 clic */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-slateDark-textMuted font-medium">Sugeridos:</span>
            {contactosSugeridos.map((sugId) => (
              <button
                key={sugId}
                type="button"
                onClick={() => handleCompararRapido(sugId)}
                className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slateDark-surfaceSubtle hover:bg-indigo-500/15 text-slateDark-textMuted hover:text-slateDark-primaryLight border border-slateDark-borderSubtle hover:border-indigo-500/30 transition-all cursor-pointer"
              >
                vs @{sugId}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => otroUsuarioId !== undefined && void consultar(otroUsuarioId)}
          disabled={estado.tipo === 'cargando'}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slateDark-surfaceSubtle hover:bg-slateDark-borderSubtle border border-slateDark-borderSubtle disabled:opacity-50 disabled:cursor-not-allowed text-slateDark-text rounded-lg text-xs font-semibold transition-colors cursor-pointer shadow-xs"
        >
          <Search className="w-3.5 h-3.5 text-slateDark-primaryLight" />
          <span>{estado.tipo === 'cargando' ? 'Buscando...' : 'Actualizar'}</span>
        </button>
      )}

      {estado.tipo === 'error' && (
        <p
          role="alert"
          className="mt-3 text-xs text-rose-400 font-medium flex items-center gap-1.5 bg-rose-950/20 border border-rose-800/40 p-2.5 rounded-lg"
        >
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {estado.mensaje}
        </p>
      )}

      {estado.tipo === 'listo' && estado.conexiones.length === 0 && (
        <div className="mt-3.5 py-4 text-center rounded-lg bg-slateDark-surfaceSubtle border border-slateDark-borderSubtle/60">
          <p className="text-xs text-slateDark-textMuted">
            No tienen conexiones en común.
          </p>
        </div>
      )}

      {estado.tipo === 'listo' && estado.conexiones.length > 0 && (
        <div className="mt-3.5 space-y-2.5">
          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <p className="text-xs font-medium text-emerald-300">
              {estado.conexiones.length} conexion(es) en comun con {otroUsuarioNombre}
            </p>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto">
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
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors border border-transparent hover:border-slateDark-borderSubtle/50"
                >
                  {mostrarAvatar ? (
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-slateDark-surfaceSubtle shrink-0 ring-1 ring-slateDark-border">
                      <img
                        src={conexion.avatar}
                        alt={`Avatar de @${conexion.username}`}
                        className="w-full h-full object-cover"
                        onError={() => setAvatarCaido((prev) => ({ ...prev, [conexion.id]: true }))}
                      />
                    </div>
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slateDark-surfaceSubtle text-slateDark-text border border-slateDark-borderSubtle flex items-center justify-center font-bold text-xs shrink-0">
                      {inicial}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slateDark-text truncate">{nombre}</p>
                    <p className="text-[11px] text-slateDark-textMuted">@{conexion.username}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
