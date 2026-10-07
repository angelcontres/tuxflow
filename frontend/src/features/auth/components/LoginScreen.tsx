import React, { useState } from 'react';
import {
  LogIn,
  UserPlus,
  AlertCircle,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Sun,
  Moon,
} from 'lucide-react';
import { loginUser, registerUser } from '../services/authApi';
import { getUserFacingError } from '../../../shared/utils/errorMessage';
import { useTheme } from '../../../shared/context/ThemeContext';
import { TuxFlowLogo } from '../../../shared/components/TuxFlowLogo';

interface LoginScreenProps {
  onLogin: (userId: string, username: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin }) => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<'login' | 'register'>('login');
  const [error, setError] = useState<string | null>(null);
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
      setError(
        getUserFacingError(err, 'Credenciales inválidas. Verifica tu usuario y contraseña.'),
      );
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

    try {
      const user = await registerUser({
        nombre: regNombre.trim(),
        username: regUsername.trim().toLowerCase().replace(/\s+/g, '_'),
        password: regPassword,
      });

      // El registro ya devuelve un token, así que se entra directo sin
      // obligar a escribir la contraseña otra vez.
      onLogin(user.id, user.username);
    } catch (err) {
      setError(getUserFacingError(err, 'No pudimos crear la cuenta. Inténtalo de nuevo.'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchView = (newView: 'login' | 'register') => {
    setView(newView);
    setError(null);
  };

  return (
    <div className="relative min-h-screen bg-slateDark-bg flex flex-col items-center justify-center p-4">
      {/* Botón flotante para alternar Tema */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slateDark-surface border border-slateDark-border text-slateDark-textMuted hover:text-slateDark-text hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer shadow-xs flex items-center gap-2 text-xs font-medium"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label="Alternar tema claro y oscuro"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
          <span className="hidden sm:inline">
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </span>
        </button>
      </div>

      <div className="w-full max-w-4xl flex flex-col lg:flex-row items-center gap-8">
        {/* Lado izquierdo - Branding */}
        <div className="flex-1 text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3.5 mb-4">
            <TuxFlowLogo className="w-14 h-14 rounded-2xl shadow-md" size={56} />
            <h1 className="text-5xl font-extrabold text-slateDark-text tracking-tight font-sans">
              Tux<span className="text-indigo-600 dark:text-indigo-400">Flow</span>
            </h1>
          </div>
          <p className="text-xl text-slateDark-textMuted leading-relaxed max-w-lg">
            Conecta, comparte y fluye en la red social distribuida de código abierto.
          </p>
        </div>

        {/* Lado derecho - Formulario */}
        <div className="w-full max-w-md">
          <div className="bg-slateDark-surface rounded-2xl shadow-2xl border border-slateDark-border overflow-hidden">
            {view === 'login' ? (
              <>
                {/* LOGIN */}
                <div className="p-6 space-y-4">
                  {error && (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center gap-2.5 text-xs font-medium text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleLogin} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateDark-textMuted" />
                      <input
                        type="text"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Correo electrónico o usuario"
                        className="w-full pl-9 pr-3 py-2.5 text-sm bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateDark-textMuted" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full pl-9 pr-9 py-2.5 text-sm bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slateDark-textMuted hover:text-slateDark-text cursor-pointer"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-slateDark-primary hover:bg-slateDark-primaryHover disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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
                      <div className="w-full border-t border-slateDark-borderSubtle" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-slateDark-surface px-2 text-slateDark-textMuted">o</span>
                    </div>
                  </div>

                  <button
                    onClick={() => switchView('register')}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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
                    <h2 className="text-lg font-bold text-slateDark-text">Crear Cuenta Nueva</h2>
                    <p className="text-xs text-slateDark-textMuted">
                      Regístrate para unirte a TuxFlow
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-800/60 flex items-center gap-2.5 text-xs font-medium text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-3">
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateDark-textMuted" />
                      <input
                        type="text"
                        value={regNombre}
                        onChange={(e) => setRegNombre(e.target.value)}
                        placeholder="Nombre completo"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      />
                    </div>

                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateDark-textMuted" />
                      <input
                        type="text"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value)}
                        placeholder="Nombre de usuario"
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slateDark-textMuted" />
                      <input
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Contraseña"
                        className="w-full pl-9 pr-9 py-2 text-xs bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slateDark-text placeholder:text-slateDark-textMuted/50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slateDark-textMuted hover:text-slateDark-text cursor-pointer"
                      >
                        {showRegPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
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
                      <div className="w-full border-t border-slateDark-borderSubtle" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-slateDark-surface px-2 text-slateDark-textMuted">o</span>
                    </div>
                  </div>

                  <button
                    onClick={() => switchView('login')}
                    className="w-full py-2.5 px-4 bg-slateDark-surfaceSubtle hover:bg-slateDark-borderSubtle border border-slateDark-borderSubtle text-slateDark-text rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    Ya tengo cuenta
                  </button>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slateDark-textMuted/60 mt-4">
            TuxFlow · Red Social Distribuida
          </p>
        </div>
      </div>
    </div>
  );
};
