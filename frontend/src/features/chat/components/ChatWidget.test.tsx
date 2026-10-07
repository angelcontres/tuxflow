import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWidget, fusionarFilas, normalizar } from './ChatWidget';
import { ChatMessage, ConversacionChat } from '../types/chat.types';

/**
 * Dobles de los servicios que el widget consume.
 *
 * <p>Se sustituyen los módulos enteros en vez de usar dobles de clase porque el componente depende
 * del singleton `chatSocketManager`, y así la prueba no depende de que el singleton esté limpio
 * entre pruebas.
 *
 * <p>Van dentro de `vi.hoisted` porque `vi.mock` se sube al principio del archivo: si el doble fuera
 * una constante normal, el sustituto se evaluaría antes de que exista.
 */
const { canal, apiMock, redMock } = vi.hoisted(() => ({
  canal: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(() => true),
  },
  apiMock: {
    obtenerHistorial: vi.fn(),
    obtenerConversaciones: vi.fn(),
  },
  redMock: {
    fetchSeguidos: vi.fn(),
  },
}));

vi.mock('../services/chatSocket', () => ({
  chatSocketManager: canal,
}));

vi.mock('../services/chatApi', () => apiMock);

vi.mock('../../network/services/networkApi', () => redMock);

/** Bandeja del servidor: dos parejas, la más reciente primero. */
const CONVERSACIONES: ConversacionChat[] = [
  {
    id: 'paulo-orrala',
    username: 'paulo',
    nombre: 'Paulo Orrala',
    avatarUrl: 'https://cdn.example.com/paulo.png',
    ultimoMensaje: 'mi respuesta',
    fechaUltimoMensaje: 1700000000002,
  },
  {
    id: 'angel-villon',
    username: 'angel',
    nombre: 'Ángel Villón',
    ultimoMensaje: 'primer mensaje',
    fechaUltimoMensaje: 1700000000001,
  },
];

/** Historial de la pareja con Paulo, con los dos sentidos de la conversación. */
const HISTORIAL: ChatMessage[] = [
  {
    id: 'h1',
    emisorId: 'carlos',
    destinatarioId: 'paulo-orrala',
    contenido: 'primer mensaje',
    timestamp: 1,
  },
  {
    id: 'h2',
    emisorId: 'paulo-orrala',
    destinatarioId: 'carlos',
    contenido: 'mi respuesta',
    timestamp: 2,
  },
];

/** Persona a la que se sigue y con la que todavía no se ha hablado. */
const SEGUIDOS = [{ id: 'david-mendoza', username: 'david', nombre: 'David Mendoza' }];

const conectar = (): void => {
  canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
    onEstado({ estado: 'conectado', intento: 0 });
  });
};

/**
 * Monta el widget y abre su panel de una vez.
 *
 * <p>Montar y abrir van juntos a propósito: el canal se abre al montar y el estado de conexión llega
 * por ese momento, así que una prueba que sólo llamara a `abrir` se encontraría con un canal ya
 * conectado y nunca vería el estado que dice estar probando.
 *
 * <p>El botón se localiza por etiqueta y no por clase porque sólo existe mientras el panel está
 * cerrado: si la etiqueta cambiara, la prueba lo señala en vez de seguir en verde.
 */
const montarYAbrir = async (): Promise<ReturnType<typeof render>> => {
  const montaje = render(<ChatWidget currentUserId="carlos" />);
  await userEvent.click(screen.getByRole('button', { name: 'Abrir el chat' }));
  await esperarLista();
  return montaje;
};

/**
 * Espera a que termine la carga de la lista de destino.
 *
 * <p>No es decorativa: la lista es lo que hay que pulsar para abrir una conversación, y teclear en el
 * campo de búsqueda mientras se repinta hace que lo escrito se quede en un nodo que ya no está en
 * pantalla.
 */
const esperarLista = async (): Promise<void> => {
  await waitFor(() => expect(apiMock.obtenerConversaciones).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByText(/cargando conversaciones/i)).not.toBeInTheDocument(),
  );
};

/**
 * Abre la conversación de una fila de la lista y espera a que su historial termine de cargar.
 *
 * <p>Se localiza por el texto de la fila y no por un identificador interno, porque lo que importa
 * comprobär es que se pueda llegar a la conversación por lo que se ve en pantalla.
 */
const abrirConversacion = async (texto: string | RegExp): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: texto }));
  await waitFor(() => expect(apiMock.obtenerHistorial).toHaveBeenCalled());
  await waitFor(() => expect(screen.queryByText(/cargando historial/i)).not.toBeInTheDocument());
};

