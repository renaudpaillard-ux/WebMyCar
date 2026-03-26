import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface ModalPosition {
  left: number;
  top: number;
}

interface ModalFrameProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default function ModalFrame({ title, onClose, children, className }: ModalFrameProps) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const dragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const dragSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [position, setPosition] = useState<ModalPosition>({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const modal = modalRef.current;
    if (!modal) {
      return;
    }

    const rect = modal.getBoundingClientRect();
    setPosition({
      left: Math.max((window.innerWidth - rect.width) / 2, 12),
      top: Math.max((window.innerHeight - rect.height) / 2, 12),
    });
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a, label")) {
      return;
    }

    const modal = modalRef.current;
    if (!modal) {
      return;
    }

    const rect = modal.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    dragSizeRef.current = {
      width: rect.width,
      height: rect.height,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const modal = modalRef.current;
    const dragOffset = dragOffsetRef.current;

    if (!modal || !dragOffset) {
      return;
    }

    const size = dragSizeRef.current ?? {
      width: modal.getBoundingClientRect().width,
      height: modal.getBoundingClientRect().height,
    };
    const nextLeft = clamp(
      event.clientX - dragOffset.x,
      12,
      window.innerWidth - size.width - 12,
    );
    const nextTop = clamp(
      event.clientY - dragOffset.y,
      12,
      window.innerHeight - size.height - 12,
    );

    setPosition({
      left: nextLeft,
      top: nextTop,
    });
  }

  function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOffsetRef.current = null;
    dragSizeRef.current = null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={modalRef}
        className={["modal", className].filter(Boolean).join(" ")}
        onClick={(event) => event.stopPropagation()}
        style={{ left: position.left, top: position.top }}
      >
        <div
          className="modal__header"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <h2 className="modal__title">{title}</h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
