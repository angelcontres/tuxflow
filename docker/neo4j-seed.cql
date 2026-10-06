// ==============================================================================
// Red Social Distribuida - Neo4j Seed Data
// Equipo: Paulo Orrala, Carlos Patiño, Angel Villon
// ==============================================================================

// 1. Limpieza inicial
MATCH (n) DETACH DELETE n;

// 2. Constraints de Unicidad
CREATE CONSTRAINT unique_user_id IF NOT EXISTS FOR (u:Usuario) REQUIRE u.id IS UNIQUE;
CREATE CONSTRAINT unique_post_id IF NOT EXISTS FOR (p:Post) REQUIRE p.id IS UNIQUE;

// 3. Nodos de Usuarios
CREATE (carlos:Usuario {
    id: 'carlos-patino', 
    username: 'carlos',
    password: 'carlos123', 
    contrasenia: 'carlos123',
    nombre: 'Carlos Patiño', 
    email: 'carlos@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploCarlos","keys":{"p256dh":"key1","auth":"auth1"}}'
})
CREATE (paulo:Usuario {
    id: 'paulo-orrala', 
    username: 'paulo', 
    password: 'paulo123',
    contrasenia: 'paulo123',
    nombre: 'Paulo Orrala', 
    email: 'paulo@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploPaulo","keys":{"p256dh":"key2","auth":"auth2"}}'
})
CREATE (angel:Usuario {
    id: 'angel-villon', 
    username: 'angel', 
    password: 'angel123',
    contrasenia: 'angel123',
    nombre: 'Angel Villon', 
    email: 'angel@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploAngel","keys":{"p256dh":"key3","auth":"auth3"}}'
})
CREATE (beatriz:Usuario {
    id: 'beatriz-silva', 
    username: 'beatriz', 
    password: 'beatriz123',
    contrasenia: 'beatriz123',
    nombre: 'Beatriz Silva', 
    email: 'beatriz@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
})
CREATE (david:Usuario {
    id: 'david-mendoza', 
    username: 'david', 
    password: 'david123',
    contrasenia: 'david123',
    nombre: 'David Mendoza', 
    email: 'david@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
})
CREATE (elena:Usuario {
    id: 'elena-vega', 
    username: 'elena', 
    password: 'elena123',
    contrasenia: 'elena123',
    nombre: 'Elena Vega', 
    email: 'elena@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150'
});

// 4. Relaciones de Seguimiento [:SIGUE]
// Carlos sigue a Beatriz y a Paulo
MATCH (carlos:Usuario {id: 'carlos-patino'}), (beatriz:Usuario {id: 'beatriz-silva'}), (paulo:Usuario {id: 'paulo-orrala'})
CREATE (carlos)-[:SIGUE {desde: 1727200000000}]->(beatriz)
CREATE (carlos)-[:SIGUE {desde: 1727201000000}]->(paulo);

// Beatriz y Paulo siguen a David (David = Sugerencia #1 para Carlos con 2 seguidos en común)
MATCH (beatriz:Usuario {id: 'beatriz-silva'}), (paulo:Usuario {id: 'paulo-orrala'}), (david:Usuario {id: 'david-mendoza'})
CREATE (beatriz)-[:SIGUE {desde: 1727202000000}]->(david)
CREATE (paulo)-[:SIGUE {desde: 1727203000000}]->(david);

// Angel sigue a Beatriz y a Paulo.
// Beatriz y Paulo son SEGUIDOS en común entre Carlos y Angel: los dos los siguen.
// Ojo con la dirección de las flechas en US-09 (GET /api/users/comunes). La consulta
// correcta es (u1)-[:SIGUE]->(comun)<-[:SIGUE]-(u2), con las flechas hacia `comun`.
// La forma invertida, (u1)<-[:SIGUE]-(comun)-[:SIGUE]->(u2), devuelve a QUIENES SIGUEN
// a los dos (los seguidores comunes) y con estos datos devuelve []: el cURL del ticket
// se vería "vacío" sin que nadie notara que la consulta estaba al revés.
MATCH (angel:Usuario {id: 'angel-villon'}), (beatriz:Usuario {id: 'beatriz-silva'}), (paulo:Usuario {id: 'paulo-orrala'})
CREATE (angel)-[:SIGUE {desde: 1727204000000}]->(beatriz)
CREATE (angel)-[:SIGUE {desde: 1727205000000}]->(paulo);

