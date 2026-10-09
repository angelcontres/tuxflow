import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  Edit3,
  Upload,
  Check,
  AlertCircle,
  X,
  LogOut,
  MessageSquare,
  Sun,
  Moon,
  Network,
  Trash2,
} from 'lucide-react';
import { Usuario } from '../../features/user/types/user.types';
import {
  fetchMiPerfil,
  fetchUsuario,
  registerOrUpdateUsuario,
  uploadAvatar,
} from '../../features/user/services/userApi';
import { getUserFacingError } from '../utils/errorMessage';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { UserSearchBox } from '../../features/user/components/UserSearchBox';
import { useTheme } from '../context/ThemeContext';
import { TuxFlowLogo } from './TuxFlowLogo';
import {
  BANNER_THEMES,
  getBannerTheme,
  getUserSavedBanner,
  saveUserBanner,
} from '../../features/user/utils/profileStyle';

interface NavbarProps {
  currentUserId: string;
  currentUsername: string;
  onProfileUpdated?: () => void;
  onLogout?: () => void;
  /**
   * Abre el perfil de una persona buscada por nombre (US-14).
   *
   * Es el mismo manejador que ya usan las sugerencias y el perfil ajeno, para que la navegación por
   * la comunidad tenga un solo camino en vez de uno por pantalla. Es opcional: sin él, el buscador
   * sigue funcionando y sólo deja de poder abrir el perfil, en vez de romper el `Navbar` entero.
   */
  onOpenPerfil?: (usuarioId: string) => void;
  onToggleChat?: () => void;
  isChatOpen?: boolean;
  onOpenGraphModal?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUserId,
  currentUsername,
  onProfileUpdated,
  onLogout,
  onOpenPerfil,
  onToggleChat,
  isChatOpen,
  onOpenGraphModal,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'edit'>('view');
  const [currentUserProfile, setCurrentUserProfile] = useState<Usuario | null>(null);

