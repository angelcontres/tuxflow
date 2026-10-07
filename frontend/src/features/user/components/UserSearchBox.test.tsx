import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { UserSearchBox } from './UserSearchBox';
import { buscarUsuarios } from '../services/userApi';
import type { ResultadoBusquedaUsuario } from '../types/user.types';

vi.mock('../services/userApi', () => ({
  buscarUsuarios: vi.fn(),
}));

const buscarMock = vi.mocked(buscarUsuarios);

const AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

function persona(overrides: Partial<ResultadoBusquedaUsuario> = {}): ResultadoBusquedaUsuario {
  return {
    id: 'beatriz-silva',
    username: 'beatriz',
    nombre: 'Beatriz Silva',
    avatarUrl: AVATAR,
    ...overrides,
  };
}

const campo = () => screen.getByLabelText(/buscar personas/i) as HTMLInputElement;

/**
 * Escribe un texto de una vez, como si la persona lo pegara.
 *
 * `fireEvent` y no `userEvent` a propósito: `userEvent` espera un retardo real entre teclas y con
 * temporizadores falsos se queda colgado salvo que se le pase `advanceTimers`. Aquí lo que importa es
 * el efecto del debounce sobre el texto completo, no la cadencia de tecleo, y `fireEvent` hace que
 * esa prueba no dependa de cuánto tarde el runner.
 */
function escribir(texto: string) {
  fireEvent.change(campo(), { target: { value: texto } });
}

/**
 * Deja correr el debounce y las microtareas pendientes.
 *
 * Con temporizadores falsos, `advanceTimersByTime` dispara el `setTimeout` pero las promesas que éste
 * lanza siguen en la cola de microtareas. Por eso el avance va dentro de `act`: sin él React no ve el
 * cambio de estado y las aserciones corren contra un árbol sin pintar.
 */
async function correrElDebounce(ms = 250) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

function montar(onOpenPerfil = vi.fn()) {
  render(<UserSearchBox onOpenPerfil={onOpenPerfil} />);
  return onOpenPerfil;
}