// followed-vs-followers: caso donde las dos direcciones de la consulta dan distinto.
//
// Elena sigue a Carlos y a Paulo  ->  Carlos y Paulo tienen a Elena como SEGUIDORA en
//                                     comun. (u1)<-(comun)->(u2) devuelve [elena].
// Carlos y Paulo no siguen a Elena ->  (u1)->(comun)<-(u2) devuelve [] para el mismo par.
//
// Con este par, invertir las flechas de la consulta de US-09 no se puede pasar por alto:
// el Gherkin de US-09 (carlos-patino vs angel-villon, espera beatriz y paulo) y este caso
// devuelven respuestas opuestas bajo cada una de las dos formas.
MATCH (elena:Usuario {id: 'elena-vega'}), (carlos:Usuario {id: 'carlos-patino'}), (paulo:Usuario {id: 'paulo-orrala'})
CREATE (elena)-[:SIGUE {desde: 1727205500000}]->(carlos)
CREATE (elena)-[:SIGUE {desde: 1727205600000}]->(paulo);

// Cadena de Camino Más Corto (Carlos -> Beatriz -> David -> Elena -> 3 saltos)
MATCH (david:Usuario {id: 'david-mendoza'}), (elena:Usuario {id: 'elena-vega'})
CREATE (david)-[:SIGUE {desde: 1727206000000}]->(elena);

// 5. Publicaciones [:PUBLICA]
//
// OJO con las fechas: son relativas a `datetime()`, no valores fijos a mano.
//
// Estaban fijas (septiembre de 2024) y por eso cualquier consulta con ventana de tiempo devolvía
// vacío en cuanto pasaban unos días: las publicaciones quedaban fuera del rango y no había forma de
// distinguir "el filtro no funciona" de "no hay publicaciones nuevas". Con un desplazamiento fijo
// respecto a ahora, la semilla sirve siempre para demostrar la ventana de siete días de
// GET /api/posts/tendencias/{userId}.
//
// La unidad es el milisegundo: 1 hora = 3 600 000, 1 día = 86 400 000.
MATCH (beatriz:Usuario {id: 'beatriz-silva'}), (paulo:Usuario {id: 'paulo-orrala'}), (david:Usuario {id: 'david-mendoza'})
CREATE (pb1:Post {
    id: 'post-b1', 
    texto: '¡Bienvenidos a la Red Social Distribuida en UPSE! 🚀 Conexión Neo4j y MinIO lista.', 
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800', 
    // Hace 2 horas: entra en la ventana de 7 días y es la más reaccionada.
    fechaCreacion: datetime().epochMillis - 7200000
})
CREATE (beatriz)-[:PUBLICA]->(pb1)

CREATE (pp1:Post {
    id: 'post-p1', 
    texto: 'Microservicio Quarkus 3 corriendo en modo JVM con bajo consumo de memoria ⚡', 
    mediaUrl: '', 
    // Hace 1 día: también entra en la ventana, con menos reacciones.
    fechaCreacion: datetime().epochMillis - 86400000
})
CREATE (paulo)-[:PUBLICA]->(pp1)

CREATE (pd1:Post {
    id: 'post-d1', 
    texto: 'Publicación de prueba creada por David (Carlos NO la verá en su feed)', 
    mediaUrl: '', 
    // Hace 30 días: FUERA de la ventana de 7 días, a propósito, para poder comprobar que el
    // filtro descarta lo que debe descartar y no sólo que devuelve algo.
    fechaCreacion: datetime().epochMillis - 2592000000
})
CREATE (david)-[:PUBLICA]->(pd1);

// 6. Reacciones [:REACCIONA]
MATCH (carlos:Usuario {id: 'carlos-patino'}), (angel:Usuario {id: 'angel-villon'}), (pb1:Post {id: 'post-b1'})
CREATE (carlos)-[:REACCIONA {tipo: 'LIKE', fecha: datetime().epochMillis - 7000000}]->(pb1)
CREATE (angel)-[:REACCIONA {tipo: 'LIKE', fecha: datetime().epochMillis - 7100000}]->(pb1);

