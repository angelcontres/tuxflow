import React, { useState, useRef } from 'react';
import { Image, Send, Sparkles, Hash, Upload, Video } from 'lucide-react';
import { submitPost } from '../services/feedApi';
import { uploadAvatar } from '../../user/services/userApi';

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
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hashtagsSugeridos = ['#parati', '#fyp', '#upse', '#viral', '#socialgraph', '#neo4j'];

  const handleAddHashtag = (tag: string) => {
    if (!texto.includes(tag)) {
      setTexto((prev) => (prev ? `${prev} ${tag}` : tag));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingMedia(true);
    try {
      const res = await uploadAvatar(file);
      setMediaUrl(res.avatarUrl);
      setShowMediaInput(true);
    } catch (err) {
      console.error('Error al subir archivo multimedia a MinIO:', err);
    } finally {
      setUploadingMedia(false);
    }
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
    <div className="bg-[#161823] rounded-2xl p-4 sm:p-5 shadow-2xl border border-white/10 mb-6 backdrop-blur-md transition-all hover:border-white/15">
      <form onSubmit={handleSubmit}>
        {/* Header estilo TikTok Studio */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#FE2C55]/20 text-[#FE2C55] flex items-center justify-center">
              <Video className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-extrabold tracking-wide uppercase text-white/90">
              Crear Nuevo Video / Post
            </span>
          </div>
          <span className="text-[10px] text-white/40 font-mono">@{currentUsername}</span>
        </div>

        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex-shrink-0 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white/10">
            {currentUsername.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="¿Qué está pasando? Escribe una leyenda, agrega hashtags #parati..."
              rows={2}
              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[#FE2C55] focus:border-[#FE2C55] transition-all resize-none font-normal"
            />
          </div>
        </div>

        {/* Sugerencias de Hashtags Rápidas */}
        <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-neutral-500 flex items-center gap-1">
            <Hash className="w-3 h-3 text-[#25F4EE]" />
          </span>
          {hashtagsSugeridos.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => handleAddHashtag(tag)}
              className="text-[11px] font-semibold text-neutral-400 hover:text-[#25F4EE] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-full transition-colors cursor-pointer border border-white/5"
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Multimedia Input / S3 MinIO */}
        {showMediaInput && (
          <div className="mt-3 p-3 bg-black/40 rounded-xl border border-white/10 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="URL de imagen o video (ej. MinIO o Unsplash)"
                className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#25F4EE] font-mono"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingMedia}
                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0"
              >
                <Upload className="w-3 h-3 text-[#25F4EE]" />
                <span>{uploadingMedia ? 'Subiendo...' : 'MinIO'}</span>
              </button>
            </div>

            {mediaUrl && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="truncate max-w-sm">Adjunto: {mediaUrl}</span>
              </div>
            )}
          </div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*,video/*"
          className="hidden"
        />

        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMediaInput(!showMediaInput)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Image className="w-4 h-4 text-[#25F4EE]" />
              <span>Multimedia</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5 text-[#FE2C55]" />
              <span>Subir a MinIO</span>
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting || !texto.trim()}
            className="inline-flex items-center gap-2 bg-[#FE2C55] hover:bg-[#e0264b] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-5 py-2 rounded-xl shadow-lg shadow-[#FE2C55]/25 transition-all cursor-pointer active:scale-95"
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
