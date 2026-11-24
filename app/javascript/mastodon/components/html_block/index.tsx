import { useCallback } from 'react';

import type { OnElementHandler } from '@/mastodon/utils/html';
import { polymorphicForwardRef } from '@/types/polymorphic';

import type { EmojiHTMLProps } from '../emoji/html';
import { EmojiHTML } from '../emoji/html';
import { useElementHandledLink } from '../status/handled_link';

export const HTMLBlock = polymorphicForwardRef<
  'div',
  EmojiHTMLProps & Parameters<typeof useElementHandledLink>[0]
>(({ onElement: onParentElement, hrefToMention, ...props }) => {
  const { onElement: onLinkElement } = useElementHandledLink({
    hrefToMention,
  });
  const onElement: OnElementHandler = useCallback(
    (...args) => onParentElement?.(...args) ?? onLinkElement(...args),
    [onLinkElement, onParentElement],
  );
  return <EmojiHTML {...props} onElement={onElement} />;
});
