Este archivo es un borrador de una propuesta para poder resolver el problema de los usuarios que son amigos de amigos que no conozco y su desaparición al dejar de seguirlos.

Para implementar un sistema de redes sociales en Neo4j donde la acción de dejar de seguir no afecte la visibilidad de las conexiones indirectas, se debe separar la lógica de **seguimiento** de la de **conocimiento o recomendación**.

*   **Modelo de Datos**: Define nodos `(:Usuario)` y relaciones `(:Usuario)-[:SIGUE]->(:Usuario)` para el seguimiento directo. Para las conexiones indirectas (amigos de amigos), no dependas de la relación `SIGUE`, sino utiliza algoritmos de recorrido de grafos o relaciones explícitas de `CONOCE` si es necesario persistirlas.
*   **Consulta de Feed/Recomendación**: Al recuperar el feed o sugerencias, utiliza consultas Cypher que busquen patrones más allá de los seguidores directos. Por ejemplo, para ver contenido de personas que tus contactos siguen, usa una consulta que atraviese múltiples nodos:
    ```cypher
    MATCH (currentUser:Usuario {id: $userId})-[:SIGUE]->(friend:Usuario)-[:SIGUE]->(target:Usuario)
    RETURN target
    ```
*   **Persistencia de Conexiones**: Si deseas que la "red de contactos" persista independientemente del estado de seguimiento, considera crear relaciones adicionales como `(:Usuario)-[:CONOCE]->(:Usuario)` que no se eliminen al hacer `UNFOLLOW`, o utiliza **Graph Algorithms** (como PageRank o Comunidad) para calcular la relevancia de las conexiones indirectas en tiempo de consulta, basándose en la estructura completa del grafo y no solo en los enlaces activos de seguimiento.

De esta forma, aunque el usuario deje de seguir a alguien, la estructura del grafo permite seguir accediendo a las relaciones de segundo y tercer nivel (conocidos de conocidos) mediante patrones de búsqueda más amplios.


Dado el siguiente problema:

Si yo me loggeo como user Carlos, y estoy siguiendo a Paulo, pero Paulo sigue a Angel, entonces Angel también me aparece en mi lista de Usuarios sugeridos + seguidos. Pero si yo borro a Paulo, mi unico seguido directamente, Angel también se borra de la lista de sugeridos

Por tanto, cuando se elimina la relación Carlos→Paulo, el patrón MATCH (c)-[:SIGUE]->(p)-[:SIGUE]->(a) ya no tiene camino, y Angel desaparece.

**Propuesta preliminar:**

## Solución: materializar la sugerencia

Crea una relación propia `SUGERIDO` que se **persiste** en el momento en que se genera la sugerencia. Así queda desacoplada del camino que la originó.

### 1. Modelo de datos

```
(:Usuario {id, nombre})
(:Usuario)-[:SIGUE {fecha}]->(:Usuario)        // seguimiento directo
(:Usuario)-[:SUGERIDO {fecha, origen}]->(:Usuario)  // sugerencia persistida
```

### 2. Generar sugerencias (al hacer login o en un job)

```cypher
// Busca amigos de amigos que NO sigues directamente
// Y crea la relación SUGERIDO si aún no existe
MATCH (c:Usuario {id: $userId})-[:SIGUE]->(p:Usuario)-[:SIGUE]->(s:Usuario)
WHERE NOT (c)-[:SIGUE]->(s)
  AND NOT (c)-[:SUGERIDO]->(s)
MERGE (c)-[r:SUGERIDO]->(s)
  ON CREATE SET r.fecha = datetime(), r.origen = p.id
RETURN s
```

### 3. Consultar la lista de sugeridos

```cypher
MATCH (c:Usuario {id: $userId})-[:SUGERIDO]->(s:Usuario)
RETURN s
```

### 4. Unfollow de Paulo (no afecta a Angel)

```cypher
MATCH (c:Usuario {id: $carlosId})-[r:SIGUE]->(p:Usuario {id: $pauloId})
DELETE r
```

Angel **sigue apareciendo** porque su relación `SUGERIDO` es independiente del camino `Carlos→Paulo→Angel`.

### 5. (Opcional) Expiración o limpieza
Si las sugerencias no deben durar para siempre, puedes agregar un TTL:

```cypher
// Eliminar sugerencias con más de 30 días
MATCH (c:Usuario {id: $userId})-[r:SUGERIDO]->(s:Usuario)
WHERE duration.between(r.fecha, datetime()).days > 30
DELETE r
```

---

**Resumen del cambio de paradigma:**

| Enfoque | Comportamiento al unfollow |
|---|---|
| **Dinámico** (calcular en cada query) | Angel desaparece al borrar `Carlos→Paulo` |
| **Materializado** (relación `SUGERIDO`) | Angel permanece hasta que se expira o el usuario lo descarta explícitamente |

La clave es tratar la sugerencia como un **estado persistente** del grafo, no como un resultado efímero de una traversal.