import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConexionesComunesPanel } from './ConexionesComunesPanel';
import { fetchConexionesComunes } from '../services/networkApi';
import type { ConexionComun } from '../types/network.types';

vi.mock('../services/networkApi', () => ({
  fetchConexionesComunes: vi.fn(),
}));

const fetchMock = vi.mocked(fetchConexionesComunes);

const AVATAR = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150';

function conexion(overrides: Partial<ConexionComun> = {}): ConexionComun {
  return {
    id: 'beatriz-silva',
    username: 'beatriz',
    nombre: 'Beatriz Silva',
    avatar: AVATAR,
    ...overrides,
  };
}

function renderPanel() {
  return render(<ConexionesComunesPanel currentUserId="carlos-patino" currentUsername="carlos" />);
}

const campo = () => screen.getByLabelText('Identificador de la otra persona');
const botonBuscar = () => screen.getByRole('button', { name: /buscar/i });

async function buscar(identificador: string) {
  renderPanel();
  const user = userEvent.setup();
  if (identificador) {
    await user.type(campo(), identificador);
  }
  await user.click(botonBuscar());
  return user;
}

describe('ConexionesComunesPanel', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  describe('Consulta contra el servidor', () => {
    it('no manda ninguna petición hasta que se pide la búsqueda', () => {
      renderPanel();

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('consulta el identificador del usuario activo y el que se escribió', async () => {
      fetchMock.mockResolvedValue([]);
      await buscar('angel-villon');

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock).toHaveBeenCalledWith('carlos-patino', 'angel-villon');
    });

    it('ignora los espacios que sobran en el identificador', async () => {
      fetchMock.mockResolvedValue([]);
      await buscar('  angel-villon  ');

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('carlos-patino', 'angel-villon'));
    });

    it('no consulta en cada tecla, solo al buscar', async () => {
      fetchMock.mockResolvedValue([]);
      renderPanel();
      const user = userEvent.setup();

      await user.type(campo(), 'angel');

      expect(fetchMock).not.toHaveBeenCalled();

      await user.click(botonBuscar());
      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  describe('Identificador vacío', () => {
    it('avisa que hace falta un identificador sin llamar al servidor', async () => {
      await buscar('');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Escribe el identificador de la otra persona.',
      );
    });

    it('avisa igual cuando el identificador es solo espacios', async () => {
      await buscar('   ');

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  describe('Lista con resultados', () => {
    it('muestra una fila por cada conexión en común', async () => {
      fetchMock.mockResolvedValue([
        conexion(),
        conexion({
          id: 'paulo-orrala',
          username: 'paulo',
          nombre: 'Paulo Orrala',
          avatar: undefined,
        }),
      ]);
      await buscar('angel-villon');

      expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.getByText('Paulo Orrala')).toBeInTheDocument();
      expect(screen.getByText('@beatriz')).toBeInTheDocument();
    });

    it('muestra el avatar recibido', async () => {
      fetchMock.mockResolvedValue([conexion({ username: 'beatriz' })]);
      await buscar('angel-villon');

      expect(await screen.findByAltText('Avatar de @beatriz')).toBeInTheDocument();
    });

    it('usa la inicial en mayúscula cuando la conexión no trae avatar', async () => {
      fetchMock.mockResolvedValue([conexion({ username: 'david', avatar: undefined })]);
      await buscar('angel-villon');

      expect(await screen.findByText('D')).toBeInTheDocument();
    });

    it('vuelve a la inicial cuando la imagen del avatar no carga', async () => {
      fetchMock.mockResolvedValue([conexion({ username: 'beatriz' })]);
      await buscar('angel-villon');

      fireEvent.error(await screen.findByAltText('Avatar de @beatriz'));

      await waitFor(() =>
        expect(screen.queryByAltText('Avatar de @beatriz')).not.toBeInTheDocument(),
      );
      expect(screen.getByText('B')).toBeInTheDocument();
    });

    it('muestra el identificador cuando el usuario no tiene nombre', async () => {
      fetchMock.mockResolvedValue([conexion({ username: 'beatriz', nombre: undefined })]);
      await buscar('angel-villon');

      // La conexión aparece dos veces: como nombre de respaldo y como subtítulo.
      const repeticiones = await screen.findAllByText('@beatriz');
      expect(repeticiones).toHaveLength(2);
      expect(screen.queryByText('null')).not.toBeInTheDocument();
    });

    it('informa cuántas conexiones en común se encontraron', async () => {
      fetchMock.mockResolvedValue([
        conexion(),
        conexion({ id: 'paulo-orrala', username: 'paulo' }),
      ]);
      await buscar('angel-villon');

      expect(await screen.findByText(/2 conexion\(es\) en comun con @carlos/)).toBeInTheDocument();
    });
  });

  describe('Lista vacía', () => {
    it('informa que no hay conexiones en común y no lo presenta como error', async () => {
      fetchMock.mockResolvedValue([]);
      await buscar('angel-villon');

      expect(await screen.findByText('No tienen conexiones en común.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('Fallo de la consulta', () => {
    it('muestra un mensaje visible en vez de una lista vacía', async () => {
      fetchMock.mockRejectedValue(new Error('Network Error'));
      await buscar('angel-villon');

      const alerta = await screen.findByRole('alert');
      expect(alerta).toHaveTextContent('No pudimos consultar las conexiones en común');
      expect(screen.queryByText('No tienen conexiones en común.')).not.toBeInTheDocument();
    });

    it('muestra el mensaje del servidor cuando es apto para el usuario', async () => {
      fetchMock.mockRejectedValue({
        isAxiosError: true,
        response: { status: 400, data: { error: 'Elige dos identificadores distintos' } },
      });
      await buscar('carlos-patino');

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Elige dos identificadores distintos',
      );
    });

    it('permite reintentar tras un fallo', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network Error'));
      renderPanel();
      const user = userEvent.setup();
      await user.type(campo(), 'angel-villon');
      await user.click(botonBuscar());
      expect(await screen.findByRole('alert')).toBeInTheDocument();

      fetchMock.mockResolvedValueOnce([conexion()]);
      await user.click(botonBuscar());

      expect(await screen.findByText('Beatriz Silva')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });
});
