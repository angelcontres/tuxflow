import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GraphExplorerModal } from './GraphExplorerModal';
import * as networkApi from '../services/networkApi';

vi.mock('../services/networkApi', () => ({
  fetchSeguidos: vi.fn(),
  fetchSugerenciasGrafo: vi.fn(),
  fetchCaminoCorto: vi.fn(),
  fetchConexionesComunes: vi.fn(),
  followUserInGraph: vi.fn(),
  unfollowUserInGraph: vi.fn(),
}));

describe('GraphExplorerModal', () => {
  const mockSeguidos = [
    { id: 'user-2', username: 'ana', nombre: 'Ana García', seguido: true },
    { id: 'user-3', username: 'carlos', nombre: 'Carlos Ruiz', seguido: true },
  ];

  const mockSugerencias = [
    {
      id: 'user-4',
      username: 'diana',
      nombre: 'Diana Prince',
      conexionesEnComun: 2,
      seguidosEnComun: ['ana', 'carlos'],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(networkApi.fetchSeguidos).mockResolvedValue(mockSeguidos);
    vi.mocked(networkApi.fetchSugerenciasGrafo).mockResolvedValue(mockSugerencias);

    // Mock HTMLCanvasElement.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      arc: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 50 }),
      setLineDash: vi.fn(),
    });

    // Mock requestAnimationFrame
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      return setTimeout(cb, 16) as unknown as number;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      clearTimeout(id);
    });
  });

  it('renderiza el modal con el título y branding TuxFlow', async () => {
    const handleClose = vi.fn();
    render(
      <GraphExplorerModal
        currentUserId="user-1"
        currentUsername="testuser"
        onClose={handleClose}
      />,
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Explorador de Grafo Social')).toBeInTheDocument();
    expect(screen.getByText('Neo4j Live')).toBeInTheDocument();

    await waitFor(() => {
      expect(networkApi.fetchSeguidos).toHaveBeenCalledWith('user-1');
      expect(networkApi.fetchSugerenciasGrafo).toHaveBeenCalledWith('user-1');
    });
  });

  it('calcula y muestra las estadísticas de nodos y aristas', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      // 1 usuario activo ('yo') + 2 seguidos + 1 sugerencia = 4 nodos
      expect(screen.getByText(/Todos \(4\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Seguidos \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Sugerencias \(1\)/i)).toBeInTheDocument();
    });
  });

  it('permite cambiar entre los filtros de visualización', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Todos \(4\)/i)).toBeInTheDocument();
    });

    const btnSeguidos = screen.getByText(/Seguidos \(2\)/i);
    fireEvent.click(btnSeguidos);
    expect(btnSeguidos.className).toContain('bg-emerald-600');

    const btnSugerencias = screen.getByText(/Sugerencias \(1\)/i);
    fireEvent.click(btnSugerencias);
    expect(btnSugerencias.className).toContain('bg-amber-600');
  });

  it('cierra el modal al hacer clic en el botón de cerrar', async () => {
    const handleClose = vi.fn();
    render(
      <GraphExplorerModal
        currentUserId="user-1"
        currentUsername="testuser"
        onClose={handleClose}
      />,
    );

    const closeBtn = screen.getByRole('button', { name: /cerrar explorador de grafo/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('cierra el modal al presionar la tecla Escape', async () => {
    const handleClose = vi.fn();
    render(
      <GraphExplorerModal
        currentUserId="user-1"
        currentUsername="testuser"
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('permite pausar y reanudar la simulación física', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    const pauseBtn = screen.getByTitle(/pausar simulación física/i);
    fireEvent.click(pauseBtn);
    expect(screen.getByTitle(/reanudar física/i)).toBeInTheDocument();

    const playBtn = screen.getByTitle(/reanudar física/i);
    fireEvent.click(playBtn);
    expect(screen.getByTitle(/pausar simulación física/i)).toBeInTheDocument();
  });

  it('permite controlar el zoom y restablecer la cámara', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    expect(screen.getByText('100%')).toBeInTheDocument();

    const zoomInBtn = screen.getByTitle(/acercar/i);
    fireEvent.click(zoomInBtn);
    expect(screen.getByText('125%')).toBeInTheDocument();

    const resetBtn = screen.getByTitle(/centrar vista/i);
    fireEvent.click(resetBtn);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('muestra el panel vacío informativo cuando ningún nodo está seleccionado', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    expect(screen.getByText('Selecciona un Nodo')).toBeInTheDocument();
    expect(
      screen.getByText(/haz clic en cualquier persona para inspeccionar sus grados de separación/i),
    ).toBeInTheDocument();
  });

  it('selecciona un nodo al hacer clic sobre su posición en el canvas', async () => {
    render(
      <GraphExplorerModal currentUserId="user-1" currentUsername="testuser" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText(/Todos \(4\)/i)).toBeInTheDocument();
    });

    const canvas = document.querySelector('canvas')!;
    // El nodo central "yo" está en worldX: 0, worldY: 0, que corresponde al centro del canvas (width/2 = 600, height/2 = 350)
    fireEvent.mouseDown(canvas, { clientX: 600, clientY: 350 });
    fireEvent.mouseUp(canvas, { clientX: 600, clientY: 350 });

    await waitFor(() => {
      expect(screen.getByText('Tú (Usuario Activo)')).toBeInTheDocument();
      expect(screen.getByText('@testuser')).toBeInTheDocument();
    });
  });
});
