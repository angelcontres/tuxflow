# Tasks: US-10 (TUX-61) — Grado de separación y camino más corto

> **Dominio**: `graph-algorithms` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `Neo4jGrafoAdapter.java`, `UserGraphResource.java`, `networkApi.ts`,
`network.types.ts` y `UserSuggestionsCard.tsx`.

Este change modifica la tarjeta de sugerencias porque US-02 y US-03 ya están aplicadas en el orden del
roadmap. Ese es el requisito que hace válido tocar ese archivo aquí.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 3 |
| Líneas estimadas de cambio | 120–180 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| Presión de revisión | Baja |
| Decisión previa a aplicar | No |

## Unidad 1 — Resultados distinguibles y validación de entrada

- [x] Validar en el recurso que el origen llega presente y no vacío
- [x] Validar en el recurso que el destino llega presente y no vacío
- [x] Responder con error de cliente cuando falta cualquiera de los dos
- [x] Devolver en el adaptador una ruta vacía y cero saltos cuando no hay camino, en lugar de un mapa vacío
- [x] Mantener la respuesta correcta tanto para el camino encontrado como para el resultado vacío
- [x] Evitar que la petición incompleta se reporte como resultado vacío
- [x] Mantener la consulta obligatoria sin alterar su recorrido dirigido
- [x] Proteger la conversión del nombre de cada nodo del camino ante un valor ausente
- [x] Sustituir el nombre ausente por un valor por defecto en lugar de fallar
- [x] Incluir el identificador de cada nodo junto a su nombre de usuario
- [x] Conservar el orden del camino tal como lo devuelve la base de datos
- [x] Ejecutar `cd backend && mvn compile`

## Unidad 2 — Servicio de cliente

- [x] Declarar el tipo de la respuesta del camino en `network.types.ts`
- [x] Incluir en el tipo la ruta con identificador y nombre, y el total de saltos
- [x] Añadir a `networkApi.ts` la función que consulta el camino
- [x] Pasar origen y destino como parámetros de la consulta
- [x] Propagar el error de la respuesta de petición incorrecta como error explícito
- [x] No convertir la respuesta de error en una ruta vacía
- [x] Usar la instancia de cliente ya configurada, con la base que ya usa el archivo
- [x] Ejecutar `cd frontend && pnpm run build`

## Unidad 3 — Control de distancia en la tarjeta de sugerencias

- [x] Añadir a la tarjeta de sugerencias el control para pedir la distancia a un usuario
- [x] Enviar el identificador del usuario actual y el del usuario elegido
- [x] Mostrar la cadena de nombres del camino cuando existe
- [x] Mostrar el número de saltos junto a la ruta
- [x] Comunicar que no hay conexión dentro del alcance cuando la ruta viene vacía
- [x] Comunicar el error de petición de forma distinta de la ausencia de conexión
- [x] Deshabilitar el control mientras la petición está en curso, para no duplicarla
- [x] Limpiar el resultado al cambiar de usuario seleccionado
- [x] No alterar el comportamiento existente de sugerencias y de seguir
- [x] Ejecutar `cd frontend && pnpm run build`
- [x] Probar con el `curl` del ticket entre dos usuarios con camino conocido
- [x] Probar con el `curl` del ticket entre dos usuarios sin camino
- [x] Probar la consulta con un solo parámetro y comprobar la respuesta de petición incorrecta
- [x] Probar la consulta de un usuario consigo mismo y comprobar que la respuesta es distinguible

## Fuera de alcance

- Recorrido bidireccional del camino: la consulta obligatoria es dirigida
- Vista de perfil nueva, visualización del grafo o del mapa de la red
- Cálculo de grados de separación contra un grupo de usuarios