// 7. Publicaciones de tendencias (US-11 / TUX-62): 47 posts más, para un total de 50.
//
// Por qué tantos: GET /api/posts/tendencias/{userId} devuelve TOP 5 con orden por
// puntuación neta (likes - dislikes) y desempate por total de reacciones. Con tres posts
// no hay forma de ver el ranking ni comprobar que el LIMIT 5 recorta. El diseño de los
// datos está pensado para la ventana de `carlos-patino`, cuyo grafo de 1 a 2 saltos es
// {beatriz, paulo, david} (sigue a beatriz y paulo; beatriz y paulo siguen a david).
//
// Tres ejes cruzados, en el orden de los autores y de las edades:
//   * Autor en la ventana (beatriz/paulo/david) vs. fuera (angel/elena) vs. autor propio
//     (carlos): si `autor <> u` o el salto `*1..2` fallan, un post de angel, elena o de
//     Carlos mismo con neto alto aparecería en el ranking.
//   * Edad dentro de la ventana de 7 días (1 h a 6,9 días) vs. fuera (8, 10, 14 y 30
//     días): si la ventana falla, los posts viejos de beatriz/paulo/david con neto 5
//     (post-t13, post-t27) encabezarían la lista.
//   * Reacciones: likes y dislikes variados para que el orden neta sea observable, más
//     dos posts sin ninguna reacción (post-t46, post-t47) que el MATCH interno descarta.
//
// `hace` es la antigüedad en milisegundos respecto a `datetime()`, igual que en la
// sección 5: 1 h = 3 600 000, 1 día = 86 400 000, 7 días = 604 800 000.
UNWIND [
    {id: 'post-t01', autor: 'beatriz-silva', hace: 3600000, texto: 'Deploy del clúster de Neo4j completado: cinco nodos y la réplica lista para el examen 🚀'},
    {id: 'post-t02', autor: 'paulo-orrala', hace: 10800000, texto: 'Tip de Cypher: WITH DISTINCT es la diferencia entre contar personas y contar caminos.'},
    {id: 'post-t03', autor: 'david-mendoza', hace: 43200000, texto: 'Alguien más le está peleando al driver de Neo4j 5 con TLS? Me comió tres horas.'},
    {id: 'post-t04', autor: 'angel-villon', hace: 86400000, texto: 'Resumen de la clase de arquitectura distribuida: consistencia, particionamiento y tolerancia a fallos.'},
    {id: 'post-t05', autor: 'elena-vega', hace: 172800000, texto: 'Nuevo artículo sobre diseño hexagonal en el blog de la facultad, ¿qué les parece?'},
    {id: 'post-t06', autor: 'carlos-patino', hace: 259200000, texto: 'Probando el feed cronológico con la ventana de siete días, ojalá pase los tests.'},
    {id: 'post-t07', autor: 'beatriz-silva', hace: 345600000, texto: '¿Alguien tiene el enlace del laboratorio de Quarkus? El de la semana pasada se me perdió.'},
    {id: 'post-t08', autor: 'paulo-orrala', hace: 432000000, texto: 'Refactor completo del módulo de reacciones: ahora like y dislike son mutuamente excluyentes.'},
    {id: 'post-t09', autor: 'david-mendoza', hace: 518400000, texto: 'Stand-up express: qué avancé, qué me bloquea y qué necesito del equipo.'},
    {id: 'post-t10', autor: 'angel-villon', hace: 594000000, texto: 'Estoy a un día del límite de la ventana, pero Carlos no me sigue: si aparezco en sus tendencias, el filtro de red está roto.'},
    {id: 'post-t11', autor: 'elena-vega', hace: 691200000, texto: 'Ocho días de antigüedad: fuera de la ventana de siete días a propósito.'},
    {id: 'post-t12', autor: 'carlos-patino', hace: 864000000, texto: 'Diez días atrás: más allá del rango permitido para US-11.'},
    {id: 'post-t13', autor: 'beatriz-silva', hace: 1209600000, texto: 'Dos semanas de antigüedad y cinco likes: si esto aparece en tendencias, la ventana de tiempo falló.'},
    {id: 'post-t14', autor: 'paulo-orrala', hace: 2592000000, texto: 'Un mes de antigüedad con muchas reacciones: el caso extremo que debe descartarse.'},
    {id: 'post-t15', autor: 'david-mendoza', hace: 3600000, texto: 'Cinco reacciones positivas en la primera hora: esto va a encabezar tendencias.'},
    {id: 'post-t16', autor: 'angel-villon', hace: 10800000, texto: 'Yo sigo a Beatriz y a Paulo, pero Carlos no me sigue a mí: fuera de su ventana extendida.'},
    {id: 'post-t17', autor: 'elena-vega', hace: 43200000, texto: 'Desde el otro lado del grafo: Elena reacciona fuerte, pero Carlos no debe verme en sus tendencias.'},
    {id: 'post-t18', autor: 'carlos-patino', hace: 86400000, texto: 'Mi propia publicación con cuatro likes: si aparece en mi tendencia, falla la exclusión de autor propio.'},
    {id: 'post-t19', autor: 'beatriz-silva', hace: 172800000, texto: 'Post impopular a propósito: cuatro dislikes y un like, la puntuación neta lo hunde.'},
    {id: 'post-t20', autor: 'paulo-orrala', hace: 259200000, texto: 'Encuesta fallida: cero likes, dos dislikes. Aprendí que no todo engagement suma.'},
    {id: 'post-t21', autor: 'david-mendoza', hace: 345600000, texto: 'Dos likes, un dislike: neto positivo modesto a mitad de ventana.'},
    {id: 'post-t22', autor: 'angel-villon', hace: 432000000, texto: 'Empate técnico en el feed: dos a dos entre likes y dislikes.'},
    {id: 'post-t23', autor: 'elena-vega', hace: 518400000, texto: 'A un día del límite de la ventana, con saldo positivo de uno.'},
    {id: 'post-t24', autor: 'carlos-patino', hace: 594000000, texto: 'Mi publicación casi en el borde de los siete días: si aparece en mi ranking, la exclusión de autor propio falló.'},
    {id: 'post-t25', autor: 'beatriz-silva', hace: 691200000, texto: 'Ocho días atrás: fuera de la ventana aunque tenga tres likes.'},
    {id: 'post-t26', autor: 'paulo-orrala', hace: 864000000, texto: 'Diez días atrás, cuatro likes y un dislike: clásicamente fuera de rango.'},
    {id: 'post-t27', autor: 'david-mendoza', hace: 1209600000, texto: 'Dos semanas con cinco likes: el caso más claro de exclusión por antigüedad.'},
    {id: 'post-t28', autor: 'angel-villon', hace: 2592000000, texto: 'Un mes atrás y todavía le llegan reacciones: para el filtro de siete días no cuenta.'},
    {id: 'post-t29', autor: 'elena-vega', hace: 3600000, texto: 'Cinco likes en la primera hora desde fuera de la red de Carlos.'},
    {id: 'post-t30', autor: 'carlos-patino', hace: 10800000, texto: 'Otra publicación mía con buenas reacciones: tampoco debe aparecer en mi tendencia.'},
    {id: 'post-t31', autor: 'beatriz-silva', hace: 43200000, texto: 'Cuatro likes y un dislike: neto tres a medio día de publicado.'},
    {id: 'post-t32', autor: 'paulo-orrala', hace: 86400000, texto: 'Un like solitario en veinticuatro horas: el podio bajo del ranking.'},
    {id: 'post-t33', autor: 'david-mendoza', hace: 172800000, texto: 'Tres likes y dos dislikes: neto positivo pero discutido.'},
    {id: 'post-t34', autor: 'angel-villon', hace: 259200000, texto: 'Dos likes desde fuera del círculo de Carlos.'},
    {id: 'post-t35', autor: 'elena-vega', hace: 345600000, texto: 'Tres likes y dos dislikes: neto positivo pero peleado.'},
    {id: 'post-t36', autor: 'carlos-patino', hace: 432000000, texto: 'Publicación propia con saldo negativo: fuera de mi ventana por ser autor.'},
    {id: 'post-t37', autor: 'beatriz-silva', hace: 518400000, texto: 'Un like y un dislike: neto cero, a seis días de publicado.'},
    {id: 'post-t38', autor: 'paulo-orrala', hace: 594000000, texto: 'Empate perfecto dos a dos cerca del borde de la ventana.'},
    {id: 'post-t39', autor: 'david-mendoza', hace: 691200000, texto: 'Fuera de rango por dos días, con reacciones de sobra.'},
    {id: 'post-t40', autor: 'angel-villon', hace: 864000000, texto: 'Diez días y un like: descartado por la ventana.'},
    {id: 'post-t41', autor: 'elena-vega', hace: 1209600000, texto: 'Dos semanas y tres likes: descartada por antigüedad.'},
    {id: 'post-t42', autor: 'carlos-patino', hace: 2592000000, texto: 'Publicación propia vieja con un dislike: descartada por autor y por fecha.'},
    {id: 'post-t43', autor: 'beatriz-silva', hace: 3600000, texto: 'Cuatro likes sin ni un dislike en la primera hora: favorita de la tarde.'},
    {id: 'post-t44', autor: 'paulo-orrala', hace: 10800000, texto: 'Un like y un dislike: la frontera de los netos en cero.'},
    {id: 'post-t45', autor: 'david-mendoza', hace: 43200000, texto: 'Dos likes y tres dislikes: saldo negativo a medio día.'},
    {id: 'post-t46', autor: 'angel-villon', hace: 86400000, texto: 'Sin ninguna reacción: las tendencias sólo muestran posts reaccionados.'},
    {id: 'post-t47', autor: 'elena-vega', hace: 172800000, texto: 'Tampoco tengo reacciones: misma regla que el post anterior.'}
] AS fila
MATCH (a:Usuario {id: fila.autor})
CREATE (p:Post {
    id: fila.id,
    texto: fila.texto,
    mediaUrl: '',
    fechaCreacion: datetime().epochMillis - fila.hace
})
CREATE (a)-[:PUBLICA]->(p);

