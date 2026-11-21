import type { DragEvent } from 'react';
import { useCallback, useMemo, useState } from 'react';

interface PhotoDropOptions {
  // The dropped files, already filtered to `accept`. Never empty.
  onFiles: (files: File[]) => void;
  // Held to the same accept list as the file input it sits beside, since a
  // drag can carry anything (a text file, a link).
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
}

// Does a file match an accept list like 'image/*,video/mp4,.heic'? An
// empty list, like an input without one, takes anything.
export const accepts = (file: File, accept: string): boolean =>
  accept.trim() === '' ||
  accept
    .split(',')
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)
    .some((a) => {
      if (a.startsWith('.')) return file.name.toLowerCase().endsWith(a);
      if (a.endsWith('/*')) return file.type.startsWith(a.slice(0, -1));
      return file.type === a;
    });

// Drag and drop for anything that takes a photo (docs/design.md, Compose +
// confirmation). Spread `dropProps` on the element photos are dropped on;
// `dragging` is true while files are held over it, for its own highlight.
// <PhotoDropZone> is this plus the box; an avatar, a cover or a message
// box that already has its own look uses the hook directly.
//
// `data-photo-drop` keeps the page-wide "drop to post" overlay out of the
// way while the drag is over this element, and a drop here is marked
// handled (preventDefault), so the window-level drop in
// features/ui/index.jsx doesn't also upload the files into the post box.
export const usePhotoDrop = ({
  onFiles,
  accept = 'image/*',
  multiple = true,
  disabled = false,
}: PhotoDropOptions) => {
  const [dragging, setDragging] = useState(false);

  const take = useCallback(
    (list: FileList | null | undefined) => {
      const files = Array.from(list ?? []).filter((f) => accepts(f, accept));
      const picked = multiple ? files : files.slice(0, 1);
      if (picked.length > 0) onFiles(picked);
    },
    [accept, multiple, onFiles],
  );

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (!disabled) setDragging(true);
    },
    [disabled],
  );
  const handleDragLeave = useCallback((e: DragEvent) => {
    // Moving onto a child fires a leave on the parent; only a move out of
    // the element ends the highlight.
    if (
      e.relatedTarget instanceof Node &&
      e.currentTarget.contains(e.relatedTarget)
    )
      return;
    setDragging(false);
  }, []);
  const handleDrop = useCallback(
    (e: DragEvent) => {
      // A drop target inside this one (a drop zone in a composer) has
      // taken it already.
      if (e.defaultPrevented) {
        setDragging(false);
        return;
      }
      e.preventDefault();
      setDragging(false);
      if (!disabled) take(e.dataTransfer.files);
    },
    [disabled, take],
  );

  const dropProps = useMemo(
    () => ({
      'data-photo-drop': true,
      onDragEnter: handleDragOver,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    }),
    [handleDragOver, handleDragLeave, handleDrop],
  );

  return { dragging, dropProps, take };
};
