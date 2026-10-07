import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, X, Check, AlertCircle, Link2, Palette, Sparkles } from 'lucide-react';
import { submitPost } from '../services/feedApi';
import { uploadAvatar } from '../../user/services/userApi';
import { getUserFacingError } from '../../../shared/utils/errorMessage';
import { THEME_LIST, getPostCardTheme } from '../utils/postThemes';

interface CreatePostFormProps {
  currentUserId: string;
  currentUsername: string;
  onPostCreated: () => void;
}

export const CreatePostForm: React.FC<CreatePostFormProps> = ({
  currentUserId,
  currentUsername,
  onPostCreated,
}) => {
  const [texto, setTexto] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [selectedCardTheme, setSelectedCardTheme] = useState<string | null>(null);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const removeMedia = () => {
    setMediaUrl('');
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const res = await uploadAvatar(file);
      setMediaUrl(res.avatarUrl);
      setSelectedCardTheme(null);
      setShowUrlInput(false);
    } catch (err) {
      showFeedback(
        'error',
        getUserFacingError(err, 'No pudimos subir la imagen. Inténtalo de nuevo.'),
      );
    } finally {
      setUploadingMedia(false);
      // Permite volver a seleccionar el mismo archivo
      e.target.value = '';
    }
  };

  const handleApplyUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    setMediaUrl(trimmed);
    setSelectedCardTheme(null);
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    setSubmitting(true);
    try {
      const finalMediaUrl = mediaUrl.trim()
        ? mediaUrl.trim()
        : selectedCardTheme
          ? `theme:${selectedCardTheme}`
          : undefined;

      await submitPost({
        autorId: currentUserId,
        autorUsername: currentUsername,
        texto,
        mediaUrl: finalMediaUrl,
      });
      setTexto('');
      removeMedia();
      setSelectedCardTheme(null);
      showFeedback('success', 'Publicación creada exitosamente');
      onPostCreated();
    } catch (err) {
      showFeedback('error', getUserFacingError(err, 'No pudimos publicar. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slateDark-surface rounded-xl p-4 sm:p-5 shadow-xs border border-slateDark-borderSubtle mb-6 relative">
      {/* Toast de Feedback */}
      {feedback && (
        <div
          className={`absolute top-2 right-2 left-2 z-10 p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
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

      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-slateDark-primary text-white flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-xs ring-1 ring-slateDark-border">
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Qué estás pensando hoy?"
              rows={3}
              className={`w-full rounded-xl p-3 text-sm transition-all resize-none focus:outline-none ${
                selectedCardTheme && !mediaUrl
                  ? `${getPostCardTheme(selectedCardTheme).gradientClass} placeholder-white/70 focus:ring-2 focus:ring-white/40 shadow-inner min-h-[100px] text-center font-medium`
                  : 'bg-slateDark-surfaceSubtle border border-slateDark-borderSubtle text-slateDark-text placeholder-slateDark-textMuted/60 focus:ring-2 focus:ring-indigo-500 focus:bg-slateDark-surfaceSubtle'
              }`}
            />
          </div>
        </div>

        {/* Selector de Fondo Estético */}
        {showThemePicker && !mediaUrl && (
          <div className="mt-3 p-2.5 rounded-xl bg-slateDark-surfaceSubtle border border-slateDark-borderSubtle flex items-center gap-2 flex-wrap animate-in fade-in duration-200">
            <span className="text-[11px] font-medium text-slateDark-textMuted flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              Estilo:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCardTheme(null)}
              className={`text-[11px] px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                !selectedCardTheme
                  ? 'bg-slate-700 text-white border-slate-600 font-semibold'
                  : 'border-slateDark-borderSubtle text-slateDark-textMuted hover:text-slateDark-text'
              }`}
            >
              Normal
            </button>
            {THEME_LIST.map((th) => (
              <button
                key={th.key}
                type="button"
                onClick={() => {
                  setSelectedCardTheme(selectedCardTheme === th.key ? null : th.key);
                }}
                className={`text-[11px] px-2.5 py-1 rounded-full text-white font-medium transition-all cursor-pointer flex items-center gap-1.5 ${th.chipClass} ${
                  selectedCardTheme === th.key
                    ? 'ring-2 ring-white scale-105 shadow-sm'
                    : 'opacity-80 hover:opacity-100'
                }`}
              >
                <span>{th.nombre}</span>
                {selectedCardTheme === th.key && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        )}

        {/* Vista previa de la imagen adjunta */}
        {mediaUrl && (
          <div className="mt-3 relative rounded-xl overflow-hidden border border-slateDark-borderSubtle bg-slateDark-surfaceSubtle">
            <img
              src={mediaUrl}
              alt="Vista previa de la imagen adjunta"
              className="w-full max-h-72 object-cover"
            />
            <button
              type="button"
              onClick={removeMedia}
              aria-label="Quitar imagen"
              className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/85 text-white rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alternativa: usar el enlace de una imagen */}
        {showUrlInput && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApplyUrl();
                }
              }}
              placeholder="https://ejemplo.com/imagen.jpg"
              className="flex-1 bg-slateDark-surfaceSubtle border border-slateDark-border rounded-lg px-3 py-2 text-xs text-slateDark-text placeholder-slateDark-textMuted/60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              disabled={!urlInput.trim()}
              className="px-3 py-2 bg-slateDark-primary hover:bg-slateDark-primaryHover disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              Agregar
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUrlInput(false);
                setUrlInput('');
              }}
              aria-label="Cancelar enlace"
              className="p-2 text-slateDark-textMuted hover:text-slateDark-text rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        {/* Chips de hashtags sugeridos */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-slateDark-textMuted/70 font-medium">Temas:</span>
          {['#UPSE', '#TuxFlow', '#Innovacion', '#Comunidad'].map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setTexto((prev) => (prev ? `${prev.trim()} ${tag} ` : `${tag} `))}
              className="text-[11px] px-2.5 py-0.5 rounded-full bg-slateDark-surfaceSubtle hover:bg-indigo-500/15 text-slateDark-textMuted hover:text-slateDark-primaryLight border border-slateDark-borderSubtle transition-all cursor-pointer"
            >
              {tag}
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-slateDark-borderSubtle flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!mediaUrl && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slateDark-textMuted hover:text-slateDark-primaryLight disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-slateDark-primaryLight" />
                  <span>{uploadingMedia ? 'Subiendo imagen...' : 'Agregar imagen'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowThemePicker((p) => !p)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    selectedCardTheme
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slateDark-textMuted hover:text-slateDark-primaryLight hover:bg-slateDark-surfaceSubtle'
                  }`}
                  title="Elegir fondo estético para el post"
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>{selectedCardTheme ? 'Fondo activo' : 'Fondo'}</span>
                </button>

                {!showUrlInput && (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-slateDark-textMuted hover:text-slateDark-text px-2 py-1.5 rounded-lg hover:bg-slateDark-surfaceSubtle transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Usar enlace</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`text-[11px] font-mono transition-colors ${
                texto.length > 450 ? 'text-amber-400 font-bold' : 'text-slateDark-textMuted/60'
              }`}
            >
              {texto.length}/500
            </span>

            <button
              type="submit"
              disabled={submitting || !texto.trim() || texto.length > 500}
              className="inline-flex items-center gap-2 bg-slateDark-primary hover:bg-slateDark-primaryHover disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer shadow-xs active:scale-95"
            >
              <span>{submitting ? 'Publicando...' : 'Publicar'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
