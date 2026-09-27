import React, { useState } from 'react';
import { Image, Send, Sparkles } from 'lucide-react';
import { submitPost } from '../services/feedApi';

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
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
      setMediaUrl('');
      setShowMediaInput(false);
      onPostCreated();
    } catch (err) {
      console.error('Error al crear publicación:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 mb-6 transition-all hover:shadow-md">
      <form onSubmit={handleSubmit}>
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Qué quieres compartir con tu red hoy?"
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all resize-none"
            />
          </div>
        </div>

        {showMediaInput && (
          <div className="mt-3 pl-13 flex items-center gap-2">
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="URL de imagen / S3 MinIO (ej. http://localhost:9000/...)"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowMediaInput(!showMediaInput)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-sky-600 px-3 py-1.5 rounded-lg hover:bg-sky-50 transition-colors"
          >
            <Image className="w-4 h-4 text-sky-500" />
            <span>Adjuntar multimedia</span>
          </button>

          <button
            type="submit"
            disabled={submitting || !texto.trim()}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-sm shadow-sky-500/20 transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{submitting ? 'Publicando...' : 'Publicar'}</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>
    </div>
  );
};
