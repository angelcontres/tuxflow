import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Share2,
  Bell,
  MessageSquare,
  Compass,
  User,
  Edit3,
  UserPlus,
  Upload,
  Check,
  AlertCircle,
  X,
  Users,
} from 'lucide-react';
import { Usuario } from '../../features/user/types/user.types';
import {
  fetchUsuario,
  fetchAllUsuarios,
  registerOrUpdateUsuario,
  uploadAvatar,
} from '../../features/user/services/userApi';

interface NavbarProps {
  currentUserId: string;
  currentUsername: string;
  onUserChange?: (userId: string, username: string) => void;
  onProfileUpdated?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUserId,
  currentUsername,
  onUserChange,
  onProfileUpdated,
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
    null
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
      // If user profile is not in Neo4j yet or fails, fallback to basic info
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
        message: '¡Avatar subido exitosamente a MinIO S3!',
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al subir imagen a MinIO';
      setFeedback({ type: 'error', message: errorMsg });
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
        message: '¡Avatar subido exitosamente a MinIO S3!',
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al subir imagen a MinIO';
      setFeedback({ type: 'error', message: errorMsg });
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
      setFeedback({ type: 'success', message: 'Perfil actualizado exitosamente en el grafo Neo4j.' });
      onProfileUpdated?.();
      setActiveTab('view');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al actualizar perfil';
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle new user registration
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
        message: `¡Usuario @${payload.username} registrado exitosamente en el grafo!`,
      });

      // Switch to newly created user
      onUserChange?.(payload.id, payload.username);
      setRegId('');
      setRegUsername('');
      setRegNombre('');
      setRegEmail('');
      setRegAvatarUrl('');
      setIsModalOpen(false);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al registrar usuario';
      setFeedback({ type: 'error', message: errorMsg });
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
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/80 transition-all">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center shadow-md shadow-sky-500/20 text-white font-black text-xl">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                Red Distribuida
              </span>
              <div className="flex items-center gap-1.5 -mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-400">
                  Neo4j • Quarkus • MinIO
                </span>
              </div>
            </div>
          </div>

          {/* Action icons & User profile button */}
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              title="Explorar red"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <Compass className="w-5 h-5" />
            </button>
            <button
              title="Notificaciones"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-sky-500 rounded-full" />
            </button>
            <button
              title="Mensajes"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <MessageSquare className="w-5 h-5" />
            </button>

            <div className="h-6 w-[1px] bg-slate-200 hidden sm:block" />

            {/* Clickable User Badge (triggers profile modal) */}
            <button
              onClick={() => {
                setActiveTab('view');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2.5 pl-1 py-1 pr-2 rounded-full hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 group text-left"
              title="Ver o editar perfil de usuario"
            >
              <div className="relative">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={currentUsername}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-sky-500/30 group-hover:ring-sky-500 transition-all"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-white">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              </div>
              <div className="hidden sm:block">
                <p className="text-xs font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">
                  @{currentUsername}
                </p>
                <p className="text-[10px] text-emerald-600 font-medium">Mi Perfil</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Profile & Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scale-up">
            {/* Header with Tabs */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <User className="w-5 h-5 text-sky-600" />
                  Perfil e Identidad Social
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveTab('view');
                    setFeedback(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'view'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  Ver Perfil
                </button>
                <button
                  onClick={() => {
                    setActiveTab('edit');
                    setFeedback(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'edit'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Editar Perfil
                </button>
                <button
                  onClick={() => {
                    setActiveTab('register');
                    setFeedback(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    activeTab === 'register'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-200/60'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Nuevo Registro
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* Feedback Alert */}
              {feedback && (
                <div
                  className={`mb-4 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium ${
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

              {/* TAB 1: VIEW PROFILE */}
              {activeTab === 'view' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-gradient-to-br from-slate-50 to-sky-50/30 rounded-2xl border border-slate-100">
                    <div className="relative">
                      {currentUserProfile?.avatarUrl ? (
                        <img
                          src={currentUserProfile.avatarUrl}
                          alt={currentUserProfile.nombre}
                          className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white shadow-md"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md ring-4 ring-white">
                          {initial}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full shadow-sm">
                        Activo
                      </span>
                    </div>

                    <div className="text-center sm:text-left flex-1">
                      <h3 className="text-lg font-black text-slate-900">
                        {currentUserProfile?.nombre || currentUsername}
                      </h3>
                      <p className="text-sm font-semibold text-sky-600">
                        @{currentUserProfile?.username || currentUsername}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {currentUserProfile?.email || 'Sin correo configurado'}
                      </p>
                      <div className="mt-2 text-[11px] font-mono bg-white/80 border border-slate-200/80 px-2 py-0.5 rounded-md inline-block text-slate-600">
                        ID: {currentUserId}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('edit')}
                      className="flex-1 py-2.5 px-4 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar Datos y Avatar
                    </button>
                    <button
                      onClick={() => setActiveTab('register')}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                    >
                      <UserPlus className="w-4 h-4" />
                      Registrar Otro
                    </button>
                  </div>

                  {/* Switch user section */}
                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" />
                        Cambiar de Sesión Activa
                      </p>
                      <span className="text-[11px] text-slate-500">
                        {availableUsers.length} usuarios en grafo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {availableUsers.map((u) => {
                        const isCurrent = u.id === currentUserId;
                        return (
                          <button
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`p-2 rounded-xl text-left flex items-center gap-2.5 transition-all border ${
                              isCurrent
                                ? 'bg-sky-50 border-sky-300 text-sky-900 font-bold'
                                : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden">
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
                              <p className="text-xs font-semibold truncate leading-tight">
                                {u.nombre || u.username}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">@{u.username}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EDIT PROFILE */}
              {activeTab === 'edit' && (
                <form onSubmit={handleSaveProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Ej. Angel Villon"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="usuario@upse.edu.ec"
                      className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium text-slate-900"
                    />
                  </div>

                  {/* Avatar Upload with MinIO */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-sky-600" />
                        Avatar en MinIO S3
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
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-sky-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 font-bold shrink-0">
                          {initial}
                        </div>
                      )}

                      <div className="flex-1 space-y-1">
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
                          className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-sky-600" />
                          {isUploadingEditAvatar
                            ? 'Subiendo a MinIO...'
                            : 'Seleccionar Imagen desde Disco'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 block mb-1">
                        O pega una URL directa de imagen:
                      </span>
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="http://localhost:9000/redsocial-media/..."
                        className="w-full px-3 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500 text-slate-600 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      {isSubmitting ? 'Guardando...' : 'Guardar Cambios en Neo4j'}
                    </button>
                  </div>
                </form>
              )}

              {/* TAB 3: REGISTER NEW USER */}
              {activeTab === 'register' && (
                <form onSubmit={handleRegisterUser} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        ID Único <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regId}
                        onChange={(e) => setRegId(e.target.value)}
                        placeholder="nuevo-programador"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Username <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="dev_upse"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900 font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nombre Completo <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      placeholder="Programador Insano"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Correo Institucional
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="dev@upse.edu.ec"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-slate-900"
                    />
                  </div>

                  {/* Avatar upload to MinIO */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                    <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-indigo-600" />
                        Subir Avatar a MinIO
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
                          className="w-12 h-12 rounded-xl object-cover ring-2 ring-indigo-500/30 shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-400 font-bold shrink-0">
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
                          className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <Upload className="w-3.5 h-3.5 text-indigo-600" />
                          {isUploadingRegAvatar ? 'Subiendo...' : 'Subir Archivo de Imagen'}
                        </button>
                      </div>
                    </div>

                    <input
                      type="url"
                      value={regAvatarUrl}
                      onChange={(e) => setRegAvatarUrl(e.target.value)}
                      placeholder="O pega URL: https://images.unsplash.com/..."
                      className="w-full px-3 py-1.5 text-[11px] bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-600 font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      <UserPlus className="w-4 h-4" />
                      {isSubmitting ? 'Registrando...' : 'Registrar en Grafo Social (POST /api/users)'}
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
