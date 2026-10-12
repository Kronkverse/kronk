import { useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

// The bottom sheet both Kuestions sheets sit in (answering, and the answers
// revealed afterwards): backdrop, the sheet itself, the grab bar.
//
// It renders into <body>. The panels it is opened from live inside the
// Frame's turning drum, and a `position: fixed` box inside a transformed
// ancestor is positioned against that ancestor, not the screen: on a phone
// the sheet sat inside the Stage, cut off above the tab bar, and a drag on
// it scrolled the page behind (Kommons proposal "Scroll glitch on answers
// in Kuestions", 2026-10-12).
//
// Dragging the sheet down from its top closes it, as the grab bar promises.

// How far down, in px, a drag has to travel to close the sheet.
const CLOSE_DISTANCE = 90;

interface Props {
  // What tapping the backdrop, or dragging the sheet down, does.
  onClose: () => void;
  closeLabel: string;
  children: React.ReactNode;
}

export const SheetFrame: React.FC<Props> = ({
  onClose,
  closeLabel,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return undefined;

    let startY: number | null = null;
    let dy = 0;

    const start = (e: TouchEvent) => {
      // Only a drag that begins with the sheet scrolled to its top can
      // close it; anywhere else the finger is scrolling the answers.
      const touch = e.touches[0];
      startY = sheet.scrollTop <= 0 && touch ? touch.clientY : null;
      dy = 0;
    };
    const move = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (startY === null || !touch) return;
      dy = touch.clientY - startY;
      if (dy <= 0) {
        // Upwards: an ordinary scroll after all.
        sheet.style.transform = '';
        return;
      }
      sheet.style.transition = 'none';
      sheet.style.transform = `translateY(${dy}px)`;
      if (e.cancelable) e.preventDefault();
    };
    const end = () => {
      if (startY === null) return;
      startY = null;
      sheet.style.transition = '';
      sheet.style.transform = '';
      if (dy > CLOSE_DISTANCE) onCloseRef.current();
      dy = 0;
    };

    sheet.addEventListener('touchstart', start, { passive: true });
    sheet.addEventListener('touchmove', move, { passive: false });
    sheet.addEventListener('touchend', end);
    sheet.addEventListener('touchcancel', end);
    return () => {
      sheet.removeEventListener('touchstart', start);
      sheet.removeEventListener('touchmove', move);
      sheet.removeEventListener('touchend', end);
      sheet.removeEventListener('touchcancel', end);
    };
  }, []);

  const handleBackdrop = useCallback(() => {
    onCloseRef.current();
  }, []);

  return createPortal(
    <div className='kuestions-sheet-wrap' role='dialog' aria-modal>
      <button
        type='button'
        className='kuestions-sheet-backdrop'
        aria-label={closeLabel}
        onClick={handleBackdrop}
      />
      <div className='kuestions-sheet' ref={sheetRef}>
        <div className='kuestions-sheet__grab' aria-hidden />
        {children}
      </div>
    </div>,
    document.body,
  );
};
