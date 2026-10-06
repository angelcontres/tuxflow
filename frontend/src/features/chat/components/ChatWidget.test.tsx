import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatWidget } from './ChatWidget';
import { ChatMessage } from '../types/chat.types';

/**
 * Doble del servicio de canal.
 *
 * <p>Se sustituye el módulo entero en vez de usar un doble de la clase porque el componente depende
 * del singleton `chatSocketManager`, y así la prueba no depende de que el singleton esté limpio
 * entre pruebas.
 *
 * <p>Va dentro de `vi.hoisted` porque `vi.mock` se sube al principio del archivo: si el doble fuera
 * una constante normal, el sustituto se evaluaría antes de que exista.
 */
const { canal } = vi.hoisted(() => ({
  canal: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(() => true),
  },
}));

vi.mock('../services/chatSocket', () => ({
  chatSocketManager: canal,
}));

/** Historial que devuelve el endpoint, con los dos sentidos de la conversación. */
const HISTORIAL: ChatMessage[] = [
  {
    id: 'h1',
    emisorId: 'paulo',
    destinatarioId: 'carlos',
    contenido: 'primer mensaje',
    timestamp: 1,
  },
  {
    id: 'h2',
    emisorId: 'carlos',
    destinatarioId: 'paulo',
    contenido: 'mi respuesta',
    timestamp: 2,
  },
];

const responderHistorial = (cuerpo: unknown = HISTORIAL, ok = true): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => cuerpo,
    })),
  );
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
  return montaje;
};

/**
 * Escribe el ID del interlocutor y espera a que su carga de historial termine.
 *
 * <p>La espera no es decorativa: el historial cambia el árbol de la conversación cuando llega, y
 * teclear en el campo de mensaje mientras eso ocurre hace que lo escrito se quede en un nodo que ya
 * no está en pantalla. El síntoma es un envío que parece no escribir nada.
 */
