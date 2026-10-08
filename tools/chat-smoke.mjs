// Prueba manual de US-07 contra el backend en ejecución.
// Es la consola del ticket automatizada: dos identidades, dos sockets, acuses y persistencia.
//
// Uso: node --experimental-websocket tools/chat-smoke.mjs

const BASE = 'ws://localhost:8080/chat';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function abrir(userId) {
  const ws = new WebSocket(`${BASE}/${userId}`);
  ws.recibidos = [];
  ws.onmessage = (e) => ws.recibidos.push(JSON.parse(e.data));
  ws.onerror = () => ws.recibidos.push({ __error: true });
  return new Promise((resolve, reject) => {
    ws.onopen = () => resolve(ws);
    ws.onerror = () => reject(new Error(`no se pudo abrir el socket de ${userId}`));
  });
}

const enviar = (ws, cuerpo) => ws.send(JSON.stringify(cuerpo));

const titulo = (t) => console.log(`\n=== ${t} ===`);

const fallos = [];
const comprobar = (condicion, descripcion) => {
  console.log(`${condicion ? 'OK  ' : 'FALLA'} ${descripcion}`);
  if (!condicion) fallos.push(descripcion);
};

const carlos = await abrir('carlos-patino');
const paulo = await abrir('paulo-orrala');
await esperar(300);

titulo('Entrega directa entre dos participantes');
enviar(carlos, { emisorId: 'mentira', destinatarioId: 'paulo-orrala', contenido: 'Hola Paulo!' });
await esperar(600);
comprobar(paulo.recibidos.length === 1, 'el destinatario recibe 1 mensaje');
const recibido = paulo.recibidos[0] ?? {};
comprobar(recibido.emisorId === 'carlos-patino', `emisorId viene de la ruta, no del cuerpo (${recibido.emisorId})`);
comprobar(recibido.contenido === 'Hola Paulo!', 'el contenido llega idéntico');
comprobar(typeof recibido.id === 'string' && recibido.id.length > 0, 'el mensaje trae id del servidor');
comprobar(typeof recibido.timestamp === 'number', 'el mensaje trae marca de tiempo del servidor');
// Esta es la comprobación que faltaba y que dejó pasar el defecto: si el frame de entrega trajera
// `estado`, el cliente lo leería como un acuse, no hallaría la burbuja a la que corresponde y
// descartaría el mensaje. El destinatario no vería nunca lo que le escriben.
comprobar(recibido.estado === undefined, `el frame de entrega va sin desenlace (estado=${recibido.estado})`);
comprobar(!('estado' in recibido), 'ni siquiera con estado nulo: la clave no debe existir');

titulo('Acuse al emisor');
const acuse = carlos.recibidos.find((m) => m.id === recibido.id);
comprobar(acuse !== undefined, 'el emisor recibe un acuse con el mismo id');
comprobar(acuse?.estado === 'ENTREGADO', `el acuse dice ENTREGADO (${acuse?.estado})`);

titulo('Destinatario ausente');
enviar(carlos, { destinatarioId: 'elena-vega', contenido: 'Hola Elena' });
await esperar(600);
const noEntregado = carlos.recibidos.find((m) => m.contenido === 'Hola Elena');
comprobar(noEntregado !== undefined, 'el emisor recibe acuse del envío a un ausente');
comprobar(noEntregado?.estado === 'NO_ENTREGADO', `el acuse dice NO_ENTREGADO (${noEntregado?.estado})`);
comprobar(typeof noEntregado?.motivo === 'string' && noEntregado.motivo.length > 0, 'el acuse explica el motivo');

titulo('Rechazos');
enviar(carlos, { destinatarioId: 'carlos-patino', contenido: 'me myself' });
enviar(carlos, { destinatarioId: '', contenido: 'sin destinatario' });
enviar(carlos, { destinatarioId: 'paulo-orrala', contenido: '   ' });
await esperar(700);
const rechazos = carlos.recibidos.filter((m) => m.estado === 'RECHAZADO');
comprobar(rechazos.length === 3, `llegan 3 rechazos (${rechazos.length})`);
comprobar(
  rechazos.every((r) => typeof r.motivo === 'string' && r.motivo.length > 0),
  'cada rechazo trae motivo legible',
);

titulo('Dos sesiones del mismo usuario (el defecto que se corrige)');
const carlosSegunda = await abrir('carlos-patino');
await esperar(400);
enviar(paulo, { destinatarioId: 'carlos-patino', contenido: 'llegan a las dos' });
await esperar(600);
comprobar(carlos.recibidos.some((m) => m.contenido === 'llegan a las dos'), 'la primera pestaña recibe');
comprobar(
  carlosSegunda.recibidos.some((m) => m.contenido === 'llegan a las dos'),
  'la segunda pestaña también recibe',
);
carlosSegunda.close();
await esperar(500);
enviar(paulo, { destinatarioId: 'carlos-patino', contenido: 'tras cerrar la segunda' });
await esperar(600);
comprobar(
  carlos.recibidos.some((m) => m.contenido === 'tras cerrar la segunda'),
  'la primera pestaña sigue recibiendo tras cerrar la segunda',
);

titulo('Historial por HTTP');
const respuesta = await fetch(
  'http://localhost:8080/api/chat/historial?userA=carlos-patino&userB=paulo-orrala',
);
const historial = await respuesta.json();
comprobar(respuesta.status === 200, `responde 200 (${respuesta.status})`);
comprobar(Array.isArray(historial), 'devuelve una lista');
comprobar(historial.length > 0, `el historial no está vacío (${historial.length} mensajes)`);
comprobar(
  historial.every((m) => m.emisorId !== undefined && m.destinatarioId !== undefined),
  'cada mensaje trae emisor y destinatario',
);
const desordenado = historial.some((m, i) => i > 0 && m.timestamp < historial[i - 1].timestamp);
comprobar(!desordenado, 'el historial viene ordenado cronológicamente');
const ida = historial.filter((m) => m.emisorId === 'carlos-patino' && m.destinatarioId === 'paulo-orrala');
const vuelta = historial.filter((m) => m.emisorId === 'paulo-orrala' && m.destinatarioId === 'carlos-patino');
comprobar(ida.length > 0 && vuelta.length > 0, 'el historial es simétrico: hay mensajes en los dos sentidos');

titulo('Historial vacío y validación del endpoint');
const vacio = await fetch(
  'http://localhost:8080/api/chat/historial?userA=carlos-patino&userB=david-mendoza',
);
const vacioBody = await vacio.json();
comprobar(vacio.status === 200 && vacioBody.length === 0, 'una pareja sin mensajes da 200 con lista vacía');

const sinParams = await fetch('http://localhost:8080/api/chat/historial?userA=carlos-patino');
comprobar(sinParams.status === 400, `sin participantes completos responde 400 (${sinParams.status})`);

const consigo = await fetch(
  'http://localhost:8080/api/chat/historial?userA=carlos-patino&userB=carlos-patino',
);
comprobar(consigo.status === 400, `pedir el historial consigo mismo responde 400 (${consigo.status})`);

carlos.close();
paulo.close();
await esperar(300);

console.log(`\n${fallos.length === 0 ? 'TODO EN VERDE' : `FALLOS: ${fallos.length}`}`);
fallos.forEach((f) => console.log(` - ${f}`));
process.exit(fallos.length === 0 ? 0 : 1);