# Frontend React - Red Social Distribuida (Feature-Driven + Tailwind CSS)

Single Page Application (SPA) construida con **React 18 + TypeScript + Vite**, estilizada de forma integral con **Tailwind CSS + Lucide Icons**, empaquetada con **Nginx** para producción y dotada de un **Service Worker** para soporte de notificaciones **Web Push (VAPID)**.

## Arquitectura Basada en Módulos / Características (Feature-Driven)

```text
src/
├── features/                        # Módulos verticales por dominio de la red social
│   ├── feed/                        # US-05: Feed por Grafo Social
│   │   ├── components/              # PostCard, CreatePostForm, FeedList
│   │   ├── services/                # feedApi.ts
│   │   └── types/                   # post.types.ts
│   │
│   ├── network/                     # US-02 y US-03: Grafo de Amigos y Sugerencias de 2do Grado
│   │   ├── components/              # UserSuggestionsCard.tsx
│   │   ├── services/                # networkApi.ts
│   │   └── types/                   # network.types.ts
│   │
│   ├── chat/                        # US-07: Mensajería 1 a 1 en tiempo real
│   │   ├── components/              # ChatWidget.tsx
│   │   ├── services/                # chatSocket.ts
│   │   └── types/                   # chat.types.ts
│   │
│   └── notifications/               # US-08: Web Push
│       └── services/                # pushService.ts
│
└── shared/                          # Componentes UI reutilizables
    └── components/                  # Navbar.tsx con Tailwind CSS y glassmorphism
```

## Estilos y Diseño

- **Tailwind CSS 3.4**: Clases de utilidad modernas sin CSS redundante.
- **Lucide React**: Iconografía minimalista para redes sociales.
- **PWA / Service Worker**: `public/sw.js` para recibir alertas nativas del sistema operativo en segundo plano.

## Ejecución Local

```bash
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:3000` con proxy inverso configurado hacia el backend Quarkus en el puerto `8080`.