const elegirInterlocutor = async (id: string): Promise<void> => {
  await userEvent.type(screen.getByLabelText(/enviar mensaje a/i), id);
  await waitFor(() => expect(fetch).toHaveBeenCalled());
};

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canal.sendMessage.mockReturnValue(true);
    responderHistorial();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('indicador de conexión', () => {
    it('refleja el estado real que reporta el canal', async () => {
      // El estado se pinta a partir de lo que dice el canal, no de un supuesto: si el socket no
      // está abierto y la etiqueta dice "conectado", el usuario espera mensajes que no llegan.
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectado', intento: 0 });
      });

      await montarYAbrir();

      expect(await screen.findByText('Conectado')).toBeInTheDocument();
    });

    it('avisa cuando está reconectando en vez de fingir que todo va bien', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectando', intento: 3 });
      });

      await montarYAbrir();

      expect(await screen.findByText('Reconectando')).toBeInTheDocument();
      expect(screen.getByText(/Reintentando la conexión/i)).toBeInTheDocument();
    });

    it('avisa cuando no hay conexión', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'desconectado', intento: 0 });
      });

      await montarYAbrir();

      expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
    });

    it('cierra el canal al desmontarse, para no dejar sockets abiertos al cambiar de vista', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectado', intento: 0 });
      });
      const { unmount } = render(<ChatWidget currentUserId="carlos" />);

      unmount();

      expect(canal.disconnect).toHaveBeenCalled();
    });
  });

  describe('widget flotante', () => {
    it('empieza cerrado y se abre al pulsar el botón', async () => {
      await montarYAbrir();

      expect(screen.getByLabelText(/enviar mensaje a/i)).toBeInTheDocument();
    });

    it('se puede minimizar sin perder la conversación', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectado', intento: 0 });
      });
      await montarYAbrir();
      await elegirInterlocutor('paulo');
      await waitFor(() => expect(screen.getByText('primer mensaje')).toBeInTheDocument());

      await userEvent.click(screen.getByRole('button', { name: /minimizar el chat/i }));

      expect(screen.queryByLabelText(/ID de usuario/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Abrir el chat' })).toBeInTheDocument();
    });

    it('el botón flotante avisa de que el canal no está listo', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'desconectado', intento: 0 });
      });

      render(<ChatWidget currentUserId="carlos" />);

      expect(screen.getByTitle('Sin conexión')).toBeInTheDocument();
    });
  });

  describe('historial', () => {
    it('carga los mensajes de la pareja al elegir interlocutor', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      expect(await screen.findByText('primer mensaje')).toBeInTheDocument();
      expect(screen.getByText('mi respuesta')).toBeInTheDocument();
      expect(fetch).toHaveBeenCalledWith('/api/chat/historial?userA=carlos&userB=paulo');
    });

    it('avisa y ofrece reintentar cuando el historial no carga, en vez de fingir que está vacío', async () => {
      responderHistorial({}, false);

      await montarYAbrir();
      await elegirInterlocutor('paulo');

      expect(await screen.findByText('No se pudo cargar el historial.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
    });

    it('el reintento vuelve a pedir el historial', async () => {
      responderHistorial({}, false);
      await montarYAbrir();
      await elegirInterlocutor('paulo');
      await screen.findByRole('button', { name: /reintentar/i });

      responderHistorial();
      await userEvent.click(screen.getByRole('button', { name: /reintentar/i }));

      expect(await screen.findByText('primer mensaje')).toBeInTheDocument();
    });

    it('no pide nada si el interlocutor es uno mismo', async () => {
      await montarYAbrir();
      await userEvent.type(screen.getByLabelText(/enviar mensaje a/i), 'carlos');

      expect(screen.getByPlaceholderText(/escribe un id de usuario/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toBeDisabled();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('los mensajes propios que ya estaban guardados no se muestran como pendientes', async () => {
      // El historial llega sin estado de entrega, y aun así está confirmado: lo guardó el servidor
      // en una conversación anterior. Marcarlo como pendiente dejaba "Enviando..." bajo cada
      // mensaje propio que se abría la conversación.
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      expect(await screen.findByText('mi respuesta')).toBeInTheDocument();
      expect(screen.queryByText('Enviando...')).not.toBeInTheDocument();
    });

    it('una conversación sin mensajes muestra el estado vacío', async () => {
      responderHistorial([]);

      await montarYAbrir();
      await elegirInterlocutor('paulo');

      expect(await screen.findByText(/no hay mensajes en esta conversación/i)).toBeInTheDocument();
    });
  });

  describe('envío', () => {
    it('muestra el mensaje en el momento, antes de que el servidor confirme', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(await screen.findByText('hola')).toBeInTheDocument();
      expect(screen.getByText('Enviando...')).toBeInTheDocument();
    });

    it('no manda un emisor inventado: lo toma el servidor de la ruta', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(canal.sendMessage).toHaveBeenCalledWith('paulo', 'hola');
    });

    it('conserva el texto si el canal no está listo, en vez de perder lo escrito', async () => {
      canal.sendMessage.mockReturnValue(false);
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));

      expect(screen.getByPlaceholderText(/escribe un mensaje/i)).toHaveValue('hola');
      expect(screen.queryByText('hola')).not.toBeInTheDocument();
    });

    it('no permite enviar sin elegir interlocutor', async () => {
      await montarYAbrir();
      await userEvent.type(screen.getByPlaceholderText(/escribe un id de usuario/i), 'hola');

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
      await elegirInterlocutor('paulo');
      await waitFor(() => expect(screen.getByText('mi respuesta')).toBeInTheDocument());

      await userEvent.clear(screen.getByPlaceholderText(/escribe un mensaje/i));
      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      expect(await screen.findAllByText('Enviando...')).toHaveLength(1);

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'hola',
        timestamp: 3,
        estado: 'ENTREGADO',
      });

      await waitFor(() => expect(screen.queryByText('Enviando...')).not.toBeInTheDocument());
      expect(screen.getAllByText('hola')).toHaveLength(1);
    });

    it('el acuse de no entregado explica el motivo en la burbuja', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await screen.findAllByText('Enviando...');

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'hola',
        estado: 'NO_ENTREGADO',
        motivo: 'El destinatario no está conectado. El mensaje quedó guardado.',
      });

      expect(await screen.findByText(/no está conectado/i)).toBeInTheDocument();
    });

    it('el rechazo explica el motivo y la burbuja se marca como no entregada', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      await userEvent.type(screen.getByPlaceholderText(/escribe un mensaje/i), 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await screen.findAllByText('Enviando...');

      recibir({
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'hola',
        estado: 'RECHAZADO',
        motivo: 'El usuario "paulo" no existe.',
      });

      expect(await screen.findByText(/no existe/i)).toBeInTheDocument();
    });

    it('dos envíos del mismo texto se confirman en orden y no se cruzan', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      const campo = screen.getByPlaceholderText(/escribe un mensaje/i);
      await userEvent.type(campo, 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await userEvent.type(campo, 'hola');
      await userEvent.click(screen.getByRole('button', { name: /enviar mensaje/i }));
      await waitFor(() => expect(screen.getAllByText('hola')).toHaveLength(2));

      recibir({
        id: 'n1',
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'hola',
        estado: 'ENTREGADO',
      });
      recibir({
        id: 'n2',
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'hola',
        estado: 'ENTREGADO',
      });

      await waitFor(() => expect(screen.queryAllByText('Enviando...')).toHaveLength(0));
      expect(screen.getAllByText('hola')).toHaveLength(2);
    });

    it('un mensaje ajeno a la conversación abierta no se cuela en ella', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');
      await waitFor(() => expect(screen.getByText('mi respuesta')).toBeInTheDocument());

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
      await elegirInterlocutor('paulo');
      await waitFor(() => expect(screen.getByText('primer mensaje')).toBeInTheDocument());

      recibir({
        id: 'nuevo',
        emisorId: 'paulo',
        destinatarioId: 'carlos',
        contenido: 'mensaje que acaba de llegar',
        timestamp: 10,
      });

      expect(await screen.findByText('mensaje que acaba de llegar')).toBeInTheDocument();
    });

    it('un acuse sin burbuja que corresponde se descarta, en vez de inventar un mensaje', async () => {
      await montarYAbrir();
      await elegirInterlocutor('paulo');

      recibir({
        id: 'huerfano',
        emisorId: 'carlos',
        destinatarioId: 'paulo',
        contenido: 'algo que nunca se vio en pantalla',
        estado: 'ENTREGADO',
      });

      expect(screen.queryByText('algo que nunca se vio en pantalla')).not.toBeInTheDocument();
    });
  });

  describe('ubicación en la página', () => {
    it('queda fuera del flujo del contenido, que es lo que lo hace flotante', async () => {
      canal.connect.mockImplementation((_userId, _onMensaje, onEstado) => {
        onEstado({ estado: 'conectado', intento: 0 });
      });

      await montarYAbrir();
      await elegirInterlocutor('paulo');

      const burbuja = screen.getByPlaceholderText(/escribe un mensaje/i).closest('div.fixed');
      expect(burbuja).not.toBeNull();
    });

    it('el botón para abrirlo también está fijo en la esquina', () => {
      render(<ChatWidget currentUserId="carlos" />);

      const boton = screen.getByRole('button', { name: 'Abrir el chat' });

      expect(boton.className).toContain('fixed');
    });
  });
});
