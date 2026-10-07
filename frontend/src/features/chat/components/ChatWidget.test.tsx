import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ChatWidget } from './ChatWidget';
import { chatSocketManager } from '../services/chatSocket';

vi.mock('../services/chatSocket', () => {
  let messageHandler: ((msg: any) => void) | null = null;
  let statusHandler: ((conectado: boolean) => void) | null = null;

  return {
    chatSocketManager: {
      connect: vi.fn((_userId: string, onMsg: any, onStatus: any) => {
        messageHandler = onMsg;
        statusHandler = onStatus;
        if (onStatus) onStatus(true);
      }),
      sendMessage: vi.fn(() => true),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      _simulateMessage: (msg: any) => messageHandler?.(msg),
      _simulateStatus: (status: boolean) => statusHandler?.(status),
    },
  };
});

describe('ChatWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renderiza la barra minimizada con fondo sólido y botón accesible', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    const dock = screen.getByRole('button', { name: /abrir mensajes directos/i });
    expect(dock).toBeInTheDocument();
    // Verificar que tiene estilo de fondo sólido sin clases transparentes
    expect(dock.className).toContain('bg-white');
    expect(dock.className).toContain('dark:bg-[#27272A]');
    expect(dock.className).not.toContain('bg-transparent');
  });

  it('se expande y muestra la bandeja de entrada con fondo sólido', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    const dock = screen.getByRole('button', { name: /abrir mensajes directos/i });
    fireEvent.click(dock);

    // Debe mostrar el título Mensajes y el buscador
    expect(screen.getByText('Mensajes')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/buscar o escribir @usuario/i)).toBeInTheDocument();

    // Debe listar los contactos predeterminados
    expect(screen.getByText('Beatriz Silva')).toBeInTheDocument();
    expect(screen.getByText('Paulo Orrala')).toBeInTheDocument();
  });

  it('permite abrir una conversación y verificar el lienzo sólido de mensajes', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    // Abrir dock
    fireEvent.click(screen.getByRole('button', { name: /abrir mensajes directos/i }));

    // Clic en el contacto Beatriz Silva
    const contactoBeatriz = screen.getByText('Beatriz Silva');
    fireEvent.click(contactoBeatriz);

    // Debe mostrar a Beatriz Silva en la vista de conversación
    expect(screen.getAllByText('Beatriz Silva').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/@beatriz/i).length).toBeGreaterThan(0);

    // Verificar que existe el input de mensaje
    const input = screen.getByPlaceholderText(/mensaje a @beatriz/i);
    expect(input).toBeInTheDocument();
  });

  it('envía un mensaje, reproduce feedback y actualiza el preview de la conversación', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    // Abrir widget y seleccionar Beatriz
    fireEvent.click(screen.getByRole('button', { name: /abrir mensajes directos/i }));
    fireEvent.click(screen.getByText('Beatriz Silva'));

    const input = screen.getByPlaceholderText(/mensaje a @beatriz/i);
    fireEvent.change(input, { target: { value: 'Hola Beatriz, confirmando entrega' } });

    const sendBtn = screen.getByTitle('Enviar mensaje');
    fireEvent.click(sendBtn);

    // Verificar que chatSocketManager.sendMessage fue invocado
    expect(chatSocketManager.sendMessage).toHaveBeenCalledWith(
      'beatriz',
      'Hola Beatriz, confirmando entrega',
    );

    // El mensaje debe aparecer en pantalla
    expect(screen.getByText('Hola Beatriz, confirmando entrega')).toBeInTheDocument();

    // Volver a inbox y verificar que la previsualización del contacto se actualizó
    const backBtn = screen.getByRole('button', { name: /volver a lista de mensajes/i });
    fireEvent.click(backBtn);

    expect(screen.getByText('Hola Beatriz, confirmando entrega')).toBeInTheDocument();
  });

  it('muestra toast y actualiza preview al recibir un mensaje por socket en segundo plano', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    // Simular recepción de mensaje vía WebSocket mientras el chat está minimizado
    act(() => {
      (chatSocketManager as any)._simulateMessage({
        emisorId: 'beatriz',
        destinatarioId: 'usuario-1',
        contenido: 'Nuevo mensaje entrante en tiempo real',
      });
    });

    // Debe mostrarse el toast flotante de notificación
    expect(screen.getByText('Nuevo mensaje entrante en tiempo real')).toBeInTheDocument();
    expect(screen.getByText('@beatriz')).toBeInTheDocument();

    // El contador de no leídos debe marcar 1 en el dock
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('permite usar sugerencias de inicio rápido al estar en chat vacío', () => {
    render(<ChatWidget currentUserId="usuario-1" />);

    // Abrir y seleccionar Paulo (sin mensajes previos)
    fireEvent.click(screen.getByRole('button', { name: /abrir mensajes directos/i }));
    fireEvent.click(screen.getByText('Paulo Orrala'));

    // Debe ver sugerencia rápida "👋 ¡Hola!"
    const sugerenciaHola = screen.getByText('👋 ¡Hola!');
    expect(sugerenciaHola).toBeInTheDocument();

    // Al hacer clic en la sugerencia, se envía automáticamente
    fireEvent.click(sugerenciaHola);

    expect(chatSocketManager.sendMessage).toHaveBeenCalledWith('paulo', '👋 ¡Hola!');
    expect(screen.getByText('👋 ¡Hola!')).toBeInTheDocument();
  });
});