const campoMensaje = (): HTMLInputElement =>
  screen.getByPlaceholderText(/escribe un mensaje/i) as HTMLInputElement;

const campoBusqueda = (): HTMLInputElement =>
  screen.getByLabelText(/buscar conversación/i) as HTMLInputElement;

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canal.sendMessage.mockReturnValue(true);
    apiMock.obtenerConversaciones.mockResolvedValue(CONVERSACIONES);
    apiMock.obtenerHistorial.mockResolvedValue(HISTORIAL);
    redMock.fetchSeguidos.mockResolvedValue(SEGUIDOS);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('indicador de conexión', () => {
    it('refleja el estado real que reporta el canal', async () => {
      // El estado se pinta a partir de lo que dice el canal, no de un supuesto: si el socket no
      // está abierto y la etiqueta dice "conectado", el usuario espera mensajes que no llegan.
      conectar();

      await montarYAbrir();

      expect(await screen.findByText('Conectado')).toBeInTheDocument();
    });

    it('avisa cuando está reconectando en vez de fingir que todo va bien', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectando', intento: 3 });
      });

      await montarYAbrir();

      expect(await screen.findByText('Reconectando')).toBeInTheDocument();
      expect(screen.getByText(/reintentando la conexión/i)).toBeInTheDocument();
    });

    it('avisa cuando no hay conexión', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'desconectado', intento: 0 });
      });

      await montarYAbrir();

      expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    });

    it('cierra el canal al desmontarse, para no dejar sockets abiertos al cambiar de vista', async () => {
      conectar();
      const { unmount } = render(<ChatWidget currentUserId="carlos" />);

      unmount();

      expect(canal.disconnect).toHaveBeenCalled();
    });
  });

  describe('widget flotante', () => {
    it('empieza cerrado y se abre al pulsar el botón', async () => {
      await montarYAbrir();

      expect(campoBusqueda()).toBeInTheDocument();
    });

    it('se puede minimizar sin perder la conversación abierta', async () => {
      conectar();
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);
      await waitFor(() => expect(screen.getByText('mi respuesta')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: /minimizar el chat/i }));

      expect(screen.queryByLabelText(/buscar conversación/i)).not.toBeInTheDocument();
      const boton = screen.getByRole('button', { name: 'Abrir el chat' });
      expect(boton).toBeInTheDocument();

      // Minimizar esconde el panel, no lo vacía: al volver se sigue en la conversación que había.
      await userEvent.click(boton);
      expect(screen.getByText('mi respuesta')).toBeInTheDocument();
    });

    it('el botón flotante avisa de que el canal no está listo', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'desconectado', intento: 0 });
      });

      render(<ChatWidget currentUserId="carlos" />);

      expect(screen.getByTitle('Sin conexión')).toBeInTheDocument();
    });
  });

  describe('lista de destinos', () => {
    it('no pide nada mientras el panel está cerrado', async () => {
      // Casi nadie abre el chat, y una petición por cada visita para pintar una lista que nadie miró
      // es trabajo que se hace y se tira.
      render(<ChatWidget currentUserId="carlos" />);

      expect(apiMock.obtenerConversaciones).not.toHaveBeenCalled();
      expect(redMock.fetchSeguidos).not.toHaveBeenCalled();
    });

    it('pide la bandeja y los seguidos del usuario abierto', async () => {
      await montarYAbrir();

      expect(apiMock.obtenerConversaciones).toHaveBeenCalledWith('carlos');
      expect(redMock.fetchSeguidos).toHaveBeenCalledWith('carlos');
    });

    it('muestra una fila por interlocutor, con nombre y último mensaje', async () => {
      await montarYAbrir();

      const fila = screen.getByRole('button', { name: /Paulo Orrala/ });
      expect(within(fila).getByText('mi respuesta')).toBeInTheDocument();
    });

    it('incluye a quien se sigue y con quien no se ha hablado, para poder empezar la conversación', async () => {
      // Si la lista fuera solo la bandeja, escribirle por primera vez a una persona a la que sigues
      // exigiría cerrar el chat y buscarla en otro sitio de la página.
      await montarYAbrir();

      const fila = screen.getByRole('button', { name: /David Mendoza/ });
      expect(within(fila).getByText(/sin mensajes/i)).toBeInTheDocument();
    });

    it('no repite a una persona que ya está en la bandeja y en los seguidos', async () => {
      redMock.fetchSeguidos.mockResolvedValue([
        { id: 'paulo-orrala', username: 'paulo', nombre: 'Paulo Orrala' },
      ]);

      await montarYAbrir();

      expect(screen.getAllByRole('button', { name: /Paulo Orrala/ })).toHaveLength(1);
    });

    it('avisa cuando la lista no carga, en vez de fingir que no hay conversaciones', async () => {
      apiMock.obtenerConversaciones.mockRejectedValue(new Error('status 500'));

      await montarYAbrir();

      expect(screen.getByText(/no se pudieron cargar tus conversaciones/i)).toBeInTheDocument();
    });

    it('sigue mostrando las conversaciones si solo fallan los seguidos', async () => {
      // Perder el acceso para escribirle a alguien nuevo no es lo mismo que quedarse sin
      // conversaciones, y la segunda parte sí tiene algo que enseñar.
      redMock.fetchSeguidos.mockRejectedValue(new Error('status 500'));

      await montarYAbrir();

      expect(screen.getByRole('button', { name: /Paulo Orrala/ })).toBeInTheDocument();
      expect(screen.queryByText(/no se pudieron cargar/i)).not.toBeInTheDocument();
    });

    it('una bandeja vacía dice que todavía no se ha escrito con nadie', async () => {
      apiMock.obtenerConversaciones.mockResolvedValue([]);
      redMock.fetchSeguidos.mockResolvedValue([]);

      await montarYAbrir();

      expect(screen.getByText(/todavía no has escrito con nadie/i)).toBeInTheDocument();
    });

    it('no deja escribir el identificador a mano', async () => {
      // Escribir el ID a mano era el error de la versión anterior: quien no adivinara el
      // identificador exacto no tenía forma de abrir una conversación.
      await montarYAbrir();

      expect(screen.queryByLabelText(/id de usuario/i)).not.toBeInTheDocument();
    });
  });

  describe('búsqueda local', () => {
    it('filtra por nombre ignorando tildes y mayúsculas', async () => {
      // Sin normalizar, buscar "angel" no encuentra a "Ángel": justo el caso de una comunidad con
      // nombres acentuados, que es el que más se usa.
      await montarYAbrir();

      await userEvent.type(campoBusqueda(), 'ANGEL');

      expect(screen.getByRole('button', { name: /Ángel Villón/ })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Paulo Orrala/ })).not.toBeInTheDocument();
    });

    it('filtra también por el nombre de usuario', async () => {
      await montarYAbrir();

      await userEvent.type(campoBusqueda(), 'david');

      expect(screen.getByRole('button', { name: /David Mendoza/ })).toBeInTheDocument();
    });

    it('avisa cuando nada coincide en vez de dejar la lista a medias', async () => {
      await montarYAbrir();

      await userEvent.type(campoBusqueda(), 'zzzz');

      expect(screen.getByText(/ninguna conversación coincide/i)).toBeInTheDocument();
    });

    it('normaliza igual en el texto que se busca y en el guardado', () => {
      expect(normalizar('  Ángel Muñoz  ')).toBe('angel munoz');
    });
  });

  describe('historial', () => {
    it('carga los mensajes de la pareja al abrir su fila', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      expect(screen.getByText('primer mensaje')).toBeInTheDocument();
      expect(screen.getByText('mi respuesta')).toBeInTheDocument();
      expect(apiMock.obtenerHistorial).toHaveBeenCalledWith('carlos', 'paulo-orrala');
    });

    it('vuelve a la lista sin mezclarla con la conversación abierta', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.click(screen.getByRole('button', { name: /volver a la lista/i }));

      expect(campoBusqueda()).toBeInTheDocument();
      // El campo de escritura es lo que solo existe en la conversación: si siguiera aquí, se
      // estaría escribiendo en la conversación anterior desde la lista.
      expect(screen.queryByPlaceholderText(/escribe un mensaje/i)).not.toBeInTheDocument();
    });

    it('avisa y ofrece reintentar cuando el historial no carga, en vez de fingir que está vacío', async () => {
      apiMock.obtenerHistorial.mockRejectedValue(new Error('status 500'));

      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      expect(screen.getByText(/no se pudo cargar el historial/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('el reintento vuelve a pedir el historial', async () => {
      apiMock.obtenerHistorial.mockRejectedValue(new Error('status 500'));
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);
      await screen.findByRole('button', { name: /reintentar/i });

      apiMock.obtenerHistorial.mockResolvedValue(HISTORIAL);
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

      expect(await screen.findByText('primer mensaje')).toBeInTheDocument();
    });

    it('los mensajes propios que ya estaban guardados no se muestran como pendientes', async () => {
      // El historial llega sin estado de entrega, y aun así está confirmado: lo guardó el servidor
      // en una conversación anterior. Marcarlo como pendiente dejaba "Enviando..." bajo cada
      // mensaje propio que se abría la conversación.
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      expect(screen.getByText('mi respuesta')).toBeInTheDocument();
      expect(screen.queryByText('Enviando...')).not.toBeInTheDocument();
    });

    it('una conversación sin mensajes muestra el estado vacío', async () => {
      apiMock.obtenerHistorial.mockResolvedValue([]);

      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      expect(screen.getByText(/no hay mensajes en esta conversación/i)).toBeInTheDocument();
    });
  });

  describe('envío', () => {
    it('muestra el mensaje en el momento, antes de que el servidor confirme', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(await screen.findByText('hola')).toBeInTheDocument();
      expect(screen.getByText('Enviando...')).toBeInTheDocument();
    });

    it('no manda un emisor inventado: lo toma el servidor de la ruta', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(canal.sendMessage).toHaveBeenCalledWith('paulo-orrala', 'hola');
    });

    it('la fila del destinatario deja de decir que no hay conversación al escribirle', async () => {
      // La lista no se vuelve a pedir al enviar, así que sin esto, volver atrás tras escribir la
      // primera palabra mostraría "Sin mensajes" sobre una conversación que ya existe.
      await montarYAbrir();
      await abrirConversacion(/David Mendoza/);
      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      await userEvent.click(screen.getByRole('button', { name: /volver a la lista/i }));

      const fila = screen.getByRole('button', { name: /David Mendoza/ });
      expect(within(fila).getByText('hola')).toBeInTheDocument();
      expect(within(fila).queryByText(/sin mensajes/i)).not.toBeInTheDocument();
    });

    it('conserva el texto si el canal no está listo, en vez de perder lo escrito', async () => {
      canal.sendMessage.mockReturnValue(false);
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(campoMensaje()).toHaveValue('hola');
      expect(screen.queryByText('hola')).not.toBeInTheDocument();
    });

    it('no permite enviar un mensaje vacío', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), '   ');

      expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
      expect(canal.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('acuses del servidor', () => {
    /**
     * Empuja un frame por el callback que el componente registró al conectar.
     *
     * <p>Va dentro de `act` porque el callback es el mismo que usaría el navegador al llegar un
     * frame: dispara un cambio de estado fuera del ciclo de React. Sin envolverlo, la actualización
     * se encola y la comprobación siguiente mira la pantalla anterior.
     */
    const recibir = (mensaje: ChatMessage): void => {
      const [, onMensaje] = canal.connect.mock.calls[0] as [string, (m: ChatMessage) => void];
      act(() => {
        onMensaje(mensaje);
      });
    };

    it('el acuse de entregado no crea una burbuja nueva: la que ya está en pantalla se confirma', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      expect(await screen.findAllByText('Enviando...')).toHaveLength(1);

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'hola',
        timestamp: 3,
        estado: 'ENTREGADO',
      });

      await waitFor(() => expect(screen.queryByText('Enviando...')).not.toBeInTheDocument());
      expect(screen.getAllByText('hola')).toHaveLength(1);
    });

    it('el acuse de no entregado explica el motivo en la burbuja', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await screen.findAllByText('Enviando...');

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'hola',
        estado: 'NO_ENTREGADO',
        motivo: 'El destinatario no está conectado. El mensaje quedó guardado.',
      });

      expect(await screen.findByText(/no está conectado/i)).toBeInTheDocument();
    });

    it('el rechazo explica el motivo y la burbuja se marca como no entregada', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await screen.findAllByText('Enviando...');

      recibir({
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'hola',
        estado: 'RECHAZADO',
        motivo: 'El usuario "paulo-orrala" no existe.',
      });

      expect(await screen.findByText(/no existe/i)).toBeInTheDocument();
    });

    it('dos envíos del mismo texto se confirman en orden y no se cruzan', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await userEvent.type(campoMensaje(), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await waitFor(() => expect(screen.getAllByText('hola')).toHaveLength(2));

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'hola',
        estado: 'ENTREGADO',
      });
      recibir({
        id: 'n2',
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'hola',
        estado: 'ENTREGADO',
      });

      await waitFor(() => expect(screen.queryAllByText('Enviando...')).toHaveLength(0));
      expect(screen.getAllByText('hola')).toHaveLength(2);
    });

    it('un mensaje ajeno a la conversación abierta no se cuela en ella', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      recibir({
        id: 'x1',
        emisorId: 'angel',
        destinatarioId: 'carlos',
        contenido: 'mensaje de un tercero',
        timestamp: 9,
      });

      expect(screen.queryByText('mensaje de un tercero')).not.toBeInTheDocument();
    });

    it('un mensaje del interlocutor aparece en la conversación abierta', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      recibir({
        id: 'nuevo',
        emisorId: 'paulo-orrala',
        destinatarioId: 'carlos',
        contenido: 'mensaje que acaba de llegar',
        timestamp: 10,
      });

      expect(await screen.findByText('mensaje que acaba de llegar')).toBeInTheDocument();
    });

    it('un acuse sin burbuja que corresponde se descarta, en vez de inventar un mensaje', async () => {
      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      recibir({
        id: 'huerfano',
        emisorId: 'carlos',
        destinatarioId: 'paulo-orrala',
        contenido: 'algo que nunca se vio en pantalla',
        estado: 'ENTREGADO',
      });

      expect(screen.queryByText('algo que nunca se vio en pantalla')).not.toBeInTheDocument();
    });
  });

  describe('ubicación en la página', () => {
    it('queda fuera del flujo del contenido, que es lo que lo hace flotante', async () => {
      conectar();

      await montarYAbrir();
      await abrirConversacion(/Paulo Orrala/);

      const burbuja = campoMensaje().closest('div.fixed');
      expect(burbuja).not.toBeNull();
    });

    it('el botón para abrirlo también está fijo en la esquina', () => {
      render(<ChatWidget currentUserId="carlos" />);

      const boton = screen.getByRole('button', { name: 'Abrir el chat' });

      expect(boton.className).toContain('fixed');
    });
  });
});

