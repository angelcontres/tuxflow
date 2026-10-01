import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Edit3, UserPlus, Upload, Check, AlertCircle, X, Users, Share2, LogOut } from 'lucide-react';
import { Usuario } from '../../features/user/types/user.types';
import {
  fetchUsuario,
  fetchAllUsuarios,
  registerOrUpdateUsuario,
  uploadAvatar,
} from '../../features/user/services/userApi';
import { getUserFacingError } from '../utils/errorMessage';

interface NavbarProps {
  currentUserId: string;
  currentUsername: string;
  onUserChange?: (userId: string, username: string) => void;
  onProfileUpdated?: () => void;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUserId,
  currentUsername,
  onUserChange,
  onProfileUpdated,
  onLogout,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'view' | 'edit' | 'register'>('view');
  const [currentUserProfile, setCurrentUserProfile] = useState<Usuario | null>(null);
  const [availableUsers, setAvailableUsers] = useState<Usuario[]>([]);

  // Edit form state
  const [editNombre, setEditNombre] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isUploadingEditAvatar, setIsUploadingEditAvatar] = useState(false);

  // Register form state
  const [regId, setRegId] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regAvatarUrl, setRegAvatarUrl] = useState('');
  const [isUploadingRegAvatar, setIsUploadingRegAvatar] = useState(false);

  // Feedback state
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const editFileInputRef = useRef<HTMLInputElement>(null);
  const regFileInputRef = useRef<HTMLInputElement>(null);

  // Load current user profile
  const loadProfile = useCallback(async () => {
    try {
      const data = await fetchUsuario(currentUserId);
      setCurrentUserProfile(data);
      setEditNombre(data.nombre || '');
      setEditEmail(data.email || '');
      setEditAvatarUrl(data.avatarUrl || '');
    } catch {
      setCurrentUserProfile({
        id: currentUserId,
        username: currentUsername,
        nombre: currentUsername,
      });
      setEditNombre(currentUsername);
      setEditEmail('');
      setEditAvatarUrl('');
    }
  }, [currentUserId, currentUsername]);

  // Load all users for session switcher
  const loadAvailableUsers = useCallback(async () => {
    try {
      const users = await fetchAllUsuarios();
      if (users && users.length > 0) {
        setAvailableUsers(users);
      }
    } catch {
      // Fallback
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (isModalOpen) {
      loadProfile();
      loadAvailableUsers();
      setFeedback(null);
    }
  }, [isModalOpen, loadProfile, loadAvailableUsers]);

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

  // Handle avatar upload for register
  const handleRegAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingRegAvatar(true);
    setFeedback(null);
    try {
      const res = await uploadAvatar(file);
      setRegAvatarUrl(res.avatarUrl);
      setFeedback({
        type: 'success',
        message: 'Foto de perfil cargada correctamente.',
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: getUserFacingError(err, 'No pudimos subir la foto. Inténtalo de nuevo.'),
      });
    } finally {
      setIsUploadingRegAvatar(false);
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

  // Handle new user registration (US-01)
  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regId.trim() || !regUsername.trim() || !regNombre.trim()) {
      setFeedback({
        type: 'error',
        message: 'Los campos ID, Nombre de Usuario y Nombre Completo son requeridos.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const payload: Usuario = {
        id: regId.trim().toLowerCase().replace(/\s+/g, '-'),
        username: regUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        nombre: regNombre.trim(),
        email: regEmail.trim(),
        avatarUrl: regAvatarUrl.trim(),
      };
      await registerOrUpdateUsuario(payload);
      setFeedback({
        type: 'success',
        message: `Usuario @${payload.username} registrado correctamente.`,
      });

      onUserChange?.(payload.id, payload.username);
      setRegId('');
      setRegUsername('');
      setRegNombre('');
      setRegEmail('');
      setRegAvatarUrl('');
      setIsModalOpen(false);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: getUserFacingError(err, 'No pudimos registrar el usuario. Inténtalo de nuevo.'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectUser = (u: Usuario) => {
    onUserChange?.(u.id, u.username);
    setIsModalOpen(false);
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

          {/* Acciones de Usuario */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveTab('register');
                setIsModalOpen(true);
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Nuevo Usuario</span>
            </button>

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
                <button
                  onClick={() => {
                    setActiveTab('register');
                    setFeedback(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Registrar
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
                    <button
                      onClick={() => setActiveTab('register')}
                      className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Nuevo Usuario
                    </button>
                  </div>

                  {/* Cambiar de Sesión */}
                  <div className="pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between mb-2.5">
                      <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-slate-500" />
                        Cambiar de Sesión Activa
                      </p>
                      <span className="text-[11px] text-slate-400 font-medium">
                        {availableUsers.length} en la base
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {availableUsers.map((u) => {
                        const isCurrent = u.id === currentUserId;
                        return (
                          <button
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`p-2 rounded-lg text-left flex items-center gap-2 transition-all border cursor-pointer ${
                              isCurrent
                                ? 'bg-blue-50 border-blue-300 text-blue-900 font-semibold'
                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          >
                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
                              {u.avatarUrl ? (
                                <img
                                  src={u.avatarUrl}
                                  alt={u.username}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                u.username.charAt(0).toUpperCase()
                              )}
                            </div>
                            <div className="truncate">
                              <p className="text-xs truncate leading-tight">
                                {u.nombre || u.username}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">@{u.username}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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
                          {isUploadingEditAvatar ? 'Subiendo...' : 'Seleccionar archivo local'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="O ingresa URL directa de imagen"
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

              {/* TAB 3: REGISTRO DE NUEVO USUARIO (TUX-52 / US-01) */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegisterUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        ID Único <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regId}
                        onChange={(e) => setRegId(e.target.value)}
                        placeholder="nuevo-programador"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="dev_upse"
                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      placeholder="Programador Insano"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Correo Institucional
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="dev@upse.edu.ec"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    />
                  </div>

                  {/* Foto de perfil */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                    <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-blue-600" />
                        Foto de perfil
                      </span>
                      {regAvatarUrl && (
                        <span className="text-[10px] text-emerald-600 font-semibold">Listo</span>
                      )}
                    </label>

                    <div className="flex items-center gap-3">
                      {regAvatarUrl ? (
                        <img
                          src={regAvatarUrl}
                          alt="Preview"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-500 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold shrink-0">
                          +
                        </div>
                      )}

                      <div className="flex-1">
                        <input
                          type="file"
                          ref={regFileInputRef}
                          onChange={handleRegAvatarFileChange}
                          accept="image/*"
                          className="hidden"
                        />
                        <button
                          type="button"
                          disabled={isUploadingRegAvatar}
                          onClick={() => regFileInputRef.current?.click()}
                          className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-blue-600" />
                          {isUploadingRegAvatar ? 'Subiendo...' : 'Seleccionar archivo local'}
                        </button>
                      </div>
                    </div>

                    <input
                      type="url"
                      value={regAvatarUrl}
                      onChange={(e) => setRegAvatarUrl(e.target.value)}
                      placeholder="O ingresa URL: https://images.unsplash.com/..."
                      className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-slate-700"
                    />
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
                      <UserPlus className="w-3.5 h-3.5" />
                      {isSubmitting ? 'Registrando...' : 'Registrar usuario'}
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
