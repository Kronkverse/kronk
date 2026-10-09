import { useEffect } from 'react';

// One way into editing a Moment's caption, whoever asks: the Edit item in
// the reactions bar's menu, or an Edit moon on the Ж menu. Both call
// `editMomentCaption(id)`; the open viewer listens and shows its caption
// editor when the id is the Moment on screen. The save itself goes through
// PATCH /api/v1/moments/:id, which keeps the backing Status's text in step
// (editing that Status directly is refused server-side).

const EVENT = 'kronk:moment-edit-caption';

export const editMomentCaption = (momentId: string) => {
  window.dispatchEvent(
    new CustomEvent<{ id: string }>(EVENT, { detail: { id: momentId } }),
  );
};

export const useMomentCaptionEditRequests = (
  onRequest: (momentId: string) => void,
) => {
  useEffect(() => {
    const handler = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      onRequest(id);
    };
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener(EVENT, handler);
    };
  }, [onRequest]);
};