describe('fusionarFilas', () => {
  it('deja las conversaciones primero y los seguidos detrás', () => {
    const filas = fusionarFilas(
      [
        {
          id: 'paulo-orrala',
          username: 'paulo',
          ultimoMensaje: 'que tal',
          fechaUltimoMensaje: 2,
        },
      ],
      [
        { id: 'david-mendoza', username: 'david', nombre: 'David Mendoza' },
        { id: 'elena-vega', username: 'elena', nombre: 'Elena Vega' },
      ],
      'carlos',
    );

    // Los seguidos sin conversación salen por nombre, no en el orden en que los devuelve el grafo.
    expect(filas.map((fila) => fila.id)).toEqual(['paulo-orrala', 'david-mendoza', 'elena-vega']);
  });

  it('marca cuáles tienen conversación y cuáles no', () => {
    const filas = fusionarFilas(
      [
        {
          id: 'paulo-orrala',
          username: 'paulo',
          ultimoMensaje: 'que tal',
          fechaUltimoMensaje: 2,
        },
      ],
      [{ id: 'david-mendoza', username: 'david', nombre: 'David Mendoza' }],
      'carlos',
    );

    expect(filas[0]).toMatchObject({ conMensajes: true, ultimoMensaje: 'que tal' });
    expect(filas[1].conMensajes).toBe(false);
    expect(filas[1].ultimoMensaje).toBeUndefined();
  });

  it('conserva el orden por fecha que dio el servidor', () => {
    // La bandeja llega ya ordenada por la marca del último mensaje. Volver a tocarla en el cliente
    // tiraría ese criterio, que es mejor del que tendría el `sort` de una lista de objetos.
    const filas = fusionarFilas(
      [
        {
          id: 'elena-vega',
          username: 'elena',
          ultimoMensaje: 'hola',
          fechaUltimoMensaje: 1,
        },
        {
          id: 'paulo-orrala',
          username: 'paulo',
          ultimoMensaje: 'que tal',
          fechaUltimoMensaje: 9,
        },
      ],
      [],
      'carlos',
    );

    expect(filas.map((fila) => fila.id)).toEqual(['elena-vega', 'paulo-orrala']);
  });

  it('no incluye al propio usuario: una conversación consigo mismo no se puede abrir', () => {
    const filas = fusionarFilas(
      [
        {
          id: 'carlos',
          username: 'carlos',
          ultimoMensaje: 'hola',
          fechaUltimoMensaje: 1,
        },
      ],
      [{ id: 'carlos', username: 'carlos', nombre: 'Carlos' }],
      'carlos',
    );

    expect(filas).toEqual([]);
  });

  it('aguanta que el servidor no devuelva ninguna de las dos listas', () => {
    expect(fusionarFilas(undefined, undefined, 'carlos')).toEqual([]);
  });
});
