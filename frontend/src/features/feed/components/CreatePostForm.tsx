import React, { useState, useRef, useEffect } from 'react';
import { Send, Upload, X, Check, AlertCircle, Link2 } from 'lucide-react';
import { submitPost } from '../services/feedApi';
import { uploadAvatar } from '../../user/services/userApi';
import { getUserFacingError } from '../../../shared/utils/errorMessage';

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
    setUrlInput('');
    setShowUrlInput(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!texto.trim()) return;

    setSubmitting(true);
    try {
      await submitPost({
        autorId: currentUserId,
        autorUsername: currentUsername,
        texto,
        mediaUrl: mediaUrl.trim() || undefined,
      });
      setTexto('');
      removeMedia();
      showFeedback('success', 'Publicación creada exitosamente');
      onPostCreated();
    } catch (err) {
      showFeedback('error', getUserFacingError(err, 'No pudimos publicar. Inténtalo de nuevo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 mb-6 relative">
      {/* Toast de Feedback */}
      {feedback && (
        <div
          className={`absolute top-2 right-2 left-2 z-10 p-3 rounded-lg flex items-center gap-2.5 text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-300 ${
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

      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex-shrink-0 flex items-center justify-center font-bold text-sm shadow-xs">
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Qué estás pensando hoy?"
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all resize-none"
            />
          </div>
        </div>

        {/* Vista previa de la imagen adjunta */}
        {mediaUrl && (
          <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
            <img
              src={mediaUrl}
              alt="Vista previa de la imagen adjunta"
              className="w-full max-h-72 object-cover"
            />
            <button
              type="button"
              onClick={removeMedia}
              aria-label="Quitar imagen"
              className="absolute top-2 right-2 p-1.5 bg-slate-900/60 hover:bg-slate-900/85 text-white rounded-full transition-colors cursor-pointer"
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
              className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleApplyUrl}
              disabled={!urlInput.trim()}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
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
              className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
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

        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!mediaUrl && (
              <>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-blue-600 disabled:opacity-50 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-blue-500" />
                  <span>{uploadingMedia ? 'Subiendo imagen...' : 'Agregar imagen'}</span>
                </button>

                {!showUrlInput && (
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Usar enlace</span>
                  </button>
                )}
              </>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !texto.trim()}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <span>{submitting ? 'Publicando...' : 'Publicar'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
