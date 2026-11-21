import { createElement, useCallback, useRef } from 'react';

import classNames from 'classnames';

import { accepts, usePhotoDrop } from 'mastodon/hooks/usePhotoDrop';

interface PhotoDropTargetProps extends React.HTMLAttributes<HTMLElement> {
  // The element it renders as: the field's own wrapper, so the markup and
  // styling around the file input stay as they were.
  as?: 'div' | 'label' | 'span' | 'form';
  disabled?: boolean;
}

// Drag and drop for file inputs that already have their own look (a
// "Choose a cover" button, a photo grid's + tile): wrap them in this and a
// file dropped anywhere on it goes into the input inside, as if it had been
// picked, so the input's own onChange takes it. The drop is held to the
// input's accept list and to one file unless it takes several.
//
// <ComposeShell> is one, so every composer takes a drop anywhere on it. A
// place with no picker of its own yet uses <PhotoDropZone>; one that takes
// the file straight off the drop uses usePhotoDrop.
export const PhotoDropTarget: React.FC<PhotoDropTargetProps> = ({
  as: tag = 'div',
  className,
  disabled = false,
  children,
  ...rest
}) => {
  const ref = useRef<HTMLElement | null>(null);
  const setRef = useCallback((el: HTMLElement | null) => {
    ref.current = el;
  }, []);

  // The first input that takes what was dropped: a composer with a cover
  // and an audio file sends each to its own.
  const handleFiles = useCallback((files: File[]) => {
    const inputs = Array.from(
      ref.current?.querySelectorAll<HTMLInputElement>(
        'input[type="file"]:not(:disabled)',
      ) ?? [],
    );
    for (const input of inputs) {
      const fitting = files.filter((f) => accepts(f, input.accept));
      if (fitting.length === 0) continue;
      const transfer = new DataTransfer();
      (input.multiple ? fitting : fitting.slice(0, 1)).forEach((f) => {
        transfer.items.add(f);
      });
      input.files = transfer.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
  }, []);

  const { dragging, dropProps } = usePhotoDrop({
    onFiles: handleFiles,
    accept: '',
    disabled,
  });

  return createElement(
    tag,
    {
      ...rest,
      ref: setRef,
      className: classNames(className, { 'photo-drop-over': dragging }),
      ...dropProps,
    },
    children,
  );
};
