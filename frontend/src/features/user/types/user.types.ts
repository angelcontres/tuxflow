export interface Usuario {
  id: string;
  username: string;
  email?: string;
  nombre: string;
  avatarUrl?: string;
  pushSubscriptionJson?: string;
}
