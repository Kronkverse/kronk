// The composer hero for a photo with a film look: the graded canvas, or
// the original photo while it renders (or if WebGL isn't available,
// the look can't bake in at upload either and posting reports the error).

import { useEffect, useRef, useState } from 'react';

import { renderFilmPreview } from './film';

export const FilmPreview: React.FC<{
  file: File;
  fallbackUrl: string;
  look: string;
  className?: string;
}> = ({ file, fallbackUrl, look, className }) => {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    renderFilmPreview(file, look)
      .then((canvas) => {
        if (cancelled || !host.current) return;
        canvas.className = className ?? '';
        host.current.replaceChildren(canvas);
        setReady(true);
      })
      .catch((err: unknown) => {
        console.warn('film preview failed', err);
      });
    return () => {
      cancelled = true;
    };
  }, [file, look, className]);

  return (
    <>
      {!ready && (
        <img className={className} src={fallbackUrl} alt='' aria-hidden />
      )}
      <div ref={host} className='moments-composer__film-canvas' aria-hidden />
    </>
  );
};