  // Edit form state
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isUploadingEditAvatar, setIsUploadingEditAvatar] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedBannerKey, setSelectedBannerKey] = useState<string>(() => {
    return getUserSavedBanner(currentUserId) || 'aurora';
  });

  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Perfil del usuario activo, CON su correo.
  //
  // El correo ya no viene de `GET /users/{userId}`: ese endpoint es la lectura pública de un perfil
  // y no puede devolver el correo de nadie, ni siquiera del propio (US-14 lo dejó de exponer). Se lee
  // de `GET /auth/me`, que exige sesión y es donde el correo debe estar: es un dato de contacto de
  // la cuenta, no del perfil.
  //
  // Si `/auth/me` falla, el perfil se degrada a lo público y el campo de correo queda vacío en vez de
  // romper el Navbar entero: perder la edición del correo es un problema, perder la sesión es otro.
  const loadProfile = useCallback(async () => {
    try {
      const data = await fetchMiPerfil();
      setCurrentUserProfile({
        id: currentUserId,
        username: currentUsername,
        nombre: data.nombre || currentUsername,
        email: data.email,
        avatarUrl: data.avatarUrl,
      });
      setEditNombre(data.nombre || currentUsername);
      setEditEmail(data.email || '');
      setEditAvatarUrl(data.avatarUrl || '');
    } catch {
      // Sin sesión válida el Navbar sigue vivo, sólo sin correo. El token ya lo limpia el
      // interceptor de `client.ts` cuando el backend responde 401.
      try {
        const publico = await fetchUsuario(currentUserId);
        setCurrentUserProfile(publico);
      } catch {
        setCurrentUserProfile({
          id: currentUserId,
          username: currentUsername,
          nombre: currentUsername,
        });
      }
      setEditNombre(currentUsername);
      setEditEmail('');
      setEditAvatarUrl('');
    }
  }, [currentUserId, currentUsername]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (isModalOpen) {
      loadProfile();
      setFeedback(null);
    }
  }, [isModalOpen, loadProfile]);

  // Handle avatar upload for edit
  const handleEditAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingEditAvatar(true);
    setFeedback(null);
    try {
      const res = await uploadAvatar(file, currentUserId);
      setEditAvatarUrl(res.avatarUrl);
      setFeedback({
        type: 'success',
        message: 'Foto de perfil actualizada correctamente.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: getUserFacingError(err, 'No pudimos subir la foto. Inténtalo de nuevo.'),
      });
    } finally {
      setIsUploadingEditAvatar(false);
    }
  };

  // Handle profile update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editNombre.trim()) {
      setFeedback({ type: 'error', message: 'El nombre no puede estar vacío.' });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const payload: Usuario = {
        id: currentUserId,
        username: currentUsername,
        nombre: editNombre.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl.trim(),
      };
      const updated = await registerOrUpdateUsuario(payload);
      setCurrentUserProfile(updated);
      saveUserBanner(currentUserId, selectedBannerKey);
      setFeedback({
        type: 'success',
        message: 'Perfil actualizado correctamente.',
      });
      onProfileUpdated?.();
      setActiveTab('view');
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: getUserFacingError(err, 'No pudimos actualizar tu perfil. Inténtalo de nuevo.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const avatarSrc = resolveMediaUrl(currentUserProfile?.avatarUrl);
  const initial = (currentUserProfile?.nombre || currentUsername || '?').charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 bg-slateDark-surface border-b border-slateDark-borderSubtle shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo TuxFlow */}
          <div className="flex items-center gap-2.5">
            <TuxFlowLogo className="w-9 h-9 rounded-xl shadow-xs" size={36} />
            <div>
              <span className="font-extrabold text-lg text-slateDark-text tracking-tight font-sans">
                Tux<span className="text-indigo-600 dark:text-indigo-400">Flow</span>
              </span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-medium text-slateDark-primaryLight bg-slateDark-surfaceSubtle border border-slateDark-borderSubtle px-2 py-0.5 rounded-md">
                Social
              </span>
            </div>
          </div>

          {/* Buscador de personas (US-14). Va junto al logo y no junto al perfil porque es una
              acción de la comunidad, no una pieza de la sesión: se usa igual desde el feed que
              desde un perfil ajeno.

              Sin `hidden` en móvil a propósito: el buscador es la mitad del circuito que US-12
              dejó a medias y en un teléfono es la única forma de llegar a alguien que no está en
              tu red. El campo es estrecho (`max-w-xs`) y el logo y las acciones se adaptan. */}
          {onOpenPerfil && (
            <div className="flex-1 max-w-xs min-w-0">
              <UserSearchBox onOpenPerfil={onOpenPerfil} />
            </div>
          )}

          {/* Acciones de Usuario */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Alternar Tema Claro / Oscuro */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
              title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              aria-label="Alternar tema claro y oscuro"
            >
              {theme === 'dark' ? (
                <Sun className="w-5 h-5 text-amber-400" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-600" />
              )}
            </button>

            {/* Explorador de Grafo Social */}
            {onOpenGraphModal && (
              <button
                type="button"
                onClick={onOpenGraphModal}
                className="p-2 rounded-lg text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer flex items-center gap-1.5"
                title="Explorar Grafo Social Interactivo"
                aria-label="Abrir explorador de grafo"
              >
                <Network className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline text-xs font-semibold text-slateDark-text">
                  Grafo
                </span>
              </button>
            )}

            {onToggleChat && (
              <button
                type="button"
                onClick={onToggleChat}
                className={`p-2 rounded-lg transition-colors cursor-pointer relative ${
                  isChatOpen
                    ? 'bg-slateDark-surfaceSubtle text-indigo-400'
                    : 'text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle'
                }`}
                title="Mensajes directos"
                aria-label="Abrir mensajes directos"
              >
                <MessageSquare className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slateDark-bg animate-pulse" />
              </button>
            )}
            <NotificationCenter currentUserId={currentUserId} />
            {/* Perfil del Usuario Activo */}
            <button
              onClick={() => {
                setActiveTab('view');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors text-left cursor-pointer border border-transparent hover:border-slateDark-borderSubtle"
              title="Ver perfil o cambiar de sesión"
            >
              <div className="relative">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={currentUsername}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slateDark-border"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slateDark-primary text-white flex items-center justify-center font-bold text-xs">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-slateDark-bg" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slateDark-text leading-tight">
                  {currentUserProfile?.nombre || currentUsername}
                </p>
                <p className="text-[11px] text-slateDark-textMuted">@{currentUsername}</p>
              </div>
            </button>

            {/* Botón de Logout */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-slateDark-textMuted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Modal de Perfil e Identidad */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slateDark-surface rounded-2xl shadow-2xl border border-slateDark-border w-full max-w-lg overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="border-b border-slateDark-borderSubtle px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slateDark-text flex items-center gap-2">
                  <User className="w-5 h-5 text-slateDark-primaryLight" />
                  Perfil de Usuario
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveTab('view');
                    setFeedback(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'view'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Mi Perfil
                </button>
                <button
                  onClick={() => {
                    setActiveTab('edit');
                    setFeedback(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'edit'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar
                </button>
              </div>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* Alerta de Feedback */}
              {feedback && (
                <div
                  role="alert"
                  className={`mb-4 p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* TAB 1: VER PERFIL */}
              {activeTab === 'view' &&
                (() => {
                  const myBannerTheme = getBannerTheme(selectedBannerKey, currentUserId);
                  return (
                    <div className="space-y-6">
                      <div className="rounded-xl overflow-hidden border border-slateDark-borderSubtle bg-slateDark-surfaceSubtle shadow-xs">
                        {/* Banner de Cabecera Estético */}
                        <div
                          className={`h-24 w-full bg-gradient-to-r ${myBannerTheme.gradient} relative overflow-hidden flex items-end justify-end p-2.5`}
                        >
                          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:12px_12px]" />
                          <span className="relative z-10 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-[10px] font-semibold text-white/95 border border-white/10 shadow-xs">
                            {myBannerTheme.nombre}
                          </span>
                        </div>

                        <div className="p-4 pt-3.5">
                          <div className="flex items-center gap-3.5 mb-3">
                            {currentUserProfile?.avatarUrl ? (
                              <img
                                src={resolveMediaUrl(currentUserProfile.avatarUrl)}
                                alt={currentUserProfile.nombre}
                                className="w-14 h-14 rounded-full object-cover ring-2 ring-slateDark-border shadow-xs shrink-0"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-full bg-slateDark-primary flex items-center justify-center text-white font-bold text-lg shadow-xs ring-2 ring-slateDark-border shrink-0">
                                {initial}
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-bold text-slateDark-text truncate">
                                {currentUserProfile?.nombre || currentUsername}
                              </h3>
                              <p className="text-xs font-medium text-slateDark-primaryLight truncate">
                                @{currentUserProfile?.username || currentUsername}
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-slateDark-textMuted mb-2">
                            {currentUserProfile?.email || 'Sin correo configurado'}
                          </p>
                          <span className="inline-block text-[11px] font-mono text-slateDark-textMuted bg-slateDark-surface border border-slateDark-borderSubtle px-2 py-0.5 rounded">
                            ID: {currentUserId}
                          </span>
                        </div>
                      </div>

                      {/* Acciones Rápidas */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveTab('edit')}
                          className="flex-1 py-2 px-3 bg-slateDark-primary hover:bg-slateDark-primaryHover text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Editar Perfil
                        </button>
                      </div>
                    </div>
                  );
                })()}

              {/* TAB 2: EDITAR PERFIL */}
              {activeTab === 'edit' && (
                <form onSubmit={handleSaveProfile} noValidate className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slateDark-textMuted mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Ej. Angel Villon"
                      className="w-full px-3 py-2 text-xs bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slateDark-textMuted mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="usuario@upse.edu.ec"
                      className="w-full px-3 py-2 text-xs bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slateDark-text placeholder:text-slateDark-textMuted/50"
                    />
                  </div>

                  {/* Foto de perfil */}
                  <div className="p-3 bg-slateDark-surfaceSubtle rounded-xl border border-slateDark-borderSubtle space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slateDark-text flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-slateDark-primaryLight" />
                        Foto de perfil
                      </label>
                      {editAvatarUrl && (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Imagen seleccionada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {editAvatarUrl ? (
                        <img
                          src={resolveMediaUrl(editAvatarUrl)}
                          alt="Avatar preview"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-slateDark-primary shrink-0"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slateDark-surface text-slateDark-textMuted flex items-center justify-center font-bold shrink-0 border border-slateDark-borderSubtle">
                          {initial}
                        </div>
                      )}

                      <div className="flex-1 flex gap-2">
                        <input
                          type="file"
                          ref={editFileInputRef}
                          onChange={handleEditAvatarFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploadingEditAvatar}
                          onClick={() => editFileInputRef.current?.click()}
                          className="flex-1 py-2 px-3 bg-slateDark-surface hover:bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg text-xs font-medium text-slateDark-text transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-slateDark-primaryLight" />
                          {isUploadingEditAvatar ? 'Subiendo...' : 'Elegir imagen'}
                        </button>
                        {editAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => setEditAvatarUrl('')}
                            title="Quitar foto de perfil"
                            className="py-2 px-2.5 bg-slateDark-surface hover:bg-rose-500/10 border border-slateDark-border hover:border-rose-500/30 rounded-lg text-xs font-medium text-slateDark-textMuted hover:text-rose-400 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Quitar</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="O pega el enlace de una imagen (opcional)"
                        className="w-full px-3 py-1.5 text-xs bg-slateDark-surface border border-slateDark-border rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slateDark-text placeholder:text-slateDark-textMuted/50 font-mono"
                      />
                    </div>
                  </div>

                  {/* Estilo de Portada / Banner */}
                  <div>
                    <label className="block text-xs font-medium text-slateDark-textMuted mb-1.5">
                      Estilo de Portada / Banner
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.values(BANNER_THEMES).map((th) => (
                        <button
                          key={th.key}
                          type="button"
                          onClick={() => setSelectedBannerKey(th.key)}
                          className={`p-2 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                            selectedBannerKey === th.key
                              ? 'border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500'
                              : 'border-slateDark-borderSubtle hover:border-slateDark-border bg-slateDark-surfaceSubtle'
                          }`}
                        >
                          <div className={`h-6 w-full rounded-md ${th.previewBg}`} />
                          <span className="text-[11px] font-medium text-slateDark-text truncate">
                            {th.nombre}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-slateDark-primary hover:bg-slateDark-primaryHover text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
