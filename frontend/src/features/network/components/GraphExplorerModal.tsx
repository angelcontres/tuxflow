import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  Users,
  Route,
  UserCheck,
  UserPlus,
  Play,
  Pause,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  fetchSeguidos,
  fetchSugerenciasGrafo,
  fetchCaminoCorto,
  fetchConexionesComunes,
  followUserInGraph,
  unfollowUserInGraph,
} from '../services/networkApi';
import type { CaminoCorto, ConexionComun } from '../types/network.types';
import { TuxFlowLogo } from '../../../shared/components/TuxFlowLogo';

export interface GraphNode {
  id: string;
  username: string;
  nombre: string;
  avatarUrl?: string;
  tipo: 'yo' | 'seguido' | 'sugerencia';
  seguido: boolean;
  conexionesEnComun?: number;
  seguidosEnComun?: string[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  radio: number;
}

export interface GraphEdge {
  sourceId: string;
  targetId: string;
  tipo: 'sigue' | 'camino';
}

interface GraphExplorerModalProps {
  currentUserId: string;
  currentUsername: string;
  onClose: () => void;
  onNetworkUpdated?: () => void;
  onOpenPerfil?: (usuarioId: string) => void;
}

export const GraphExplorerModal: React.FC<GraphExplorerModalProps> = ({
  currentUserId,
  currentUsername,
  onClose,
  onNetworkUpdated,
  onOpenPerfil,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Datos del Grafo
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<'todos' | 'seguidos' | 'sugerencias'>('todos');

  // Interacción y Estado de Selección
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [physicsRunning, setPhysicsRunning] = useState(true);

  // Cálculos en vivo sobre el grafo
  const [caminoCalculado, setCaminoCalculado] = useState<CaminoCorto | null>(null);
  const [calculandoCamino, setCalculandoCamino] = useState(false);
  const [comunesCalculadas, setComunesCalculadas] = useState<ConexionComun[] | null>(null);
  const [calculandoComunes, setCalculandoComunes] = useState(false);
  const [accionEnVuelo, setAccionEnVuelo] = useState(false);

  // Cámara (Pan y Zoom)
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const [zoomLevel, setZoomLevel] = useState(1);

  // Estado de arrastre (Drag)
  const dragRef = useRef<{
    isDraggingNode: boolean;
    draggedNodeId: string | null;
    isPanning: boolean;
    startX: number;
    startY: number;
    hasMoved: boolean;
  }>({
    isDraggingNode: false,
    draggedNodeId: null,
    isPanning: false,
    startX: 0,
    startY: 0,
    hasMoved: false,
  });

  const animFrameRef = useRef<number | null>(null);

  // Carga de datos del grafo desde Neo4j
  const cargarGrafo = useCallback(async () => {
    setLoading(true);
    try {
      const [seguidos, sugerencias] = await Promise.all([
        fetchSeguidos(currentUserId).catch(() => []),
        fetchSugerenciasGrafo(currentUserId).catch(() => []),
      ]);

      const nodosConstruidos: GraphNode[] = [];
      const aristasConstruidas: GraphEdge[] = [];

      // 1. Nodo central (Tú)
      nodosConstruidos.push({
        id: currentUserId,
        username: currentUsername || 'yo',
        nombre: 'Tú (Usuario Activo)',
        tipo: 'yo',
        seguido: true,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radio: 26,
      });

      // 2. Nodos seguidos (1er salto)
      seguidos.forEach((seg, idx) => {
        const angulo = (idx / Math.max(seguidos.length, 1)) * Math.PI * 2;
        const dist = 140 + (idx % 2) * 30;
        nodosConstruidos.push({
          id: seg.id,
          username: seg.username,
          nombre: seg.nombre || seg.username,
          avatarUrl: seg.avatarUrl,
          tipo: 'seguido',
          seguido: true,
          x: Math.cos(angulo) * dist,
          y: Math.sin(angulo) * dist,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          radio: 20,
        });

        aristasConstruidas.push({
          sourceId: currentUserId,
          targetId: seg.id,
          tipo: 'sigue',
        });
      });

      // 3. Nodos sugerencias (2do salto)
      sugerencias.forEach((sug, idx) => {
        if (!nodosConstruidos.some((n) => n.id === sug.id)) {
          const angulo = (idx / Math.max(sugerencias.length, 1)) * Math.PI * 2 + 0.4;
          const dist = 240 + (idx % 3) * 40;
          nodosConstruidos.push({
            id: sug.id,
            username: sug.username,
            nombre: sug.nombre || sug.username,
            avatarUrl: sug.avatar,
            tipo: 'sugerencia',
            seguido: false,
            conexionesEnComun: sug.conexionesEnComun,
            seguidosEnComun: sug.seguidosEnComun,
            x: Math.cos(angulo) * dist,
            y: Math.sin(angulo) * dist,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            radio: 18,
          });

          // Conectar con el seguidor que actúa de puente en común
          if (sug.seguidosEnComun && sug.seguidosEnComun.length > 0) {
            const puente = seguidos.find((s) =>
              sug.seguidosEnComun.some(
                (p) => p.toLowerCase() === s.username.toLowerCase(),
              ),
            );
            if (puente) {
              aristasConstruidas.push({
                sourceId: puente.id,
                targetId: sug.id,
                tipo: 'sigue',
              });
            }
          }
        }
      });

      setNodes(nodosConstruidos);
      setEdges(aristasConstruidas);
    } catch (err) {
      console.error('Error cargando grafo:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUserId, currentUsername]);

  useEffect(() => {
    cargarGrafo();
  }, [cargarGrafo]);

  // Manejar tecla Escape para cerrar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Simulación física continua (Force-Directed Layout)
  useEffect(() => {
    if (!physicsRunning) return;

    let cancelado = false;

    const tickFisica = () => {
      if (cancelado) return;

      setNodes((prevNodes) => {
        if (prevNodes.length === 0) return prevNodes;

        const next = prevNodes.map((n) => ({ ...n }));
        const kRepulsion = 2200;
        const kResorte = 0.045;
        const longitudReposo = 110;
        const amortiguacion = 0.86;

        // 1. Repulsión entre todos los pares de nodos
        for (let i = 0; i < next.length; i++) {
          for (let j = i + 1; j < next.length; j++) {
            const dx = next[j].x - next[i].x;
            const dy = next[j].y - next[i].y;
            const distSq = dx * dx + dy * dy + 1;
            const dist = Math.sqrt(distSq);

            if (dist < 320) {
              const fuerza = kRepulsion / distSq;
              const fx = (dx / dist) * fuerza;
              const fy = (dy / dist) * fuerza;

              if (next[i].id !== dragRef.current.draggedNodeId && next[i].tipo !== 'yo') {
                next[i].vx -= fx;
                next[i].vy -= fy;
              }
              if (next[j].id !== dragRef.current.draggedNodeId && next[j].tipo !== 'yo') {
                next[j].vx += fx;
                next[j].vy += fy;
              }
            }
          }
        }

        // 2. Atracción elástica en las aristas
        edges.forEach((edge) => {
          const s = next.find((n) => n.id === edge.sourceId);
          const t = next.find((n) => n.id === edge.targetId);
          if (s && t) {
            const dx = t.x - s.x;
            const dy = t.y - s.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const desplazamiento = dist - longitudReposo;
            const fuerza = desplazamiento * kResorte;
            const fx = (dx / dist) * fuerza;
            const fy = (dy / dist) * fuerza;

            if (s.id !== dragRef.current.draggedNodeId && s.tipo !== 'yo') {
              s.vx += fx;
              s.vy += fy;
            }
            if (t.id !== dragRef.current.draggedNodeId && t.tipo !== 'yo') {
              t.vx -= fx;
              t.vy -= fy;
            }
          }
        });

        // 3. Gravedad central suave
        next.forEach((n) => {
          if (n.tipo === 'yo') {
            n.x = 0;
            n.y = 0;
            n.vx = 0;
            n.vy = 0;
            return;
          }
          if (n.id === dragRef.current.draggedNodeId) return;

          n.vx -= n.x * 0.003;
          n.vy -= n.y * 0.003;

          n.vx *= amortiguacion;
          n.vy *= amortiguacion;

          n.x += n.vx;
          n.y += n.vy;
        });

        return next;
      });

      animFrameRef.current = requestAnimationFrame(tickFisica);
    };

    animFrameRef.current = requestAnimationFrame(tickFisica);

    return () => {
      cancelado = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [edges, physicsRunning]);

  // Renderizado en Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const { x: camX, y: camY, zoom } = cameraRef.current;

    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // Fondo y cuadrícula sutil
    const esModoOscuro = document.documentElement.classList.contains('dark');
    ctx.fillStyle = esModoOscuro ? '#121214' : '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Cuadrícula de coordenadas tenue
    ctx.strokeStyle = esModoOscuro ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)';
    ctx.lineWidth = 1;
    const step = 40 * zoom;
    const startX = ((width / 2 + camX * zoom) % step + step) % step;
    const startY = ((height / 2 + camY * zoom) % step + step) % step;

    ctx.beginPath();
    for (let gx = startX; gx < width; gx += step) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
    }
    for (let gy = startY; gy < height; gy += step) {
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
    }
    ctx.stroke();

    // Transformación de Cámara
    ctx.translate(width / 2 + camX * zoom, height / 2 + camY * zoom);
    ctx.scale(zoom, zoom);

    // Identificar nodos en el camino corto para resaltarlos
    const idsEnCamino = new Set(
      caminoCalculado ? caminoCalculado.rutaConexion.map((n) => n.id || n.username) : [],
    );

    // 1. DIBUJAR ARISTAS (ENLACES DE GRAFO)
    edges.forEach((edge) => {
      const s = nodes.find((n) => n.id === edge.sourceId);
      const t = nodes.find((n) => n.id === edge.targetId);
      if (!s || !t) return;

      // Filtrado
      if (filtro === 'seguidos' && (s.tipo === 'sugerencia' || t.tipo === 'sugerencia')) return;
      if (filtro === 'sugerencias' && s.tipo !== 'yo' && t.tipo !== 'sugerencia') return;

      const esEnCamino =
        idsEnCamino.size > 0 &&
        (idsEnCamino.has(s.id) || idsEnCamino.has(s.username)) &&
        (idsEnCamino.has(t.id) || idsEnCamino.has(t.username));

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(t.x, t.y);

      if (esEnCamino) {
        ctx.strokeStyle = '#4F46E5';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#818CF8';
        ctx.shadowBlur = 10;
      } else {
        ctx.strokeStyle = esModoOscuro ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.12)';
        ctx.lineWidth = 1.6;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Flecha indicadora de dirección
      const angle = Math.atan2(t.y - s.y, t.x - s.x);
      const arrowDist = t.radio + 8;
      const arrowX = t.x - Math.cos(angle) * arrowDist;
      const arrowY = t.y - Math.sin(angle) * arrowDist;

      ctx.save();
      ctx.translate(arrowX, arrowY);
      ctx.rotate(angle);
      ctx.fillStyle = esEnCamino ? '#4F46E5' : esModoOscuro ? '#71717A' : '#94A3B8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-7, -4);
      ctx.lineTo(-7, 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 2. DIBUJAR NODOS
    nodes.forEach((node) => {
      if (filtro === 'seguidos' && node.tipo === 'sugerencia') return;
      if (filtro === 'sugerencias' && node.tipo === 'seguido') return;

      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const isEnCamino =
        idsEnCamino.size > 0 && (idsEnCamino.has(node.id) || idsEnCamino.has(node.username));

      // Resplandor / Halo exterior
      if (isSelected || isHovered || isEnCamino || node.tipo === 'yo') {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radio + (isSelected ? 9 : 6), 0, Math.PI * 2);
        ctx.fillStyle = isEnCamino
          ? 'rgba(79, 70, 229, 0.25)'
          : node.tipo === 'yo'
            ? 'rgba(79, 70, 229, 0.2)'
            : node.tipo === 'seguido'
              ? 'rgba(16, 185, 129, 0.2)'
              : 'rgba(245, 158, 11, 0.2)';
        ctx.fill();
      }

      // Círculo principal del nodo
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radio, 0, Math.PI * 2);

      let relleno = '#4F46E5';
      let borde = '#FFFFFF';

      if (node.tipo === 'yo') {
        relleno = '#4F46E5';
        borde = '#818CF8';
      } else if (node.tipo === 'seguido') {
        relleno = '#10B981';
        borde = esModoOscuro ? '#27272A' : '#FFFFFF';
      } else {
        relleno = '#F59E0B';
        borde = esModoOscuro ? '#27272A' : '#FFFFFF';
      }

      ctx.fillStyle = relleno;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = borde;
      ctx.stroke();

      // Letra inicial o etiqueta dentro del nodo
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${Math.round(node.radio * 0.75)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const letra = node.username.charAt(0).toUpperCase();
      ctx.fillText(letra, node.x, node.y);

      // Etiqueta de texto debajo del nodo (@username)
      ctx.font = `600 ${isSelected ? '12px' : '11px'} sans-serif`;
      ctx.fillStyle = esModoOscuro ? '#F4F4F5' : '#0F172A';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`@${node.username}`, node.x, node.y + node.radio + 5);

      // Subtexto de rol
      ctx.font = '10px sans-serif';
      ctx.fillStyle =
        node.tipo === 'yo'
          ? '#818CF8'
          : node.tipo === 'seguido'
            ? '#10B981'
            : '#F59E0B';
      const badge =
        node.tipo === 'yo' ? 'Tú' : node.tipo === 'seguido' ? 'Siguiendo' : 'Sugerencia';
      ctx.fillText(badge, node.x, node.y + node.radio + 19);
    });

    ctx.restore();
  }, [nodes, edges, filtro, selectedNode, hoveredNode, caminoCalculado]);

  // Reset de cálculos al cambiar de nodo seleccionado
  useEffect(() => {
    setCaminoCalculado(null);
    setComunesCalculadas(null);
  }, [selectedNode?.id]);

  // Ajustar resolución del canvas al contenedor real en el navegador
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.round(rect.width);
        canvas.height = Math.round(rect.height);
      }
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Manejo de eventos de ratón en el Canvas (Pan, Zoom, Drag y Clic)
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, rawX: e.clientX, rawY: e.clientY };
    const rect = canvas.getBoundingClientRect();

    // Escala del buffer interno del canvas respecto al tamaño real renderizado en el DOM
    const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
    const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    const { x: camX, y: camY, zoom } = cameraRef.current;
    const worldX = (mouseX - canvas.width / 2) / zoom - camX;
    const worldY = (mouseY - canvas.height / 2) / zoom - camY;

    return { x: worldX, y: worldY, rawX: e.clientX, rawY: e.clientY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, rawX, rawY } = getCanvasCoords(e);
    dragRef.current.startX = rawX;
    dragRef.current.startY = rawY;
    dragRef.current.hasMoved = false;

    // Detectar si se hizo clic en un nodo (el más cercano dentro de su radio de captura)
    let closestNode: GraphNode | null = null;
    let minDist = Infinity;

    nodes.forEach((n) => {
      if (filtro === 'seguidos' && n.tipo === 'sugerencia') return;
      if (filtro === 'sugerencias' && n.tipo === 'seguido') return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d <= n.radio + 12 && d < minDist) {
        minDist = d;
        closestNode = n;
      }
    });

    if (closestNode) {
      dragRef.current.isDraggingNode = true;
      dragRef.current.draggedNodeId = (closestNode as GraphNode).id;
      dragRef.current.isPanning = false;
      setSelectedNode(closestNode);
    } else {
      dragRef.current.isDraggingNode = false;
      dragRef.current.draggedNodeId = null;
      dragRef.current.isPanning = true;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y, rawX, rawY } = getCanvasCoords(e);
    const distMoved = Math.hypot(rawX - dragRef.current.startX, rawY - dragRef.current.startY);
    if (distMoved > 4) {
      dragRef.current.hasMoved = true;
    }

    if (dragRef.current.isDraggingNode && dragRef.current.draggedNodeId) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === dragRef.current.draggedNodeId ? { ...n, x, y, vx: 0, vy: 0 } : n,
        ),
      );
    } else if (dragRef.current.isPanning) {
      const dx = (rawX - dragRef.current.startX) / cameraRef.current.zoom;
      const dy = (rawY - dragRef.current.startY) / cameraRef.current.zoom;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      dragRef.current.startX = rawX;
      dragRef.current.startY = rawY;
    } else {
      // Detección de Hover
      let hover: GraphNode | null = null;
      let minHoverDist = Infinity;
      nodes.forEach((n) => {
        if (filtro === 'seguidos' && n.tipo === 'sugerencia') return;
        if (filtro === 'sugerencias' && n.tipo === 'seguido') return;
        const d = Math.hypot(n.x - x, n.y - y);
        if (d <= n.radio + 12 && d < minHoverDist) {
          minHoverDist = d;
          hover = n;
        }
      });
      setHoveredNode(hover);
    }
  };

  const handleMouseUp = () => {
    dragRef.current.isDraggingNode = false;
    dragRef.current.draggedNodeId = null;
    dragRef.current.isPanning = false;
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Si fue un arrastre de cámara, no procesar como selección
    if (dragRef.current.hasMoved) return;

    const { x, y } = getCanvasCoords(e);
    let closestNode: GraphNode | null = null;
    let minDist = Infinity;

    nodes.forEach((n) => {
      if (filtro === 'seguidos' && n.tipo === 'sugerencia') return;
      if (filtro === 'sugerencias' && n.tipo === 'seguido') return;
      const d = Math.hypot(n.x - x, n.y - y);
      if (d <= n.radio + 12 && d < minDist) {
        minDist = d;
        closestNode = n;
      }
    });

    if (closestNode) {
      setSelectedNode(closestNode);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(Math.max(cameraRef.current.zoom * factor, 0.4), 2.5);
    cameraRef.current.zoom = newZoom;
    setZoomLevel(Number(newZoom.toFixed(2)));
  };

  const handleZoom = (inOut: 'in' | 'out') => {
    const factor = inOut === 'in' ? 1.25 : 0.8;
    const newZoom = Math.min(Math.max(cameraRef.current.zoom * factor, 0.4), 2.5);
    cameraRef.current.zoom = newZoom;
    setZoomLevel(Number(newZoom.toFixed(2)));
  };

  const handleResetCamera = () => {
    cameraRef.current = { x: 0, y: 0, zoom: 1 };
    setZoomLevel(1);
  };

  // Cálculo de camino más corto con Neo4j
  const handleCalcularCamino = async () => {
    if (!selectedNode || selectedNode.tipo === 'yo') return;
    setCalculandoCamino(true);
    setCaminoCalculado(null);
    try {
      const res = await fetchCaminoCorto(currentUserId, selectedNode.id);
      setCaminoCalculado(res);
    } catch (err) {
      console.error('Error calculando camino más corto:', err);
    } finally {
      setCalculandoCamino(false);
    }
  };

  // Cálculo de seguidos en común
  const handleCalcularComunes = async () => {
    if (!selectedNode || selectedNode.tipo === 'yo') return;
    setCalculandoComunes(true);
    setComunesCalculadas(null);
    try {
      const res = await fetchConexionesComunes(currentUserId, selectedNode.id);
      setComunesCalculadas(res);
    } catch (err) {
      console.error('Error calculando conexiones comunes:', err);
    } finally {
      setCalculandoComunes(false);
    }
  };

  // Acción de seguir / dejar de seguir en tiempo real
  const handleToggleFollow = async (node: GraphNode) => {
    setAccionEnVuelo(true);
    try {
      if (node.seguido) {
        await unfollowUserInGraph(currentUserId, node.id);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, seguido: false, tipo: 'sugerencia' } : n,
          ),
        );
        setSelectedNode((prev) =>
          prev?.id === node.id ? { ...prev, seguido: false, tipo: 'sugerencia' } : prev,
        );
      } else {
        await followUserInGraph(currentUserId, node.id);
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, seguido: true, tipo: 'seguido' } : n,
          ),
        );
        setSelectedNode((prev) =>
          prev?.id === node.id ? { ...prev, seguido: true, tipo: 'seguido' } : prev,
        );
      }
      onNetworkUpdated?.();
    } catch (err) {
      console.error('Error modificando seguimiento en grafo:', err);
    } finally {
      setAccionEnVuelo(false);
    }
  };

  // Estadísticas del Grafo
  const totalSeguidos = nodes.filter((n) => n.tipo === 'seguido').length;
  const totalSugerencias = nodes.filter((n) => n.tipo === 'sugerencia').length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-grafo"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-6xl h-[88vh] bg-white dark:bg-[#18181B] rounded-2xl shadow-2xl border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden">
        {/* HEADER DEL MODAL */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <TuxFlowLogo className="w-8 h-8 rounded-lg shadow-xs" size={32} />
            <div>
              <div className="flex items-center gap-2">
                <h2 id="titulo-grafo" className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  Explorador de Grafo Social
                </h2>
                <span className="text-[10px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  Neo4j Live
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                Visualización interactiva con física de fuerzas de tus conexiones y sugerencias
              </p>
            </div>
          </div>

          {/* Filtros Rápidos */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-100 dark:bg-[#27272A] p-1 rounded-xl border border-slate-200 dark:border-zinc-700">
            <button
              type="button"
              onClick={() => setFiltro('todos')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filtro === 'todos'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Todos ({nodes.length})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('seguidos')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filtro === 'seguidos'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Seguidos ({totalSeguidos})
            </button>
            <button
              type="button"
              onClick={() => setFiltro('sugerencias')}
              className={`text-xs px-3 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                filtro === 'sugerencias'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100'
              }`}
            >
              Sugerencias ({totalSugerencias})
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar explorador de grafo"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENEDOR PRINCIPAL: LIENZO CANVAS + PANEL LATERAL */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* LIENZO DE GRAFO CON CANVAS */}
          <div className="flex-1 relative overflow-hidden bg-slate-50 dark:bg-[#121214]">
            <canvas
              ref={canvasRef}
              width={1200}
              height={700}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={handleClick}
              onWheel={handleWheel}
              className={`w-full h-full block transition-colors ${
                hoveredNode
                  ? 'cursor-pointer'
                  : dragRef.current.isPanning
                    ? 'cursor-grabbing'
                    : 'cursor-grab'
              }`}
            />

            {/* CONTROLES FLOTANTES EN EL LIENZO */}
            <div className="absolute bottom-4 left-4 flex items-center gap-1.5 bg-white/90 dark:bg-[#27272A]/90 backdrop-blur-sm p-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-lg z-10">
              <button
                type="button"
                onClick={() => handleZoom('in')}
                title="Acercar (+)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom('out')}
                title="Alejar (-)"
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetCamera}
                title="Centrar vista"
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-200 dark:bg-zinc-700 mx-0.5" />
              <button
                type="button"
                onClick={() => setPhysicsRunning((p) => !p)}
                title={physicsRunning ? 'Pausar simulación física' : 'Reanudar física'}
                className="p-1.5 rounded-lg text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                {physicsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <span className="text-[10px] text-slate-400 font-mono px-1">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>

            {/* LEYENDA FLOTANTE */}
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-[#27272A]/90 backdrop-blur-sm px-3 py-2 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-md text-xs space-y-1.5 z-10 pointer-events-none select-none">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-indigo-600 ring-2 ring-indigo-400/50" />
                <span className="text-slate-700 dark:text-zinc-300 font-medium">Tú (Centro)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-slate-700 dark:text-zinc-300 font-medium">Seguidos (1er salto)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span className="text-slate-700 dark:text-zinc-300 font-medium">Sugerencias (2do salto)</span>
              </div>
            </div>

            {/* AVISO DE CARGA */}
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/60 z-20">
                <div className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-[#18181B] rounded-xl shadow-lg border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-800 dark:text-zinc-200">
                  <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                  <span>Consultando grafo en Neo4j...</span>
                </div>
              </div>
            )}
          </div>

          {/* PANEL LATERAL DE DETALLES DEL NODO SELECCIONADO */}
          <div className="w-80 sm:w-88 border-l border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181B] flex flex-col justify-between shrink-0 overflow-y-auto">
            {selectedNode ? (
              <div className="p-5 space-y-5">
                {/* Perfil del Nodo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-base text-white shadow-md ${
                        selectedNode.tipo === 'yo'
                          ? 'bg-indigo-600 ring-2 ring-indigo-400'
                          : selectedNode.tipo === 'seguido'
                            ? 'bg-emerald-500 ring-2 ring-emerald-300'
                            : 'bg-amber-500 ring-2 ring-amber-300'
                      }`}
                    >
                      {selectedNode.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                        {selectedNode.nombre}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                        @{selectedNode.username}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      selectedNode.tipo === 'yo'
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800'
                        : selectedNode.tipo === 'seguido'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                    }`}
                  >
                    {selectedNode.tipo === 'yo'
                      ? 'Tú'
                      : selectedNode.tipo === 'seguido'
                        ? 'Siguiendo'
                        : 'Sugerencia'}
                  </span>
                </div>

                {/* Acciones principales de Red */}
                {selectedNode.tipo !== 'yo' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={accionEnVuelo}
                      onClick={() => handleToggleFollow(selectedNode)}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                        selectedNode.seguido
                          ? 'bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-zinc-800 dark:hover:bg-rose-950/40 text-slate-700 dark:text-zinc-200 border border-slate-200 dark:border-zinc-700'
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {selectedNode.seguido ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          Siguiendo
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          Seguir en Grafo
                        </>
                      )}
                    </button>

                    {onOpenPerfil && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPerfil(selectedNode.id);
                          onClose();
                        }}
                        title="Ver perfil completo"
                        className="p-2 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-600 dark:text-zinc-300 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* HERRAMIENTA 1: CALCULAR CAMINO MÁS CORTO (6 GRADOS) */}
                {selectedNode.tipo !== 'yo' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#222226] border border-slate-200 dark:border-zinc-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Route className="w-3.5 h-3.5 text-indigo-500" />
                        Grados de Separación
                      </span>
                      <button
                        type="button"
                        disabled={calculandoCamino}
                        onClick={handleCalcularCamino}
                        className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {calculandoCamino ? 'Calculando...' : 'Calcular Camino'}
                      </button>
                    </div>

                    {caminoCalculado && (
                      <div className="text-xs space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                        {caminoCalculado.rutaConexion.length === 0 ? (
                          <p className="text-slate-500 dark:text-zinc-400 text-[11px]">
                            No hay conexión directa dentro de los 6 grados.
                          </p>
                        ) : (
                          <>
                            <p className="font-semibold text-indigo-600 dark:text-indigo-400">
                              {caminoCalculado.saltosTotales}{' '}
                              {caminoCalculado.saltosTotales === 1 ? 'salto' : 'saltos'} de distancia
                            </p>
                            <div className="flex flex-wrap items-center gap-1 text-[11px] font-mono">
                              {caminoCalculado.rutaConexion.map((paso, idx) => (
                                <React.Fragment key={idx}>
                                  {idx > 0 && <span className="text-slate-400">&rarr;</span>}
                                  <span className="px-1.5 py-0.5 rounded bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 font-bold">
                                    @{paso.username}
                                  </span>
                                </React.Fragment>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* HERRAMIENTA 2: CONEXIONES EN COMÚN */}
                {selectedNode.tipo !== 'yo' && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#222226] border border-slate-200 dark:border-zinc-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-emerald-500" />
                        Conexiones en Común
                      </span>
                      <button
                        type="button"
                        disabled={calculandoComunes}
                        onClick={handleCalcularComunes}
                        className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
                      >
                        {calculandoComunes ? 'Buscando...' : 'Consultar'}
                      </button>
                    </div>

                    {comunesCalculadas && (
                      <div className="text-xs space-y-1.5 pt-1 border-t border-slate-200/60 dark:border-zinc-700/60">
                        {comunesCalculadas.length === 0 ? (
                          <p className="text-slate-500 dark:text-zinc-400 text-[11px]">
                            No comparten contactos en común actualmente.
                          </p>
                        ) : (
                          <div className="space-y-1">
                            <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {comunesCalculadas.length} amigos en común:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {comunesCalculadas.map((c) => (
                                <span
                                  key={c.id}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700"
                                >
                                  @{c.username}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center text-slate-400 dark:text-zinc-500 space-y-2">
                <Info className="w-8 h-8 text-slate-300 dark:text-zinc-600" />
                <h4 className="font-semibold text-xs text-slate-700 dark:text-zinc-300">
                  Selecciona un Nodo
                </h4>
                <p className="text-[11px] leading-relaxed">
                  Haz clic en cualquier persona para inspeccionar sus grados de separación, conexiones
                  en común y seguirlo en tiempo real.
                </p>
              </div>
            )}

            {/* PIE DEL PANEL: RESUMEN DE TOPOLOGÍA */}
            <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#1F1F23] text-xs text-slate-500 dark:text-zinc-400 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{nodes.length}</span>{' '}
                nodos
              </div>
              <div>
                <span className="font-bold text-slate-800 dark:text-zinc-200">{edges.length}</span>{' '}
                aristas
              </div>
              <div className="text-[10px] bg-slate-200/80 dark:bg-zinc-800 px-2 py-0.5 rounded font-mono">
                Neo4j Graph
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
