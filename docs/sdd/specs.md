# Spec Driven Development (SDD)

> El flujo activo es **OpenSpec**: `openspec/changes/us-XX-<nombre>/<capa>/...` y
> specs canónicos en `openspec/specs/<dominio>/`. La metodología EARS sigue aplicando.

## Estructura

Cada feature del `ROADMAP.md` tiene una carpeta raíz por Historia de Usuario en `openspec/changes/`, subdividida por capa:

```
openspec/changes/us-XX-<feature-name>/
├── back/
│   ├── spec.md           # Requisitos y escenarios Gherkin (EARS notation)
│   ├── design.md         # Decisiones técnicas de implementación
│   └── tasks.md          # Pasos discretos y accionables
└── front/
    ├── spec.md
    ├── design.md
    └── tasks.md
```

## requirements.md / spec.md — EARS estricto

Las requirements se redactan en **EARS** (Easy Approach to Requirements Syntax). Cada requirement es un párrafo numerado con uno de estos cinco patrones:

- **Ubicuo**: `El sistema DEBE <acción>.`
- **Evento**: `CUANDO <disparador>, el sistema DEBE <acción>.`
- **Estado**: `MIENTRAS <estado>, el sistema DEBE <acción>.`
- **Opcional**: `DONDE <feature opcional>, el sistema DEBE <acción>.`
- **No deseado**: `SI <evento no deseado> ENTONCES el sistema DEBE <acción>.`

## design.md — decisiones técnicas

Captura **antes** de tocar código:
- Qué archivos se crean / modifican.
- Qué arquitectura (ej. Hexagonal) se respeta.
- Consultas Cypher fundamentales.
- Decisiones de UX/UI en React.

## tasks.md — checklist ejecutable

Pasos discretos en orden, cada uno con checkbox. Agrupa las tareas por área (Backend, Frontend, Dominio, etc.).
