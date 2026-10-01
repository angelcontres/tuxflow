export interface Post {
  id: string;
  texto: string;
  mediaUrl?: string;
  fechaCreacion: number;
  autorId: string;
  autorUsername: string;
  autorAvatar?: string;
  totalLikes: number;
  likedByMe: boolean;
}

export interface CreatePostPayload {
  autorId: string;
  texto: string;
  mediaUrl?: string;
  autorUsername?: string;
}
