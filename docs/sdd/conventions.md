# Convenciones de código

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece a sí mismo en todas partes.

## Estilo Java (Backend)

- **Versión:** Java 17 o superior.
- **Formato:** Código claro y organizado. Importaciones limpias (sin `.*`).
- **Nombres:**
  - Interfaces de puerto de entrada: `*UseCase` (ej. `CrearPostUseCase`).
  - Interfaces de puerto de salida: `*Port` (ej. `GrafoPersistencePort`).
  - Adaptadores: `*Adapter` (ej. `Neo4jGrafoAdapter`).
  - Controladores REST: `*Resource` (ej. `FeedResource`).

## Estilo React (Frontend)

- **Versión:** React 18, TypeScript, Tailwind CSS.
- **Componentes:** Funcionales, usar Hooks. Nombramiento `PascalCase`.
- **Hooks y Utilidades:** `camelCase`.
- **Estructura:** Agrupar por feature (`features/feed/components/`, `features/feed/services/`).

## Manejo de errores

- En Quarkus, lanzar excepciones del dominio que luego se mapeen a códigos HTTP mediante `ExceptionMapper`. No retornar `null` silenciosamente.
- En React, usar bloques `try/catch` para peticiones y revertir estados optimistas ante fallos de la API.

## Testing (Actual)

- **Deshabilitado.** No configurar runners (JUnit/Vitest). Todo test se valida mentalmente y por compilación estricta (`mvn compile`, `npm run build`).