// 8. Reacciones de tendencias: LIKES y DISLIKES sobre los posts nuevos.
//
// Formato de cada fila: {post, reacciones: [[usuario, tipo], ...]}. Un usuario aparece
// como mucho una vez por post (en la app like y dislike se excluyen mutuamente) y el
// autor nunca reacciona a lo suyo. Los números no son aleatorios: sostienen el ranking
// esperado de carlos-patino documentado en la verificación final de este archivo.
UNWIND [
    {post: 'post-p1', reacciones: [['carlos-patino', 'LIKE'], ['angel-villon', 'DISLIKE'], ['david-mendoza', 'DISLIKE']]},
    {post: 'post-t01', reacciones: [['carlos-patino', 'LIKE'], ['angel-villon', 'LIKE'], ['paulo-orrala', 'LIKE']]},
    {post: 'post-t02', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t03', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE']]},
    {post: 'post-t04', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE']]},
    {post: 'post-t05', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE']]},
    {post: 'post-t06', reacciones: [['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t07', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'DISLIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t08', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['elena-vega', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t09', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'DISLIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t10', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE']]},
    {post: 'post-t11', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE']]},
    {post: 'post-t12', reacciones: [['paulo-orrala', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t13', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['angel-villon', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE']]},
    {post: 'post-t14', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE'], ['angel-villon', 'LIKE']]},
    {post: 'post-t15', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['angel-villon', 'LIKE'], ['beatriz-silva', 'LIKE'], ['elena-vega', 'LIKE']]},
    {post: 'post-t16', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t17', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t18', reacciones: [['beatriz-silva', 'LIKE'], ['paulo-orrala', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE']]},
    {post: 'post-t19', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'DISLIKE'], ['david-mendoza', 'DISLIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t20', reacciones: [['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t21', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['paulo-orrala', 'DISLIKE']]},
    {post: 'post-t22', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t23', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'DISLIKE']]},
    {post: 'post-t24', reacciones: [['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t25', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['angel-villon', 'LIKE']]},
    {post: 'post-t26', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t27', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['angel-villon', 'LIKE'], ['beatriz-silva', 'LIKE'], ['elena-vega', 'LIKE']]},
    {post: 'post-t28', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['paulo-orrala', 'DISLIKE']]},
    {post: 'post-t29', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'LIKE']]},
    {post: 'post-t30', reacciones: [['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'LIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t31', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['david-mendoza', 'LIKE'], ['elena-vega', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t32', reacciones: [['carlos-patino', 'LIKE']]},
    {post: 'post-t33', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t34', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE']]},
    {post: 'post-t35', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'DISLIKE'], ['beatriz-silva', 'DISLIKE']]},
    {post: 'post-t36', reacciones: [['paulo-orrala', 'LIKE'], ['angel-villon', 'DISLIKE'], ['david-mendoza', 'DISLIKE']]},
    {post: 'post-t37', reacciones: [['carlos-patino', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t38', reacciones: [['carlos-patino', 'LIKE'], ['david-mendoza', 'LIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]},
    {post: 'post-t39', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['paulo-orrala', 'DISLIKE']]},
    {post: 'post-t40', reacciones: [['carlos-patino', 'LIKE']]},
    {post: 'post-t41', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['beatriz-silva', 'LIKE']]},
    {post: 'post-t42', reacciones: [['angel-villon', 'DISLIKE']]},
    {post: 'post-t43', reacciones: [['carlos-patino', 'LIKE'], ['paulo-orrala', 'LIKE'], ['angel-villon', 'LIKE'], ['david-mendoza', 'LIKE']]},
    {post: 'post-t44', reacciones: [['carlos-patino', 'LIKE'], ['angel-villon', 'DISLIKE']]},
    {post: 'post-t45', reacciones: [['carlos-patino', 'LIKE'], ['beatriz-silva', 'LIKE'], ['paulo-orrala', 'DISLIKE'], ['angel-villon', 'DISLIKE'], ['elena-vega', 'DISLIKE']]}
] AS fila
MATCH (p:Post {id: fila.post})
UNWIND fila.reacciones AS par
WITH p, par[0] AS usuario, par[1] AS tipo
MATCH (u:Usuario {id: usuario})
CREATE (u)-[:REACCIONA {tipo: tipo, fecha: datetime().epochMillis - 7200000}]->(p);

// ==============================================================================
// 9. Verificación del ranking de tendencias (US-11)
// ==============================================================================
//
// Resultado real de GET /api/posts/tendencias/carlos-patino tras cargar este seed
// (Neo4j 5.20, orden por puntuación neta DESC, desempate por total DESC, LIMIT 5):
//
//   1. post-t15  david    5 likes  0 dislikes  neto 5   (1 h)
//   2. post-t43  beatriz  4 likes  0 dislikes  neto 4   (1 h)
//   3. post-t31  beatriz  4 likes  1 dislike   neto 3   (12 h)  ---\ empate neto 3 y
//   4. post-t08  paulo    4 likes  1 dislike   neto 3   (5 d)    | total 5: el orden
//                                                                | entre 3 y 4 puede
//   5. post-t01  beatriz  3 likes  0 dislikes  neto 3   (1 h)   ---/ variar; los tres
//                                                                entran siempre (el
//                                                                desempate pone a t01
//                                                                después: total 3 < 5).
//
// El corte del LIMIT 5 cae entre post-t01 (neto 3) y post-t02 (neto 2): sin empate en la
// frontera la lista es determinista. Cuando el límite era 10, el puesto 6 era post-t02
// (neto 2) y el 11 post-t32 (neto 1, total 1); ambos quedan fuera ahora.
//
// Y lo que NO debe aparecer, comprobado con los mismos datos:
//   * post-t13 / post-t27 (neto 5 pero de hace 14 días) y post-t14 / post-t26
//     (antiguos): si aparecen, la ventana de 7 días no filtra.
//   * Los 17 posts en ventana de angel, elena y el propio carlos (netos de hasta 5,
//     p. ej. post-t04, post-t29, post-t18): si aparecen, falla `autor <> u` o el
//     salto *1..2.
//   * post-t46 y post-t47 (cero reacciones): el MATCH interno de reacciones los
//     descarta.
