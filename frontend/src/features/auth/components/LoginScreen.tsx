import React, { useState } from 'react';
import { LogIn, UserPlus, AlertCircle, Check, Eye, EyeOff, Mail, Lock, User } from 'lucide-react';
import { loginUser, registerUser } from '../services/authApi';

interface LoginScreenProps {
  onLogin: (userId: string, username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const [view, setView] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register form
  const [regNombre, setRegNombre] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const user = await loginUser(loginEmail.trim(), loginPassword);
      onLogin(user.id, user.username);
    } catch (err) {
      setError('Credenciales inválidas. Verifica tu email/usuario y contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre.trim() || !regUsername.trim() || !regPassword.trim()) {
      setError('Por favor, completa todos los campos');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await registerUser({
        nombre: regNombre.trim(),
        username: regUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        password: regPassword,
      });

      setSuccess('Cuenta creada exitosamente. Ahora puedes iniciar sesión.');

      // Limpiar formulario
      setRegNombre('');
      setRegUsername('');
      setRegPassword('');

      // Cambiar a login después de 2 segundos
      setTimeout(() => {
        setView('login');
        setSuccess(null);
      }, 2000);
    } catch (err) {
      setError('Error al crear la cuenta. El usuario ya existe o hay un problema de conexión.');
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (newView: 'login' | 'register') => {
    setView(newView);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-8">
        {/* Lado izquierdo - Branding */}
        <div className="flex-1 text-center lg:text-left">
          <h1 className="text-5xl font-bold text-blue-600 mb-4">Red Social</h1>
          <p className="text-xl text-slate-600 leading-relaxed">
            Conecta con amigos, comparte momentos y descubre tu red social distribuida con Neo4j y MinIO.
          </p>
        </div>

        {/* Lado derecho - Formulario */}
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {view === 'login' ? (
              <>
                {/* LOGIN */}
                <div className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs font-medium text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Correo electrónico o usuario"
                        className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full pl-9 pr-9 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          Iniciando sesión...
                        </>
                      ) : (
                        <>
                          <LogIn className="w-4 h-4" />
                          Iniciar Sesión
                        </>
                      )}
                    </button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-slate-500">o</span>
                    </div>
                  </div>

                  <button
                    onClick={() => switchView('register')}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    Crear Cuenta Nueva
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* REGISTRO */}
                <div className="p-6 space-y-4">
                  <div className="text-center mb-2">
                    <h2 className="text-lg font-bold text-slate-900">Crear Cuenta Nueva</h2>
                    <p className="text-xs text-slate-500">Regístrate para unirte a la red social</p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs font-medium text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {success && (
                    <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs font-medium text-emerald-800">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{success}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={regNombre}
                        onChange={(e) => setRegNombre(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>

                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Nombre de usuario"
                        className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full pl-9 pr-9 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                          Registrando...
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-4 h-4" />
                          Registrarse
                        </>
                      )}
                    </button>
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-2 text-slate-500">o</span>
                    </div>
                  </div>

                  <button
                    onClick={() => switchView('login')}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    Ya tengo cuenta
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-4">
            Red Social Distribuida • Neo4j & MinIO S3
          </p>
        </div>
      </div>
    </div>
  );
};
