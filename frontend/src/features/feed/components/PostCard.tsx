import React, { useState } from 'react';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  Music,
  CheckCircle2,
  Plus,
  Volume2,
  VolumeX,
  Sparkles,
} from 'lucide-react';
import { Post } from '../types/post.types';
import { togglePostLike } from '../services/feedApi';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  onLikeChanged: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, currentUserId, onLikeChanged }) => {
  const [isLiked, setIsLiked] = useState<boolean>(post.likedByMe);
  const [likesCount, setLikesCount] = useState<number>(post.totalLikes);
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showHeartAnim, setShowHeartAnim] = useState<boolean>(false);
  const [commentCount] = useState<number>(Math.max(2, (post.totalLikes * 3) % 17 + 1));
  const [shareCount] = useState<number>(Math.max(1, (post.totalLikes * 2) % 9 + 1));

  // Actualizar si las props cambian
  React.useEffect(() => {
    setIsLiked(post.likedByMe);
    setLikesCount(post.totalLikes);
  }, [post.likedByMe, post.totalLikes]);

  const handleLike = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);
    setLikesCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));
    if (nextState) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }

    try {
      await togglePostLike(post.id, currentUserId);
      onLikeChanged();
    } catch (err) {
      // Revertir en error
      setIsLiked(!nextState);
      setLikesCount((prev) => (!nextState ? prev + 1 : Math.max(0, prev - 1)));
      console.error('Error al dar like:', err);
    }
  };

  const handleDoubleTap = () => {
    if (!isLiked) {
      handleLike();
    } else {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
  };

  // Helper para renderizar texto con hashtags estilo TikTok
  const renderFormattedText = (text: string) => {
    const parts = text.split(/(#[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('#')) {
        return (
          <span key={i} className="font-bold text-[#25F4EE] hover:underline cursor-pointer mr-1">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <article className="relative max-w-[460px] w-full mx-auto mb-10 bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex flex-col group select-none">
      {/* Contenedor Multimedia Vertical Estilo TikTok (Aspect 9:16 o Altura Fija) */}
      <div
        onDoubleClick={handleDoubleTap}
        className="relative w-full h-[580px] sm:h-[640px] bg-black flex items-center justify-center overflow-hidden cursor-pointer"
      >
        {post.mediaUrl ? (
          <>
            {/* Fondo con desenfoque suave para llenar los bordes */}
            <div
              className="absolute inset-0 bg-cover bg-center filter blur-2xl opacity-40 scale-125 pointer-events-none"
              style={{ backgroundImage: `url(${post.mediaUrl})` }}
            />
            {/* Imagen Principal */}
            <img
              src={post.mediaUrl}
              alt="Contenido TikTok"
              className="relative z-10 w-full h-full object-contain pointer-events-none"
              loading="lazy"
            />
          </>
        ) : (
          /* Card sin multimedia: Estilo TikTok Text Story */
          <div className="relative z-10 w-full h-full bg-gradient-to-br from-[#121216] via-[#1a1324] to-[#0c141f] p-8 flex flex-col justify-center items-center text-center">
            {/* Glow decorativo de TikTok */}
            <div className="absolute top-1/4 left-1/4 w-40 h-40 bg-[#25F4EE]/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-[#FE2C55]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-xs space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-[#25F4EE] text-[11px] font-bold tracking-wider uppercase backdrop-blur-md border border-white/10">
                <Sparkles className="w-3.5 h-3.5" />
                UPSE Social Graph
              </span>
              <p className="text-xl sm:text-2xl font-black text-white leading-relaxed tracking-tight drop-shadow-md">
                "{post.texto}"
              </p>
              <div className="flex items-center justify-center gap-2 pt-2">
                <span className="w-2 h-2 rounded-full bg-[#25F4EE] animate-ping" />
                <span className="text-xs text-white/60 font-medium">Publicación en Grafo Social</span>
              </div>
            </div>
          </div>
        )}

        {/* Animación de Corazón al dar Doble Tap */}
        {showHeartAnim && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
            <Heart className="w-28 h-28 text-[#FE2C55] fill-[#FE2C55] animate-ping drop-shadow-[0_0_25px_rgba(254,44,85,0.8)]" />
          </div>
        )}

        {/* Degradado superior para legibilidad de badges */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-black/70 via-black/30 to-transparent pointer-events-none z-20" />

        {/* Badge Superior: Red Social de 2 Saltos */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white flex items-center gap-1.5 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-[#25F4EE] animate-pulse" />
            <span>Para ti</span>
            <span className="text-white/40">•</span>
            <span className="text-[10px] text-white/70">Grafo Neo4j</span>
          </div>
        </div>

        {/* Botón de Audio / Mute Superior Derecho */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsMuted(!isMuted);
          }}
          className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:scale-105 transition-all"
        >
          {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        {/* Degradado inferior para legibilidad de textos y música */}
        <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none z-20" />

        {/* RIEL LATERAL DERECHO (Botones TikTok: Avatar, Like, Comentarios, Guardar, Compartir, Vinilo) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-3 bottom-4 z-30 flex flex-col items-center gap-4 text-white"
        >
          {/* Avatar del Creador con Botón (+) */}
          <div className="relative mb-2">
            <div className="w-12 h-12 rounded-full ring-2 ring-white/90 overflow-hidden bg-gradient-to-tr from-[#25F4EE] to-[#FE2C55] flex items-center justify-center text-white font-bold text-sm shadow-xl">
              {post.autorAvatar ? (
                <img
                  src={post.autorAvatar}
                  alt={post.autorUsername}
                  className="w-full h-full object-cover"
                />
              ) : (
                post.autorUsername.charAt(0).toUpperCase()
              )}
            </div>
            {/* Botón Rojo (+) de TikTok */}
            <button
              title="Seguir usuario"
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#FE2C55] text-white flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-md"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          </div>

          {/* Botón Me Gusta (Heart) */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleLike}
              className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-125 transition-all group/btn cursor-pointer"
            >
              <Heart
                className={`w-6 h-6 transition-all ${
                  isLiked
                    ? 'text-[#FE2C55] fill-[#FE2C55] scale-110 drop-shadow-[0_0_10px_rgba(254,44,85,0.7)]'
                    : 'text-white group-hover/btn:text-white/90'
                }`}
              />
            </button>
            <span className="text-[11px] font-bold text-white/90 mt-1 tracking-tight">
              {likesCount}
            </span>
          </div>

          {/* Botón Comentarios */}
          <div className="flex flex-col items-center">
            <button className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-110 transition-all text-white cursor-pointer">
              <MessageCircle className="w-6 h-6 fill-white/10" />
            </button>
            <span className="text-[11px] font-bold text-white/90 mt-1 tracking-tight">
              {commentCount}
            </span>
          </div>

          {/* Botón Guardar / Favoritos */}
          <div className="flex flex-col items-center">
            <button
              onClick={() => setIsSaved(!isSaved)}
              className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-110 transition-all text-white cursor-pointer"
            >
              <Bookmark
                className={`w-6 h-6 transition-colors ${
                  isSaved ? 'text-amber-400 fill-amber-400' : 'text-white'
                }`}
              />
            </button>
            <span className="text-[11px] font-bold text-white/90 mt-1 tracking-tight">
              {isSaved ? 1 : 0}
            </span>
          </div>

          {/* Botón Compartir */}
          <div className="flex flex-col items-center">
            <button className="w-11 h-11 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:scale-110 transition-all text-white cursor-pointer">
              <Share2 className="w-5 h-5 fill-white/10" />
            </button>
            <span className="text-[11px] font-bold text-white/90 mt-1 tracking-tight">
              {shareCount}
            </span>
          </div>

          {/* Disco de Vinilo Giratorio con la Carátula del Autor */}
          <div className="relative mt-2">
            <div className="w-10 h-10 rounded-full bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center animate-spin-slow shadow-lg p-1.5">
              <div className="w-full h-full rounded-full overflow-hidden bg-neutral-800 flex items-center justify-center">
                {post.autorAvatar ? (
                  <img src={post.autorAvatar} alt="Disc" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[9px] font-bold text-white/70">
                    {post.autorUsername.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            {/* Pequeña nota musical que flota */}
            <Music className="w-3 h-3 text-[#25F4EE] absolute -top-2 right-0 animate-bounce" />
          </div>
        </div>

        {/* OVERLAY INFERIOR IZQUIERDO (Información del Creador, Leyenda y Música) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-3 left-4 right-18 z-20 text-white space-y-2 pointer-events-auto"
        >
          {/* Handle del Autor y Badge Verificado */}
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm sm:text-base text-white hover:underline cursor-pointer drop-shadow-md">
              @{post.autorUsername}
            </span>
            <CheckCircle2 className="w-4 h-4 text-[#25F4EE] fill-[#25F4EE]/20" />
            <span className="text-[11px] text-white/60 bg-white/10 px-2 py-0.5 rounded-full font-medium ml-1">
              Amigo en Grafo
            </span>
          </div>

          {/* Texto de la Publicación con Hashtags */}
          <p className="text-xs sm:text-sm text-white/90 leading-snug line-clamp-3 drop-shadow-md font-normal">
            {renderFormattedText(post.texto)}
          </p>

          {/* Ticker de Música Estilo TikTok */}
          <div className="flex items-center gap-2 pt-1 text-xs text-white/80">
            <Music className="w-3.5 h-3.5 text-white shrink-0" />
            <div className="overflow-hidden whitespace-nowrap w-48 sm:w-60">
              <p className="inline-block animate-marquee font-medium text-[11px]">
                Sonido original - @{post.autorUsername} • {post.fechaCreacion || 'Reciente'} • #TuxTok #UPSE
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