describe('UserSearchBox', () => {
  beforeEach(() => {
    // Por defecto resuelve con lista vacía en vez de dejar el mock sin implementación: un
    // `mockReset()` lo devuelve a `undefined`, y entonces el componente revienta al hacer `.then`
    // sobre nada. Las pruebas que necesitan resultados o un fallo lo sobrescriben.
    buscarMock.mockReset();
    buscarMock.mockResolvedValue([]);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cuándo se pregunta al servidor', () => {
    it('no pregunta nada al montar', () => {
      montar();

      expect(buscarMock).not.toHaveBeenCalled();
    });

    it('no pregunta con menos de dos caracteres', async () => {
      montar();
      escribir('b');
      await correrElDebounce();

      // Con un carácter, "a" devolvería casi toda la comunidad. El backend también lo rechaza con 400,
      // así que preguntar sería una ida que va a ser rechazada.
      expect(buscarMock).not.toHaveBeenCalled();
      expect(screen.getByText(/al menos 2 caracteres/i)).toBeInTheDocument();
    });

    it('avisa que falta texto sin abrir el desplegable de resultados', async () => {
      montar();
      escribir('b');
      await correrElDebounce();

      expect(screen.getByText(/al menos 2 caracteres/i)).toBeInTheDocument();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('no pregunta al borrar el campo por completo', async () => {
      montar();
      escribir('beatriz');
      await correrElDebounce();
      buscarMock.mockClear();

      escribir('');
      await correrElDebounce();

      expect(buscarMock).not.toHaveBeenCalled();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('pregunta una sola vez por texto escrito, no una por tecla', async () => {
      buscarMock.mockResolvedValue([persona()]);
      montar();

      // Siete pulsaciones de tecla en el campo, como las de "beatriz".
      for (const letra of 'beatriz') {
        escribir(campo().value + letra);
      }
      await correrElDebounce();

      // Sin debounce serían siete peticiones.
      expect(buscarMock).toHaveBeenCalledTimes(1);
      expect(buscarMock).toHaveBeenCalledWith('beatriz', expect.anything());
    });

    it('ignora los espacios que sobran antes de preguntar', async () => {
      buscarMock.mockResolvedValue([]);
      montar();

      escribir('  be  ');
      await correrElDebounce();

      expect(buscarMock).toHaveBeenCalledWith('be', expect.anything());
    });
  });

  describe('Cancelación de la petición anterior', () => {
    it('cancela la petición en vuelo cuando llega un texto nuevo', async () => {
      buscarMock.mockResolvedValue([persona()]);
      montar();

      escribir('beatriz');
      await correrElDebounce();

      const primerSignal = buscarMock.mock.calls[0][1];
      expect(primerSignal?.aborted).toBe(false);

      escribir('beatriz sil');
      await correrElDebounce();

      // Con debounce y sin cancelación, las dos respuestas pueden llegar en orden contrario y pintar
      // el resultado de un texto que ya no está en el campo. Es un fallo de identidad: se ve el
      // resultado de "beatriz" mientras el campo dice "beatriz sil".
      expect(primerSignal?.aborted).toBe(true);
      expect(buscarMock).toHaveBeenCalledTimes(2);
    });

    it('no pinta la respuesta de un texto que ya no es el del campo', async () => {
      let resolverPrimera: (personas: ResultadoBusquedaUsuario[]) => void = () => {};
      buscarMock
        .mockImplementationOnce(
          () =>
            new Promise<ResultadoBusquedaUsuario[]>((resolve) => {
              resolverPrimera = resolve;
            }),
        )
        .mockResolvedValue([persona({ id: 'paulo-orrala', username: 'paulo', nombre: 'Paulo' })]);

      montar();

      escribir('beatriz');
      await correrElDebounce();

      // Llega el texto nuevo y se pide su resultado.
      escribir('paulo');
      await correrElDebounce();

      // Ahora llega, tarde, la respuesta del texto viejo. No debe pintar nada.
      await act(async () => {
        resolverPrimera([persona({ nombre: 'Beatriz Silva Antigua' })]);
      });

      expect(screen.getByText('Paulo')).toBeInTheDocument();
      expect(screen.queryByText('Beatriz Silva Antigua')).not.toBeInTheDocument();
    });

    it('una petición abortada no se pinta como error', async () => {
      buscarMock.mockRejectedValue(new Error('canceled'));
      montar();

      escribir('beatriz');
      // El efecto se limpia antes de que la promesa se rechace, así que llega abortada.
      escribir('');
      await act(async () => {
        await Promise.resolve();
      });
      await correrElDebounce(500);

      // Borrar el campo a medio teclear no puede dejar un error en rojo: abortar es el desenlace
      // previsto cuando llega un texto nuevo, no un fallo.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Los seis estados son distinguibles', () => {
    it('muestra un resultado por persona, con nombre y nombre de usuario', async () => {
      buscarMock.mockResolvedValue([
        persona(),
        persona({ id: 'paulo-orrala', username: 'paulo', nombre: 'Paulo Orrala' }),
      ]);
      montar();

      escribir('orrala');
      await correrElDebounce();

      expect(screen.getByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.getByText('@beatriz')).toBeInTheDocument();
      expect(screen.getByText('Paulo Orrala')).toBeInTheDocument();
    });

    it('avisa que no encontró a nadie, en vez de mostrar un desplegable vacío', async () => {
      buscarMock.mockResolvedValue([]);
      montar();

      escribir('zzzz');
      await correrElDebounce();

      // Un desplegable vacío sin explicación se lee como "no hay nadie". Con texto de verdad esta
      // respuesta sí significa eso; lo que no puede hacer es parecerse a un fallo.
      expect(screen.getByText(/no encontramos a nadie/i)).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('muestra el fallo como alerta y no como "no hay nadie"', async () => {
      buscarMock.mockRejectedValue(new Error('Network Error'));
      montar();

      escribir('beatriz');
      await correrElDebounce();

      // Si estos dos estados compartieran forma, una caída de la red se pintaría como una comunidad
      // vacía, que es la peor forma de mentir.
      expect(screen.getByRole('alert')).toHaveTextContent(/no pudimos buscar/i);
      expect(screen.queryByText(/no encontramos a nadie/i)).not.toBeInTheDocument();
    });

    it('muestra el mensaje del servidor cuando es apto para el usuario', async () => {
      buscarMock.mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { error: 'Escribe al menos 2 caracteres para buscar' } },
      });
      montar();

      escribir('be');
      await correrElDebounce();

      expect(screen.getByRole('alert')).toHaveTextContent(
        'Escribe al menos 2 caracteres para buscar',
      );
    });

    it('explica el 429 como "espera un momento", no como un fallo generico', async () => {
      // El backend corta la busqueda cuando una direccion IP supera el tope por ventana. Si el
      // cliente lo pintara como un error cualquiera, quien estuviera buscando se pensaria que la
      // aplicacion esta rota en vez de que tiene que esperar un segundo.
      buscarMock.mockRejectedValue({ isAxiosError: true, response: { status: 429 } });
      montar();

      escribir('beatriz');
      await correrElDebounce();

      expect(screen.getByRole('alert')).toHaveTextContent(/espera un momento/i);
    });

    it('el 429 es un fallo y no se confunde con "no hay nadie"', async () => {
      buscarMock.mockRejectedValue({ isAxiosError: true, response: { status: 429 } });
      montar();

      escribir('beatriz');
      await correrElDebounce();

      // Un 429 disfrazado de "no encontramos a nadie" es la peor version de este fallo: la persona
      // cree que esa persona no existe en la comunidad y deja de buscarla.
      expect(screen.queryByText(/no encontramos a nadie/i)).not.toBeInTheDocument();
    });

    it('vuelve a preguntar despues de un fallo', async () => {
      buscarMock.mockRejectedValueOnce(new Error('Network Error'));
      montar();

      escribir('beatriz');
      await correrElDebounce();
      expect(screen.getByRole('alert')).toBeInTheDocument();

      buscarMock.mockResolvedValueOnce([persona()]);
      escribir('beatriz sil');
      await correrElDebounce();

      expect(screen.getByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    it('explica el 429 como "espera un momento", no como un fallo genérico', async () => {
      // El backend corta la búsqueda cuando una dirección IP supera el tope por ventana. Si el
      // cliente lo pintara como un error cualquiera, quien estuviera buscando se pensaría que la
      // aplicación está rota en vez de que tiene que esperar un segundo.
      buscarMock.mockRejectedValue({
        isAxiosError: true,
        response: { status: 429, data: undefined },
      });
      montar();

      escribir('beatriz');
      await correrElDebounce();

      expect(screen.getByRole('alert')).toHaveTextContent(/espera un momento/i);
    });

    it('el 429 es un fallo y no se confunde con "no hay nadie"', async () => {
      buscarMock.mockRejectedValue({
        isAxiosError: true,
        response: { status: 429, data: undefined },
      });
      montar();

      escribir('beatriz');
      await correrElDebounce();

      // Un 429 disfrazado de "no encontramos a nadie" es la peor versión de este fallo: la
      // persona cree que esa persona no existe en la comunidad y deja de buscarla.
      expect(screen.queryByText(/no encontramos a nadie/i)).not.toBeInTheDocument();
    });
  });

  describe('De la búsqueda al perfil', () => {
    it('abre el perfil de la persona elegida', async () => {
      const onOpenPerfil = montar();
      buscarMock.mockResolvedValue([persona()]);

      escribir('beatriz');
      await correrElDebounce();
      fireEvent.click(screen.getByText('Beatriz Silva'));

      // La búsqueda cierra el circuito que US-12 dejó a medias: buscar → resultado → perfil →
      // seguir. El manejador es el mismo que usan las sugerencias, así que hay un solo camino.
      expect(onOpenPerfil).toHaveBeenCalledWith('beatriz-silva');
    });

    it('cierra el desplegable y limpia el campo al elegir', async () => {
      montar();
      buscarMock.mockResolvedValue([persona()]);

      escribir('beatriz');
      await correrElDebounce();
      fireEvent.click(screen.getByText('Beatriz Silva'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(campo()).toHaveValue('');
    });

    it('el propio usuario puede aparecer entre los resultados', async () => {
      const onOpenPerfil = montar();
      buscarMock.mockResolvedValue([
        persona({ id: 'carlos-patino', username: 'carlos', nombre: 'Carlos Patiño' }),
      ]);

      escribir('carlos');
      await correrElDebounce();
      fireEvent.click(screen.getByText('Carlos Patiño'));

      // El backend no lo excluye y el frontend tampoco: excluirlo escondería un resultado real, y
      // alguien puede buscar su propio nombre para comprobar que su perfil se ve bien.
      expect(onOpenPerfil).toHaveBeenCalledWith('carlos-patino');
    });
  });

  describe('Lo que la búsqueda no trae', () => {
    it('no pinta correo, contraseña ni suscripción push aunque vinieran en la respuesta', async () => {
      montar();
      buscarMock.mockResolvedValue([
        {
          id: 'beatriz-silva',
          username: 'beatriz',
          nombre: 'Beatriz Silva',
          avatarUrl: AVATAR,
          email: 'beatriz@upse.edu.ec',
          password: 'no-debe-aparecer',
          pushSubscriptionJson: 'fcm',
        } as unknown as ResultadoBusquedaUsuario,
      ]);

      escribir('beatriz');
      await correrElDebounce();
      screen.getByText('Beatriz Silva');

      // El backend no los manda. Esta comprobación ata la otra mitad de la defensa: si alguna vez
      // llegaran, no tienen dónde pintarse.
      expect(screen.queryByText(/@upse\.edu\.ec/)).not.toBeInTheDocument();
      expect(screen.queryByText(/no-debe-aparecer/)).not.toBeInTheDocument();
      expect(screen.queryByText(/fcm/)).not.toBeInTheDocument();
    });

    it('degrada a la inicial cuando la persona no trae nombre', async () => {
      montar();
      buscarMock.mockResolvedValue([
        persona({ username: 'sinnombre', nombre: undefined, avatarUrl: undefined }),
      ]);

      escribir('sinnombre');
      await correrElDebounce();

      // `nombre` es opcional porque guardarUsuario borra la propiedad cuando llega nula. Mostrar
      // "undefined" o "null" sería mostrar un nombre inventado. El identificador aparece dos veces:
      // como nombre de respaldo y como subtítulo, y por eso la consulta es Multiple.
      expect(screen.getAllByText('@sinnombre')).toHaveLength(2);
      // La inicial sale del identificador de usuario, en mayúscula, porque es lo único que hay.
      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
      expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    });

    it('degrada a la inicial cuando el avatar no carga', async () => {
      montar();
      buscarMock.mockResolvedValue([persona()]);

      escribir('beatriz');
      await correrElDebounce();
      fireEvent.error(screen.getByAltText('Avatar de @beatriz'));

      await correrElDebounce(0);
      expect(screen.queryByAltText('Avatar de @beatriz')).not.toBeInTheDocument();
      expect(screen.getByText('B')).toBeInTheDocument();
    });
  });
});
