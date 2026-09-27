# Tasks: US-11 (TUX-62) — Tendencias en la red extendida

> **Dominio**: `graph-algorithms` · **Estrategia de entrega**: `single-pr` · **Límite de revisión**: 800 líneas

**Archivos a modificar**: `Neo4jGrafoAdapter.java`, `PostResource.java`, `postApi.ts` (o el archivo de
cliente de publicaciones que exista), `post.types.ts` y `App.tsx`.

## Review Workload Forecast

| Métrica | Valor |
|---|---|
| Unidades de trabajo | 4 |
| Líneas estimadas de cambio | 200–280 |
| Riesgo de presupuesto de 400 líneas | **Bajo** |
| Presión de revisión | Media |
| Decisión previa a aplicar | No |

La presión de revisión es media, no baja, porque cuatro unidades tocan dos capas distintas. Se mantiene
por debajo del presupuesto de 400 líneas, así que no hace falta dividir la entrega.

## Unidad 1 — Ventana temporal y alcance

- [ ] Comparar la fecha de la publicación contra el equivalente numérico de la fecha límite
- [ ] Conservar la semántica de siete días de la consulta obligatoria
- [ ] No comparar la fecha contra una fecha con hora
- [ ] Excluir las publicaciones sin fecha de creación en lugar de romper la consulta
- [ ] Verificar que la ventana no descarta todas las publicaciones
- [ ] Añadir la condición que excluye al propio usuario como autor
- [ ] Comprobar que un autor a un salto se incluye
- [ ] Comprobar que un autor a dos saltos se incluye
- [ ] Comprobar que un autor a tres o más saltos se excluye
- [ ] Ejecutar `cd backend && mvn compile`

## Unidad 2 — Conteo de reacciones

- [ ] Contar reaccores distintos en lugar de filas
- [ ] Evitar que la multiplicidad de caminos duplique el total de una publicación
- [ ] Comprobar con un autor alcanzable por dos rutas que el total NO se duplica
- [ ] Comprobar con tres reaccores distintos que el total es tres
- [ ] Comprobar que el orden por total de reacciones no premia al autor con más rutas de entrada
- [ ] Mantener el límite de diez publicaciones
- [ ] Mantener el orden de mayor a menor total de reacciones
- [ ] Ejecutar `cd backend && mvn compile`

> Las unidades 1 y 2 van en el mismo cambio a propósito. Corregir solo la ventana deja una pantalla con
> números falsos de apariencia correcta, que es peor que una pantalla rota.

## Unidad 3 — Servicio de cliente

- [ ] Declarar el tipo de la respuesta de tendencias con autor, texto, identificador y total de reacciones
- [ ] Añadir al cliente la función que consulta las tendencias del usuario
- [ ] Pasar el identificador de usuario en la ruta, no en la cadena de consulta
- [ ] Propagar un fallo de la petición como error explícito
- [ ] No convertir un fallo en una lista de tendencias vacía
- [ ] Usar la instancia de cliente ya configurada, con la base que ya usa el archivo
- [ ] Ejecutar `cd frontend && pnpm run build`

## Unidad 4 — Componente de tendencias en la barra lateral

- [ ] Crear el componente de tendencias en la carpeta de publicaciones
- [ ] Mostrar autor, texto y total de reacciones de cada publicación
- [ ] Mostrar la lista en el orden recibido, sin reordenar en el cliente
- [ ] Añadir el componente al elemento lateral existente, por encima de la tarjeta de sugerencias
- [ ] Mantener la tarjeta de sugerencias y el chat en su lugar actual, por debajo
- [ ] Definir el estado de carga del componente
- [ ] Comunicar la ausencia de tendencias de forma distinta del fallo
- [ ] Deshabilitar la consulta repetida mientras hay una petición en curso
- [ ] Cargar las tendencias junto con el resto de datos de la vista
- [ ] No alterar el comportamiento existente del feed, de las sugerencias ni del chat
- [ ] Ejecutar `cd frontend && pnpm run build`

## Verificación manual

- [ ] Probar con el `curl` del ticket sobre una base con publicaciones con reacciones
- [ ] Confirmar que el resultado trae publicaciones y no una lista vacía
- [ ] Confirmar que una publicación de hace diez días no aparece
- [ ] Confirmar que el total de reacciones coincide con el número de personas que reaccionaron
- [ ] Confirmar el orden de la barra lateral: tendencias, sugerencias, chat

## Fuera de alcance

- Migrar el campo de fecha a una fecha con hora: requiere una decisión propia con las tres historias
  consumidoras a la vista
- Limpiar reacciones duplicadas ya existentes en la base
- Ponderar la popularidad por antigüedad de la publicación
- Página de tendencias completa o clasificación por categorías
