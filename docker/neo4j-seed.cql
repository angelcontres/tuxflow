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
    nombre: 'Carlos Patiño', 
    email: 'carlos@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploCarlos","keys":{"p256dh":"key1","auth":"auth1"}}'
})
CREATE (paulo:Usuario {
    id: 'paulo-orrala', 
    username: 'paulo', 
    nombre: 'Paulo Orrala', 
    email: 'paulo@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploPaulo","keys":{"p256dh":"key2","auth":"auth2"}}'
})
CREATE (angel:Usuario {
    id: 'angel-villon', 
    username: 'angel', 
    nombre: 'Angel Villon', 
    email: 'angel@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    pushSubscriptionJson: '{"endpoint":"https://fcm.googleapis.com/fcm/send/ejemploAngel","keys":{"p256dh":"key3","auth":"auth3"}}'
})
CREATE (beatriz:Usuario {
    id: 'beatriz-silva', 
    username: 'beatriz', 
    nombre: 'Beatriz Silva', 
    email: 'beatriz@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'
})
CREATE (david:Usuario {
    id: 'david-mendoza', 
    username: 'david', 
    nombre: 'David Mendoza', 
    email: 'david@upse.edu.ec', 
    avatarUrl: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150'
})
CREATE (elena:Usuario {
    id: 'elena-vega', 
    username: 'elena', 
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
MATCH (beatriz:Usuario {id: 'beatriz-silva'}), (paulo:Usuario {id: 'paulo-orrala'}), (david:Usuario {id: 'david-mendoza'})
CREATE (pb1:Post {
    id: 'post-b1', 
    texto: '¡Bienvenidos a la Red Social Distribuida en UPSE! 🚀 Conexión Neo4j y MinIO lista.', 
    mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800', 
    fechaCreacion: 1727260000000
})
CREATE (beatriz)-[:PUBLICA]->(pb1)

CREATE (pp1:Post {
    id: 'post-p1', 
    texto: 'Microservicio Quarkus 3 corriendo en modo JVM con bajo consumo de memoria ⚡', 
    mediaUrl: '', 
    fechaCreacion: 1727265000000
})
CREATE (paulo)-[:PUBLICA]->(pp1)

CREATE (pd1:Post {
    id: 'post-d1', 
    texto: 'Publicación de prueba creada por David (Carlos NO la verá en su feed)', 
    mediaUrl: '', 
    fechaCreacion: 1727268000000
})
CREATE (david)-[:PUBLICA]->(pd1);

// 6. Reacciones [:REACCIONA]
MATCH (carlos:Usuario {id: 'carlos-patino'}), (angel:Usuario {id: 'angel-villon'}), (pb1:Post {id: 'post-b1'})
CREATE (carlos)-[:REACCIONA {tipo: 'LIKE', fecha: 1727269000000}]->(pb1)
CREATE (angel)-[:REACCIONA {tipo: 'LIKE', fecha: 1727269500000}]->(pb1);
