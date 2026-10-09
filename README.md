# **Red Social Distribuida**

### **Integrantes**
- Paulo Orrala
- Carlos Patiño
- Angel Villon

> 🚀 **¿Deseas probar TuxFlow en vivo sin instalar nada?**
> Accede directamente a la versión desplegada en producción en la nube:
> 👉 **[https://app.tuxeros.website/](https://app.tuxeros.website/)**
>
> *Cuentas de prueba preconfiguradas:*
> - Usuario: `carlos` | Contraseña: `carlos123`
> - Usuario: `paulo` | Contraseña: `paulo123`
> - Usuario: `elena` | Contraseña: `elena123`
> - Usuario: `angel` | Contraseña: `angel123`

---

## **1. Descripción del proyecto**
Aplicación web distribuida que implementa las funcionalidades esenciales de una red social. El sistema integra diversas tecnologías y mecanismos de comunicación (REST, WebSockets, Web Push), persistencia (Neo4j para el grafo social) y almacenamiento (S3 para multimedia), demostrando una arquitectura distribuida sólida donde cada componente tiene una responsabilidad claramente definida. 

Esta guía integral documenta el diseño, implementación, justificación técnica y despliegue del sistema conforme a los requerimientos de la actividad práctica.

## **2. Arquitectura**
```text
                    ┌─────────────────────────┐
                    │      React Frontend     │
                    │   (SPA + ServiceWorker) │
                    └────────────┬────────────┘
                                 │
             HTTP REST (JSON)    │    WebSocket (WSS)
             Operaciones CRUD    │    Chat Bidireccional
                                 │
                    ┌────────────▼────────────┐
                    │  Quarkus Backend (Java) │
                    │   (Orquestador Lógico)  │
                    └───┬─────────────┬───────┘
                        │             │
       Cypher (Bolt:7687)│             │ S3 API (HTTP:9000)
       Grafo Social     │             │ Binarios Multimedia
                        │             │
                ┌───────▼──────┐    ┌─▼──────────────┐
                │    Neo4j     │    │  MinIO (S3)    │
                │ Base Grafos  │    │ Object Storage │
                └──────────────┘    └────────────────┘
                        │
                  Web Push (VAPID)
                        │
                ┌───────▼──────────────┐
                │ Navegador de Usuario │
                │   (OS Notification)  │
                └──────────────────────┘
```

## **3. Tecnologías utilizadas**
| Necesidad del Sistema             | Mecanismo Implementado    | ¿Por qué esta tecnología?                                                                                         | ¿Qué problema resuelve?                                                                                                   |
| :-------------------------------- | :------------------------ | :---------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| **Operaciones Transaccionales**   | **REST / HTTP**           | Protocolo sin estado (_stateless_), semántica estándar (GET, POST, DELETE).                                       | Creación de cuentas, inicio de sesión, publicación y seguimiento sin sobrecoste de canal abierto.                         |
| **Chat en Vivo 1 a 1**            | **WebSockets**            | Conexión bidireccional TCP dúplex persistente con bajísima latencia.                                              | Elimina la sobrecarga de cabeceras HTTP y el consumo ineficiente de CPU del _polling_ periódico.                          |
| **Alertas fuera de la app**       | **Web Push (VAPID)**      | Estándar W3C soportado por el sistema operativo mediante _Service Workers_.                                       | Permite notificar a los usuarios aunque tengan la pestaña cerrada o la aplicación en segundo plano.                       |
| **Grafo Social y Recomendación**  | **Neo4j (Cypher)**        | _Index-free adjacency_: cada nodo almacena punteros directos a sus relaciones adyacentes (![][image1] por salto). | Evita costosos ![][image2] relacionales recursivos al consultar feeds, amigos en común o sugerencias de múltiples saltos. |
| **Multimedia de Publicaciones**   | **MinIO (S3 Compatible)** | Almacenamiento desacoplado orientado a objetos con metadata.                                                      | Mantiene la base de datos de grafos liviana, delegando la persistencia de binarios pesados a un sistema escalable.        |
| **Despliegue y Reproducibilidad** | **Docker & Compose**      | Empaquetado inmutable y redes virtuales puente (_bridge_).                                                        | Garantiza que la topología distribuida arranque con un solo comando sin discrepancias de entorno.                         |

## **4. Instrucciones de ejecución**

Puedes probar y ejecutar la red social de tres formas según tu necesidad:

### **Opción 0: En la Nube (Sin instalar nada) 🌐**
Si deseas probar la aplicación de inmediato sin configurar nada en tu máquina:
👉 **[https://app.tuxeros.website/](https://app.tuxeros.website/)**  
*(Cuentas: `carlos` / `paulo` / `elena` / `angel`, contraseña: `<nombre>123`)*

---

### **Opción A: Despliegue Local Rápido (100% Docker con 1 solo comando) 🐳**
Ideal para evaluar todo el proyecto en tu máquina sin instalar Java ni Node.js manualmente. Levanta la arquitectura completa (Frontend en Nginx, Backend en Quarkus, Neo4j con UTF-8 y MinIO con buckets autoconfigurados):

**Método 1 — Con script automatizado todo-en-uno:**
```bash
# En Windows:
desplegar.bat

# En Linux o macOS:
chmod +x desplegar.sh && ./desplegar.sh
```
*(El script comprueba requisitos, compila, levanta los contenedores, inyecta la semilla automáticamente y abre el navegador).*

**Método 2 — Con Docker Compose directo:**
```bash
# 1. Levantar toda la topología local
docker compose -f docker-compose.local.yml up --build -d

# 2. Cargar datos semilla cuando Neo4j esté listo
# En Linux/macOS:
cat docker/neo4j-seed.cql | docker exec -i redsocial-neo4j cypher-shell -u neo4j -p password123

# En Windows (PowerShell):
Get-Content docker/neo4j-seed.cql | docker exec -i redsocial-neo4j cypher-shell -u neo4j -p password123
```
> **Acceso:** Aplicación Web en [http://localhost:3000](http://localhost:3000) | Backend y Swagger en [http://localhost:8080](http://localhost:8080) | Neo4j Browser en [http://localhost:7474](http://localhost:7474).

---

### **Opción B: Modo Desarrollo (Hot-Reload)**
Ideal para programar y ver cambios en tiempo real:

```bash
# 1. Levantar bases de datos y almacenamiento
docker compose up -d neo4j minio minio-init

# 2. Cargar datos semilla
cat docker/neo4j-seed.cql | docker exec -i redsocial-neo4j cypher-shell -u neo4j -p password123

# 3. Backend en modo Dev (Terminal 1)
cd backend && mvn quarkus:dev

# 4. Frontend SPA (Terminal 2)
cd frontend && npm install && npm run dev
```

## **5. Variables de entorno necesarias**
Para la correcta ejecución del sistema, los siguientes servicios requieren configuración mediante variables de entorno (ya preconfiguradas en el `docker-compose.yml` para el entorno local):

**Backend (Quarkus):**
- `QUARKUS_NEO4J_URI`: URI de conexión a Neo4j (ej. `bolt://neo4j:7687`).
- `QUARKUS_NEO4J_AUTHENTICATION_USERNAME`: Usuario de Neo4j.
- `QUARKUS_NEO4J_AUTHENTICATION_PASSWORD`: Contraseña de Neo4j.
- `S3_ENDPOINT`: URL del servicio S3/MinIO.
- `S3_BUCKET`: Nombre del bucket para multimedia.
- `S3_ACCESS_KEY` / `S3_SECRET_KEY`: Credenciales de acceso a S3.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT`: Claves y configuración para notificaciones Web Push.
  > 💡 *Para generar un nuevo par de claves VAPID, ejecuta:* `npx web-push generate-vapid-keys`

**Base de Datos de Grafos (Neo4j):**
- `NEO4J_AUTH`: Credenciales de inicialización (ej. `neo4j/password123`).
- `NEO4J_PLUGINS`: Plugins requeridos (ej. `["apoc"]`).

**Object Storage (MinIO):**
- `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`: Credenciales de administración.

## **6. Modelo del grafo**
### **Nodos y Propiedades**
- `(:Usuario {id, username, email, nombre, avatarUrl, pushSubscriptionJson})`
- `(:Post {id, texto, mediaUrl, fechaCreacion})`

### **Relaciones**
- `(:Usuario)-[:SIGUE {desde: timestamp}]->(:Usuario)`
- `(:Usuario)-[:PUBLICA]->(:Post)`
- `(:Usuario)-[:REACCIONA {tipo: 'LIKE', fecha: timestamp}]->(:Post)`

## **7. Endpoints principales**
La API REST expone las operaciones convencionales del sistema:

### **Usuarios y Red Social**
- `POST /usuarios` - Registro de un nuevo usuario.
- `GET /usuarios/{id}` - Consulta de perfil de usuario.
- `POST /usuarios/{id}/seguir` - Seguir a un usuario.
- `DELETE /usuarios/{id}/seguir` - Dejar de seguir a un usuario.
- `GET /usuarios/{id}/seguidores` - Obtener lista de seguidores.
- `GET /usuarios/{id}/seguidos` - Obtener lista de usuarios seguidos.
- `GET /usuarios/{id}/sugerencias` - Obtener sugerencias de amistad basadas en el grafo social.

### **Publicaciones y Feed**
- `POST /posts` - Crear una nueva publicación (con soporte multimedia).
- `GET /feed` - Obtener el feed de publicaciones de los usuarios seguidos.

## **8. Explicación del uso de REST**
El protocolo REST se utiliza para las operaciones CRUD y transaccionales estándar (registro, inicio de sesión, publicación, seguimiento). Su naturaleza sin estado (_stateless_) y uso de verbos HTTP semánticos (GET, POST, DELETE) permite exponer los endpoints de forma limpia y escalable sin mantener conexiones abiertas que consuman recursos en el servidor innecesariamente.

## **9. Explicación del uso de WebSocket**
Para el módulo de mensajería en tiempo real (chat 1 a 1), se reemplazó el tradicional _polling_ HTTP por WebSockets. Esto establece una conexión bidireccional TCP dúplex persistente, reduciendo drásticamente la latencia y eliminando la sobrecarga constante de cabeceras HTTP, permitiendo una experiencia conversacional verdaderamente instantánea.

## **10. Explicación del uso de Web Push**
Se integró Web Push (VAPID) respaldado por Service Workers para manejar notificaciones push. Esto asegura que el sistema pueda alertar a los usuarios sobre interacciones importantes de su red a nivel del sistema operativo, incluso si la aplicación web está minimizada o la pestaña está cerrada, rompiendo la dependencia con la interfaz abierta.

## **11. Consultas Cypher desarrolladas**

### **1. Feed Cronológico Filtrado por Grafo Social (2 Saltos)**
Obtiene únicamente las publicaciones creadas por los usuarios que el solicitante sigue:
```cypher
MATCH (u:Usuario {id: $userId})-[:SIGUE]->(amigo:Usuario)-[:PUBLICA]->(p:Post)  
OPTIONAL MATCH (p)<-[r:REACCIONA]-(:Usuario)  
RETURN p.id AS id, p.texto AS texto, p.mediaUrl AS mediaUrl, p.fechaCreacion AS fecha, amigo.id AS autorId, amigo.username AS autorUsername, amigo.avatarUrl AS autorAvatar, count(r) AS totalLikes, EXISTS((u)-[:REACCIONA]->(p)) AS likedByMe  
ORDER BY p.fechaCreacion DESC  
LIMIT 20;
```

### **2. Algoritmo de Sugerencia de Usuarios (Red Social de Segundo Nivel)**
Calcula recomendaciones basadas en conexiones mutuas ("amigos de amigos" que aún no sigue):
```cypher
MATCH (u:Usuario {id: $userId})-[:SIGUE]->(intermedio:Usuario)-[:SIGUE]->(sugerido:Usuario)  
WHERE u <> sugerido AND NOT (u)-[:SIGUE]->(sugerido)  
RETURN sugerido.id AS id, sugerido.username AS username, sugerido.nombre AS nombre, sugerido.avatarUrl AS avatar, count(intermedio) AS conexionesEnComun, collect(intermedio.username) AS seguidosEnComun  
ORDER BY conexionesEnComun DESC  
LIMIT 5;
```

### **3. Seguidores y Conexiones en Común entre Dos Perfiles**
Identifica la intersección de seguimiento entre dos perfiles analizados:
```cypher
MATCH (u1:Usuario {id: $userA})<-[:SIGUE]-(comun:Usuario)-[:SIGUE]->(u2:Usuario {id: $userB})  
RETURN comun.id AS id, comun.username AS username, comun.nombre AS nombre, comun.avatarUrl AS avatar;
```

### **4. Grado de Separación y Camino Más Corto (Shortest Path)**
Calcula la cadena de conexiones mínimas que unen a dos usuarios distantes:
```cypher
MATCH p = shortestPath((origen:Usuario {id: $origenId})-[:SIGUE*..6]->(destino:Usuario {id: $destinoId}))  
WHERE origen <> destino  
RETURN [n IN nodes(p) | n.username] AS rutaConexion, length(p) AS saltosTotales;
```

### **5. Tendencias en la Red Extendida (Posts con más interacción a 1 y 2 saltos)**
Detecta publicaciones populares generadas dentro de la red cercana del usuario:
```cypher
MATCH (u:Usuario {id: $userId})-[:SIGUE*1..2]->(autor:Usuario)-[:PUBLICA]->(p:Post)  
WHERE p.fechaCreacion >= datetime() - duration('P7D')  
MATCH (reactor:Usuario)-[:REACCIONA]->(p)  
RETURN p.id AS id, p.texto AS texto, autor.username AS autor, count(reactor) AS totalReacciones  
ORDER BY totalReacciones DESC  
LIMIT 10;
```

## **12. Decisiones técnicas relevantes**
- **Neo4j vs Bases Relacionales:** Se aprovechó la propiedad de adyacencia libre de índices (_Index-free adjacency_) de Neo4j para evitar los costosos JOINs recursivos que ocurren al calcular sugerencias de contactos o el _shortest path_ en SQL clásico.
- **S3 / MinIO para Multimedia:** Se desacopló el almacenamiento de binarios pesados (imágenes). La base de datos orientada a grafos solo almacena las URLs de referencia, lo que mantiene el tamaño de los índices del grafo extremadamente compactos y veloces.
- **Microservicios y Docker Compose:** La infraestructura fue diseñada para ser fácilmente distribuible mediante contenedores Docker, garantizando que todos los integrantes del equipo tengan entornos de prueba inmutables, sin el típico problema de "en mi máquina sí funciona".

---

## **📚 Información Relevante Extra**
El _Backlog_, estimaciones, y la infraestructura extra requerida para correr los modos locales han sido extraídos a su respectiva documentación dedicada para mantener este documento limpio. 

- [👉 Especificación Integral BDD/Gherkin y Matriz de Trazabilidad (Backlog)](./docs/architecture-and-backlog.md)
- [👉 Guía Extendida de Desarrollo Local para Programadores](./docs/guia-desarrollo-local.md)


[image1]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAWCAYAAACsR+4DAAAC1ElEQVR4Xr1WO2gUURSdIQYUREFdJezOezu72yjYONhpI7FIYRMEC0sLrf0gClZWgoUEq8UmhQhiIViIYiGpRNtACpsogYC9RVCznvs+M/fd+QbEA4+ZOfe+886777MbRS2IJSEQxtuy/yP2amWv+f8I7cPKCrf3KCPWWt9SSr3G8wPaAxYqXhmDnCnlyliBcj8C71ed4aC1uoDEDZh6h+e14XD4SGn9A+8vB4PBEZnvQBPZQnzCqOI1MgZu93q9gwEJjEajwxhjLcuyeRkzIFF0XkfSPXzOyTj4zzA4i8SI6HcA/d6kaXpC8KdJD22G9hvtG9oCz7GIo8RqfB2Px0kQItckQM6DgIH1gQqeQ84v5FznUXBPYXiHcxbefxxppe5iJWqMWSC2ifaJc7QMD9HxDwa/WLcpEcuQ9xPtGeed4BfOSShjrK5iFoi90nyCbsYzPK+yvBIgfknbqq5ynjgaWO4pjtCYzLPfiC25rWKBSm058VFOVgA59ykPbUXwxC1zTkJWTFoj+BXJDwiMkXDhNEfpVG27yp70HImQGInyXAlprArwsaB4jptxB2P5BPZ57lijsaJ/81JaUCwwT4MFa1ux+ZGzTHnYX0+4cFgx2atAt4q1GguBu+W4tvfbGl0rPAZuP2K7uA4WC7ZssIsx2uPwsZ36+xDiN8iYMleFhZd2l+cMbcPHJMzEzKmsRxdjiC2RVk5k2Zl5EFOl9PckSc56HmKnUtz2dD1MJpNDxJVrYQR3MbHnkgfmqNrQuQyN98jbQbtD5uzJC7cM+Ju5MR6gZYHIIplEW+n3+0dZ2MDmy0OhX/ibv8p4PUo6m2gfA7IZhUAoZb/qfivb4dVir7FOFQ5S6iArUFUxArbAedqr9qt8quvg82h/o/+VINgdxQyrnm4LNPwf8ygt4VSZfl2n04CqJaX/UxjkMb7zC7gZ+YTeNvzPq0L7DNozukHq/AWfKbw8dTTLQQAAAABJRU5ErkJggg==
[image2]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAXCAYAAABEQGxzAAADtklEQVR4Xs1WPWhUQRB+RyKoiCgaxbvL7Xt3hxAipDgUBG3EQkGsBe0stEhloWilhYVgFbQJEVEQEexCQDBISolFLAyKGEhASRFEFAxqIOc3t7N5s/P2nTHcoR8M73a++dmdnTfvouifoKAVAc16EPAKqAQcq58pspqNIT/DBuEHWn/YsGWq1fxG86wPbeLFcbxD6wjaRa7hc8IYcxfyDnKv0WhsEnQGpVJpV8QhXJxisbg1tbBArH1O2MdDrVbb0zYXgu6G8yykqWRM2xLq9fp2cCOQTzjULTzPQ55DvlYqlVPantEbiE+yII0Qb7PiVyVPkLyidP1bSZ9C5svlcilg0YMNX0bS9+DrPhVF4M5REjwHfSaNAu4Ib+amMMgA/Fljb77Z399/QO+0gtuD/rRS+xA3NUGV0jwdhhIkSWI0R4B+L/i3kDtRphYW4C7xgU5KvTY2tgOGsfEm9nJd0a3CQKpa7wGOFygZDI9rjm6ENzKeptfbaMV4AJtvONyQ5vjAc7JgemjQGvwAZJYUVBzKC/sz0hC6R2IdBhmRs2s3AWrFMcgqDQJJ6KPZA1W+oygNqSdwu62YQLvJOMa22xStKQ7tCc9nzpY6CTc349aRrosDHJfpilONrRhdOQUNbcTCxsNEKsPmI+QzZEAZUXx6P2lzmVaRO0K+afl+UCHJz5lxJ00EzyFVvOnQVJlkzut7HZBalZO/wu+dmsfNzfE7kXk/JeD/Wh4a65ecP+E1dZItbuBMEWupL8lpXuq5BRaYy1RdgpKw3YjVpNlsnAq1mx61GcBmqq+vb5tYD3PcYV7PhN5zgUKEKz6IhNQOVzRrbAs1ZZIQDLcGffQChXPfoUVNSNDNBsaxNxxMzhT2wH25Qi+u5gzfkG2jMOiwvOElzRESO+GIn9ScBOyGzFonpGWB7jD7v4BcWyOY/ElktVrdT2tKVrHfj8dY9nrGUXrlcsLJG4D/IfBf4ji5imWPoNZgvO9P4P4sCijafa10MNwBNHyshuNwYBrPW2iNjV6kNa76qHOWoP9O4N9Axp2PBPRL5J///6rg/oEs+hPOP1iSxK0Ps6cUMDwcMu0G5W3ID+7Hh3h3PuB5jLjc2kWtg09zwCd4jkJ+QZbpv522JRjbJq1ukBKrL3+OHXWLB+gSyJzWEwo1tBvIUQS/EapszsEKsI/JjwTVHgz5dgN2P3bq/gX8Mds5dCvuH9G9dHmR8/QW7dkuwCXsVOL8OLmMT+SadQydyhcuXZt4YSqs/R/gdvYbnFMROAr4wSIAAAAASUVORK5CYII=
[image3]: data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAE1ElEQVR4Xu2Yz4scRRTHZ1gFfxIE1zX7o2tnVl0wgsHFH4eQkxFBxUOUCHryYP4AITmLNwWRPQZFchAxetBDjAcR8ZCLoggRRRNIJJrDokFhc0hM4vc7VTX9+nVVd9VML4LmA4/tevXqW69eV1f3bK9XoV9tXiOR5LolB/5H6Wr9QqcrSU/Xepqu9Nt0fL/92xbdAalTVBOrE/OnUh0/udrkIzMJTNQfDAa7tdMSiK7TX15efsUYc6goimfn5uZu1gGJSJ1HcX2DDmgD63gM456WvpXhcBt8O5NWokAuL9t8THRdwQ2AQW/A/oBdhl3Fgg5W4hLh5LDPRftd6sH2yjhJaKGY/x3Yp76N8a+6vPbIuDpVNYxZd/NL+7YSlADzh53z7cXFxRsLY97CDXxIxun5x+COPozknxkOhxhnzkxR4E0IvOjbKysrS/D9DDsLG8jYJhD7O4vBhbC9tLT0INoXYB+ieZ0Kj8J1YMxFV1huoCfgntFxbWDcd7omKO4c/O/12vKRNceA7aZS4MgdieAWclU+zmg/T5/XTFFE/DGO6bnkMXYX2pdgR3OOCs6J+MPan4KqyyZ0fir9fWrfVubTsKrmAueBsb/CLihfpcCWhoQcMgJnHncib9xzwj2iSSm/wGE1zH3OrYFH1CgIuvtC+TSSX+BwQh73GP0AO4Hj4g7d3waOhvuQy0tcHOx12dc8s8UdEadg6zwC8fckbFPHtYGjcxvGfeDyoG1C74WmLII9JlrgYHgrboG887t0XwoY94ux5/cxvid0f0k4Pzf/+bJtdqC9MRi/nMLjQszPz980WsuowAWfpo91DPGKQWUMjBQ4HyzC8E4b+2KZCrzs7oLOb7Aja2tr1+v+HIz9suAOXJP+YEEciP9E3KgZU744855ME93BebhH6jO+/XXfJPBFAr2j2ABXcP247s9BPFVP6b4QLDzir9gjwbKwsLDI9VHHn8NNN2hMVwU29nv4lG/Pzs7eQpMxOiHZxvx78ATcL1ws8mG3a9alvwljd9o30lctsM6iDvNG/Gk8RQult+/9Wfk0FpipYGfew8XrPkEf/QdQjDulE5pfyR2D4u3WBfS4HJg4P9NG8FeTKXfMfu9v0iFOZ0O4+sb++Kl8lzfpFPZz7HucwbfrPvgvyXxacYsLFpig7zIP+V7k49rYXzw4dwvuYGHFX+LM4yK58HEBJfxx4fo3/A7j7kH7NOxsURamUYeg74TceQP3VYOivNkrt29Ap7Kz2c+jaZ90Ov8G1rVD+ev4xyZgZ2DbfRyuj3MyUawKgfHevpBHBNp/wv7Wx4YH+k8yBn8/MvYmUeOkjqvrlIXhlTsrj1MHBXrf6RwZBznqOlUwdpk6sB9hb8POwy721J0I0h5RZXV19dZYgXPgCzC2IMKvBSziNdghrO+RByJfD206PfvWH+nwp7vu9MR0RH1mePxRh8dd7J89U1PYt2nwiEiFxRtgR+kdF6cf7KcOd6b25zKJTiifOmlRYwb22/br0pMp4IDGXizoy/p43W6m1CnJU7CEdDST6GaD3XvvtB/6BC+eu+1V6g4ukXGlznTUdVKz+RfpJsWYSsw/PVunHEFPqNtVmnv/P3RWh86EHLl6sfiYP53pFYKkyqbG1bEj4+PjPVvJ1s36DxMkUNxa70r+AAAAAElFTkSuQmCC
