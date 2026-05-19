import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDraggablePanelOptions {
  initialPosition: { x: number; y: number };
  onPositionChange: (pos: { x: number; y: number }) => void;
  panelWidth?: number;
  panelHeight?: number;
}

function clampPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number
): { x: number; y: number } {
  const maxX = Math.max(8, window.innerWidth - panelWidth - 8);
  const maxY = Math.max(8, window.innerHeight - panelHeight - 8);
  return {
    x: Math.min(maxX, Math.max(8, x)),
    y: Math.min(maxY, Math.max(8, y)),
  };
}

export function useDraggablePanel({
  initialPosition,
  onPositionChange,
  panelWidth = 352,
  panelHeight = 200,
}: UseDraggablePanelOptions) {
  const [position, setPosition] = useState(initialPosition);
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const positionRef = useRef(position);

  positionRef.current = position;

  useEffect(() => {
    setPosition(initialPosition);
  }, [initialPosition.x, initialPosition.y]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    dragging.current = true;
    dragOffset.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragging.current) return;
      const next = clampPosition(
        e.clientX - dragOffset.current.x,
        e.clientY - dragOffset.current.y,
        panelWidth,
        panelHeight
      );
      setPosition(next);
    };

    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      onPositionChange(positionRef.current);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [onPositionChange, panelWidth, panelHeight]);

  useEffect(() => {
    const onResize = () => {
      setPosition(prev => {
        const clamped = clampPosition(prev.x, prev.y, panelWidth, panelHeight);
        onPositionChange(clamped);
        return clamped;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [onPositionChange, panelWidth, panelHeight]);

  return { position, handlePointerDown, setPosition };
}
