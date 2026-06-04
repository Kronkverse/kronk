import { useCallback, useEffect, useRef } from 'react';

interface Props {
  coverUrl: string;
  offsetY: number; // 0–100
  onChange: (y: number) => void;
  disabled?: boolean;
}

export const CoverPositionEditor: React.FC<Props> = ({
  coverUrl,
  offsetY,
  onChange,
  disabled,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const getY = useCallback((clientY: number) => {
    const el = containerRef.current;
    if (!el) return 50;
    const rect = el.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100)));
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      draggingRef.current = true;
      onChange(getY(e.clientY));
    },
    [disabled, onChange, getY],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (disabled) return;
      draggingRef.current = true;
      const touch = e.touches[0];
      if (touch) onChange(getY(touch.clientY));
    },
    [disabled, onChange, getY],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      onChange(getY(e.clientY));
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (!draggingRef.current) return;
      const touch = e.touches[0];
      if (touch) onChange(getY(touch.clientY));
    };
    const handleUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [onChange, getY]);

  return (
    <div className='booth-cover-editor'>
      <div
        ref={containerRef}
        className={`booth-cover-editor__frame${disabled ? ' booth-cover-editor__frame--disabled' : ''}`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <img
          src={coverUrl}
          alt=''
          className='booth-cover-editor__img'
          style={{ objectPosition: `50% ${offsetY}%` }}
          draggable={false}
        />
        <div
          className='booth-cover-editor__handle'
          style={{ top: `${offsetY}%` }}
        />
        <div className='booth-cover-editor__hint'>Drag to reposition</div>
      </div>
    </div>
  );
};
