import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Search, X } from 'lucide-react';
import { buscarUsuarios } from '../services/userApi';
import type { ResultadoBusquedaUsuario } from '../types/user.types';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

interface UserSearchBoxProps {
  /** Abre el perfil de la persona elegida. Es el mismo manejador de US-12. */
  onOpenPerfil: (usuarioId: string) => void;
}

/**
 * Cuánto se espera antes de preguntar al servidor.
 *
 * Sin esto, escribir "beatriz" dispara siete peticiones. Con esto, una.
 */
const ESPERA_BUSQUEDA_MS = 250;

/**
 * Mínimo de caracteres para preguntar al servidor.
 *
 * Con dos caracteres se evita el volcado del directorio letra a letra: con uno, "a" devuelve casi
 * todo y el endpoint se convierte en un `GET /api/users` con otro nombre. Es una mitigación, no una
 * solución, y el backend la repite por su cuenta: una mitigación que sólo existe en el navegador no
 * mitiga nada contra un curl.
 */
const MINIMO_CARACTERES = 2;

/**
 * Los seis estados del desplegable, modelados aparte.
 *
 * Un estado único sería más corto y estaría mal. Un desplegable vacío sin explicación se lee como
 * "no hay nadie", que es una afirmación falsa, y por eso "sin resultados", "cargando" y "falló"
 * tienen que verse distinto uno de otro. También delatan los tres casos en los que el componente
 * se equivoca: si "sin resultados" y "falló" compartieran forma, una caída de la red se pintaría como
 * una comunidad vacía.
 */
type Estado =
  | { tipo: 'inactivo' }
  | { tipo: 'corto' }
  | { tipo: 'cargando' }
  | { tipo: 'listo'; datos: ResultadoBusquedaUsuario[] }
  | { tipo: 'vacio' }
  | { tipo: 'error'; mensaje: string };

/**
 * Buscador de personas en el `Navbar` (US-14).
 *
 * Cierra el circuito que US-12 dejó a medias: **buscar → resultado → perfil → seguir.** Cada
 * resultado es un botón que llama a `onOpenPerfil`, que es el mismo manejador que ya usan las
 * sugerencias y el perfil ajeno, así que la navegación por la comunidad tiene un solo camino.
 *
 * El componente no sabe el orden por relevancia ni el mínimo de caracteres del servidor: los aplica
 * el backend, y el mínimo se comprueba aquí para no hacer una petición que el servidor va a
 * rechazar. Es el único dato que se duplica, y sólo como ahorro de una ida.
 */
