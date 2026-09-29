import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  MessageSquare,
  User,
  Edit3,
  UserPlus,
  Upload,
  Check,
  AlertCircle,
  X,
  Users,
  Search,
  Plus,
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
      {/* Barra de Navegación Superior Estilo TikTok */}
      <header className="sticky top-0 z-50 bg-[#010101]/95 backdrop-blur-md border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo TikTok / FrutaTok con Efecto Cromático Neón */}
          <div className="flex items-center gap-2.5 cursor-pointer shrink-0">
            <div className="w-9 h-9 rounded-xl bg-black border border-white/20 flex items-center justify-center shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#25F4EE]/20 to-[#FE2C55]/20 group-hover:opacity-100 transition-opacity" />
              <span className="text-xl relative z-10 select-none">🍉</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="font-black text-2xl tracking-tighter text-white">
                Fruta<span className="text-[#FE2C55]">Tok</span>
              </span>
              <span className="text-[10px] font-extrabold text-[#25F4EE] tracking-widest uppercase bg-[#25F4EE]/10 px-1.5 py-0.5 rounded border border-[#25F4EE]/30">
                SHOP
              </span>
            </div>
          </div>

          {/* Barra de Búsqueda FrutaTok Píldora */}
          <div className="hidden md:flex items-center flex-1 max-w-md bg-[#2f313f]/60 hover:bg-[#2f313f]/80 transition-colors border border-transparent focus-within:border-white/20 rounded-full px-4 py-2 text-xs">
            <input
              type="text"
              placeholder="Buscar mangos, frutillas, aguacates, huertos o cosechas..."
              className="w-full bg-transparent text-white placeholder-neutral-400 focus:outline-none text-xs"
            />
            <div className="h-4 w-[1px] bg-white/10 mx-2" />
            <Search className="w-4 h-4 text-neutral-400 shrink-0 cursor-pointer hover:text-white" />
          </div>

          {/* Botones de Acción Estilo TikTok (+ Vender Fruta, Mensajes, Notificaciones, Perfil) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botón "+ Vender Fruta" de FrutaTok */}
            <button
              onClick={() => {
                setActiveTab('register');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-sm bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold text-xs transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4 text-[#25F4EE]" />
              <span className="hidden sm:inline">+ Vender Fruta</span>
            </button>

            {/* Mensajes / Pedidos */}
            <button
              title="Mensajes y pedidos"
              className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors relative"
            >
              <MessageSquare className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FE2C55] rounded-full" />
            </button>

            {/* Notificaciones */}
            <button
              title="Notificaciones de ofertas"
              className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors relative"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#25F4EE] rounded-full" />
            </button>

            <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />

            {/* Avatar del Usuario Activo */}
            <button
              onClick={() => {
                setActiveTab('view');
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 p-1 rounded-full hover:bg-white/10 transition-all border border-transparent hover:border-white/15 text-left cursor-pointer"
              title="Ver perfil y cambiar de usuario en Neo4j"
            >
              <div className="relative">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={currentUsername}
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-[#FE2C55] transition-all"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex items-center justify-center text-white font-black text-xs shadow-md ring-2 ring-white/20">
                    {initial}
                  </div>
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#25F4EE] ring-2 ring-black" />
              </div>
              <div className="hidden lg:block pr-1">
                <p className="text-xs font-bold text-white leading-tight">@{currentUsername}</p>
                <p className="text-[10px] text-[#25F4EE] font-semibold">En línea</p>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Modal de Perfil e Identidad Social (Tema Oscuro TikTok) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#161823] rounded-3xl shadow-2xl border border-white/15 w-full max-w-lg overflow-hidden animate-scale-up text-white">
            {/* Header con Pestañas */}
            <div className="bg-black/60 border-b border-white/10 px-6 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-[#FE2C55]" />
                  Perfil e Identidad Social
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1.5 rounded-xl text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tabs de Navegación */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveTab('view');
                    setFeedback(null);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'view'
                      ? 'bg-[#FE2C55] text-white shadow-md shadow-[#FE2C55]/30'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'edit'
                      ? 'bg-[#FE2C55] text-white shadow-md shadow-[#FE2C55]/30'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
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
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'register'
                      ? 'bg-[#25F4EE] text-black shadow-md shadow-[#25F4EE]/30'
                      : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Nuevo Registro
                </button>
              </div>
            </div>

            {/* Cuerpo del Modal */}
            <div className="p-6 max-h-[75vh] overflow-y-auto">
              {/* Alerta de Feedback */}
              {feedback && (
                <div
                  className={`mb-4 p-3.5 rounded-2xl flex items-center gap-2.5 text-xs font-medium ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/40'
                      : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* TAB 1: VIEW PROFILE */}
              {activeTab === 'view' && (
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-black/40 rounded-2xl border border-white/10">
                    <div className="relative">
                      {currentUserProfile?.avatarUrl ? (
                        <img
                          src={currentUserProfile.avatarUrl}
                          alt={currentUserProfile.nombre}
                          className="w-20 h-20 rounded-full object-cover ring-4 ring-[#FE2C55] shadow-xl"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex items-center justify-center text-white font-black text-2xl shadow-xl ring-4 ring-white/20">
                          {initial}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 px-2 py-0.5 bg-[#25F4EE] text-black text-[10px] font-black rounded-full shadow-md">
                        ACTIVO
                      </span>
                    </div>

                    <div className="text-center sm:text-left flex-1">
                      <h3 className="text-lg font-black text-white">
                        {currentUserProfile?.nombre || currentUsername}
                      </h3>
                      <p className="text-sm font-bold text-[#FE2C55]">
                        @{currentUserProfile?.username || currentUsername}
                      </p>
                      <p className="text-xs text-neutral-400 mt-1">
                        {currentUserProfile?.email || 'Sin correo configurado'}
                      </p>
                      <div className="mt-2 text-[11px] font-mono bg-white/5 border border-white/10 px-2.5 py-0.5 rounded-md inline-block text-neutral-300">
                        ID: {currentUserId}
                      </div>
                    </div>
                  </div>

                  {/* Botones de Acción */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setActiveTab('edit')}
                      className="flex-1 py-2.5 px-4 bg-[#FE2C55] hover:bg-[#e0264b] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FE2C55]/20 cursor-pointer active:scale-95"
                    >
                      <Edit3 className="w-4 h-4" />
                      Editar Datos y Avatar
                    </button>
                    <button
                      onClick={() => setActiveTab('register')}
                      className="py-2.5 px-4 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-[#25F4EE]" />
                      Registrar Otro
                    </button>
                  </div>

                  {/* Selector de Sesión de Usuario en Neo4j */}
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-[#25F4EE]" />
                        Cambiar de Sesión Activa
                      </p>
                      <span className="text-[11px] text-neutral-400 font-mono">
                        {availableUsers.length} en grafo
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {availableUsers.map((u) => {
                        const isCurrent = u.id === currentUserId;
                        return (
                          <button
                            key={u.id}
                            onClick={() => handleSelectUser(u)}
                            className={`p-2 rounded-xl text-left flex items-center gap-2.5 transition-all border cursor-pointer ${
                              isCurrent
                                ? 'bg-[#FE2C55]/20 border-[#FE2C55] text-white font-bold'
                                : 'bg-black/30 hover:bg-white/5 border-white/10 text-neutral-300'
                            }`}
                          >
                            <div className="w-7 h-7 rounded-full bg-neutral-800 flex items-center justify-center text-xs font-bold shrink-0 overflow-hidden ring-1 ring-white/10">
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
                              <p className="text-[10px] text-neutral-400 truncate">@{u.username}</p>
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
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={editNombre}
                      onChange={(e) => setEditNombre(e.target.value)}
                      placeholder="Ej. Angel Villon"
                      className="w-full px-3.5 py-2.5 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#FE2C55] text-white font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="usuario@upse.edu.ec"
                      className="w-full px-3.5 py-2.5 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#FE2C55] text-white font-medium"
                    />
                  </div>

                  {/* Subida de Avatar a MinIO */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#25F4EE]" />
                        Avatar en MinIO S3
                      </label>
                      {editAvatarUrl && (
                        <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                          <Check className="w-3 h-3" /> Imagen cargada
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {editAvatarUrl ? (
                        <img
                          src={editAvatarUrl}
                          alt="Avatar preview"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-[#FE2C55] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-white font-bold shrink-0">
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
                          className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#25F4EE]" />
                          {isUploadingEditAvatar
                            ? 'Subiendo a MinIO...'
                            : 'Seleccionar Imagen desde Disco'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] text-neutral-400 block mb-1">
                        O pega una URL directa de imagen:
                      </span>
                      <input
                        type="url"
                        value={editAvatarUrl}
                        onChange={(e) => setEditAvatarUrl(e.target.value)}
                        placeholder="http://localhost:9000/redsocial-media/..."
                        className="w-full px-3 py-1.5 text-[11px] bg-black/60 border border-white/10 rounded-lg focus:outline-none focus:border-[#25F4EE] text-neutral-300 font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-[#FE2C55] hover:bg-[#e0264b] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#FE2C55]/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
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
                      <label className="block text-xs font-bold text-neutral-300 mb-1">
                        ID Único <span className="text-[#FE2C55]">*</span>
                      </label>
                      <input
                        type="text"
                        value={regId}
                        onChange={(e) => setRegId(e.target.value)}
                        placeholder="nuevo-programador"
                        className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#25F4EE] text-white font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-300 mb-1">
                        Username <span className="text-[#FE2C55]">*</span>
                      </label>
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="dev_upse"
                        className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#25F4EE] text-white font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Nombre Completo <span className="text-[#FE2C55]">*</span>
                    </label>
                    <input
                      type="text"
                      value={regNombre}
                      onChange={(e) => setRegNombre(e.target.value)}
                      placeholder="Programador Insano"
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#FE2C55] text-white"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-neutral-300 mb-1">
                      Correo Institucional
                    </label>
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="dev@upse.edu.ec"
                      className="w-full px-3 py-2 text-xs bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:border-[#FE2C55] text-white"
                    />
                  </div>

                  {/* Avatar upload a MinIO */}
                  <div className="p-4 bg-black/40 rounded-2xl border border-white/10 space-y-3">
                    <label className="text-xs font-bold text-neutral-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-[#25F4EE]" />
                        Subir Avatar a MinIO
                      </span>
                      {regAvatarUrl && (
                        <span className="text-[10px] text-emerald-400 font-semibold">Listo</span>
                      )}
                    </label>

                    <div className="flex items-center gap-3">
                      {regAvatarUrl ? (
                        <img
                          src={regAvatarUrl}
                          alt="Preview"
                          className="w-12 h-12 rounded-full object-cover ring-2 ring-[#FE2C55] shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 font-bold shrink-0">
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
                          className="w-full py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-xl text-xs font-bold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5 text-[#25F4EE]" />
                          {isUploadingRegAvatar ? 'Subiendo...' : 'Subir Archivo de Imagen'}
                        </button>
                      </div>
                    </div>

                    <input
                      type="url"
                      value={regAvatarUrl}
                      onChange={(e) => setRegAvatarUrl(e.target.value)}
                      placeholder="O pega URL: https://images.unsplash.com/..."
                      className="w-full px-3 py-1.5 text-[11px] bg-black/60 border border-white/10 rounded-lg focus:outline-none focus:border-[#25F4EE] text-neutral-300 font-mono"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('view')}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-neutral-400 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-5 py-2.5 bg-[#FE2C55] hover:bg-[#e0264b] text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-[#FE2C55]/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
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
