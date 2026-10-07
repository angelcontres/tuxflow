import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Edit3, Upload, Check, AlertCircle, X, Share2, LogOut } from 'lucide-react';
import { Usuario } from '../../features/user/types/user.types';
import {
  fetchMiPerfil,
  fetchUsuario,
  registerOrUpdateUsuario,
  uploadAvatar,
} from '../../features/user/services/userApi';
import { getUserFacingError } from '../utils/errorMessage';
import { NotificationCenter } from '../../features/notifications/components/NotificationCenter';
import { UserSearchBox } from '../../features/user/components/UserSearchBox';

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
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUserId,
  currentUsername,
  onProfileUpdated,
  onLogout,
  onOpenPerfil,
}) => {
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

  const avatarSrc = currentUserProfile?.avatarUrl || '';
  const initial = (currentUserProfile?.nombre || currentUsername || '?').charAt(0).toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo Simple y Base */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">Red Social</span>
              <span className="hidden sm:inline-block ml-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                UPSE
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
          <div className="flex items-center gap-3">
            <NotificationCenter currentUserId={currentUserId} />
            {/* Perfil del Usuario Activo */}
            <button
              onClick={() => {
                setActiveTab('view');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2.5 p-1 sm:px-2.5 sm:py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-left cursor-pointer border border-transparent hover:border-slate-200"
              title="Ver perfil o cambiar de sesión"
            >
              <div className="relative">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={currentUsername}
                    className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentUserProfile?.nombre || currentUsername}
                </p>
                <p className="text-[11px] text-slate-500">@{currentUsername}</p>
              </div>
            </button>

            {/* Botón de Logout */}
            {onLogout && (
              <button
                onClick={onLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            {/* Cabecera del Modal */}
            <div className="border-b border-slate-200 px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Perfil de Usuario
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'view'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
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
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'edit'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
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
                  className={`mb-4 p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium ${
                    feedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* TAB 1: VER PERFIL */}
              {activeTab === 'view' && (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                    {currentUserProfile?.avatarUrl ? (
                      <img
                        src={currentUserProfile.avatarUrl}
                        alt={currentUserProfile.nombre}
                        className="w-16 h-16 rounded-full object-cover ring-2 ring-blue-500 shadow-xs"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-xs">
                        {initial}
                      </div>
                    )}

                    <div className="flex-1">
                      <h3 className="text-base font-bold text-slate-900">
                        {currentUserProfile?.nombre || currentUsername}
                      </h3>
                      <p className="text-xs font-medium text-blue-600">
                        @{currentUserProfile?.username || currentUsername}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {currentUserProfile?.email || 'Sin correo configurado'}
                      </p>
                      <span className="mt-1.5 inline-block text-[11px] font-mono text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded">
                        ID: {currentUserId}
                      </span>
                    </div>
                  </div>

                  {/* Acciones Rápidas */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('edit')}
                      className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Editar Perfil
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 2: EDITAR PERFIL */}
              {activeTab === 'edit' && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Ej. Angel Villon"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="usuario@upse.edu.ec"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                    />
                  </div>

                  {/* Foto de perfil */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        Foto de perfil
                      </label>
                      {editAvatarUrl && (
                        <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Imagen cargada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {editAvatarUrl ? (
                        <img
                          src={editAvatarUrl}
                          alt="Avatar preview"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-bold shrink-0">
                          {initial}
                        </div>
                      )}

                      <div className="flex-1">
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
                          className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          {isUploadingEditAvatar ? 'Subiendo...' : 'Elegir imagen'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="O pega el enlace de una imagen"
                        className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