export const UserSearchBox: React.FC<UserSearchBoxProps> = ({ onOpenPerfil }) => {
  const [texto, setTexto] = useState<string>('');
  const [estado, setEstado] = useState<Estado>({ tipo: 'inactivo' });
  const [avatarsCaidos, setAvatarsCaidos] = useState<Record<string, boolean>>({});

  // El controlador de la petición en vuelo. Vive en un ref y no en estado porque cambiar el
  // AbortController no debe provocar un render: sólo se usa para abortar.
  const peticionRef = useRef<AbortController | null>(null);
  // Sólo se pinta la respuesta de la última petición. Sin esto, la respuesta de "beat" puede llegar
  // después de la de "beatriz" y ganar, y se ve el resultado de un texto que ya no está en el campo.
  const secuenciaRef = useRef<number>(0);

  useEffect(() => {
    const limpio = texto.trim();

    if (limpio.length === 0) {
      // Abortar en vez de dejar terminar: la respuesta de un texto anterior ya no le sirve a nadie.
      peticionRef.current?.abort();
      peticionRef.current = null;
      setEstado({ tipo: 'inactivo' });
      return;
    }

    if (limpio.length < MINIMO_CARACTERES) {
      peticionRef.current?.abort();
      peticionRef.current = null;
      setEstado({ tipo: 'corto' });
      return;
    }

    setEstado({ tipo: 'cargando' });

    // El temporizador es el debounce: cada tecla nuevacancela el anterior, así que sólo la última
    // de una ráfaga llega a preguntar.
    const temporizador = setTimeout(() => {
      const controlador = new AbortController();
      peticionRef.current?.abort();
      peticionRef.current = controlador;
      const secuencia = ++secuenciaRef.current;

      buscarUsuarios(limpio, controlador.signal)
        .then((datos) => {
          // Una respuesta obsoleta se descarta: si meanwhile se pidió otro texto, ésta ya no pinta.
          if (secuencia !== secuenciaRef.current) {
            return;
          }
          setEstado(datos.length === 0 ? { tipo: 'vacio' } : { tipo: 'listo', datos });
        })
        .catch((err: unknown) => {
          if (secuencia !== secuenciaRef.current) {
            return;
          }
          // Una petición abortada no es un fallo: es el desenlace previsto cuando llega un texto
          // nuevo. Sin esta separación, borrar el campo a medio teclear pintaría un error en rojo.
          if (controlador.signal.aborted) {
            return;
          }
          setEstado({
            tipo: 'error',
            mensaje: getUserFacingError(err, 'No pudimos buscar. Inténtalo de nuevo.'),
          });
        });
    }, ESPERA_BUSQUEDA_MS);

    return () => {
      clearTimeout(temporizador);
      peticionRef.current?.abort();
      peticionRef.current = null;
    };
  }, [texto]);

  const abierto = estado.tipo !== 'inactivo' && estado.tipo !== 'corto';

  const elegir = (usuarioId: string) => {
    // Se cierra y se limpia antes de navegar: si el manejador de US-12 falla, el desplegable no se
    // queda abierto con el mismo texto pidiendo algo que ya se está abriendo.
    setTexto('');
    setEstado({ tipo: 'inactivo' });
    onOpenPerfil(usuarioId);
  };

  return (
    <div className="relative w-full max-w-xs">
      <label htmlFor="buscar-usuarios" className="sr-only">
        Buscar personas por nombre o nombre de usuario
      </label>
      <div className="relative">
        <Search className="w-4 h-4 text-slateDark-textMuted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          id="buscar-usuarios"
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar personas..."
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls="buscar-usuarios-resultados"
          className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slateDark-border bg-slateDark-surfaceSubtle text-slateDark-text placeholder:text-slateDark-textMuted/60 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {texto.length > 0 && (
          <button
            type="button"
            onClick={() => setTexto('')}
            aria-label="Limpiar la búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surface transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* El desplegable no se abre sin texto y con texto demasiado corto: son estados en los que no
          hay nada que preguntar, y un cuadro vacío ahí se lee como una búsqueda que no encontró a
          nadie. */}
      {abierto && (
        <div
          id="buscar-usuarios-resultados"
          role="listbox"
          className="absolute z-50 mt-1.5 w-full bg-slateDark-surface rounded-xl border border-slateDark-border shadow-2xl overflow-hidden"
        >
          {estado.tipo === 'cargando' && (
            <div className="px-3 py-3 flex items-center gap-2 text-xs text-slateDark-textMuted">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slateDark-primaryLight" />
              Buscando...
            </div>
          )}

          {estado.tipo === 'vacio' && (
            <p className="px-3 py-3 text-xs text-slateDark-textMuted">
              No encontramos a nadie con ese texto.
            </p>
          )}

          {estado.tipo === 'error' && (
            <p
              role="alert"
              className="px-3 py-3 text-xs text-rose-400 flex items-start gap-2 bg-rose-950/20"
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
              <span>{estado.mensaje}</span>
            </p>
          )}

          {estado.tipo === 'listo' && (
            <ul className="max-h-80 overflow-y-auto divide-y divide-slateDark-borderSubtle/40">
              {estado.datos.map((persona) => {
                const inicial = (persona.nombre || persona.username).charAt(0).toUpperCase();
                const avatarVisible = Boolean(persona.avatarUrl) && !avatarsCaidos[persona.id];
                return (
                  <li key={persona.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => elegir(persona.id)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
                    >
                      {avatarVisible ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden bg-slateDark-surfaceSubtle shrink-0 ring-1 ring-slateDark-border">
                          <img
                            src={persona.avatarUrl}
                            alt={`Avatar de @${persona.username}`}
                            className="w-full h-full object-cover"
                            onError={() =>
                              setAvatarsCaidos((prev) => ({ ...prev, [persona.id]: true }))
                            }
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-slateDark-surfaceSubtle text-slateDark-text border border-slateDark-borderSubtle flex items-center justify-center font-bold text-xs shrink-0">
                          {inicial}
                        </div>
                      )}
                      <div className="min-w-0">
                        {/* El identificador de usuario es el que no puede faltar: `guardarUsuario`
                            exige `username`, así que un nombre ausente cae al identificador. */}
                        <p className="text-xs font-semibold text-slateDark-text truncate">
                          {persona.nombre || `@${persona.username}`}
                        </p>
                        <p className="text-[11px] text-slateDark-textMuted truncate">
                          @{persona.username}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {estado.tipo === 'corto' && (
        <p className="absolute top-full left-0 mt-1 text-[11px] text-slateDark-textMuted">
          Escribe al menos {MINIMO_CARACTERES} caracteres.
        </p>
      )}
    </div>
  );
};
