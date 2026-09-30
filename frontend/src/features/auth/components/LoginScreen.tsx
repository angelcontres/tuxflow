import React, { useState, useEffect } from 'react';
import { LogIn, User, Users, AlertCircle } from 'lucide-react';
import { fetchAllUsuarios } from '../../user/services/userApi';
import { Usuario } from '../../user/types/user.types';

interface LoginScreenProps {
  onLogin: (userId: string, username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [users, setUsers] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAllUsuarios();
      setUsers(data);
      if (data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      setError('No se pudieron cargar los usuarios. ¿Está el backend corriendo?');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    const selected = users.find((u) => u.id === selectedUserId);
    if (selected) {
      onLogin(selected.id, selected.username);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 w-full max-w-md text-center">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-600 font-medium">Cargando usuarios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 px-6 py-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/20 text-white flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white">Red Social Distribuida</h1>
          <p className="text-blue-100 text-sm mt-1">Neo4j & MinIO S3</p>
        </div>

        {/* Formulario */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs font-medium text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              Selecciona tu usuario
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 appearance-none bg-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre || u.username} (@{u.username})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={!selectedUserId}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            Iniciar Sesión
          </button>

          <div className="text-center">
            <p className="text-[11px] text-slate-400">
              {users.length} usuarios registrados en el grafo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
